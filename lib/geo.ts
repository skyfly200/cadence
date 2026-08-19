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

export type TravelMode = 'drive' | 'walk' | 'cycle';

export const TRAVEL_MODES: { value: TravelMode; label: string; emoji: string }[] = [
  { value: 'drive', label: 'Drive', emoji: '🚗' },
  { value: 'walk', label: 'Walk', emoji: '🚶' },
  { value: 'cycle', label: 'Cycle', emoji: '🚲' },
];

const OSRM_PROFILE: Record<TravelMode, string> = { drive: 'driving', walk: 'walking', cycle: 'cycling' };

/** Search navigable places. Returns [] on any failure. */
export async function searchPlaces(query: string, limit = 6): Promise<Place[]> {
  const q = query.trim();
  if (q.length < 3) return [];
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=${limit}&addressdetails=0&q=${encodeURIComponent(q)}`;
    const r = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!r.ok) return [];
    const data = await r.json();
    return (Array.isArray(data) ? data : [])
      .filter((d: { lat?: string; lon?: string }) => d.lat && d.lon)
      .map((d: { display_name: string; lat: string; lon: string }) => ({
        label: d.display_name,
        lat: parseFloat(d.lat),
        lon: parseFloat(d.lon),
      }));
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

/** Straight-line distance (km) — a cheap fallback for ordering when routing is unavailable. */
export function haversineKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const s = Math.sin(dLat / 2) ** 2
    + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}
