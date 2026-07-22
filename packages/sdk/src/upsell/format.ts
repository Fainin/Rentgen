/**
 * Minimal money formatter for the upsell widgets. Kept local (not imported from
 * results/format.ts) — the seam's import-only rule limits WS5 to frozen types/events/config,
 * never another stream's implementation files.
 */

const formatters = new Map<string, Intl.NumberFormat>();

function formatter(currency: string): Intl.NumberFormat {
  let f = formatters.get(currency);
  if (!f) {
    f = new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    });
    formatters.set(currency, f);
  }
  return f;
}

export function formatMoney(amount: number, currency: string): string {
  return formatter(currency).format(Math.round(amount));
}
