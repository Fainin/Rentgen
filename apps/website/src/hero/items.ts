export interface ScanItem {
  name: string;
  /** Resale value in EUR. */
  sell: number;
  /** Rental income per day in EUR. */
  rent: number;
  icon: string;
}

export const SCAN_ITEMS: ScanItem[] = [
  { name: 'Electric guitar', sell: 420, rent: 14, icon: 'guitar' },
  { name: 'Cordless drill', sell: 85, rent: 8, icon: 'wrench' },
  { name: 'DSLR camera', sell: 610, rent: 22, icon: 'camera' },
  { name: 'Road bike', sell: 540, rent: 18, icon: 'bike' },
  { name: 'Espresso machine', sell: 190, rent: 9, icon: 'coffee' },
  { name: 'Projector', sell: 260, rent: 16, icon: 'video' },
  { name: 'Turntable', sell: 150, rent: 7, icon: 'disc-3' },
  { name: 'Game console', sell: 240, rent: 12, icon: 'gamepad-2' },
  { name: '4-person tent', sell: 130, rent: 11, icon: 'tent' },
  { name: 'Kayak', sell: 480, rent: 25, icon: 'waves' },
  { name: 'Stand mixer', sell: 210, rent: 8, icon: 'utensils' },
  { name: 'Ski set', sell: 300, rent: 20, icon: 'snowflake' },
  { name: 'Camera drone', sell: 350, rent: 19, icon: 'plane' },
  { name: '4K monitor', sell: 220, rent: 9, icon: 'monitor' },
  { name: 'Pressure washer', sell: 140, rent: 13, icon: 'spray-can' },
  { name: 'Sewing machine', sell: 120, rent: 6, icon: 'scissors' },
  { name: 'Snowboard', sell: 260, rent: 17, icon: 'mountain-snow' },
  { name: 'Camera lens', sell: 480, rent: 15, icon: 'aperture' },
  { name: 'Guitar amp', sell: 175, rent: 9, icon: 'speaker' },
  { name: 'Extension ladder', sell: 90, rent: 7, icon: 'ruler' },
  { name: 'Chainsaw', sell: 160, rent: 12, icon: 'axe' },
  { name: 'Telescope', sell: 240, rent: 14, icon: 'telescope' },
  { name: 'Roller suitcase', sell: 70, rent: 5, icon: 'briefcase' },
  { name: 'PA speaker', sell: 200, rent: 15, icon: 'volume-2' },
  { name: 'MIDI keyboard', sell: 190, rent: 8, icon: 'piano' },
  { name: 'Golf club set', sell: 280, rent: 16, icon: 'target' },
  { name: 'Belt sander', sell: 75, rent: 6, icon: 'hammer' },
  { name: 'Robot vacuum', sell: 180, rent: 7, icon: 'bot' },
  { name: 'Ring light', sell: 45, rent: 4, icon: 'lightbulb' },
  { name: 'Power blender', sell: 130, rent: 5, icon: 'cup-soda' },
  { name: 'VR headset', sell: 320, rent: 18, icon: 'glasses' },
  { name: 'E-scooter', sell: 380, rent: 21, icon: 'zap' },
  { name: 'Tool chest', sell: 150, rent: 8, icon: 'package' },
  { name: 'Camping stove', sell: 60, rent: 5, icon: 'flame' },
  { name: 'Studio mic', sell: 200, rent: 9, icon: 'mic' },
  { name: 'Film camera', sell: 260, rent: 12, icon: 'film' },
];

export const TOTAL_SELL = SCAN_ITEMS.reduce((sum, item) => sum + item.sell, 0);
export const TOTAL_RENT = SCAN_ITEMS.reduce((sum, item) => sum + item.rent, 0);
