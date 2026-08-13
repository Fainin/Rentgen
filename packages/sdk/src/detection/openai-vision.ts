/**
 * Real DetectionAdapter (Stream 2): browser fetch → OpenAI vision (Structured Outputs) →
 * defensive parse → DetectedObject[]. Never reads import.meta.env — keys arrive via config.
 */

import type { DetectionAdapter } from '../adapters/types.js';
import type { BoundingBox, DetectedObject, PriceRange } from '../types.js';

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';
/** Retail estimates are stamped in this currency (matches the enrichment default). */
const RETAIL_CURRENCY = 'EUR';
const MAX_RETAIL_EUR = 1_000_000;

/** Fixed category list — keeps Stream 3's queries and Stream 4's grouping stable. */
export const CATEGORIES = [
  'Photography',
  'Electronics',
  'Audio',
  'Gaming',
  'Computing',
  'Tools',
  'Sports & Outdoor',
  'Music Instruments',
  'Home & Kitchen',
  'Furniture',
  'Other',
] as const;

const CATEGORY_SET: ReadonlySet<string> = new Set(CATEGORIES);

/**
 * Listing-quality gate: only items the model is at least this sure about survive.
 * Tuning (2026-07-18, revised): the old 0.8 bar silently dropped most real finds whenever
 * the exact brand/model wasn't legible — recall cratered. Lowered to 0.45 to match the
 * krempel pipeline (which keeps ≥0.4 and detects far more); a plausible generic listing
 * beats a missed item. Overridable via the factory config's minConfidence.
 */
const DEFAULT_MIN_CONFIDENCE = 0.45;
const MAX_ITEMS = 12;
const NAME_MAX_LEN = 80;
const CONDITION_MAX_LEN = 60;
const MAX_RETRIES = 1;
const RETRY_DELAY_MS = 1500;
const REQUEST_TIMEOUT_MS = 45_000;
const MAX_TOKENS = 1000;
const TEMPERATURE = 0.2;

const PROMPT = `You are an expert at identifying distinct sellable/rentable objects in a photo for a peer-to-peer marketplace.

List each distinct movable object that a person could sell or rent out. For each object, provide:

1. "name" — follow this specificity ladder, in order of preference:
   a. brand + model, if legible (e.g. "Canon PowerShot G7X Mark II")
   b. brand + type, if the model isn't legible (e.g. "Bosch cordless drill")
   c. precise generic description (e.g. "18V cordless drill")
   Never return a vague name like "electronic device" or "gadget" — if you truly cannot tell what it is, omit it.

2. "category" — exactly one of: ${CATEGORIES.join(' · ')}.

3. "condition" — short resale-speak based only on visible evidence, e.g. "used - good", "used - visible wear", "like new". Do not invent details you cannot see.

4. "confidence" — a number 0..1 representing how certain you are that the NAME is correct (not whether something is present). If the brand/model is unreadable, use a generic name and an honestly lower confidence.

5. "box" — the object's bounding box within the image as FRACTIONS of image width/height (0..1, top-left origin): x, y = top-left corner, w, h = size. Be reasonably tight around the object. If you cannot localize it, use the full image {x:0, y:0, w:1, h:1}.

6. "estimatedRetail" — the approximate price to buy this item NEW at retail today, in EUR, as { "min", "max" } (a sensible range, NOT the used price). Use your knowledge of the product's typical new/MSRP price; if the exact model is unknown, give your best estimate for that product class. Always return a positive range.

Skip rules — do NOT list:
- built-in fixtures, walls, floors, ceilings, cables or chargers as standalone items, or people;
- everyday low-value clutter with no real resale market: bottles, cups, mugs, glasses, dishes, cutlery, food and drinks, plants, decoration knick-knacks, pens, pencils, rulers, paper notebooks, office stationery;
- anything whose realistic used resale value is clearly under about €15.

Include an object if you are reasonably sure what it is (confidence ≥ 0.4). When the exact brand/model isn't legible, still include it with a more generic name and an honestly lower confidence — a plausible generic listing beats a missed item. Only omit something if you genuinely cannot tell what kind of thing it is.

List each distinct physical object once. An empty list is a valid and correct answer if nothing sellable/rentable is visible.

Return at most ${MAX_ITEMS} objects.`;

const JSON_SCHEMA = {
  name: 'detected_objects',
  strict: true,
  schema: {
    type: 'object',
    properties: {
      items: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            category: { type: 'string', enum: [...CATEGORIES] },
            condition: { type: 'string' },
            confidence: { type: 'number' },
            box: {
              type: 'object',
              properties: {
                x: { type: 'number' },
                y: { type: 'number' },
                w: { type: 'number' },
                h: { type: 'number' },
              },
              required: ['x', 'y', 'w', 'h'],
              additionalProperties: false,
            },
            estimatedRetail: {
              type: 'object',
              properties: {
                min: { type: 'number' },
                max: { type: 'number' },
              },
              required: ['min', 'max'],
              additionalProperties: false,
            },
          },
          required: ['name', 'category', 'condition', 'confidence', 'box', 'estimatedRetail'],
          additionalProperties: false,
        },
      },
    },
    required: ['items'],
    additionalProperties: false,
  },
} as const;

interface OpenAIVisionConfig {
  readonly openaiApiKey: string;
  /** e.g. 'gpt-4.1-nano' (default, fastest), 'gpt-4.1-mini', 'gpt-4.1'. */
  readonly model?: string;
  /** Drop items below this identification confidence (default 0.8). */
  readonly minConfidence?: number;
  /**
   * Known products likely to appear (demo/venue inventory). When a detected object
   * visually matches a hint, the model uses that exact name — fixes brand/model misreads
   * ("Microsoft Surface" for an Asus Zenbook) and keeps names stable across angles,
   * which is also what makes the client's name-based dedup merge correctly.
   */
  readonly hints?: readonly string[];
}

function buildPrompt(hints: readonly string[] | undefined): string {
  if (!hints || hints.length === 0) return PROMPT;
  return `${PROMPT}

KNOWN INVENTORY HINTS: the user's items likely include: ${hints.join('; ')}.
If a detected object plausibly matches one of these products, use that EXACT name (and a higher confidence). Only do this when the visual evidence is compatible — never force a hint onto a clearly different object.`;
}

interface RawItem {
  readonly name?: unknown;
  readonly category?: unknown;
  readonly condition?: unknown;
  readonly confidence?: unknown;
  readonly box?: unknown;
  readonly estimatedRetail?: unknown;
}

/** Parse the model's new/retail estimate into a positive, currency-tagged EUR range. */
function validateRetail(raw: unknown): PriceRange | undefined {
  if (typeof raw !== 'object' || raw === null) return undefined;
  const r = raw as { min?: unknown; max?: unknown };
  let lo = Number(r.min);
  let hi = Number(r.max);
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) return undefined;
  if (lo > hi) [lo, hi] = [hi, lo];
  lo = Math.min(MAX_RETAIL_EUR, Math.max(1, Math.round(lo)));
  hi = Math.min(MAX_RETAIL_EUR, Math.max(lo, Math.round(hi)));
  if (!(lo > 0 && lo <= hi)) return undefined;
  return { min: lo, max: hi, currency: RETAIL_CURRENCY };
}

/**
 * A usable per-item box is strictly smaller than the frame — the prompt's "full image"
 * fallback (and anything nearly that big) means the model couldn't localize, so we omit
 * the box and the client keeps the whole scan image for that item.
 */
function validateBox(raw: unknown): BoundingBox | undefined {
  if (typeof raw !== 'object' || raw === null) return undefined;
  const b = raw as { x?: unknown; y?: unknown; w?: unknown; h?: unknown };
  const x = clamp01(Number(b.x));
  const y = clamp01(Number(b.y));
  const w = clamp01(Number(b.w));
  const h = clamp01(Number(b.h));
  if (![x, y, w, h].every(Number.isFinite)) return undefined;
  if (w < 0.03 || h < 0.03) return undefined; // degenerate sliver
  if (w * h > 0.85) return undefined; // effectively the whole frame
  return { x, y, w: Math.min(w, 1 - x), h: Math.min(h, 1 - y) };
}

const cleanString = (value: unknown, maxLen: number): string =>
  String(value ?? '')
    .replace(/[<>]/g, '')
    .trim()
    .slice(0, maxLen);

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

function toImageUrl(imageBase64: string): string {
  return imageBase64.startsWith('data:') ? imageBase64 : `data:image/jpeg;base64,${imageBase64}`;
}

function validateItem(
  raw: RawItem,
  index: number,
  minConfidence: number,
): DetectedObject | undefined {
  const name = cleanString(raw.name, NAME_MAX_LEN);
  if (!name) {
    console.warn(`[openai-vision] dropping item ${index}: missing/empty name`);
    return undefined;
  }

  const rawCategory = cleanString(raw.category, 40);
  const category = CATEGORY_SET.has(rawCategory) ? rawCategory : 'Other';

  const condition = cleanString(raw.condition, CONDITION_MAX_LEN) || 'used - good';

  const rawConfidence = typeof raw.confidence === 'number' ? raw.confidence : Number(raw.confidence);
  const confidence = clamp01(Number.isFinite(rawConfidence) ? rawConfidence : 0);

  if (confidence < minConfidence) {
    console.warn(`[openai-vision] dropping "${name}": confidence ${confidence} below ${minConfidence}`);
    return undefined;
  }

  const box = validateBox(raw.box);
  const estimatedRetail = validateRetail(raw.estimatedRetail);
  return {
    id: `oa-${index}`,
    name,
    category,
    condition,
    confidence,
    ...(box ? { box } : {}),
    ...(estimatedRetail ? { estimatedRetail } : {}),
  };
}

function parseResponseContent(content: string, minConfidence: number): DetectedObject[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error(`OpenAI vision returned invalid JSON: ${content.slice(0, 200)}`);
  }

  const items = (parsed as { items?: unknown })?.items;
  if (!Array.isArray(items)) {
    throw new Error('OpenAI vision response missing "items" array');
  }

  const validated: DetectedObject[] = [];
  for (const raw of items) {
    if (validated.length >= MAX_ITEMS) break;
    const item = validateItem((raw ?? {}) as RawItem, validated.length, minConfidence);
    if (item) validated.push(item);
  }
  return validated;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function callOpenAI(imageBase64: string, config: OpenAIVisionConfig): Promise<string> {
  // Fastest vision model measured for this task: gpt-4.1-nano 0.75-1.3s vs gpt-4.1-mini
  // ~1.4s, gpt-4.1 2.2-3.9s, gpt-5-nano (minimal effort) 1.3-1.7s, gpt-5-mini ~2.2s.
  // Demo hints offset nano's weaker brand OCR. Override via config for cold rooms.
  const model = config.model ?? 'gpt-4.1-nano';
  // GPT-5-family models are reasoning models with a different parameter surface: they
  // reject `temperature`/`max_tokens` and want `max_completion_tokens` (+ minimal
  // reasoning effort for latency). Keep the config dial working across both families.
  const isReasoningModel = model.startsWith('gpt-5') || model.startsWith('o');
  const body = {
    model,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: buildPrompt(config.hints) },
          {
            type: 'image_url',
            image_url: { url: toImageUrl(imageBase64), detail: 'high' },
          },
        ],
      },
    ],
    response_format: { type: 'json_schema', json_schema: JSON_SCHEMA },
    ...(isReasoningModel
      ? { max_completion_tokens: MAX_TOKENS * 2, reasoning_effort: 'minimal' }
      : { temperature: TEMPERATURE, max_tokens: MAX_TOKENS }),
  };

  let lastError: Error | undefined;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    let res: Response;
    try {
      res = await fetch(OPENAI_URL, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${config.openaiApiKey}`,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < MAX_RETRIES) {
        await sleep(RETRY_DELAY_MS);
        continue;
      }
      throw new Error(`OpenAI vision request failed: ${lastError.message}`);
    }

    if (res.ok) {
      const json = (await res.json()) as {
        choices?: ReadonlyArray<{ message?: { content?: string } }>;
      };
      const content = json.choices?.[0]?.message?.content;
      if (typeof content !== 'string') {
        throw new Error('OpenAI vision response missing message content');
      }
      return content;
    }

    const isRetryable = res.status === 429 || res.status >= 500;
    if (isRetryable && attempt < MAX_RETRIES) {
      await sleep(RETRY_DELAY_MS);
      continue;
    }

    const errorBody = await res.text().catch(() => '');
    throw new Error(`OpenAI vision request failed with status ${res.status}: ${errorBody.slice(0, 200)}`);
  }

  // Unreachable: the loop above always returns or throws.
  throw new Error(`OpenAI vision request failed: ${lastError?.message ?? 'unknown error'}`);
}

export function createOpenAIVisionAdapter(config: OpenAIVisionConfig): DetectionAdapter {
  const minConfidence = config.minConfidence ?? DEFAULT_MIN_CONFIDENCE;
  return {
    async detect(imageBase64: string): Promise<DetectedObject[]> {
      const content = await callOpenAI(imageBase64, config);
      return parseResponseContent(content, minConfidence);
    },
  };
}
