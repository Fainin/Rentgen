/**
 * Offline EnrichmentAdapter stub (Stream 3). Deterministic (same input → same output),
 * zero network, resolves fast, prices vary by category so the demo total looks real.
 */

import type { EnrichmentAdapter } from '../adapters/types.js';
import type { DetectedObject, EnrichedItem, PriceRange } from '../types.js';

const CATEGORY_BASE: Readonly<Record<string, number>> = {
  Photography: 620,
  Electronics: 240,
  Audio: 180,
  Gaming: 320,
  Computing: 900,
  Tools: 110,
  'Sports & Outdoor': 140,
  'Music Instruments': 380,
  'Home & Kitchen': 90,
  Furniture: 150,
  Other: 60,
};

function nameJitter(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return (h % 40) / 100; // 0..0.39
}

function range(min: number, max: number, currency: string): PriceRange {
  return { min: Math.max(1, Math.round(min)), max: Math.max(1, Math.round(max)), currency };
}

export function createStubEnrichmentAdapter(currency = 'EUR'): EnrichmentAdapter {
  return {
    async enrich(object: DetectedObject): Promise<EnrichedItem> {
      const base = CATEGORY_BASE[object.category] ?? CATEGORY_BASE.Other;
      const value = base * (0.8 + nameJitter(object.name));
      const resale = range(value * 0.75, value * 1.25, currency);
      const rentPerDay = range(Math.max(1, value * 0.02), Math.max(2, value * 0.045), currency);
      return {
        ...object,
        resale,
        rentPerDay,
        sources: [
          { title: `eBay sold listings — ${object.name}`, url: 'https://www.ebay.de/' },
          { title: `Kleinanzeigen — ${object.name}`, url: 'https://www.kleinanzeigen.de/' },
        ],
      };
    },
  };
}
