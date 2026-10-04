import { UNIT_DEFS, UNIT_GROUPS, unitDef } from "@/lib/units";

/**
 * <option>s for a native unit <select>, grouped Length (1D) / Area (2D) / Volume (3D) / Count…
 * A saved value that isn't in the catalogue (a custom unit) is kept as the first option so it
 * still shows and isn't silently changed.
 */
export function UnitOptions({ value, allowEmpty = false, kinds }: {
  value?: string | null;
  allowEmpty?: boolean;
  /** Limit to some groups, e.g. ["length", "area"]. */
  kinds?: string[];
}) {
  const custom = value && !UNIT_DEFS.some((u) => u.code === value) ? value : null;
  const groups = kinds ? UNIT_GROUPS.filter((g) => kinds.includes(g.kind)) : UNIT_GROUPS;
  return (
    <>
      {allowEmpty && <option value="">—</option>}
      {custom && <option value={custom}>{custom}{unitDef(custom) ? ` (${unitDef(custom)!.code})` : ""}</option>}
      {groups.map((g) => (
        <optgroup key={g.kind} label={g.label}>
          {UNIT_DEFS.filter((u) => u.kind === g.kind).map((u) => (
            <option key={u.code} value={u.code} title={u.label}>{u.code}</option>
          ))}
        </optgroup>
      ))}
    </>
  );
}

/** Suggestions for free-text unit inputs: render once and point inputs at it with list={UNIT_DATALIST_ID}. */
export const UNIT_DATALIST_ID = "app-unit-list";
export function UnitDatalist() {
  return (
    <datalist id={UNIT_DATALIST_ID}>
      {UNIT_DEFS.map((u) => <option key={u.code} value={u.code}>{u.label}</option>)}
    </datalist>
  );
}
