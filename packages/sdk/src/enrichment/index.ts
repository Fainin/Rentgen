/**
 * Stream 3 barrel — the frozen factory seam.
 * Real adapter (tavily-comps) iff BOTH keys are present, stub otherwise.
 */

import type { EnrichmentAdapter } from '../adapters/types.js';
import { createStubEnrichmentAdapter } from './stub.js';
import { createTavilyCompsEnrichmentAdapter } from './tavily-comps.js';

export interface EnrichmentConfig {
  readonly tavilyApiKey?: string;
  readonly openaiApiKey?: string;
  readonly currency?: string;
}

export function createEnrichmentAdapter(config: EnrichmentConfig): EnrichmentAdapter {
  // Real tavily-comps adapter iff both keys are present (R1); stub otherwise.
  if (config.tavilyApiKey && config.openaiApiKey) {
    return createTavilyCompsEnrichmentAdapter({
      tavilyApiKey: config.tavilyApiKey,
      openaiApiKey: config.openaiApiKey,
      currency: config.currency,
    });
  }
  return createStubEnrichmentAdapter(config.currency ?? 'EUR');
}

export { createStubEnrichmentAdapter };
