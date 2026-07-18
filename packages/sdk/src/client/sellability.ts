/**
 * The sellability gate — "only honestly-sellable items make the list".
 * Pure function over an EnrichedItem; used by RentgenClient before an item
 * enters ScanResult.items. Dropped items never reach the list OR the total,
 * so the idle-capital number is honest by construction.
 *
 * Signals come from existing fields (category/name/confidence from detection,
 * sources/resale from enrichment) — no frozen-type change. Detection's prompt
 * (Workstream 2) is the first line of defense; this is the compile-time backstop.
 */
import type { EnrichedItem } from '../types.js';

/** Tokens that mark an item as non-sellable (fixture / structural / non-goods). */
const DENYLIST = [
  'wall', 'floor', 'ceiling', 'window', 'door', 'radiator', 'curtain', 'blind',
  'built-in', 'pipe', 'cable', 'charger', 'trash', 'rubbish', 'plant', 'pet', 'person',
] as const;

export interface SellabilityOptions {
  /** Compile-time confidence floor (stricter than detection's 0.3). */
  readonly minConfidence?: number;
  /** Minimum resale midpoint (€) to be worth a card. */
  readonly minValue?: number;
}

export type SellabilityResult = true | { readonly reason: string };

export function sellabilityCheck(
  item: EnrichedItem,
  opts: SellabilityOptions = {},
): SellabilityResult {
  const minConfidence = opts.minConfidence ?? 0.4;
  const minValue = opts.minValue ?? 5;

  const hay = `${item.name} ${item.category}`.toLowerCase();
  for (const token of DENYLIST) {
    if (hay.includes(token)) return { reason: `not sellable (${token})` };
  }
  if (item.confidence < minConfidence) {
    return { reason: `low confidence (${item.confidence.toFixed(2)})` };
  }
  if (!item.sources || item.sources.length === 0) {
    return { reason: 'no grounded source' };
  }
  if (!(item.resale.max > 0)) {
    return { reason: 'no positive resale range' };
  }
  const midpoint = (item.resale.min + item.resale.max) / 2;
  if (midpoint < minValue) {
    return { reason: `below €${minValue} midpoint` };
  }
  return true;
}

/** Midpoint of a price range — the per-item contribution to the total. */
export function midpoint(min: number, max: number): number {
  return (min + max) / 2;
}
