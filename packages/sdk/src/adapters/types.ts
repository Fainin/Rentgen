/**
 * The SDK's plugin surface. Anything OpenAI / Tavily / cognee-shaped plugs in by
 * implementing one of these interfaces and registering it in RentgenClient — without
 * touching the widgets or the app.
 *
 * Adding a source during the hackathon = "write an adapter, register it". Nothing else.
 */

import type { Asset, DetectedObject, EnrichedItem, Session } from '../types.js';

/**
 * Turns one photo into the distinct sellable/rentable objects in it.
 * Default implementation: openai-vision.
 *
 * @param imageBase64 A data URL (`data:image/...;base64,...`) or raw base64 string.
 */
export interface DetectionAdapter {
  detect(imageBase64: string): Promise<DetectedObject[]>;
  /**
   * Optional (sanctioned additive edit, 2026-07-18): analyze a whole video pan at once —
   * all sampled keyframes in ONE model call. The model sees full-scene context, dedupes
   * the same object across frames itself, and reports `frameIndex`/`box` per item.
   * Default implementation: gemini-vision (the krempel pattern).
   */
  detectBatch?(framesBase64: readonly string[]): Promise<DetectedObject[]>;
}

/**
 * Prices one detected object against live comps → resale + rent/day + sources.
 * Default implementation: tavily-comps (Tavily search → OpenAI reconcile).
 */
export interface EnrichmentAdapter {
  enrich(object: DetectedObject): Promise<EnrichedItem>;
}

/**
 * Optional (Phase 3). Renders a session into a shareable asset (report card image, etc.).
 * Empty by default — no AssetAdapter is registered until Phase 3.
 */
export interface AssetAdapter {
  render(session: Session): Promise<Asset>;
}
