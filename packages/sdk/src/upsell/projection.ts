/**
 * Pure ranking/projection helpers (Stream 5). A local `midpoint` is used deliberately —
 * WS5 doesn't import Stream 4's results/total.ts: the seam's import-only rule limits it to
 * frozen types/events/config, not another stream's implementation files.
 */

import type { EnrichedItem, PriceRange } from '../types.js';

/**
 * Rental days assumed per month for the monthly projection. A demo constant, not a real
 * occupancy model — picked to land in a believable "a few days a month" range.
 */
const PROJECTED_RENTAL_DAYS_PER_MONTH = 10;

export function midpoint(range: PriceRange): number {
  return (range.min + range.max) / 2;
}

/** Items ranked by rent/day midpoint, highest first. */
export function rankByRentPerDay(items: readonly EnrichedItem[]): readonly EnrichedItem[] {
  return [...items].sort((a, b) => midpoint(b.rentPerDay) - midpoint(a.rentPerDay));
}

/** Sum of each item's rent/day midpoint, scaled by the assumed rental days/month. */
export function monthlyProjection(items: readonly EnrichedItem[]): number {
  return Math.round(
    items.reduce(
      (sum, item) => sum + midpoint(item.rentPerDay) * PROJECTED_RENTAL_DAYS_PER_MONTH,
      0,
    ),
  );
}

/** Sum of each item's rent/day midpoint (across all given items). */
export function sumRentPerDay(items: readonly EnrichedItem[]): number {
  return Math.round(items.reduce((sum, item) => sum + midpoint(item.rentPerDay), 0));
}
