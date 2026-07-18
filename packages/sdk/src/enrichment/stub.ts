/**
 * Offline EnrichmentAdapter — deterministic mock prices + plausible fake sources.
 * Category→price table, name-hash jitter so the demo total looks real but is stable.
 * Real tavily-comps (Tavily search → Gemini Flash reconcile) lands in Workstream 3.
 *
 * Grounding is the product: even the stub attaches ≥1 source per item, mirroring the
 * real adapter's invariant. Prices are ranges (absorb noise), single currency (EUR).
 */
import type { EnrichmentAdapter } from '../adapters/types.js';
import type { DetectedObject, EnrichedItem, PriceRange, Source } from '../types.js';

interface Band {
  readonly resale: readonly [number, number];
  readonly rent: readonly [number, number];
}

const PRICE_TABLE: Record<string, Band> = {
  Photography: { resale: [380, 480], rent: [12, 18] },
  Audio: { resale: [450, 600], rent: [15, 22] },
  Electronics: { resale: [150, 280], rent: [6, 10] },
  Gaming: { resale: [40, 70], rent: [2, 4] },
  Tools: { resale: [80, 140], rent: [5, 8] },
  Other: { resale: [20, 60], rent: [1, 3] },
};

function hash(name: string): number {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h;
}

/** Deterministic jitter inside a band — same input ⇒ same output. */
function jitter(name: string, band: readonly [number, number]): readonly [number, number] {
  const f = (hash(name) % 100) / 100; // 0..1
  const [lo, hi] = band;
  const span = hi - lo;
  return [
    Math.round(lo + span * 0.1 * f),
    Math.round(hi - span * 0.1 * (1 - f)),
  ] as const;
}

function sourcesFor(name: string): readonly Source[] {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return [
    { title: `${name} — used market`, url: `https://www.ebay.de/sch/i.html?_nkw=${slug}` },
    { title: `${name} — listings`, url: `https://www.kleinanzeigen.de/s-anzeige/${slug}` },
  ];
}

function range(min: number, max: number, currency: string): PriceRange {
  return { min, max, currency };
}

export const stubEnrichmentAdapter: EnrichmentAdapter = {
  async enrich(object: DetectedObject): Promise<EnrichedItem> {
    const band = PRICE_TABLE[object.category] ?? PRICE_TABLE.Other;
    const [rMin, rMax] = jitter(object.name, band.resale);
    const [dMin, dMax] = jitter(object.name, band.rent);
    return {
      ...object,
      resale: range(rMin, rMax, 'EUR'),
      rentPerDay: range(dMin, dMax, 'EUR'),
      sources: sourcesFor(object.name),
    };
  },
};
