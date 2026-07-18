/**
 * Stream 2 barrel — the frozen factory seam.
 * Real adapter (openai-vision) when a key is present, stub otherwise.
 */

import type { DetectionAdapter } from '../adapters/types.js';
import { createOpenAIVisionAdapter } from './openai-vision.js';
import { createStubDetectionAdapter } from './stub.js';

export interface DetectionConfig {
  readonly openaiApiKey?: string;
  readonly model?: 'gpt-4o' | 'gpt-4o-mini';
}

export function createDetectionAdapter(config: DetectionConfig): DetectionAdapter {
  if (config.openaiApiKey) {
    return createOpenAIVisionAdapter({ openaiApiKey: config.openaiApiKey, model: config.model });
  }
  return createStubDetectionAdapter();
}

export { createOpenAIVisionAdapter, createStubDetectionAdapter };
export { CATEGORIES } from './openai-vision.js';
