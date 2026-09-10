import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Search, Loader2 } from 'lucide-react';

/**
 * Interactive map to set an office geofence centre precisely: drag the pin or click the map, and the
 * radius circle updates live. Optional address search (OpenStreetMap Nominatim) recentres the map so
 * the admin can start from the right neighbourhood, then fine-tune the exact spot.
 *
 * Uses Leaflet + OpenStreetMap tiles (no API key). A div-icon pin avoids Leaflet's bundled-asset path
 * issue. Controlled by lat/lng props; emits changes via onChange.
 */
export default function LocationMapPicker({
  lat, lng, radiusMeters, onChange,
}: {
  lat: number;
  lng: number;
  radiusMeters: number;
  onChange: (lat: number, lng: number) => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const circleRef = useRef<L.Circle | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const hasCoords = !!lat && !!lng;
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchErr, setSearchErr] = useState('');

  const pinIcon = L.divIcon({
    className: '',
    html: '<div style="font-size:26px;line-height:26px;transform:translate(-2px,-6px)">📍</div>',
    iconSize: [26, 26],
    iconAnchor: [11, 26],
  });

  // Init the map once.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const center: [number, number] = hasCoords ? [lat, lng] : [20.5937, 78.9629]; // India centroid fallback
    const map = L.map(containerRef.current, { center, zoom: hasCoords ? 17 : 5 });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap contributors',
    }).addTo(map);

    const marker = L.marker(center, { draggable: true, icon: pinIcon }).addTo(map);
    const circle = L.circle(center, { radius: radiusMeters || 150, color: '#0f5132', fillColor: '#10b981', fillOpacity: 0.12 }).addTo(map);

    marker.on('dragend', () => {
      const p = marker.getLatLng();
      circle.setLatLng(p);
      onChangeRef.current(+p.lat.toFixed(6), +p.lng.toFixed(6));
    });
    map.on('click', (e: L.LeafletMouseEvent) => {
      marker.setLatLng(e.latlng);
      circle.setLatLng(e.latlng);
      onChangeRef.current(+e.latlng.lat.toFixed(6), +e.latlng.lng.toFixed(6));
    });

    mapRef.current = map;
    markerRef.current = marker;
    circleRef.current = circle;

    // Leaflet mis-sizes if the container was hidden/animating at init; settle after mount.
    setTimeout(() => map.invalidateSize(), 200);
    return () => { map.remove(); mapRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reflect external lat/lng changes (e.g. "use my location" / address search) onto the map.
  useEffect(() => {
    if (!mapRef.current || !markerRef.current || !circleRef.current || !hasCoords) return;
    const p: [number, number] = [lat, lng];
    markerRef.current.setLatLng(p);
    circleRef.current.setLatLng(p);
    mapRef.current.setView(p, Math.max(mapRef.current.getZoom(), 17));
  }, [lat, lng, hasCoords]);

  // Keep the radius circle in sync with the radius input.
  useEffect(() => {
    if (circleRef.current) circleRef.current.setRadius(radiusMeters || 150);
  }, [radiusMeters]);

  const search = async () => {
    if (!query.trim()) return;
    setSearching(true); setSearchErr('');
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query.trim())}`;
      const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        onChangeRef.current(+parseFloat(data[0].lat).toFixed(6), +parseFloat(data[0].lon).toFixed(6));
      } else {
        setSearchErr('No match — try a more specific address, or drop the pin manually.');
      }
    } catch {
      setSearchErr('Search unavailable — set the pin manually.');
    } finally {
      setSearching(false);
    }
  };

  return (
    <div>
      <div className="mb-2 flex gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); search(); } }}
            placeholder="Search an address to jump the map…"
            className="h-9 w-full rounded-md border border-input bg-card pl-8 pr-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
        </div>
        <button type="button" onClick={search} disabled={searching}
          className="inline-flex h-9 items-center gap-1.5 rounded-md border border-input bg-card px-3 text-sm font-medium hover:bg-accent disabled:opacity-60">
          {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />} Search
        </button>
      </div>
      {searchErr && <p className="mb-2 text-xs text-amber-600">{searchErr}</p>}
      <div ref={containerRef} className="h-64 w-full overflow-hidden rounded-lg border" style={{ zIndex: 0 }} />
      <p className="mt-1.5 text-[11px] text-muted-foreground">
        Drag the pin or tap the map to set the exact office centre. The shaded circle is the clock-in radius.
      </p>
    </div>
  );
}
