/**
 * Enrichment factory (frozen seam). Real adapter when keys are present, else stub.
 *
 * Real tavily-comps adapter (Tavily search → Gemini Flash reconcile) is Workstream 3's
 * job. The factory takes `geminiApiKey` (reconcile moved OpenAI→Gemini to preserve
 * OpenAI credits for hero detection). Until the real adapter lands, keys log a warning
 * and fall back to the stub.
 */
import type { EnrichmentAdapter } from '../adapters/types.js';
import { stubEnrichmentAdapter } from './stub.js';

export interface EnrichmentConfig {
  readonly tavilyApiKey?: string;
  readonly geminiApiKey?: string;
  readonly currency?: string;
}

export function createEnrichmentAdapter(config: EnrichmentConfig = {}): EnrichmentAdapter {
  if (config.tavilyApiKey || config.geminiApiKey) {
    // TODO(ws3): return the real tavily-comps + Gemini-reconcile adapter here once built.
    console.warn(
      '[rentgen] enrichment keys set, but the real adapter is not yet implemented — using the stub.',
    );
  }
  return stubEnrichmentAdapter;
}
