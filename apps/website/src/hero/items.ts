export type RevealItemId = 'bike' | 'guitar' | 'camera' | 'drone' | 'lamp' | 'sofa';

export interface RevealItem {
  id: RevealItemId;
  label: string;
  value: number;
  /** 0-100: position within the hero canvas, and the reveal % at which this item's tag animates in. */
  x: number;
  /** 0-100: vertical position within the hero canvas. */
  y: number;
}

export const REVEAL_ITEMS: RevealItem[] = [
  { id: 'bike', label: 'Bike', value: 350, x: 14, y: 62 },
  { id: 'guitar', label: 'Guitar', value: 220, x: 30, y: 40 },
  { id: 'camera', label: 'Camera', value: 480, x: 48, y: 58 },
  { id: 'drone', label: 'Drone', value: 650, x: 62, y: 30 },
  { id: 'lamp', label: 'Lamp', value: 150, x: 76, y: 48 },
  { id: 'sofa', label: 'Sofa', value: 2350, x: 88, y: 65 },
];

export const REVEAL_ITEMS_TOTAL = REVEAL_ITEMS.reduce((sum, item) => sum + item.value, 0);
