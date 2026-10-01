import { useMemo, useState } from 'react';
import {
  Sparkles, Search, X, Check,
  Sofa, Armchair, Lamp, LampDesk, LampFloor, LampCeiling, Lightbulb, Bed, BedDouble, Blinds,
  Wallpaper, PaintRoller, PaintBucket, Paintbrush, Palette, Brush, Scissors, Ruler, PencilRuler,
  Frame, Image, Flower2, Leaf, Trees, Home, Building2, Warehouse, Store, DoorClosed, DoorOpen,
  Bath, ShowerHead, CookingPot, Utensils, Refrigerator, WashingMachine, Tv, Fan, AirVent, Heater,
  Gem, Crown, Star, Award, Heart, Gift, Tag, Layers, Grid3x3, LayoutGrid, Square, Columns3, Table2,
  Box, Package, Archive, Briefcase, Users, Headphones, KeyRound, Truck, Wrench, Hammer, Drill,
  ShieldCheck, Shirt, Baby, Sun, Droplets, Waves, Sticker,
  type LucideProps,
} from 'lucide-react';
import type { ComponentType } from 'react';

type IconDef = { name: string; label: string; tags: string; Icon: ComponentType<LucideProps> };

/**
 * Curated lucide set the public site can render (keep in sync with website/src/lib/icons.tsx).
 * `name` is the PascalCase value stored in the DB; `tags` feed the picker search.
 */
export const ICON_OPTIONS: IconDef[] = [
  { name: 'Sofa', label: 'Sofa', tags: 'furniture couch seating living', Icon: Sofa },
  { name: 'Armchair', label: 'Armchair', tags: 'furniture chair seating', Icon: Armchair },
  { name: 'Bed', label: 'Bed', tags: 'bedroom furniture mattress', Icon: Bed },
  { name: 'BedDouble', label: 'Double bed', tags: 'bedroom furniture mattress', Icon: BedDouble },
  { name: 'Table2', label: 'Table', tags: 'furniture dining desk', Icon: Table2 },
  { name: 'Blinds', label: 'Blinds', tags: 'curtains window shades roller', Icon: Blinds },
  { name: 'Columns3', label: 'Curtains / panels', tags: 'curtain drapes window panels', Icon: Columns3 },
  { name: 'Waves', label: 'Fabric / drapes', tags: 'fabric curtain drapes textile flow', Icon: Waves },
  { name: 'Shirt', label: 'Textile', tags: 'fabric cloth upholstery textile', Icon: Shirt },
  { name: 'Wallpaper', label: 'Wallpaper', tags: 'wall decor paper', Icon: Wallpaper },
  { name: 'Sticker', label: 'Wall sticker', tags: 'decal wall decor', Icon: Sticker },
  { name: 'PaintRoller', label: 'Paint roller', tags: 'painting wall paint', Icon: PaintRoller },
  { name: 'PaintBucket', label: 'Paint bucket', tags: 'painting paint colour', Icon: PaintBucket },
  { name: 'Paintbrush', label: 'Paintbrush', tags: 'painting art', Icon: Paintbrush },
  { name: 'Brush', label: 'Brush', tags: 'painting cleaning', Icon: Brush },
  { name: 'Palette', label: 'Palette', tags: 'colour design art', Icon: Palette },
  { name: 'Lamp', label: 'Lamp', tags: 'lighting light', Icon: Lamp },
  { name: 'LampDesk', label: 'Desk lamp', tags: 'lighting light study', Icon: LampDesk },
  { name: 'LampFloor', label: 'Floor lamp', tags: 'lighting light', Icon: LampFloor },
  { name: 'LampCeiling', label: 'Ceiling lamp', tags: 'lighting light chandelier', Icon: LampCeiling },
  { name: 'Lightbulb', label: 'Light bulb', tags: 'lighting electrical idea', Icon: Lightbulb },
  { name: 'Frame', label: 'Frame', tags: 'art photo wall decor', Icon: Frame },
  { name: 'Image', label: 'Picture', tags: 'art photo wall decor', Icon: Image },
  { name: 'Flower2', label: 'Flower', tags: 'plants decor artificial', Icon: Flower2 },
  { name: 'Leaf', label: 'Leaf', tags: 'plants green nature', Icon: Leaf },
  { name: 'Trees', label: 'Trees', tags: 'garden outdoor landscape', Icon: Trees },
  { name: 'Square', label: 'Tile', tags: 'flooring tiles square', Icon: Square },
  { name: 'Grid3x3', label: 'Grid / tiles', tags: 'flooring tiles mosaic', Icon: Grid3x3 },
  { name: 'LayoutGrid', label: 'Layout', tags: 'grid modular', Icon: LayoutGrid },
  { name: 'Layers', label: 'Layers', tags: 'flooring laminate materials', Icon: Layers },
  { name: 'Home', label: 'Home', tags: 'house residential interior', Icon: Home },
  { name: 'Building2', label: 'Building', tags: 'commercial office apartment', Icon: Building2 },
  { name: 'Store', label: 'Store', tags: 'shop retail showroom', Icon: Store },
  { name: 'Warehouse', label: 'Warehouse', tags: 'storage godown', Icon: Warehouse },
  { name: 'DoorClosed', label: 'Door', tags: 'doors wardrobe entrance', Icon: DoorClosed },
  { name: 'DoorOpen', label: 'Open door', tags: 'doors entrance', Icon: DoorOpen },
  { name: 'Bath', label: 'Bath', tags: 'bathroom washroom', Icon: Bath },
  { name: 'ShowerHead', label: 'Shower', tags: 'bathroom washroom', Icon: ShowerHead },
  { name: 'Droplets', label: 'Water', tags: 'plumbing waterproofing', Icon: Droplets },
  { name: 'CookingPot', label: 'Cooking pot', tags: 'kitchen modular', Icon: CookingPot },
  { name: 'Utensils', label: 'Utensils', tags: 'kitchen dining', Icon: Utensils },
  { name: 'Refrigerator', label: 'Fridge', tags: 'kitchen appliance', Icon: Refrigerator },
  { name: 'WashingMachine', label: 'Washing machine', tags: 'appliance laundry', Icon: WashingMachine },
  { name: 'Tv', label: 'TV', tags: 'tv unit entertainment appliance', Icon: Tv },
  { name: 'Fan', label: 'Fan', tags: 'appliance electrical', Icon: Fan },
  { name: 'AirVent', label: 'Air vent', tags: 'ac hvac', Icon: AirVent },
  { name: 'Heater', label: 'Heater', tags: 'appliance', Icon: Heater },
  { name: 'Sun', label: 'Sun', tags: 'outdoor balcony light', Icon: Sun },
  { name: 'Baby', label: 'Kids', tags: 'kids room nursery children', Icon: Baby },
  { name: 'Gem', label: 'Gem', tags: 'premium luxury', Icon: Gem },
  { name: 'Crown', label: 'Crown', tags: 'premium luxury royal', Icon: Crown },
  { name: 'Star', label: 'Star', tags: 'featured favourite', Icon: Star },
  { name: 'Award', label: 'Award', tags: 'quality badge', Icon: Award },
  { name: 'Heart', label: 'Heart', tags: 'favourite love', Icon: Heart },
  { name: 'Gift', label: 'Gift', tags: 'offer present', Icon: Gift },
  { name: 'Tag', label: 'Tag', tags: 'offer price sale', Icon: Tag },
  { name: 'Sparkles', label: 'Sparkles', tags: 'new decor shine', Icon: Sparkles },
  { name: 'Box', label: 'Box', tags: 'product storage', Icon: Box },
  { name: 'Package', label: 'Package', tags: 'product delivery', Icon: Package },
  { name: 'Archive', label: 'Storage', tags: 'cabinet storage', Icon: Archive },
  { name: 'Scissors', label: 'Scissors', tags: 'stitching tailoring cutting', Icon: Scissors },
  { name: 'Ruler', label: 'Ruler', tags: 'measurement', Icon: Ruler },
  { name: 'PencilRuler', label: 'Design', tags: 'measurement design planning', Icon: PencilRuler },
  { name: 'Wrench', label: 'Wrench', tags: 'repair service maintenance', Icon: Wrench },
  { name: 'Hammer', label: 'Hammer', tags: 'carpentry installation', Icon: Hammer },
  { name: 'Drill', label: 'Drill', tags: 'installation fitting', Icon: Drill },
  { name: 'Truck', label: 'Truck', tags: 'delivery transport', Icon: Truck },
  { name: 'ShieldCheck', label: 'Warranty', tags: 'warranty guarantee safe', Icon: ShieldCheck },
  { name: 'KeyRound', label: 'Key', tags: 'handover turnkey', Icon: KeyRound },
  { name: 'Briefcase', label: 'Briefcase', tags: 'office corporate', Icon: Briefcase },
  { name: 'Users', label: 'Team', tags: 'people customers', Icon: Users },
  { name: 'Headphones', label: 'Support', tags: 'help service', Icon: Headphones },
];

const BY_NAME: Record<string, ComponentType<LucideProps>> =
  Object.fromEntries(ICON_OPTIONS.map((o) => [o.name, o.Icon]));

/** Accept "paint-roller", "paintRoller" or "PaintRoller" → canonical stored name. */
function toPascal(name: string) {
  return name.replace(/(^|[-_\s]+)([a-z])/g, (_, __, c) => c.toUpperCase()).replace(/[-_\s]/g, '');
}

export function resolveIcon(name?: string): ComponentType<LucideProps> {
  if (!name) return Sparkles;
  return BY_NAME[toPascal(name)] ?? BY_NAME[name] ?? Sparkles;
}

/** Render a lucide icon by its stored string name. */
export function LucideByName({ name, ...props }: { name?: string } & LucideProps) {
  const Cmp = resolveIcon(name);
  return <Cmp {...props} />;
}

/** Searchable visual icon grid. Stores the PascalCase lucide name. */
export function IconPicker({ value, onChange }: { value?: string; onChange: (name: string) => void }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const current = value ? ICON_OPTIONS.find((o) => o.name === toPascal(value)) : undefined;
  const Current = current?.Icon ?? Sparkles;

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return ICON_OPTIONS;
    return ICON_OPTIONS.filter((o) => `${o.name} ${o.label} ${o.tags}`.toLowerCase().includes(s));
  }, [q]);

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-3 rounded-md border border-input bg-background px-3 py-2 text-left text-sm hover:border-amber-300"
      >
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-amber-200 text-amber-600">
          <Current className="h-4 w-4" strokeWidth={1.5} />
        </span>
        <span className={`flex-1 truncate ${current ? 'text-slate-800' : 'text-muted-foreground'}`}>
          {current ? current.label : value ? `${value} (not available)` : 'Choose an icon'}
        </span>
        <span className="text-xs font-medium text-amber-700">{open ? 'Close' : 'Change'}</span>
      </button>

      {open && (
        <div className="rounded-md border border-slate-200 bg-white p-2 shadow-sm">
          <div className="relative mb-2">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search icons — sofa, curtain, kitchen, light…"
              className="w-full rounded-md border border-input bg-background py-1.5 pl-8 pr-8 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            />
            {q && (
              <button type="button" onClick={() => setQ('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600" aria-label="Clear search">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          {filtered.length === 0 ? (
            <p className="py-6 text-center text-xs text-muted-foreground">No icons match “{q}”</p>
          ) : (
            <div className="grid max-h-56 grid-cols-5 gap-1 overflow-y-auto sm:grid-cols-6">
              {filtered.map(({ name, label, Icon }) => {
                const selected = current?.name === name;
                return (
                  <button
                    key={name}
                    type="button"
                    title={label}
                    onClick={() => { onChange(name); setOpen(false); setQ(''); }}
                    className={`relative flex flex-col items-center gap-1 rounded-md px-1 py-2 text-[10px] leading-tight transition-colors ${
                      selected ? 'bg-amber-50 text-amber-700 ring-1 ring-amber-300' : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <Icon className="h-5 w-5" strokeWidth={1.5} />
                    <span className="w-full truncate text-center">{label}</span>
                    {selected && <Check className="absolute right-1 top-1 h-3 w-3" />}
                  </button>
                );
              })}
            </div>
          )}
          {value && (
            <button type="button" onClick={() => { onChange(''); setOpen(false); }} className="mt-2 text-xs text-muted-foreground hover:text-destructive">
              Remove icon
            </button>
          )}
        </div>
      )}
    </div>
  );
}
