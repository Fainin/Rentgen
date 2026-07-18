/**
 * Core domain types for Rentgen. These are the contract every adapter, the client,
 * and both widgets agree on — lock them early so the team can build in parallel.
 *
 * Convention: treat every value here as immutable. Adapters return *new* objects;
 * nothing mutates a value it received (see coding-style: no in-place mutation).
 */

/** A money range in a single currency, e.g. { min: 40, max: 80, currency: "EUR" }. */
export interface PriceRange {
  readonly min: number;
  readonly max: number;
  readonly currency: string;
}

/** A web source backing a price — shown on each card so numbers are grounded, not hallucinated. */
export interface Source {
  readonly title: string;
  readonly url: string;
}

/** One distinct sellable/rentable object identified in a photo (output of a DetectionAdapter). */
export interface DetectedObject {
  /** Stable id for this object within a scan (used as React key / dedup key). */
  readonly id: string;
  readonly name: string;
  readonly category: string;
  /** Free-text condition, e.g. "used - good". */
  readonly condition: string;
  /** Detector confidence, 0..1. */
  readonly confidence: number;
}

/** A detected object priced against live comps (output of an EnrichmentAdapter). */
export interface EnrichedItem extends DetectedObject {
  readonly resale: PriceRange;
  readonly rentPerDay: PriceRange;
  readonly sources: readonly Source[];
  /**
   * Optional item photo (data URL) — the scan image persisted per item, attached by
   * RentgenClient at compile time. Read by <rentgen-results> and Stream 5's photoProvider.
   * (Sanctioned registry edit — see workstreams README, handoff #2.)
   */
  readonly image?: string;
}

/** The result of a single scan — what <rentgen-results> renders. */
export interface ScanResult {
  readonly sessionId: string;
  readonly items: readonly EnrichedItem[];
  /** Sum of each item's resale midpoint. See midpoint() in client/RentgenClient. */
  readonly totalIdleValue: number;
  /** Currency of totalIdleValue (assumed uniform across items for the demo). */
  readonly currency: string;
}

/** A persisted scan, stored in localStorage keyed by image hash for instant re-runs. */
export interface Session {
  readonly id: string;
  readonly imageHash: string;
  readonly result: ScanResult;
  readonly createdAt: number;
}

/**
 * Optional Phase-3 output (shareable report card, QR, etc.). Empty by default.
 * Kept deliberately loose until an AssetAdapter is actually built.
 */
export interface Asset {
  readonly kind: string;
  readonly [key: string]: unknown;
}
