/**
 * Stream 3 barrel — the frozen factory seam.
 * The SDK ships only the offline stub adapter. The real-world implementation
 * (Tavily comps → OpenAI reconcile) was removed 2026-07-20 and lives as a worked
 * example in docs/writing-an-enrichment-adapter.md.
 */

import type { EnrichmentAdapter } from '../adapters/types.js';
import { createStubEnrichmentAdapter } from './stub.js';

export interface EnrichmentConfig {
  readonly currency?: string;
}

export function createEnrichmentAdapter(config: EnrichmentConfig): EnrichmentAdapter {
  return createStubEnrichmentAdapter(config.currency ?? 'EUR');
}

export { createStubEnrichmentAdapter };
