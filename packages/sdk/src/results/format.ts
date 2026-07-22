/** Money formatting helpers for the results UI (Stream 4). */

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

export function formatRange(min: number, max: number, currency: string): string {
  return `${formatMoney(min, currency)}–${formatMoney(max, currency)}`;
}
