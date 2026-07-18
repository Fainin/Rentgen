/**
 * @rentgen/sdk — public surface.
 *
 * CURRENT STATE: contracts only. The domain types and the adapter plugin interfaces are
 * locked so the team can build against a stable API. Implementations (RentgenClient,
 * adapters, storage, widgets) are TODO — see CLAUDE.md for the target architecture.
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
