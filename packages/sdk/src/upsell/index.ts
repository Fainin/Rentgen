/**
 * Stream 5 barrel — the frozen factory seam (`createAssetAdapter`) plus the export panel
 * and report card widgets. Importing this module registers both custom elements.
 */

import type { AssetAdapter } from '../adapters/types.js';
import type { Session } from '../types.js';
import { setAssetConfig } from './asset-config.js';
import { assembleExportBundle } from './export.js';
import type { AssetAdapterConfig, ExportBundle } from './types.js';

// Widgets — imported for their registration side effect.
import './rentgen-upsell.js';
import './rentgen-report-card.js';

export function createAssetAdapter(config?: AssetAdapterConfig): AssetAdapter {
  setAssetConfig(config);
  return {
    async render(session: Session): Promise<ExportBundle> {
      const bundle = await assembleExportBundle(session, config);
      config?.onExportReady?.(bundle);
      return bundle;
    },
  };
}

// Widget-side read access to the config the frozen AssetAdapter interface can't carry
// (auth / providers / uploader / actions / callbacks) — see asset-config.ts.
export { getAssetConfig } from './asset-config.js';

export { assembleExportBundle } from './export.js';
export type { AssembleOptions } from './export.js';

export { descriptionProvider } from './enrichers/description-provider.js';
export { photoProvider } from './enrichers/photo-provider.js';

export { midpoint, monthlyProjection, rankByRentPerDay, sumRentPerDay } from './projection.js';

export { RentgenUpsell } from './rentgen-upsell.js';
export { RentgenReportCard } from './rentgen-report-card.js';

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
} from './types.js';
