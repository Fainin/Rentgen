/**
 * Stream 5 local types — the generic export handoff. Everything rides under the loose
 * `Asset` shape (kind: 'export-bundle'); no widening of shared types.
 */

import type { Asset, EnrichedItem, PriceRange, Source } from '../types.js';

export interface UserRef {
  readonly id: string;
  readonly displayName?: string;
}

export interface ListingAsset {
  readonly kind: 'image';
  readonly mimeType: string;
  readonly role: 'primary' | 'gallery';
  readonly dataUrl?: string;
  readonly url?: string;
}

export interface ListingDraft {
  readonly sourceItemId: string;
  readonly title: string;
  readonly description: string;
  readonly category: string;
  readonly condition: string;
  readonly salePrice: PriceRange;
  readonly rentPricePerDay: PriceRange;
  readonly photo?: ListingAsset;
  readonly sources: readonly Source[];
  readonly attributes: Record<string, unknown>;
}

export interface ExportBundle extends Asset {
  readonly kind: 'export-bundle';
  readonly sessionId: string;
  readonly user?: UserRef;
  readonly generatedAt: number;
  readonly currency: string;
  readonly items: readonly ListingDraft[];
}

export interface UploadResult {
  readonly ok: boolean;
  readonly uploaded: number;
  readonly message?: string;
}

export interface UploadAdapter {
  upload(bundle: ExportBundle): Promise<UploadResult>;
}

export interface ExportAction {
  readonly id: string;
  readonly label: string;
  run(bundle: ExportBundle): Promise<UploadResult | void> | UploadResult | void;
}

export interface AuthContext {
  readonly isAuthenticated: boolean;
  readonly user?: UserRef;
  /** OPAQUE — the SDK never inspects or validates it. */
  readonly getToken?: () => string | Promise<string>;
}

export interface ListingEnricher {
  readonly name: string;
  enrich(draft: ListingDraft, item: EnrichedItem): Promise<ListingDraft>;
}

export interface AssetAdapterConfig {
  readonly auth?: AuthContext;
  readonly providers?: readonly ListingEnricher[];
  readonly uploader?: UploadAdapter;
  readonly actions?: readonly ExportAction[];
  readonly onExportReady?: (bundle: ExportBundle) => void;
  readonly onSignInRequest?: () => void;
}
