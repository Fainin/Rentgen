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

export interface RentgenClientOptions {
  readonly detection: DetectionAdapter;
  readonly enrichment: EnrichmentAdapter;
  readonly currency?: string;
}

/**
 * Semantic dedup at compile time (team handoff #1): the tracker gate + image hash stop
 * most double scans, but the same physical object scanned from two angles still slips
 * through. Merge items whose name+category match (case-insensitive), keep the
 * higher-confidence one.
 */
function dedupItems(items: readonly EnrichedItem[]): readonly EnrichedItem[] {
  const byKey = new Map<string, EnrichedItem>();
  for (const item of items) {
    const key = `${item.name.toLowerCase()}|${item.category.toLowerCase()}`;
    const existing = byKey.get(key);
    if (!existing || item.confidence > existing.confidence) byKey.set(key, item);
  }
  return [...byKey.values()];
}

export class RentgenClient {
  private readonly detection: DetectionAdapter;
  private readonly enrichment: EnrichmentAdapter;
  private readonly currency: string;

  constructor(options: RentgenClientOptions) {
    this.detection = options.detection;
    this.enrichment = options.enrichment;
    this.currency = options.currency ?? 'EUR';
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

  private async runScan(imageBase64: string): Promise<ScanResult> {
    const imageHash = hashImage(imageBase64);
    const cached = findByImageHash(imageHash);
    if (cached) {
      emit('scan:complete', cached.result);
      return cached.result;
    }

    const objects = await this.detection.detect(imageBase64);
    if (objects.length === 0) {
      const empty: ScanResult = {
        sessionId: crypto.randomUUID(),
        items: [],
        totalIdleValue: 0,
        currency: this.currency,
      };
      // Persist even the empty result so a rehearsal re-scan of the same image is a
      // cache hit instead of a repeat detection call.
      saveSession({ id: empty.sessionId, imageHash, result: empty, createdAt: Date.now() });
      emit('scan:complete', empty);
      return empty;
    }

    const settled = await Promise.allSettled(
      objects.map((object) => this.enrichment.enrich(object)),
    );
    const enriched = settled
      .filter((r): r is PromiseFulfilledResult<EnrichedItem> => r.status === 'fulfilled')
      .map((r) => ({ ...r.value, image: imageBase64 }));

    if (enriched.length === 0) {
      const firstFailure = settled.find(
        (r): r is PromiseRejectedResult => r.status === 'rejected',
      );
      const reason =
        firstFailure?.reason instanceof Error ? firstFailure.reason.message : 'unknown error';
      throw new Error(`Pricing failed for every detected item (${reason}).`);
    }

    const items = dedupItems(enriched);
    const result: ScanResult = {
      sessionId: crypto.randomUUID(),
      items,
      totalIdleValue: totalIdleValue(items),
      currency: this.currency,
    };

    saveSession({
      id: result.sessionId,
      imageHash,
      result,
      createdAt: Date.now(),
    });
    emit('scan:complete', result);
    return result;
  }
}
