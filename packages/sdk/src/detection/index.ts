/**
 * Stream 2 barrel — the frozen factory seam.
 * Gemini (frame-batch capable) when a Gemini key is present, OpenAI vision when only an
 * OpenAI key is present, stub otherwise.
 */

import type { DetectionAdapter } from '../adapters/types.js';
import { createGeminiVisionAdapter } from './gemini-vision.js';
import { createOpenAIVisionAdapter } from './openai-vision.js';
import { createStubDetectionAdapter } from './stub.js';

export interface DetectionConfig {
  /** Preferred: Gemini detection incl. whole-video frame batches (the krempel pattern). */
  readonly geminiApiKey?: string;
  readonly openaiApiKey?: string;
  /** Model override — Gemini ('gemini-flash-latest') or OpenAI ('gpt-4.1-nano') family. */
  readonly model?: string;
  /** Listing-quality gate: drop items below this identification confidence (default 0.45). */
  readonly minConfidence?: number;
  /** Known products likely to appear — steadies naming and fixes brand misreads. */
  readonly hints?: readonly string[];
}

export function createDetectionAdapter(config: DetectionConfig): DetectionAdapter {
  if (config.geminiApiKey) {
    return createGeminiVisionAdapter({
      geminiApiKey: config.geminiApiKey,
      // A model override configured for the OpenAI family must not leak into Gemini.
      model: config.model?.startsWith('gemini') ? config.model : undefined,
      minConfidence: config.minConfidence,
      hints: config.hints,
    });
  }
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

export { createGeminiVisionAdapter } from './gemini-vision.js';
export { createOpenAIVisionAdapter, createStubDetectionAdapter };
export { CATEGORIES } from './openai-vision.js';
