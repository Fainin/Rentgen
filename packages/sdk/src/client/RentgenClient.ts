/**
 * RentgenClient (Stream 4) — orchestrates the value chain:
 * cache → detect → enrich (parallel) → dedup → total → persist → emit → return.
 *
 * Event contract: <rentgen-scanner> emits `scan:start` BEFORE calling scan();
 * this client emits `scan:complete` on success and `scan:error` on failure.
 */

import type { DetectionAdapter, EnrichmentAdapter } from '../adapters/types.js';
import type { EnrichedItem, ScanResult, Session } from '../types.js';
import { emit } from '../events.js';
import { findByImageHash, getSession, hashImage, saveSession } from '../storage/sessionStore.js';
import { totalIdleValue } from '../results/total.js';
import { attachItemImages } from './itemImage.js';

export interface RentgenClientOptions {
  readonly detection: DetectionAdapter;
  readonly enrichment: EnrichmentAdapter;
  readonly currency?: string;
}

/**
 * Semantic dedup at compile time (team handoff #1): the tracker gate + image hash stop
 * most double scans, but the same physical object scanned from two angles still slips
 * through. Merge on the NAME alone (case-insensitive) — the classifier's specificity
 * ladder makes identical name strings mean the same product, while its category can
 * wobble between scans ("Other" vs "Home & Kitchen"), which used to leave duplicates.
 * Keep the higher-confidence one.
 */
function dedupItems(items: readonly EnrichedItem[]): readonly EnrichedItem[] {
  const byKey = new Map<string, EnrichedItem>();
  for (const item of items) {
    const key = item.name.trim().toLowerCase();
    const existing = byKey.get(key);
    if (!existing || item.confidence > existing.confidence) byKey.set(key, item);
  }
  return [...byKey.values()];
}

/**
 * Adapter ids restart per call (oa-0, oa-1, …), so accumulated scans collide. Remap new
 * items to ids unused in the current inventory — unique ids are what selection, React
 * keys, and the export's sourceItemId all assume.
 */
function withUniqueIds(
  existing: readonly EnrichedItem[],
  incoming: readonly EnrichedItem[],
): readonly EnrichedItem[] {
  const used = new Set(existing.map((i) => i.id));
  return incoming.map((item) => {
    let id = item.id;
    for (let n = 1; used.has(id); n++) id = `${item.id}-${n}`;
    used.add(id);
    return id === item.id ? item : { ...item, id };
  });
}

export class RentgenClient {
  private readonly detection: DetectionAdapter;
  private readonly enrichment: EnrichmentAdapter;
  private readonly currency: string;

  /**
   * The running inventory. Every scan MERGES into it (deduped) and emits the full
   * accumulated result, so a live pan's total climbs and consume(sessionId) always
   * returns the whole inventory — not just the last crop's item.
   */
  private currentItems: readonly EnrichedItem[] = [];
  private currentSessionId: string | null = null;

  constructor(options: RentgenClientOptions) {
    this.detection = options.detection;
    this.enrichment = options.enrichment;
    this.currency = options.currency ?? 'EUR';
  }

  /** Start a fresh inventory (e.g. a new walkthrough). Persisted sessions stay cached. */
  resetSession(): void {
    this.currentItems = [];
    this.currentSessionId = null;
  }

  async scan(imageBase64: string): Promise<ScanResult> {
    try {
      return await this.runScan(imageBase64);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Scan failed unexpectedly.';
      emit('scan:error', { message });
      throw error;
    }
  }

  consume(sessionId: string): Session | null {
    return getSession(sessionId);
  }

  /** Merge new items into the running inventory, persist, emit, return. */
  private compile(newItems: readonly EnrichedItem[], imageHash: string): ScanResult {
    if (!this.currentSessionId) this.currentSessionId = crypto.randomUUID();
    const items = dedupItems([
      ...this.currentItems,
      ...withUniqueIds(this.currentItems, newItems),
    ]);
    this.currentItems = items;
    const result: ScanResult = {
      sessionId: this.currentSessionId,
      items,
      totalIdleValue: totalIdleValue(items),
      currency: this.currency,
    };
    // Persisting even empty results keeps rehearsal re-scans of the same image instant.
    saveSession({ id: result.sessionId, imageHash, result, createdAt: Date.now() });
    emit('scan:complete', result);
    return result;
  }

  private async runScan(imageBase64: string): Promise<ScanResult> {
    const imageHash = hashImage(imageBase64);
    const cached = findByImageHash(imageHash);
    if (cached) return this.compile(cached.result.items, imageHash);

    const objects = await this.detection.detect(imageBase64);
    if (objects.length === 0) return this.compile([], imageHash);

    const settled = await Promise.allSettled(
      objects.map((object) => this.enrichment.enrich(object)),
    );
    const priced = settled
      .filter((r): r is PromiseFulfilledResult<EnrichedItem> => r.status === 'fulfilled')
      .map((r) => r.value);
    // Per-item photo: crop to the classifier's box when present (adjacent products must
    // not share one card image); full scan image otherwise.
    const enriched = await attachItemImages(priced, imageBase64);

    if (enriched.length === 0) {
      const firstFailure = settled.find(
        (r): r is PromiseRejectedResult => r.status === 'rejected',
      );
      const reason =
        firstFailure?.reason instanceof Error ? firstFailure.reason.message : 'unknown error';
      throw new Error(`Pricing failed for every detected item (${reason}).`);
    }

    return this.compile(enriched, imageHash);
  }
}
