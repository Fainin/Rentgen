/**
 * @rentgen/sdk — public surface.
 *
 * Importing this module self-registers the two custom elements (<rentgen-scanner>,
 * <rentgen-results>), so a host can just `import '@rentgen/sdk'` and drop the tags in.
 */

// Side-effect: register the widgets.
import './widgets/rentgen-scanner.js';
import './widgets/rentgen-results.js';

// Configuration + client
export { configureRentgen, getClient } from './config.js';
export type { RentgenConfig } from './config.js';
export { RentgenClient, midpoint, sumResaleMidpoints } from './client/RentgenClient.js';
export type { RentgenClientDeps } from './client/RentgenClient.js';

// Event bus (host apps can subscribe, e.g. for a live headline)
export { rentgenEvents } from './events.js';
export type { RentgenEventMap } from './events.js';

// Storage
export { SessionStore, hashImage } from './storage/sessionStore.js';

// Widgets (types — the elements register themselves on import)
export { RentgenScanner } from './widgets/rentgen-scanner.js';
export { RentgenResults } from './widgets/rentgen-results.js';

// Adapter interfaces + built-ins (the plugin surface)
export type { DetectionAdapter, EnrichmentAdapter, AssetAdapter } from './adapters/types.js';
export { OpenAIVisionAdapter } from './adapters/openai-vision.js';
export { TavilyCompsAdapter } from './adapters/tavily-comps.js';
export type { TavilyCompsConfig } from './adapters/tavily-comps.js';
export { StubDetectionAdapter, StubEnrichmentAdapter } from './adapters/stub.js';

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
