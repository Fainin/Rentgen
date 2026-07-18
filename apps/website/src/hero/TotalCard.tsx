import { formatCurrency } from './formatCurrency';
import { TOTAL_RENT, TOTAL_SELL } from './items';

export interface TotalCardProps {
  total: number;
  rentTotal: number;
}

export function TotalCard({ total, rentTotal }: TotalCardProps) {
  return (
    <div
      className="total-card"
      aria-label={`Total value in view: ${formatCurrency(TOTAL_SELL)} idle capital, plus ${formatCurrency(TOTAL_RENT)} per day potential rental income`}
    >
      <div className="total-card__label" aria-hidden="true">
        Total value in view
      </div>
      <div className="total-card__value" aria-hidden="true">
        {formatCurrency(Math.round(total))}
      </div>
      <div className="total-card__sub" aria-hidden="true">
        idle capital sitting on your shelves
      </div>
      <div className="total-card__chip" aria-hidden="true">
        + {formatCurrency(Math.round(rentTotal))}/day potential rental income
      </div>
    </div>
  );
}
