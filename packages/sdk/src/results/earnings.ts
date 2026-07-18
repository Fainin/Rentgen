/**
 * Passive-income display heuristic (Stream 4, demo-grade — see workstream spec).
 * A fixed share of each item's resale midpoint per month. Pure, local, no contract change.
 */

import type { EnrichedItem } from '../types.js';
import { midpoint } from './total.js';

/** Monthly passive income as a share of resale value (demo constant, 5–10% band). */
export const MONTHLY_INCOME_SHARE = 0.075;

export function monthlyPassiveIncome(items: readonly EnrichedItem[]): number {
  return Math.round(
    items.reduce((sum, item) => sum + midpoint(item.resale) * MONTHLY_INCOME_SHARE, 0),
  );
}
