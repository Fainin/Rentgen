/**
 * The frozen total contract (Stream 4): totalIdleValue = Σ of each item's resale midpoint.
 */

import type { EnrichedItem, PriceRange } from '../types.js';

export function midpoint(range: PriceRange): number {
  return (range.min + range.max) / 2;
}

export function totalIdleValue(items: readonly EnrichedItem[]): number {
  return Math.round(items.reduce((sum, item) => sum + midpoint(item.resale), 0));
}
