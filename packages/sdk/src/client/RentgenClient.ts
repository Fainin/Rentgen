/**
 * RentgenClient — orchestrates the value chain:
 *   scan(image) → cache check → detect → enrich each object (in parallel) → total → persist.
 *
 * This is the single SDK entry point the widgets call. Swapping data sources (OpenAI,
 * Tavily, cognee, a stub) means passing different adapters here — nothing else changes.
 */

import type { DetectionAdapter, EnrichmentAdapter } from '../adapters/types.js';
import type { EnrichedItem, PriceRange, ScanResult, Session } from '../types.js';
import { SessionStore, hashImage } from '../storage/sessionStore.js';

export interface RentgenClientDeps {
  readonly detection: DetectionAdapter;
  readonly enrichment: EnrichmentAdapter;
  readonly store?: SessionStore;
  /** Injected clock so we never touch Date.now() implicitly (testability). */
  readonly now?: () => number;
}

export class RentgenClient {
  private readonly detection: DetectionAdapter;
  private readonly enrichment: EnrichmentAdapter;
  private readonly store: SessionStore;
  private readonly now: () => number;

  constructor(deps: RentgenClientDeps) {
    this.detection = deps.detection;
    this.enrichment = deps.enrichment;
    this.store = deps.store ?? new SessionStore();
    this.now = deps.now ?? (() => Date.now());
  }

  /**
   * Scan one image → priced items + idle-capital total. Cache-first: an identical image
   * returns instantly (great for rehearsal). @param imageBase64 data URL or base64.
   */
  async scan(imageBase64: string): Promise<ScanResult> {
    const imageHash = hashImage(imageBase64);

    const cached = this.store.getByImageHash(imageHash);
    if (cached) return cached.result;

    const objects = await this.detection.detect(imageBase64);

    // Price every object in parallel — one enrich call each, all at once.
    const items = await Promise.all(objects.map((obj) => this.enrichment.enrich(obj)));

    const sessionId = `s-${imageHash}-${this.now().toString(36)}`;
    const currency = items[0]?.resale.currency ?? 'EUR';
    const result: ScanResult = {
      sessionId,
      items,
      totalIdleValue: sumResaleMidpoints(items),
      currency,
    };

    this.store.save(imageHash, result, this.now());
    return result;
  }

  /**
   * Redisplay an existing session's compiled items/total/sources without re-scanning —
   * the client-side realization of "give me the final product data" (backed by
   * localStorage since there's no server).
   */
  consume(sessionId: string): Session | null {
    return this.store.getById(sessionId);
  }
}

/** Idle-capital total = sum of each item's resale midpoint. */
export function sumResaleMidpoints(items: readonly EnrichedItem[]): number {
  return items.reduce((sum, item) => sum + midpoint(item.resale), 0);
}

export function midpoint(range: PriceRange): number {
  return (range.min + range.max) / 2;
}
