import {
  Sofa, Armchair, Lamp, LampDesk, LampFloor, LampCeiling, Lightbulb, Bed, BedDouble, Blinds,
  Wallpaper, PaintRoller, PaintBucket, Paintbrush, Palette, Brush, Scissors, Ruler, PencilRuler,
  Frame, Image, Flower2, Leaf, Trees, Home, Building2, Warehouse, Store, DoorClosed, DoorOpen,
  Bath, ShowerHead, CookingPot, Utensils, Refrigerator, WashingMachine, Tv, Fan, AirVent, Heater,
  Gem, Crown, Star, Award, Heart, Gift, Tag, Layers, Grid3x3, LayoutGrid, Square, Columns3, Table2,
  Box, Package, Archive, Briefcase, Users, Headphones, KeyRound, Truck, Wrench, Hammer, Drill,
  ShieldCheck, Shirt, Baby, Sun, Droplets, Waves, Sticker, Sparkles,
  type LucideProps,
} from 'lucide-react'
import type { ComponentType } from 'react'

/**
 * Maps the string icon names stored in data (and the CRM CMS icon picker) to Lucide
 * components, so content can reference icons by name without importing them.
 * Keep in sync with ICON_OPTIONS in frontend/src/pages/website/icons.tsx.
 */
const map: Record<string, ComponentType<LucideProps>> = {
  Sofa, Armchair, Lamp, LampDesk, LampFloor, LampCeiling, Lightbulb, Bed, BedDouble, Blinds,
  Wallpaper, PaintRoller, PaintBucket, Paintbrush, Palette, Brush, Scissors, Ruler, PencilRuler,
  Frame, Image, Flower2, Leaf, Trees, Home, Building2, Warehouse, Store, DoorClosed, DoorOpen,
  Bath, ShowerHead, CookingPot, Utensils, Refrigerator, WashingMachine, Tv, Fan, AirVent, Heater,
  Gem, Crown, Star, Award, Heart, Gift, Tag, Layers, Grid3x3, LayoutGrid, Square, Columns3, Table2,
  Box, Package, Archive, Briefcase, Users, Headphones, KeyRound, Truck, Wrench, Hammer, Drill,
  ShieldCheck, Shirt, Baby, Sun, Droplets, Waves, Sticker, Sparkles,
}

/** Accept "paint-roller", "paintRoller" or "PaintRoller" (older CMS entries were free text). */
const toPascal = (n: string) =>
  n.replace(/(^|[-_\s]+)([a-z])/g, (_, __, c: string) => c.toUpperCase()).replace(/[-_\s]/g, '')

export function Icon({ name, ...props }: { name: string } & LucideProps) {
  const Cmp = map[name] ?? (name ? map[toPascal(name)] : undefined) ?? Sparkles
  return <Cmp {...props} />
}
