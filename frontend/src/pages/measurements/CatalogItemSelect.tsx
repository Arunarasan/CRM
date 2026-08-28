import { useEffect, useState } from 'react';
import { Field, selectClass } from '../leads/fields';
import { measurementCatalogApi, CatalogItem } from '@/api/measurementCatalogApi';

/**
 * Dropdown of the admin-managed measurement item catalog. Picking an entry fills the surrounding
 * item form's type/name/unit/material via {@link onPick}; leaving it on "Custom" keeps the form's
 * free-text fields in play. Fetches the catalog itself so it can be dropped into any item form.
 */
export default function CatalogItemSelect({ onPick }: {
  onPick: (v: { itemType?: string; itemName?: string; unit?: string; material?: string }) => void;
}) {
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [pick, setPick] = useState('');

  useEffect(() => { measurementCatalogApi.list().then(setCatalog).catch(() => setCatalog([])); }, []);

  if (catalog.length === 0) return null;

  return (
    <Field label="Catalog item">
      <select
        className={selectClass}
        value={pick}
        onChange={(e) => {
          setPick(e.target.value);
          const c = catalog.find((x) => String(x.id) === e.target.value);
          if (c) onPick({ itemType: c.itemType, itemName: c.name, unit: c.defaultUnit, material: c.defaultMaterial });
        }}
      >
        <option value="">Custom (type below)…</option>
        {catalog.map((c) => (
          <option key={c.id} value={String(c.id)}>{c.name}{c.defaultUnit ? ` (${c.defaultUnit})` : ''}</option>
        ))}
      </select>
    </Field>
  );
}
