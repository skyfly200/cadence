/**
 * Location + routing via OpenStreetMap services (keyless):
 *  - Nominatim for place search / geocoding
 *  - OSRM public server for travel-time matrices
 * These are shared community servers — keep volume low (the search is
 * debounced) and treat failures as "unknown" rather than errors.
 */

export interface Place {
  label: string;
  lat: number;
  lon: number;
}

export type TravelMode = 'drive' | 'walk' | 'cycle' | 'transit';

export const TRAVEL_MODES: { value: TravelMode; label: string; emoji: string }[] = [
  { value: 'drive', label: 'Drive', emoji: '🚗' },
  { value: 'walk', label: 'Walk', emoji: '🚶' },
  { value: 'cycle', label: 'Cycle', emoji: '🚲' },
  { value: 'transit', label: 'Transit', emoji: '🚆' },
];

const OSRM_PROFILE: Record<string, string> = { drive: 'driving', walk: 'walking', cycle: 'cycling' };
export const isOsrmMode = (m: TravelMode) => m === 'drive' || m === 'walk' || m === 'cycle';

/**
 * Search navigable places. Returns [] on any failure.
 * When `near` is provided, results are sorted nearest-first (great-circle);
 * a slightly larger result set is fetched so the distance sort has choices.
 */
export async function searchPlaces(
  query: string,
  near?: { lat: number; lon: number } | null,
  limit = 8,
): Promise<Place[]> {
  const q = query.trim();
  if (q.length < 3) return [];
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=${limit}&addressdetails=0&q=${encodeURIComponent(q)}`;
    const r = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!r.ok) return [];
    const data = await r.json();
    const places: Place[] = (Array.isArray(data) ? data : [])
      .filter((d: { lat?: string; lon?: string }) => d.lat && d.lon)
      .map((d: { display_name: string; lat: string; lon: string }) => ({
        label: d.display_name,
        lat: parseFloat(d.lat),
        lon: parseFloat(d.lon),
      }));
    if (near) {
      places.sort((a, b) => haversineKm(near, a) - haversineKm(near, b));
    }
    return places;
  } catch {
    return [];
  }
}

/**
 * Duration matrix (seconds) for a list of coordinates in one OSRM call.
 * matrix[i][j] = travel seconds from point i to point j. null on failure.
 */
export async function travelMatrix(
  coords: { lat: number; lon: number }[],
  mode: TravelMode,
): Promise<number[][] | null> {
  if (coords.length < 2) return null;
  try {
    const pts = coords.map((c) => `${c.lon},${c.lat}`).join(';');
    const url = `https://router.project-osrm.org/table/v1/${OSRM_PROFILE[mode]}/${pts}?annotations=duration`;
    const r = await fetch(url);
    if (!r.ok) return null;
    const data = await r.json();
    return (data && Array.isArray(data.durations)) ? data.durations : null;
  } catch {
    return null;
  }
}

/**
 * Real road-path geometry for a sequence of stops (OSRM), as [lat,lon] points.
 * null on failure or for non-OSRM modes (caller falls back to straight lines).
 */
export async function routeGeometry(
  coords: { lat: number; lon: number }[],
  mode: TravelMode,
): Promise<[number, number][] | null> {
  if (coords.length < 2 || !isOsrmMode(mode)) return null;
  try {
    const pts = coords.map((c) => `${c.lon},${c.lat}`).join(';');
    const url = `https://router.project-osrm.org/route/v1/${OSRM_PROFILE[mode]}/${pts}?overview=full&geometries=geojson`;
    const r = await fetch(url);
    if (!r.ok) return null;
    const data = await r.json();
    const line = data?.routes?.[0]?.geometry?.coordinates;
    if (!Array.isArray(line)) return null;
    return line.map((p: [number, number]) => [p[1], p[0]]); // [lon,lat] -> [lat,lon]
  } catch {
    return null;
  }
}

/**
 * Public-transit travel time (seconds) between two points via the HERE
 * Transit API v8 (user-provided key, browser-callable). null on failure.
 */
export async function transitDurationSec(
  from: { lat: number; lon: number },
  to: { lat: number; lon: number },
  apiKey: string,
): Promise<number | null> {
  if (!apiKey) return null;
  try {
    const url = `https://transit.router.hereapi.com/v8/routes?origin=${from.lat},${from.lon}&destination=${to.lat},${to.lon}&return=travelSummary&apiKey=${encodeURIComponent(apiKey)}`;
    const r = await fetch(url);
    if (!r.ok) return null;
    const data = await r.json();
    const sections = data?.routes?.[0]?.sections;
    if (!Array.isArray(sections) || sections.length === 0) return null;
    const total = sections.reduce((sum: number, s: { travelSummary?: { duration?: number } }) => sum + (s.travelSummary?.duration ?? 0), 0);
    return total > 0 ? total : null;
  } catch {
    return null;
  }
}

export interface Charger {
  label: string;
  network: string | null;
  lat: number;
  lon: number;
  distanceKm: number | null;
  powerKw: number | null;
}

/**
 * Nearby EV charging stations via Open Charge Map (keyless, community-run —
 * keep volume low). Returns [] on any failure. `near` is a coordinate;
 * results are ordered by distance.
 */
export async function findEvChargers(
  near: { lat: number; lon: number },
  distanceKm = 25,
  limit = 8,
): Promise<Charger[]> {
  try {
    const url = `https://api.openchargemap.io/v3/poi/?output=json&latitude=${near.lat}&longitude=${near.lon}&distance=${distanceKm}&distanceunit=KM&maxresults=${limit}&compact=true&verbose=false`;
    const r = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!r.ok) return [];
    const data = await r.json();
    if (!Array.isArray(data)) return [];
    return data
      .map((d: {
        AddressInfo?: { Title?: string; Latitude?: number; Longitude?: number; Distance?: number };
        OperatorInfo?: { Title?: string } | null;
        Connections?: { PowerKW?: number }[];
      }): Charger | null => {
        const a = d.AddressInfo;
        if (!a || a.Latitude == null || a.Longitude == null) return null;
        const power = Array.isArray(d.Connections)
          ? d.Connections.reduce((mx, c) => Math.max(mx, c?.PowerKW ?? 0), 0)
          : 0;
        return {
          label: a.Title || 'Charging station',
          network: d.OperatorInfo?.Title ?? null,
          lat: a.Latitude,
          lon: a.Longitude,
          distanceKm: a.Distance != null ? Math.round(a.Distance * 10) / 10 : null,
          powerKw: power > 0 ? power : null,
        };
      })
      .filter((c): c is Charger => c !== null)
      .sort((a, b) => (a.distanceKm ?? 1e9) - (b.distanceKm ?? 1e9));
  } catch {
    return [];
  }
}

/** Straight-line distance (km) — a cheap fallback for ordering when routing is unavailable. */
export function haversineKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const s = Math.sin(dLat / 2) ** 2
    + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}
