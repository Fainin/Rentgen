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

/**
 * The flashy "what your stuff is worth new" headline: Σ of each item's retail midpoint,
 * falling back to the resale midpoint for items that carry no retail estimate. Purely a
 * display figure — the frozen `totalIdleValue` (resale) stays the sell-it-all-now number.
 */
export function totalRetailValue(items: readonly EnrichedItem[]): number {
  return Math.round(
    items.reduce((sum, item) => sum + midpoint(item.estimatedRetail ?? item.resale), 0),
  );
}
