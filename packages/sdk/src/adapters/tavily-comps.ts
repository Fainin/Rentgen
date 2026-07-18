/**
 * EnrichmentAdapter — Tavily comps → OpenAI reconcile → grounded resale + rent/day.
 *
 * Flow: Tavily search for resale/rental comps (with source links) → OpenAI reconciles
 * the noisy comps into a defensible { resale, rentPerDay } range. Price is grounded in
 * real listings, never hallucinated, and we always keep the source URLs to show on cards.
 *
 * STATUS: skeleton. Falls back to the stub adapter when either API key is missing.
 *
 * ⚠️ RISK (spec §9): Tavily may not allow direct browser CORS calls. Smoke-test this in
 * hour 1. If it's blocked, only the *transport* in this file changes (e.g. a CORS-safe
 * hosted path) — the EnrichmentAdapter interface hides where the call runs, so nothing
 * else in the SDK or app moves.
 */

import type { EnrichmentAdapter } from './types.js';
import type { DetectedObject, EnrichedItem, PriceRange, Source } from '../types.js';
import { StubEnrichmentAdapter } from './stub.js';

const TAVILY_URL = 'https://api.tavily.com/search';
const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';
const MODEL = 'gpt-4o-mini';

export interface TavilyCompsConfig {
  readonly tavilyApiKey?: string;
  readonly openaiApiKey?: string;
  readonly currency?: string;
}

export class TavilyCompsAdapter implements EnrichmentAdapter {
  private readonly fallback = new StubEnrichmentAdapter();
  private readonly currency: string;

  constructor(private readonly config: TavilyCompsConfig) {
    this.currency = config.currency ?? 'EUR';
  }

  async enrich(object: DetectedObject): Promise<EnrichedItem> {
    if (!this.config.tavilyApiKey || !this.config.openaiApiKey) {
      return this.fallback.enrich(object);
    }

    const sources = await this.searchComps(object);
    const { resale, rentPerDay } = await this.reconcile(object, sources);
    return { ...object, resale, rentPerDay, sources };
  }

  /** Tavily: fetch resale/rental comps with source links. */
  private async searchComps(object: DetectedObject): Promise<Source[]> {
    const res = await fetch(TAVILY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: this.config.tavilyApiKey,
        query: `${object.name} ${object.condition} resale price and daily rental price`,
        max_results: 6,
        search_depth: 'basic',
      }),
    });

    if (!res.ok) {
      throw new Error(`Tavily search failed: ${res.status} ${await res.text()}`);
    }

    const data = await res.json();
    const results = (data?.results ?? []) as Array<{ title?: string; url?: string }>;
    return results
      .filter((r) => r.url)
      .map((r) => ({ title: String(r.title ?? r.url), url: String(r.url) }));
  }

  /** OpenAI: reconcile noisy comps into a defensible price range. */
  private async reconcile(
    object: DetectedObject,
    sources: readonly Source[],
  ): Promise<{ resale: PriceRange; rentPerDay: PriceRange }> {
    const prompt = `Given resale/rental web results for "${object.name}" (${object.condition}),
estimate a realistic price range in ${this.currency}. Return ONLY JSON:
{"resale":{"min":number,"max":number},"rentPerDay":{"min":number,"max":number}}
Sources:
${sources.map((s) => `- ${s.title}: ${s.url}`).join('\n')}`;

    const res = await fetch(OPENAI_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.config.openaiApiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        response_format: { type: 'json_object' },
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!res.ok) {
      throw new Error(`OpenAI reconcile failed: ${res.status} ${await res.text()}`);
    }

    const data = await res.json();
    const parsed = safeParse(data?.choices?.[0]?.message?.content ?? '{}');
    return {
      resale: toRange(parsed.resale, this.currency),
      rentPerDay: toRange(parsed.rentPerDay, this.currency),
    };
  }
}

function safeParse(raw: string): { resale?: unknown; rentPerDay?: unknown } {
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function toRange(value: unknown, currency: string): PriceRange {
  const v = value as { min?: unknown; max?: unknown } | undefined;
  const min = Number(v?.min ?? 0);
  const max = Number(v?.max ?? min);
  return { min: safe(min), max: safe(Math.max(min, max)), currency };
}

function safe(n: number): number {
  return Number.isFinite(n) ? Math.round(n) : 0;
}
