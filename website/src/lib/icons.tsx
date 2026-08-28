import {
  Armchair, Lamp, Flower2, Blinds, Wallpaper, CookingPot, DoorClosed, Bath,
  Utensils, Briefcase, Building2, Award, Users, Headphones, PencilRuler,
  Layers, KeyRound, Gem, Palette, Truck, Wrench, ShieldCheck, Sparkles,
  type LucideProps,
} from 'lucide-react'
import type { ComponentType } from 'react'

/**
 * Maps the string icon names stored in data (and, later, the database) to Lucide
 * components, so content can reference icons by name without importing them.
 */
const map: Record<string, ComponentType<LucideProps>> = {
  Armchair, Lamp, Flower2, Blinds, Wallpaper, CookingPot, DoorClosed, Bath,
  Utensils, Briefcase, Building2, Award, Users, Headphones, PencilRuler,
  Layers, KeyRound, Gem, Palette, Truck, Wrench, ShieldCheck,
}

export function Icon({ name, ...props }: { name: string } & LucideProps) {
  const Cmp = map[name] ?? Sparkles
  return <Cmp {...props} />
}
