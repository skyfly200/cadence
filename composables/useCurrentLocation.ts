import { ref } from 'vue';

/**
 * Best-effort current position for biasing place search nearest-first.
 * Requested lazily (on first location-field focus) and cached for the session;
 * a denied or unavailable permission just resolves null and search stays
 * relevance-ordered.
 */
const coords = ref<{ lat: number; lon: number } | null>(null);
let inflight: Promise<{ lat: number; lon: number } | null> | null = null;

export function useCurrentLocation() {
  function request(): Promise<{ lat: number; lon: number } | null> {
    if (coords.value) return Promise.resolve(coords.value);
    if (inflight) return inflight;
    if (typeof navigator === 'undefined' || !navigator.geolocation) return Promise.resolve(null);
    inflight = new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          coords.value = { lat: pos.coords.latitude, lon: pos.coords.longitude };
          resolve(coords.value);
        },
        () => resolve(null),
        { enableHighAccuracy: false, timeout: 8000, maximumAge: 600000 },
      );
    });
    return inflight;
  }
  return { coords, request };
}
