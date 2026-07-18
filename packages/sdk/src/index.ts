/**
 * @rentgen/sdk — public surface.
 *
 * Importing this module also self-registers the two widgets (<rentgen-scanner>,
 * <rentgen-results>) as a side effect, so a host app that calls configureRentgen()
 * and drops the tags into JSX gets a working flow with no extra wiring.
 */
// Domain types
export type {
  Asset,
  DetectedObject,
  EnrichedItem,
  PriceRange,
  ScanResult,
  Session,
  Source,
} from './types.js';

// Adapter interfaces (the plugin surface)
export type { DetectionAdapter, EnrichmentAdapter, AssetAdapter } from './adapters/types.js';

// Client + config (the orchestration surface)
export { RentgenClient } from './client/RentgenClient.js';
export type { ClientConfig } from './client/RentgenClient.js';
export { sellabilityCheck, midpoint } from './client/sellability.js';
export type { SellabilityOptions, SellabilityResult } from './client/sellability.js';
export { configureRentgen, getClient } from './config.js';
export type { RentgenConfig } from './config.js';

// Event bus (for advanced consumers; widgets subscribe internally)
export { emit, on } from './events.js';
export type { RentgenEvents } from './events.js';

// Factories (for custom wiring)
export { createDetectionAdapter } from './detection/index.js';
export type { DetectionConfig } from './detection/index.js';
export { createEnrichmentAdapter } from './enrichment/index.js';
export type { EnrichmentConfig } from './enrichment/index.js';

// Widget registration (side effect — keeps customElements.define out of tree-shaking).
import './capture/rentgen-scanner.js';
import './results/rentgen-results.js';
