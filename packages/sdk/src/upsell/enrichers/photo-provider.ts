/**
 * Default listing enricher: maps EnrichedItem.image (a data URL, attached by RentgenClient
 * at compile time — see workstreams README handoff #2) to the draft's primary photo.
 * Degrades gracefully when the image is absent: no photo, never a failed export.
 */

import type { EnrichedItem } from '../../types.js';
import type { ListingAsset, ListingDraft, ListingEnricher } from '../types.js';

export const photoProvider: ListingEnricher = {
  name: 'photo-provider',
  async enrich(draft: ListingDraft, item: EnrichedItem): Promise<ListingDraft> {
    if (!item.image) return draft;
    const photo: ListingAsset = {
      kind: 'image',
      mimeType: 'image/jpeg',
      role: 'primary',
      dataUrl: item.image,
    };
    return { ...draft, photo };
  },
};
