import { REVEAL_ITEMS_TOTAL } from './items';
import { formatCurrency } from './formatCurrency';
import { clampReveal } from './XrayReveal';

export interface MoneyCounterProps {
  reveal: number;
}

export function MoneyCounter({ reveal }: MoneyCounterProps) {
  const clamped = clampReveal(reveal);
  const amount = Math.round((clamped / 100) * REVEAL_ITEMS_TOTAL);

  return (
    <div className="money-counter" role="status" aria-live="polite">
      <span className="money-counter__value">{formatCurrency(amount)}</span>
      <span className="money-counter__label">per month, idle in your room</span>
    </div>
  );
}
