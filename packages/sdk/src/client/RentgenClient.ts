/**
 * RentgenClient — orchestrates scan(): cache → detect → enrich (parallel) →
 * sellability gate → total → persist → emit. The pipeline hub (Workstream 4).
 *
 * The sellability gate runs BEFORE an item enters ScanResult.items: non-sellable /
 * ungrounded / sub-€5 items are dropped silently, so the idle-capital total sums
 * only honestly-sellable items. A count of dropped items is surfaced to the demo
 * operator (not the jury) via onHidden.
 */
import type { DetectionAdapter, EnrichmentAdapter } from '../adapters/types.js';
import type { EnrichedItem, PriceRange, ScanResult } from '../types.js';
import { emit } from '../events.js';
import { consume, findByHash, hashImage, save } from '../storage/sessionStore.js';
import { midpoint, sellabilityCheck } from './sellability.js';

export interface ClientConfig {
  readonly detection: DetectionAdapter;
  readonly enrichment: EnrichmentAdapter;
  readonly currency?: string;
  /** Called with the count of items the sellability gate dropped (operator-facing). */
  readonly onHidden?: (count: number) => void;
}

function newSessionId(): string {
  return `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export class RentgenClient {
  constructor(private readonly cfg: ClientConfig) {}

  async scan(imageBase64: string): Promise<ScanResult> {
    emit('scan:start', undefined);
    try {
      const imageHash = await hashImage(imageBase64);
      const cached = findByHash(imageHash);
      if (cached) {
        emit('scan:complete', cached.result);
        return cached.result;
      }

      const detected = await this.cfg.detection.detect(imageBase64);
      const enriched = await Promise.all(
        detected.map((object) => this.cfg.enrichment.enrich(object)),
      );

      // Sellability gate — only honestly-sellable items reach the list (and the total).
      let hidden = 0;
      const items: EnrichedItem[] = [];
      for (const item of enriched) {
        if (sellabilityCheck(item) === true) {
          // Persist the scan image as the item image (handoff #2 — EnrichedItem.image?).
          items.push({ ...item, image: imageBase64 });
        } else {
          hidden++;
        }
      }
      if (hidden > 0) this.cfg.onHidden?.(hidden);

      const currency = this.cfg.currency ?? 'EUR';
      const totalIdleValue = Math.round(
        items.reduce((sum, item) => sum + midpoint(item.resale.min, item.resale.max), 0),
      );
      const result: ScanResult = {
        sessionId: newSessionId(),
        items,
        totalIdleValue,
        currency,
      };
      save(result, imageHash);
      emit('scan:complete', result);
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      emit('scan:error', { message });
      throw err;
    }
  }

  /** Redisplay an existing session from localStorage without re-scanning. */
  consume(sessionId: string) {
    return consume(sessionId);
  }
}

export type { PriceRange };
