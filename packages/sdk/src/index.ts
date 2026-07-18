/**
 * @rentgen/sdk — public surface (Stream 4 owns this barrel).
 *
 * Importing the package registers the widgets (<rentgen-scanner>, <rentgen-results>,
 * and Stream 5's elements once they land) as standard custom elements — usable from
 * React, Angular (CUSTOM_ELEMENTS_SCHEMA), or plain HTML unchanged.
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

// Configure-once singleton + client
export { configureRentgen, getClient, getAssetAdapter } from './config.js';
export type { RentgenConfig } from './config.js';
export { RentgenClient } from './client/RentgenClient.js';

// Event bus (the only widget↔widget channel)
export { emit, on } from './events.js';
export type { RentgenEventMap, RentgenEventName } from './events.js';

// Stream factories (the frozen seams)
export { createDetectionAdapter } from './detection/index.js';
export { createEnrichmentAdapter } from './enrichment/index.js';
export { createAssetAdapter } from './upsell/index.js';
export type {
  AssetAdapterConfig,
  AuthContext,
  ExportAction,
  ExportBundle,
  ListingAsset,
  ListingDraft,
  ListingEnricher,
  UploadAdapter,
  UploadResult,
  UserRef,
} from './upsell/index.js';

// Widgets — imported for their registration side effect (and exported for typing)
export { RentgenScanner } from './capture/index.js';
export { RentgenResults } from './results/rentgen-results.js';
export { RentgenUpsell, RentgenReportCard } from './upsell/index.js';
