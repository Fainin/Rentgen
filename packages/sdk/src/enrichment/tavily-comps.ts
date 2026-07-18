/**
 * Real EnrichmentAdapter: Tavily search (resale + rental comps) → OpenAI reconcile.
 *
 * Grounding is the product. The pipeline is strictly one-directional: Tavily results in,
 * OpenAI reconciles *only* those results, sources are the actual Tavily result URLs. The
 * reconcile prompt forbids OpenAI from pricing off its own training-data priors.
 *
 * Internal shapes (Tavily response, reconcile payload) are private to this file — the only
 * thing that crosses the seam is the frozen `EnrichmentAdapter` interface.
 */

import type { EnrichmentAdapter } from '../adapters/types.js';
import type { DetectedObject, EnrichedItem, PriceRange, Source } from '../types.js';

const TAVILY_SEARCH_URL = 'https://api.tavily.com/search';
const OPENAI_CHAT_URL = 'https://api.openai.com/v1/chat/completions';
const OPENAI_MODEL = 'gpt-4o-mini';

const TAVILY_TIMEOUT_MS = 15_000;
const OPENAI_TIMEOUT_MS = 30_000;
const MAX_TAVILY_RESULTS = 6;
const MAX_SNIPPET_CHARS = 500;
const MAX_FALLBACK_SOURCES = 3;

const MAX_PRICE_EUR = 1_000_000;
/** Rental-from-resale heuristic band when rental comps are empty/unusable (R8): 1.5–3%/day. */
const RENTAL_BAND_MIN_PCT = 0.015;
const RENTAL_BAND_MAX_PCT = 0.03;
/**
 * Sanity ceiling on reconciled rent/day vs. resale value: a rent midpoint above 10%/day of
 * the resale midpoint is a sign the rental comps matched a different product class entirely
 * (e.g. a "notebook" query surfacing laptop-rental sites) rather than a real premium-rental
 * item. Past this, we don't trust the rental comps and fall back to the derived band.
 */
const RENT_SANITY_MAX_PCT = 0.1;

// ---------------------------------------------------------------------------------------
// Tavily
// ---------------------------------------------------------------------------------------

interface TavilyResult {
  readonly title: string;
  readonly url: string;
  readonly content: string;
}

interface TavilyResponse {
  readonly results?: readonly TavilyResult[];
}

function buildResaleQuery(object: DetectedObject): string {
  // Category is included as a disambiguator — short product names (e.g. "Sony a7 III") can
  // otherwise collide with unrelated listings (e.g. "Audi A7" car parts) on eBay/Kleinanzeigen.
  // "OR marketplace" keeps the net wide beyond site:-restricted SERPs, which sometimes scrape
  // as title-only listings with no price text in the extracted content.
  return `"${object.name}" ${object.category} ${object.condition} used price EUR site:ebay.de OR site:kleinanzeigen.de OR marketplace`;
}

function buildRentalQuery(object: DetectedObject): string {
  return `"${object.name}" rent per day OR daily rental price EUR`;
}

/**
 * Transport swap point (design §9 CORS risk). If direct browser calls to Tavily are ever
 * blocked, only this function's fetch target/headers change — nothing else in the file
 * (or outside it) needs to move. Confirmed working via direct browser fetch (hour-1 smoke
 * test, R10): OPTIONS preflight + POST both succeed from a Vite dev origin.
 */
async function search(query: string, apiKey: string): Promise<readonly TavilyResult[]> {
  const response = await fetch(TAVILY_SEARCH_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      query,
      max_results: MAX_TAVILY_RESULTS,
      include_answer: false,
      // 'advanced' extracts fuller page content — cheap SERP scrapes often omit price text
      // that's rendered client-side; still well within the ~8s budget.
      search_depth: 'advanced',
    }),
    signal: AbortSignal.timeout(TAVILY_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`Tavily search failed (${response.status} ${response.statusText}): ${await safeText(response)}`);
  }

  const data = (await response.json()) as TavilyResponse;
  return data.results ?? [];
}

async function safeText(response: Response): Promise<string> {
  try {
    return await response.text();
  } catch {
    return '<no response body>';
  }
}

// ---------------------------------------------------------------------------------------
// OpenAI reconcile
// ---------------------------------------------------------------------------------------

interface ReconcileRange {
  readonly min: number;
  readonly max: number;
}

interface ReconcilePayload {
  readonly resale: ReconcileRange;
  readonly rentPerDay: ReconcileRange;
  readonly resaleSourceUrls: readonly string[];
  readonly rentalSourceUrls: readonly string[];
}

/** Thrown for malformed/unusable OpenAI output — the one case reconcileWithRetry retries. */
class ReconcileParseError extends Error {}

const RECONCILE_JSON_SCHEMA = {
  name: 'price_reconcile',
  strict: true,
  schema: {
    type: 'object',
    properties: {
      resale: {
        type: 'object',
        properties: { min: { type: 'number' }, max: { type: 'number' } },
        required: ['min', 'max'],
        additionalProperties: false,
      },
      rentPerDay: {
        type: 'object',
        properties: { min: { type: 'number' }, max: { type: 'number' } },
        required: ['min', 'max'],
        additionalProperties: false,
      },
      resaleSourceUrls: { type: 'array', items: { type: 'string' } },
      rentalSourceUrls: { type: 'array', items: { type: 'string' } },
    },
    required: ['resale', 'rentPerDay', 'resaleSourceUrls', 'rentalSourceUrls'],
    additionalProperties: false,
  },
} as const;

const SYSTEM_PROMPT = [
  "You are a pricing reconciler for a used-goods resale/rental marketplace.",
  'You are given raw web search results (title, url, snippet) for one item\'s RESALE',
  'listings and, separately, its RENTAL listings. Extract only the price signals that are',
  'actually present in the provided snippets. You have no other knowledge of this specific',
  'item\'s market price — you must NOT use outside knowledge, training data, or general',
  'priors to invent or adjust a number. A comp counts as a valid resale signal whenever a',
  'snippet states an explicit price for a used/second-hand unit of this exact item — this',
  'includes "buy used from X", classifieds/forum asking or sold prices, and marketplace',
  'listings, even if the page also lists a separate brand-new price; in that case use only',
  'the used price, not the new one. Ignore comps that are clearly for a different',
  'model/product, broken/parts-only listings, or that give ONLY a brand-new/unopened retail',
  'price with no used price anywhere on the page.',
  'If, after that, the resale comps still do not support a usable price, return',
  '{"min":0,"max":0} for resale. If the rental comps do not support a usable price, return',
  '{"min":0,"max":0} for rentPerDay — do not estimate a rental price yourself under any',
  'circumstance.',
  'Return the exact URLs (verbatim, copied from the provided list) of the comps you actually',
  'relied on for each band in resaleSourceUrls / rentalSourceUrls. Respond with JSON only,',
  'matching the given schema.',
].join(' ');

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

function formatComps(comps: readonly TavilyResult[]): string {
  if (comps.length === 0) return '(no results)';
  return comps
    .map((c, i) => `${i + 1}. ${c.title}\n   URL: ${c.url}\n   Snippet: ${truncate(c.content, MAX_SNIPPET_CHARS)}`)
    .join('\n');
}

function buildReconcileUserContent(
  object: DetectedObject,
  resaleComps: readonly TavilyResult[],
  rentalComps: readonly TavilyResult[],
): string {
  return [
    `Item: "${object.name}" (category: ${object.category}, condition: ${object.condition})`,
    '',
    'RESALE comps:',
    formatComps(resaleComps),
    '',
    'RENTAL comps:',
    formatComps(rentalComps),
  ].join('\n');
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isReconcileRange(value: unknown): value is ReconcileRange {
  return isPlainRecord(value) && typeof value.min === 'number' && typeof value.max === 'number';
}

function isStringArray(value: unknown): value is readonly string[] {
  return Array.isArray(value) && value.every((v) => typeof v === 'string');
}

/** Defensive shape check — response_format should guarantee this, but never trust blindly (R7). */
function parseReconcilePayload(raw: string): ReconcilePayload {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch (error) {
    throw new ReconcileParseError(`OpenAI reconcile returned non-JSON content: ${messageOf(error)}`);
  }
  if (
    !isPlainRecord(json) ||
    !isReconcileRange(json.resale) ||
    !isReconcileRange(json.rentPerDay) ||
    !isStringArray(json.resaleSourceUrls) ||
    !isStringArray(json.rentalSourceUrls)
  ) {
    throw new ReconcileParseError('OpenAI reconcile JSON did not match the expected schema.');
  }
  return {
    resale: json.resale,
    rentPerDay: json.rentPerDay,
    resaleSourceUrls: json.resaleSourceUrls,
    rentalSourceUrls: json.rentalSourceUrls,
  };
}

async function reconcile(
  object: DetectedObject,
  resaleComps: readonly TavilyResult[],
  rentalComps: readonly TavilyResult[],
  apiKey: string,
  nudgeJsonOnly: boolean,
): Promise<ReconcilePayload> {
  const response = await fetch(OPENAI_CHAT_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      temperature: 0.1,
      messages: [
        { role: 'system', content: nudgeJsonOnly ? `${SYSTEM_PROMPT} Respond with JSON only, no prose.` : SYSTEM_PROMPT },
        { role: 'user', content: buildReconcileUserContent(object, resaleComps, rentalComps) },
      ],
      response_format: { type: 'json_schema', json_schema: RECONCILE_JSON_SCHEMA },
    }),
    signal: AbortSignal.timeout(OPENAI_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`OpenAI reconcile failed (${response.status} ${response.statusText}): ${await safeText(response)}`);
  }

  const data = (await response.json()) as {
    readonly choices?: ReadonlyArray<{ readonly message?: { readonly content?: string | null; readonly refusal?: string } }>;
  };
  const message = data.choices?.[0]?.message;
  if (message?.refusal) {
    throw new ReconcileParseError(`OpenAI reconcile refused: ${message.refusal}`);
  }
  if (typeof message?.content !== 'string') {
    throw new ReconcileParseError('OpenAI reconcile returned no content.');
  }
  return parseReconcilePayload(message.content);
}

/** One retry with a "JSON only" nudge on malformed output, then throw (R7). */
async function reconcileWithRetry(
  object: DetectedObject,
  resaleComps: readonly TavilyResult[],
  rentalComps: readonly TavilyResult[],
  apiKey: string,
): Promise<ReconcilePayload> {
  try {
    return await reconcile(object, resaleComps, rentalComps, apiKey, false);
  } catch (error) {
    if (!(error instanceof ReconcileParseError)) throw error; // hard API failure — no retry
    try {
      return await reconcile(object, resaleComps, rentalComps, apiKey, true);
    } catch (retryError) {
      throw new Error(`OpenAI reconcile: malformed JSON for "${object.name}" after retry (${messageOf(retryError)})`);
    }
  }
}

// ---------------------------------------------------------------------------------------
// Validation / clamping (ported from krempel/server/pricing.ts's sanitizePrices pattern)
// ---------------------------------------------------------------------------------------

function finite(n: number, fallback: number): number {
  return Number.isFinite(n) ? n : fallback;
}

function clampRange(min: number, max: number, currency: string): PriceRange {
  let lo = finite(min, 0);
  let hi = finite(max, 0);
  if (lo > hi) [lo, hi] = [hi, lo];
  lo = Math.min(MAX_PRICE_EUR, Math.max(1, Math.round(lo)));
  hi = Math.min(MAX_PRICE_EUR, Math.max(1, Math.round(hi)));
  if (hi < lo) hi = lo;
  return { min: lo, max: hi, currency };
}

/** True when the raw (pre-clamp) reconcile range carries no real signal — triggers the R8 fallback. */
function isUnusableRange(range: ReconcileRange): boolean {
  return !Number.isFinite(range.min) || !Number.isFinite(range.max) || (range.min <= 0 && range.max <= 0);
}

function isDegenerateRange(range: PriceRange): boolean {
  return !(range.min > 0 && range.min <= range.max);
}

function deriveRentFromResale(resale: PriceRange): PriceRange {
  // Rental comps empty/unusable (R8): derive from the resale midpoint at 1.5–3%/day.
  const midpoint = (resale.min + resale.max) / 2;
  const lo = Math.max(1, Math.round(midpoint * RENTAL_BAND_MIN_PCT));
  const hi = Math.max(lo, Math.round(midpoint * RENTAL_BAND_MAX_PCT));
  return { min: lo, max: hi, currency: resale.currency };
}

/**
 * Rent-vs-resale sanity guard (krempel pricing.ts lesson: rent bounded to a % of value).
 * True when the reconciled rent is disproportionate to the item's resale value — the
 * telltale sign the rental comps matched a different product class (e.g. a cheap paper
 * "notebook" query pulling in laptop-rental sites), not a real rental price for this item.
 */
function isRentImplausible(rent: PriceRange, resale: PriceRange): boolean {
  if (rent.min > resale.max) return true; // rent floor alone already exceeds the entire item's resale value
  const resaleMidpoint = (resale.min + resale.max) / 2;
  const rentMidpoint = (rent.min + rent.max) / 2;
  return rentMidpoint > resaleMidpoint * RENT_SANITY_MAX_PCT;
}

// ---------------------------------------------------------------------------------------
// Sources — only URLs that actually appear in Tavily's results (R4)
// ---------------------------------------------------------------------------------------

function buildUrlIndex(results: readonly TavilyResult[]): ReadonlyMap<string, string> {
  const index = new Map<string, string>();
  for (const r of results) {
    if (!index.has(r.url)) index.set(r.url, r.title || r.url);
  }
  return index;
}

function toSources(urls: readonly string[], index: ReadonlyMap<string, string>): Source[] {
  const seen = new Set<string>();
  const sources: Source[] = [];
  for (const url of urls) {
    if (seen.has(url) || !index.has(url)) continue;
    seen.add(url);
    sources.push({ title: index.get(url) as string, url });
  }
  return sources;
}

/** OpenAI cited nothing verifiable but comps exist — fall back to the top raw comps directly. */
function fallbackSources(comps: readonly TavilyResult[]): Source[] {
  return comps.slice(0, MAX_FALLBACK_SOURCES).map((c) => ({ title: c.title || c.url, url: c.url }));
}

function dedupeSources(sources: readonly Source[]): Source[] {
  const seen = new Set<string>();
  const result: Source[] = [];
  for (const s of sources) {
    if (seen.has(s.url)) continue;
    seen.add(s.url);
    result.push(s);
  }
  return result;
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

// ---------------------------------------------------------------------------------------
// Adapter
// ---------------------------------------------------------------------------------------

export interface TavilyCompsConfig {
  readonly tavilyApiKey: string;
  readonly openaiApiKey: string;
  readonly currency?: string;
}

export function createTavilyCompsEnrichmentAdapter(config: TavilyCompsConfig): EnrichmentAdapter {
  const currency = config.currency ?? 'EUR';

  return {
    async enrich(object: DetectedObject): Promise<EnrichedItem> {
      const [resaleSettled, rentalSettled] = await Promise.allSettled([
        search(buildResaleQuery(object), config.tavilyApiKey),
        search(buildRentalQuery(object), config.tavilyApiKey),
      ]);
      const resaleComps = resaleSettled.status === 'fulfilled' ? resaleSettled.value : [];
      const rentalComps = rentalSettled.status === 'fulfilled' ? rentalSettled.value : [];

      if (resaleComps.length === 0 && rentalComps.length === 0) {
        const resaleError = resaleSettled.status === 'rejected' ? messageOf(resaleSettled.reason) : 'no results';
        const rentalError = rentalSettled.status === 'rejected' ? messageOf(rentalSettled.reason) : 'no results';
        throw new Error(
          `Tavily comps: nothing to ground "${object.name}" on (resale: ${resaleError}; rental: ${rentalError})`,
        );
      }

      const payload = await reconcileWithRetry(object, resaleComps, rentalComps, config.openaiApiKey);

      // Resale drives totalIdleValue — a raw {0,0} means the model found the comps didn't
      // actually support a price (e.g. name-collision noise like "A7" matching Audi parts).
      // Clamping that to a fake €1 would be a wrong-but-confident price; throw instead (R7).
      if (isUnusableRange(payload.resale)) {
        throw new Error(`Price reconcile: no usable resale comps for "${object.name}" — comps did not support a price`);
      }

      const urlIndex = buildUrlIndex([...resaleComps, ...rentalComps]);

      const resaleRange = clampRange(payload.resale.min, payload.resale.max, currency);
      let resaleSources = toSources(payload.resaleSourceUrls, urlIndex);
      if (resaleSources.length === 0) {
        resaleSources = fallbackSources(resaleComps.length > 0 ? resaleComps : rentalComps);
      }

      let rentDerived = rentalComps.length === 0 || isUnusableRange(payload.rentPerDay);
      let rentPerDayRange = rentDerived
        ? deriveRentFromResale(resaleRange)
        : clampRange(payload.rentPerDay.min, payload.rentPerDay.max, currency);

      if (!rentDerived && isRentImplausible(rentPerDayRange, resaleRange)) {
        // Rental comps matched a different product class (e.g. a cheap item's rental query
        // surfacing listings for an unrelated, much pricier product) — the reconciled rent
        // isn't grounded for *this* item. Fall back to the resale-derived band instead (R8).
        rentPerDayRange = deriveRentFromResale(resaleRange);
        rentDerived = true;
      }

      let rentalSources: Source[] = [];
      if (!rentDerived) {
        rentalSources = toSources(payload.rentalSourceUrls, urlIndex);
        if (rentalSources.length === 0) rentalSources = fallbackSources(rentalComps);
      }

      // Derived-rent branch reuses the resale sources (R8) instead of unrelated/absent rental ones.
      const sources = dedupeSources([...resaleSources, ...rentalSources]);
      const finalSources = sources.length > 0 ? sources : dedupeSources(fallbackSources([...resaleComps, ...rentalComps]));

      if (finalSources.length === 0) {
        throw new Error(`Tavily comps: no citable source URLs found for "${object.name}"`);
      }
      if (isDegenerateRange(resaleRange)) {
        throw new Error(`Price reconcile: degenerate resale range for "${object.name}"`);
      }
      if (isDegenerateRange(rentPerDayRange)) {
        throw new Error(`Price reconcile: degenerate rent range for "${object.name}"`);
      }

      return {
        ...object,
        resale: resaleRange,
        rentPerDay: rentPerDayRange,
        sources: finalSources,
      };
    },
  };
}
