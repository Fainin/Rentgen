/**
 * Bundle assembly — Session -> ExportBundle. AssetAdapter.render(session) (index.ts) calls
 * this with ALL items (the pull path); <rentgen-upsell>'s "List N" button calls it with the
 * selected subset. Either way: base ListingDraft per item -> run the enricher providers in
 * sequence -> attach the auth user -> return the bundle.
 *
 * Providers are pure and composable: each returns a NEW draft, never mutates the input. A
 * provider that throws skips just that enrichment for that item — the warning is recorded
 * on the draft's `attributes.enrichmentWarnings` so it's visible without ever failing the
 * whole bundle.
 */

import type { EnrichedItem, Session } from '../types.js';
import type { AssetAdapterConfig, ExportBundle, ListingDraft, ListingEnricher } from './types.js';
import { descriptionProvider } from './enrichers/description-provider.js';
import { photoProvider } from './enrichers/photo-provider.js';

/** Shipped defaults — always run first, before any host-registered providers. */
const DEFAULT_PROVIDERS: readonly ListingEnricher[] = [descriptionProvider, photoProvider];

export interface AssembleOptions {
  /** Item ids to include. Omit (or leave undefined) to include every item in the session. */
  readonly selectedItemIds?: readonly string[];
}

function baseDraft(item: EnrichedItem): ListingDraft {
  return {
    sourceItemId: item.id,
    title: item.name,
    description: `${item.name} (${item.condition}).`,
    category: item.category,
    condition: item.condition,
    salePrice: item.resale,
    rentPricePerDay: item.rentPerDay,
    photo: undefined,
    sources: item.sources,
    attributes: {},
  };
}

async function runProviders(
  draft: ListingDraft,
  item: EnrichedItem,
  providers: readonly ListingEnricher[],
): Promise<ListingDraft> {
  let current = draft;
  const warnings: string[] = [];
  for (const provider of providers) {
    try {
      current = await provider.enrich(current, item);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'unknown error';
      warnings.push(`${provider.name}: ${message}`);
    }
  }
  if (warnings.length === 0) return current;
  return {
    ...current,
    attributes: { ...current.attributes, enrichmentWarnings: warnings },
  };
}

function selectItems(
  items: readonly EnrichedItem[],
  selectedItemIds: readonly string[] | undefined,
): readonly EnrichedItem[] {
  if (!selectedItemIds) return items;
  const wanted = new Set(selectedItemIds);
  return items.filter((item) => wanted.has(item.id));
}

export async function assembleExportBundle(
  session: Session,
  config: AssetAdapterConfig | undefined,
  options: AssembleOptions = {},
): Promise<ExportBundle> {
  const providers = [...DEFAULT_PROVIDERS, ...(config?.providers ?? [])];
  const items = selectItems(session.result.items, options.selectedItemIds);

  const drafts = await Promise.all(
    items.map((item) => runProviders(baseDraft(item), item, providers)),
  );

  return {
    kind: 'export-bundle',
    sessionId: session.id,
    user: config?.auth?.user,
    generatedAt: Date.now(),
    currency: session.result.currency,
    items: drafts,
  };
}
