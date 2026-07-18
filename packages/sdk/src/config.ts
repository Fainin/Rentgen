/**
 * configure-once singleton. The host app calls configureRentgen() once with its
 * keys (the SDK never reads import.meta.env — stays framework-agnostic), then any
 * widget calls getClient(). Picks real-vs-stub via the factory seams.
 */
import { RentgenClient } from './client/RentgenClient.js';
import type { ClientConfig } from './client/RentgenClient.js';
import { createDetectionAdapter } from './detection/index.js';
import { createEnrichmentAdapter } from './enrichment/index.js';

export interface RentgenConfig {
  readonly openaiApiKey?: string;
  readonly geminiApiKey?: string;
  readonly tavilyApiKey?: string;
  readonly currency?: string;
  /** Surfaced when the sellability gate drops items (operator-facing). */
  readonly onHidden?: (count: number) => void;
}

let client: RentgenClient | null = null;

export function configureRentgen(config: RentgenConfig = {}): RentgenClient {
  const clientConfig: ClientConfig = {
    detection: createDetectionAdapter({ openaiApiKey: config.openaiApiKey }),
    enrichment: createEnrichmentAdapter({
      tavilyApiKey: config.tavilyApiKey,
      geminiApiKey: config.geminiApiKey,
      currency: config.currency,
    }),
    currency: config.currency,
    onHidden: config.onHidden,
  };
  client = new RentgenClient(clientConfig);
  return client;
}

/** Lazy default client (stub-backed) so widgets work before the app configures keys. */
export function getClient(): RentgenClient {
  if (!client) client = configureRentgen();
  return client;
}
