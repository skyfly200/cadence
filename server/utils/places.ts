/**
 * Resolve a place name to a navigable address and coordinates, server-side, with `fetch` injected so it
 * is testable without a network. The AI only ever supplies the name; this is where the position comes
 * from (OpenStreetMap Nominatim, the same service the edit sheet's place search uses, see lib/geo.ts).
 * Failures answer "no matches" rather than throwing, so a proposal simply keeps just its name.
 */
export interface ResolvedPlace { label: string; address: string; lat: number; lon: number }

const NOMINATIM = 'https://nominatim.openstreetmap.org/search';
export const MAX_MATCHES = 3;
const MIN_QUERY = 3;
const MAX_QUERY = 200;
export const CACHE_TTL_MS = 60 * 60 * 1000;
const CACHE_MAX = 200;

export interface PlaceResolver { resolve(name: string): Promise<ResolvedPlace[]> }

/** The first few comma-separated parts, which read as a street address, e.g. "Oak Street Clinic, 12, Oak Street, Springfield". */
const shortAddress = (displayName: string) => displayName.split(',').map((s) => s.trim()).filter(Boolean).slice(0, 4).join(', ');

export function createPlaceResolver(opts: { fetch: typeof fetch; now?: () => number; userAgent?: string }): PlaceResolver {
  const cache = new Map<string, { at: number; places: ResolvedPlace[] }>();
  const now = opts.now ?? Date.now;
  return {
    async resolve(name) {
      const q = name.replace(/\s+/g, ' ').trim().slice(0, MAX_QUERY);
      if (q.length < MIN_QUERY) return [];
      const key = q.toLowerCase();
      const hit = cache.get(key);
      if (hit && now() - hit.at < CACHE_TTL_MS) return hit.places;
      try {
        const res = await opts.fetch(`${NOMINATIM}?format=jsonv2&limit=${MAX_MATCHES}&addressdetails=0&q=${encodeURIComponent(q)}`, {
          // Nominatim's usage policy asks for an identifying User-Agent.
          headers: { Accept: 'application/json', 'User-Agent': opts.userAgent ?? 'Cadence/1.0 (personal planner)' },
        });
        if (!res.ok) return [];
        const data = await res.json();
        const places: ResolvedPlace[] = (Array.isArray(data) ? data : [])
          .filter((d: { lat?: unknown; lon?: unknown; display_name?: unknown }) => typeof d?.display_name === 'string' && d.lat != null && d.lon != null)
          .map((d: { display_name: string; lat: string; lon: string }) => ({ label: d.display_name, address: shortAddress(d.display_name), lat: parseFloat(d.lat), lon: parseFloat(d.lon) }))
          .filter((p: ResolvedPlace) => Number.isFinite(p.lat) && Number.isFinite(p.lon))
          .slice(0, MAX_MATCHES);
        if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value as string);
        cache.set(key, { at: now(), places });
        return places;
      } catch {
        return [];
      }
    },
  };
}
