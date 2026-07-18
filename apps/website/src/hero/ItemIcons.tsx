import type { RevealItemId } from './items';

export interface ItemIconProps {
  id: RevealItemId;
}

export function ItemIcon({ id }: ItemIconProps) {
  switch (id) {
    case 'bike':
      return (
        <svg viewBox="0 0 24 24" className="item-marker__icon" aria-hidden="true">
          <circle cx="6" cy="17" r="3.2" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <circle cx="18" cy="17" r="3.2" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <path
            d="M6 17 L11 8 L16 17 M11 8 L14 8 M9 12 L16 12 L18 17"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
        </svg>
      );
    case 'guitar':
      return (
        <svg viewBox="0 0 24 24" className="item-marker__icon" aria-hidden="true">
          <circle cx="9" cy="16" r="5" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <circle cx="11" cy="10" r="3" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <line x1="12" y1="8" x2="17" y2="3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );
    case 'camera':
      return (
        <svg viewBox="0 0 24 24" className="item-marker__icon" aria-hidden="true">
          <rect x="3" y="7" width="18" height="13" rx="2" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <rect x="8" y="4" width="6" height="3" rx="1" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <circle cx="12" cy="13.5" r="4" fill="none" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      );
    case 'drone':
      return (
        <svg viewBox="0 0 24 24" className="item-marker__icon" aria-hidden="true">
          <rect x="10" y="10" width="4" height="4" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <line x1="10" y1="10" x2="4" y2="4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="14" y1="10" x2="20" y2="4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="10" y1="14" x2="4" y2="20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="14" y1="14" x2="20" y2="20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <circle cx="4" cy="4" r="2" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <circle cx="20" cy="4" r="2" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <circle cx="4" cy="20" r="2" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <circle cx="20" cy="20" r="2" fill="none" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      );
    case 'lamp':
      return (
        <svg viewBox="0 0 24 24" className="item-marker__icon" aria-hidden="true">
          <path d="M7 5 L17 5 L14 12 L10 12 Z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
          <line x1="12" y1="12" x2="12" y2="19" stroke="currentColor" strokeWidth="1.5" />
          <line x1="8" y1="20" x2="16" y2="20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );
    case 'sofa':
      return (
        <svg viewBox="0 0 24 24" className="item-marker__icon" aria-hidden="true">
          <rect x="3" y="11" width="18" height="7" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <rect x="3" y="8" width="4" height="6" rx="1" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <rect x="17" y="8" width="4" height="6" rx="1" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <line x1="5" y1="18" x2="5" y2="20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="19" y1="18" x2="19" y2="20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );
    default:
      return null;
  }
}
