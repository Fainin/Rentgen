/**
 * Detection factory (frozen seam). Returns the real adapter when configured,
 * else the stub so downstream runs offline. Stream 4 wires this into configureRentgen.
 *
 * Real openai-vision adapter (gpt-5.6-luna, Structured Outputs) is Workstream 2's
 * job — until it lands, a set key logs a warning and falls back to the stub so the
 * demo never breaks on a half-built adapter.
 */
import type { DetectionAdapter } from '../adapters/types.js';
import { stubDetectionAdapter } from './stub.js';

export interface DetectionConfig {
  readonly openaiApiKey?: string;
  readonly model?: 'gpt-5.6-luna';
}

export function createDetectionAdapter(config: DetectionConfig = {}): DetectionAdapter {
  if (config.openaiApiKey) {
    // TODO(ws2): return the real gpt-5.6-luna adapter here once built.
    console.warn(
      '[rentgen] openaiApiKey set, but the real detection adapter is not yet implemented — using the stub.',
    );
  }
  return stubDetectionAdapter;
}
