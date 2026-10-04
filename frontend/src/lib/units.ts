/**
 * The one app-wide unit catalogue. Every unit dropdown (quote sheet, BOQ, measurements,
 * inventory, invoices, purchases…) lists these, grouped by dimension.
 *
 * Units are stored as plain strings, so older values saved with other spellings
 * ("Square Feet", "running ft", "sqft", "Meter") are still understood through ALIASES.
 */

export type UnitKind = "length" | "area" | "volume" | "count" | "weight" | "liquid" | "other";

/** Base length a dimension is entered in, for 1D/2D/3D units. */
export type SizeUnit = "mm" | "cm" | "in" | "ft" | "m" | "yd";

export interface UnitDef { code: string; label: string; kind: UnitKind; size?: SizeUnit }

export const UNIT_DEFS: UnitDef[] = [
  // Length (1D)
  { code: "Mm", label: "Millimetre (mm)", kind: "length", size: "mm" },
  { code: "Cm", label: "Centimetre (cm)", kind: "length", size: "cm" },
  { code: "Inch", label: "Inch (in)", kind: "length", size: "in" },
  { code: "Ft", label: "Feet (ft)", kind: "length", size: "ft" },
  { code: "Rft", label: "Running feet (rft)", kind: "length", size: "ft" },
  { code: "Mtr", label: "Metre (m)", kind: "length", size: "m" },
  { code: "Rmt", label: "Running metre (rmt)", kind: "length", size: "m" },
  { code: "Yard", label: "Yard (yd)", kind: "length", size: "yd" },
  // Area (2D)
  { code: "Sq Mm", label: "Square mm", kind: "area", size: "mm" },
  { code: "Sq Cm", label: "Square cm", kind: "area", size: "cm" },
  { code: "Sq Inch", label: "Square inch", kind: "area", size: "in" },
  { code: "Sqft", label: "Square feet (sqft)", kind: "area", size: "ft" },
  { code: "Sqm", label: "Square metre (sqm)", kind: "area", size: "m" },
  { code: "Sq Yard", label: "Square yard", kind: "area", size: "yd" },
  // Volume (3D)
  { code: "Cu Cm", label: "Cubic cm", kind: "volume", size: "cm" },
  { code: "Cft", label: "Cubic feet (cft)", kind: "volume", size: "ft" },
  { code: "Cum", label: "Cubic metre (cum)", kind: "volume", size: "m" },
  // Count
  { code: "Nos", label: "Numbers (nos)", kind: "count" },
  { code: "Pcs", label: "Pieces (pcs)", kind: "count" },
  { code: "Set", label: "Set", kind: "count" },
  { code: "Pair", label: "Pair", kind: "count" },
  { code: "Panel", label: "Panel", kind: "count" },
  { code: "Box", label: "Box", kind: "count" },
  { code: "Pack", label: "Pack", kind: "count" },
  { code: "Bag", label: "Bag", kind: "count" },
  { code: "Roll", label: "Roll", kind: "count" },
  { code: "Sheet", label: "Sheet", kind: "count" },
  { code: "Bundle", label: "Bundle", kind: "count" },
  // Weight
  { code: "Gram", label: "Gram (g)", kind: "weight" },
  { code: "Kg", label: "Kilogram (kg)", kind: "weight" },
  { code: "Ton", label: "Tonne", kind: "weight" },
  // Liquid
  { code: "Ml", label: "Millilitre (ml)", kind: "liquid" },
  { code: "Ltr", label: "Litre (ltr)", kind: "liquid" },
  // Labour / other
  { code: "Hour", label: "Hour", kind: "other" },
  { code: "Day", label: "Day", kind: "other" },
  { code: "Visit", label: "Visit", kind: "other" },
  { code: "Lot", label: "Lot", kind: "other" },
  { code: "Lump Sum", label: "Lump sum", kind: "other" },
];

export const UNIT_GROUPS: { kind: UnitKind; label: string }[] = [
  { kind: "length", label: "Length (1D)" },
  { kind: "area", label: "Area (2D)" },
  { kind: "volume", label: "Volume (3D)" },
  { kind: "count", label: "Count" },
  { kind: "weight", label: "Weight" },
  { kind: "liquid", label: "Liquid" },
  { kind: "other", label: "Labour / other" },
];

/** Every unit code, in display order. */
export const ALL_UNITS: string[] = UNIT_DEFS.map((u) => u.code);

const key = (s: string) => s.trim().toLowerCase().replace(/[\s._-]+/g, "");

/** Other spellings (already in saved data or typed by people) → canonical code. */
const ALIASES: Record<string, string> = {
  mm: "Mm", millimeter: "Mm", millimetre: "Mm",
  cm: "Cm", centimeter: "Cm", centimetre: "Cm", cms: "Cm",
  in: "Inch", inch: "Inch", inches: "Inch",
  ft: "Ft", feet: "Ft", foot: "Ft",
  rft: "Rft", runningft: "Rft", runningfeet: "Rft", rf: "Rft",
  m: "Mtr", mtr: "Mtr", mtrs: "Mtr", meter: "Mtr", meters: "Mtr", metre: "Mtr", metres: "Mtr",
  rmt: "Rmt", rm: "Rmt", runningmeter: "Rmt", runningmetre: "Rmt", runningmtr: "Rmt",
  yd: "Yard", yard: "Yard", yards: "Yard",
  sqmm: "Sq Mm", squaremm: "Sq Mm",
  sqcm: "Sq Cm", squarecm: "Sq Cm", squarecentimeter: "Sq Cm", squarecentimetre: "Sq Cm",
  sqin: "Sq Inch", sqinch: "Sq Inch", squareinch: "Sq Inch",
  sqft: "Sqft", sft: "Sqft", squarefeet: "Sqft", squarefoot: "Sqft", sqfeet: "Sqft",
  sqm: "Sqm", sqmt: "Sqm", sqmtr: "Sqm", squaremeter: "Sqm", squaremetre: "Sqm",
  sqyd: "Sq Yard", sqyard: "Sq Yard", squareyard: "Sq Yard", gaj: "Sq Yard",
  cucm: "Cu Cm", cubiccm: "Cu Cm", cc: "Cu Cm",
  cft: "Cft", cuft: "Cft", cubicfeet: "Cft",
  cum: "Cum", cbm: "Cum", cubicmeter: "Cum", cubicmetre: "Cum",
  nos: "Nos", no: "Nos", number: "Nos", numbers: "Nos", unit: "Nos", units: "Nos",
  pcs: "Pcs", pc: "Pcs", piece: "Pcs", pieces: "Pcs",
  set: "Set", sets: "Set", pair: "Pair", pairs: "Pair", panel: "Panel", panels: "Panel",
  box: "Box", pack: "Pack", packet: "Pack", bag: "Bag", roll: "Roll", rolls: "Roll",
  sheet: "Sheet", sheets: "Sheet", bundle: "Bundle",
  g: "Gram", gm: "Gram", gram: "Gram", grams: "Gram",
  mt: "Mtr", kg: "Kg", kgs: "Kg", kilogram: "Kg", ton: "Ton", tonne: "Ton",
  ml: "Ml", millilitre: "Ml", milliliter: "Ml",
  l: "Ltr", ltr: "Ltr", litre: "Ltr", liter: "Ltr", litres: "Ltr", liters: "Ltr",
  hr: "Hour", hour: "Hour", hours: "Hour", day: "Day", days: "Day", visit: "Visit",
  lot: "Lot", lumpsum: "Lump Sum", ls: "Lump Sum",
};

const BY_CODE = new Map(UNIT_DEFS.map((u) => [key(u.code), u]));

/** The catalogue entry for any spelling of a unit, or undefined for a custom unit. */
export function unitDef(unit?: string | null): UnitDef | undefined {
  if (!unit) return undefined;
  const k = key(unit);
  return BY_CODE.get(k) ?? (ALIASES[k] ? BY_CODE.get(key(ALIASES[k])) : undefined);
}

/** Canonical code for a unit ("square feet" → "Sqft"); unknown units come back trimmed as typed. */
export const normalizeUnit = (unit?: string | null) => unitDef(unit)?.code ?? (unit ?? "").trim();

export const unitKind = (unit?: string | null): UnitKind | undefined => unitDef(unit)?.kind;
export const isAreaUnit = (unit?: string | null) => unitKind(unit) === "area";
export const isLengthUnit = (unit?: string | null) => unitKind(unit) === "length";

/** Which length a size (L × W) should be entered in for this unit, e.g. Sqft → "ft". */
export const sizeUnitOf = (unit?: string | null): SizeUnit | undefined => unitDef(unit)?.size;

const AREA_FOR: Record<SizeUnit, string> = { mm: "Sq Mm", cm: "Sq Cm", in: "Sq Inch", ft: "Sqft", m: "Sqm", yd: "Sq Yard" };

/** The area unit an L × W in this unit's length gives (Mtr → Sqm, Cm → Sq Cm); Sqft when unknown. */
export const areaUnitFor = (unit?: string | null) => AREA_FOR[sizeUnitOf(unit) ?? "ft"];

/** Metres per base length, for converting sizes between systems. */
const TO_M: Record<SizeUnit, number> = { mm: 0.001, cm: 0.01, in: 0.0254, ft: 0.3048, m: 1, yd: 0.9144 };

/** Convert a 1D/2D/3D quantity between units of the same kind (e.g. 100 Sqft → 9.29 Sqm). */
export function convertUnit(value: number, from: string, to: string): number | null {
  const a = unitDef(from), b = unitDef(to);
  if (!a || !b || a.kind !== b.kind || !a.size || !b.size) return a && b && a.code === b.code ? value : null;
  const power = a.kind === "length" ? 1 : a.kind === "area" ? 2 : 3;
  return value * Math.pow(TO_M[a.size] / TO_M[b.size], power);
}
