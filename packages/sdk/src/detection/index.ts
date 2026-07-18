/**
 * Stream 2 barrel — the frozen factory seam.
 * Real adapter (openai-vision) when a key is present, stub otherwise.
 */

import type { DetectionAdapter } from '../adapters/types.js';
import { createOpenAIVisionAdapter } from './openai-vision.js';
import { createStubDetectionAdapter } from './stub.js';

export interface DetectionConfig {
  readonly openaiApiKey?: string;
  /** OpenAI vision model, e.g. 'gpt-4.1' (default), 'gpt-4.1-mini', 'gpt-4o'. */
  readonly model?: string;
  /** Listing-quality gate: drop items below this identification confidence (default 0.8). */
  readonly minConfidence?: number;
  /** Known products likely to appear — steadies naming and fixes brand misreads. */
  readonly hints?: readonly string[];
}

export function createDetectionAdapter(config: DetectionConfig): DetectionAdapter {
  if (config.openaiApiKey) {
    return createOpenAIVisionAdapter({
      openaiApiKey: config.openaiApiKey,
      model: config.model,
      minConfidence: config.minConfidence,
      hints: config.hints,
    });
  }
  return createStubDetectionAdapter();
}

export { createOpenAIVisionAdapter, createStubDetectionAdapter };
export { CATEGORIES } from './openai-vision.js';
