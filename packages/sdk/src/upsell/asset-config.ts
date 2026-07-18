/**
 * Module-scoped stash of the most recently configured AssetAdapterConfig.
 *
 * The frozen `AssetAdapter` interface (adapters/types.ts) only exposes `render(session)` —
 * but the widgets also need `auth`, `providers`, `uploader`, `actions`, and the callbacks,
 * which don't fit through that interface. `createAssetAdapter` stashes its config here on
 * every call; widgets read it back via `getAssetConfig()`. Kept in its own file (rather than
 * in index.ts) so `rentgen-upsell.ts` / `rentgen-report-card.ts` can import it without a
 * circular dependency on the barrel that imports them.
 */

import type { AssetAdapterConfig } from './types.js';

let currentConfig: AssetAdapterConfig | undefined;

/** Called by createAssetAdapter — not part of the public barrel. */
export function setAssetConfig(config: AssetAdapterConfig | undefined): void {
  currentConfig = config;
}

/** The most recently configured AssetAdapterConfig, or undefined if none ever arrived. */
export function getAssetConfig(): AssetAdapterConfig | undefined {
  return currentConfig;
}
