import type { LucideIcon } from 'lucide-react';
import {
  Aperture,
  Axe,
  Bike,
  Bot,
  Briefcase,
  Camera,
  Coffee,
  CupSoda,
  Disc3,
  Film,
  Flame,
  Gamepad2,
  Glasses,
  Guitar,
  Hammer,
  Lightbulb,
  Mic,
  Monitor,
  MountainSnow,
  Package,
  Piano,
  Plane,
  Ruler,
  Scissors,
  Snowflake,
  Speaker,
  SprayCan,
  Target,
  Telescope,
  Tent,
  Utensils,
  Video,
  Volume2,
  Waves,
  Wrench,
  Zap,
} from 'lucide-react';

const ICONS: Record<string, LucideIcon> = {
  aperture: Aperture,
  axe: Axe,
  bike: Bike,
  bot: Bot,
  briefcase: Briefcase,
  camera: Camera,
  coffee: Coffee,
  'cup-soda': CupSoda,
  'disc-3': Disc3,
  film: Film,
  flame: Flame,
  'gamepad-2': Gamepad2,
  glasses: Glasses,
  guitar: Guitar,
  hammer: Hammer,
  lightbulb: Lightbulb,
  mic: Mic,
  monitor: Monitor,
  'mountain-snow': MountainSnow,
  package: Package,
  piano: Piano,
  plane: Plane,
  ruler: Ruler,
  scissors: Scissors,
  snowflake: Snowflake,
  speaker: Speaker,
  'spray-can': SprayCan,
  target: Target,
  telescope: Telescope,
  tent: Tent,
  utensils: Utensils,
  video: Video,
  'volume-2': Volume2,
  waves: Waves,
  wrench: Wrench,
  zap: Zap,
};

export interface ItemIconProps {
  name: string;
  className?: string;
}

export function ItemIcon({ name, className }: ItemIconProps) {
  const Icon = ICONS[name];
  if (!Icon) return null;
  return <Icon className={className} strokeWidth={1.75} aria-hidden="true" />;
}
