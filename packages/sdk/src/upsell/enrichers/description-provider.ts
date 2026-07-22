/**
 * Default listing enricher: a generated title (name + condition tag) and a short, honest
 * 1–2 sentence description built from name/category/condition. Template-based — no API
 * calls, so the demo always has a usable listing even offline.
 */

import type { EnrichedItem } from '../../types.js';
import type { ListingDraft, ListingEnricher } from '../types.js';

function conditionTag(condition: string): string {
  return condition.trim() || 'used';
}

function generateTitle(item: EnrichedItem): string {
  return `${item.name} — ${conditionTag(item.condition)}`;
}

function generateDescription(item: EnrichedItem): string {
  const category = item.category.trim();
  const condition = conditionTag(item.condition);
  const intro = category
    ? `${item.name} (${category}), in ${condition} condition.`
    : `${item.name}, in ${condition} condition.`;
  return `${intro} Priced against live comps — see sources for details.`;
}

export const descriptionProvider: ListingEnricher = {
  name: 'description-provider',
  async enrich(draft: ListingDraft, item: EnrichedItem): Promise<ListingDraft> {
    return {
      ...draft,
      title: generateTitle(item),
      description: generateDescription(item),
    };
  },
};
