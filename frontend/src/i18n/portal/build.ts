// Compact translation tables: one row per string, [en, hi, ta, te], keyed by dot-path.
// `buildDicts` expands rows into nested per-language dictionaries that index.tsx deep-merges
// over the base locale files (so new screens never need edits to the big en/hi/ta/te files).
export type Row = readonly [string, string, string, string];
export type Rows = Record<string, Row>;
type Tree = { [k: string]: string | Tree };

function put(tree: Tree, path: string, val: string) {
  const parts = path.split('.');
  let node = tree;
  parts.forEach((p, i) => {
    if (i === parts.length - 1) node[p] = val;
    else node = (node[p] = (typeof node[p] === 'object' ? node[p] : {}) as Tree) as Tree;
  });
}

export function buildDicts(rows: Rows): Record<'en' | 'hi' | 'ta' | 'te', Tree> {
  const out = { en: {}, hi: {}, ta: {}, te: {} } as Record<'en' | 'hi' | 'ta' | 'te', Tree>;
  for (const [path, r] of Object.entries(rows)) {
    put(out.en, path, r[0]); put(out.hi, path, r[1]); put(out.ta, path, r[2]); put(out.te, path, r[3]);
  }
  return out;
}

export function mergeDeep(a: unknown, b: unknown): unknown {
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    const out: Record<string, unknown> = { ...(a as Record<string, unknown>) };
    for (const [k, v] of Object.entries(b as Record<string, unknown>)) out[k] = mergeDeep(out[k], v);
    return out;
  }
  return b === undefined ? a : b;
}
