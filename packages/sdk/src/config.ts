/**
 * configureRentgen() / getClient() — the configure-once singleton (Stream 4).
 *
 * The host app passes its keys (and an opaque `asset` blob for Stream 5) here once;
 * everything else — widgets, adapters — reads from getClient(). The SDK never touches
 * import.meta.env: keys always arrive through this config.
 */

import type { AssetAdapter, DetectionAdapter, EnrichmentAdapter } from './adapters/types.js';
import { createDetectionAdapter } from './detection/index.js';
import { createEnrichmentAdapter } from './enrichment/index.js';
import { createAssetAdapter } from './upsell/index.js';
import { RentgenClient } from './client/RentgenClient.js';

export interface RentgenConfig {
  readonly openaiApiKey?: string;
  readonly tavilyApiKey?: string;
  readonly currency?: string;
  /** Vision model override for the detection adapter (default 'gpt-4.1'). */
  readonly detectionModel?: string;
  /** Listing-quality gate: drop detected items below this confidence (default 0.8). */
  readonly detectionMinConfidence?: number;
  /** Known products likely to appear (demo inventory) — steadies naming across angles. */
  readonly detectionHints?: readonly string[];
  /**
   * Opaque Stream-5 config blob ({ auth, providers, uploader, actions, callbacks }).
   * Forwarded UNTOUCHED to createAssetAdapter — Stream 4 never reads or reshapes it.
   */
  readonly asset?: unknown;
  /** Escape hatch: inject custom adapter implementations (tests, new sources). */
  readonly adapters?: {
    readonly detection?: DetectionAdapter;
    readonly enrichment?: EnrichmentAdapter;
    readonly asset?: AssetAdapter;
  };
}

let client: RentgenClient | null = null;
let assetAdapter: AssetAdapter | null = null;

export function configureRentgen(config: RentgenConfig): RentgenClient {
  const currency = config.currency ?? 'EUR';
  const detection =
    config.adapters?.detection ??
    createDetectionAdapter({
      openaiApiKey: config.openaiApiKey,
      model: config.detectionModel,
      minConfidence: config.detectionMinConfidence,
      hints: config.detectionHints,
    });
  const enrichment =
    config.adapters?.enrichment ??
    createEnrichmentAdapter({
      tavilyApiKey: config.tavilyApiKey,
      openaiApiKey: config.openaiApiKey,
      currency,
    });
  assetAdapter =
    config.adapters?.asset ?? createAssetAdapter(config.asset as never) ?? null;
  client = new RentgenClient({ detection, enrichment, currency });
  return client;
}

/** The configured client; falls back to a stub-backed client so the SDK demos offline. */
export function getClient(): RentgenClient {
  if (!client) client = configureRentgen({});
  return client;
}

/** The configured AssetAdapter (Stream 5's export seam), or null when unconfigured. */
export function getAssetAdapter(): AssetAdapter | null {
  return assetAdapter;
}
