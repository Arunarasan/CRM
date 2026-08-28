import {
  Sparkles,
  Armchair, Lamp, Flower2, Blinds, Wallpaper, CookingPot, DoorClosed, Bath,
  Utensils, Briefcase, Building2, Award, Users, Headphones, PencilRuler,
  Layers, KeyRound, Gem, Palette, Truck, Wrench, ShieldCheck, PaintRoller,
  Hammer, Home, Sofa, type LucideProps,
} from 'lucide-react';
import type { ComponentType } from 'react';

/** Same curated lucide set the public site resolves against, with a Sparkles fallback. */
const ICONS: Record<string, ComponentType<LucideProps>> = {
  Armchair, Lamp, Flower2, Blinds, Wallpaper, CookingPot, DoorClosed, Bath,
  Utensils, Briefcase, Building2, Award, Users, Headphones, PencilRuler,
  Layers, KeyRound, Gem, Palette, Truck, Wrench, ShieldCheck, PaintRoller,
  Hammer, Home, Sofa,
};

/** Accept "paint-roller", "paintRoller" or "PaintRoller" → resolve to a lucide component. */
export function resolveIcon(name?: string): ComponentType<LucideProps> {
  if (!name) return Sparkles;
  const pascal = name.replace(/(^|[-_\s]+)([a-z])/g, (_, __, c) => c.toUpperCase()).replace(/[-_\s]/g, '');
  return ICONS[pascal] ?? ICONS[name] ?? Sparkles;
}

/** Render a lucide icon by its stored string name. */
export function LucideByName({ name, ...props }: { name?: string } & LucideProps) {
  const Cmp = resolveIcon(name);
  return <Cmp {...props} />;
}
