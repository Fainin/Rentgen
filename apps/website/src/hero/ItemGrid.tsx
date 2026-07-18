import { memo } from 'react';
import { SCAN_ITEMS } from './items';
import { ItemIcon } from './icons';
import { formatCurrency } from './formatCurrency';

interface ItemCardProps {
  name: string;
  sell: number;
  rent: number;
  icon: string;
  lit: boolean;
}

const ItemCard = memo(function ItemCard({ name, sell, rent, icon, lit }: ItemCardProps) {
  return (
    <div className="scan-card">
      <div className="scan-card__hatch" />
      <div className="scan-card__ghost">
        <ItemIcon name={icon} className="scan-card__ghost-icon" />
      </div>
      <div className={`scan-card__lit${lit ? ' scan-card__lit--on' : ''}`}>
        <div className="scan-card__head">
          <span className="scan-card__name">{name}</span>
          <ItemIcon name={icon} className="scan-card__icon" />
        </div>
        <div>
          <div className="scan-card__sell">{formatCurrency(sell)}</div>
          <div className="scan-card__rent">{formatCurrency(rent)}/day</div>
        </div>
      </div>
    </div>
  );
});

export interface ItemGridProps {
  litCount: number;
}

export function ItemGrid({ litCount }: ItemGridProps) {
  return (
    <div className="scan-grid" aria-hidden="true">
      {SCAN_ITEMS.map((item, i) => (
        <ItemCard
          key={item.name}
          name={item.name}
          sell={item.sell}
          rent={item.rent}
          icon={item.icon}
          lit={i < litCount}
        />
      ))}
    </div>
  );
}
