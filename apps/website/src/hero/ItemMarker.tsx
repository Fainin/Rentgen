import type { RevealItem } from './items';
import { ItemIcon } from './ItemIcons';
import { formatCurrency } from './formatCurrency';

export interface ItemMarkerProps {
  item: RevealItem;
  revealed: boolean;
}

export function ItemMarker({ item, revealed }: ItemMarkerProps) {
  return (
    <div
      className={`item-marker${revealed ? ' item-marker--revealed' : ''}`}
      style={{ left: `${item.x}%`, top: `${item.y}%` }}
    >
      <ItemIcon id={item.id} />
      <span className="item-marker__tag">
        {item.label} · {formatCurrency(item.value)}
      </span>
    </div>
  );
}
