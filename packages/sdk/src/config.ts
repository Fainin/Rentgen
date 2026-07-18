/**
 * SDK configuration: a single configureRentgen() call wires up the client once, and the
 * widgets pull it via getClient(). Keeps the SDK framework-agnostic — keys come from the
 * host app (e.g. Vite's import.meta.env), never from the DOM or the SDK internals.
 *
 * Zero-config default: if you never call configureRentgen (or omit keys), getClient()
 * returns a stub-backed client so the UI still works offline with mock data.
 */

import { RentgenClient } from './client/RentgenClient.js';
import { OpenAIVisionAdapter } from './adapters/openai-vision.js';
import { TavilyCompsAdapter } from './adapters/tavily-comps.js';
import { StubDetectionAdapter, StubEnrichmentAdapter } from './adapters/stub.js';
import type { DetectionAdapter, EnrichmentAdapter } from './adapters/types.js';

export interface RentgenConfig {
  /** OpenAI key (demo-scoped, rotated post-event). Omit → stub detection. */
  readonly openaiApiKey?: string;
  /** Tavily key. Omit → stub enrichment. */
  readonly tavilyApiKey?: string;
  readonly currency?: string;
  /** Escape hatch: bring your own adapters (e.g. cognee in Phase 3). Overrides the keys. */
  readonly detection?: DetectionAdapter;
  readonly enrichment?: EnrichmentAdapter;
}

let client: RentgenClient | null = null;

/** Configure the shared client. Call once at app startup. Returns the client. */
export function configureRentgen(config: RentgenConfig = {}): RentgenClient {
  const detection =
    config.detection ??
    (config.openaiApiKey ? new OpenAIVisionAdapter(config.openaiApiKey) : new StubDetectionAdapter());

  const enrichment =
    config.enrichment ??
    (config.tavilyApiKey && config.openaiApiKey
      ? new TavilyCompsAdapter({
          tavilyApiKey: config.tavilyApiKey,
          openaiApiKey: config.openaiApiKey,
          currency: config.currency,
        })
      : new StubEnrichmentAdapter());

  client = new RentgenClient({ detection, enrichment });
  return client;
}

/** Get the shared client, lazily defaulting to a stub-backed one (offline demo works). */
export function getClient(): RentgenClient {
  if (!client) client = configureRentgen();
  return client;
}
