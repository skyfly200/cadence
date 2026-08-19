<template>
  <Card class="p-0 overflow-hidden flex flex-col">
    <div class="flex items-center justify-between px-2 sm:px-2.5 py-1.5 border-b shrink-0 gap-2">
      <div class="flex items-center gap-1.5">
        <MapIcon class="size-3.5" />
        <h3 class="text-[11px] sm:text-xs font-semibold">Day map</h3>
        <span class="text-[9px] text-muted-foreground hidden sm:inline">places you'll be today, in order</span>
      </div>
      <div class="flex items-center gap-2">
        <Button v-if="stops.length" size="sm" variant="outline" class="h-6 text-[10px] px-1.5 gap-1" :disabled="savingOffline" title="Cache the current map area for offline use" @click="saveOffline">
          <DownloadCloud :class="cn('size-3', savingOffline && 'animate-pulse')" />
          <span class="hidden sm:inline">{{ savingOffline ? `Saving ${savedCount}…` : 'Save area offline' }}</span>
        </Button>
        <span class="text-[9px] text-muted-foreground tabular-nums">{{ stops.length }} stop{{ stops.length !== 1 ? 's' : '' }}</span>
      </div>
    </div>

    <div v-if="stops.length === 0" class="py-10 text-center text-xs text-muted-foreground px-4">
      <MapPin class="size-5 mx-auto mb-1 text-muted-foreground/40" />
      No mapped stops today. Add a searchable <strong>location</strong> to today's tasks (in the task form), then Auto-plan — they'll appear here in order.
    </div>

    <ClientOnly v-else>
      <div ref="mapEl" class="w-full" style="height: min(70vh, 560px)" />
    </ClientOnly>

    <!-- Ordered stop list -->
    <div v-if="stops.length" class="border-t divide-y divide-border/40 max-h-48 overflow-y-auto">
      <div v-for="(s, i) in stops" :key="s.id" class="flex items-center gap-2 px-2 py-1.5 text-[11px]">
        <span class="shrink-0 size-5 rounded-full bg-primary text-primary-foreground text-[9px] font-bold flex items-center justify-center">{{ i + 1 }}</span>
        <span class="font-medium truncate flex-1">{{ s.title }}</span>
        <span class="text-[9px] text-muted-foreground shrink-0">{{ s.time }}</span>
        <span class="text-[9px] text-muted-foreground truncate max-w-[38%] hidden sm:inline">{{ s.place }}</span>
      </div>
    </div>
  </Card>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch, nextTick } from 'vue';
import { Map as MapIcon, MapPin, DownloadCloud } from 'lucide-vue-next';
import { useAppStore } from '~/stores/app';
import { useToast } from '~/composables/useToast';
import { cn } from '~/lib/utils';
import { routeGeometry, type TravelMode } from '~/lib/geo';
import { isSameDay, formatTime } from '~/lib/time-utils';

const { toast } = useToast();
const savingOffline = ref(false);
const savedCount = ref(0);
const MODE_COLOR: Record<TravelMode, string> = { drive: '#a855f7', walk: '#10b981', cycle: '#f59e0b', transit: '#0ea5e9' };

const store = useAppStore();
const mapEl = ref<HTMLElement | null>(null);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let map: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let L: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let layer: any = null;

interface Stop { id: string; title: string; time: string; place: string; lat: number; lon: number; }

// Today's scheduled task blocks whose task has coordinates, ordered by time.
const stops = computed<Stop[]>(() => {
  const taskById = new Map(store.tasks.map((t) => [t.id, t]));
  return store.timeBlocks
    .filter((b) => b.taskId && isSameDay(new Date(b.startTime), new Date()))
    .map((b) => ({ b, t: taskById.get(b.taskId!) }))
    .filter((x) => x.t && x.t.locationLat != null && x.t.locationLon != null)
    .sort((a, b) => a.b.startTime.localeCompare(b.b.startTime))
    .map(({ b, t }) => ({
      id: b.id,
      title: t!.title,
      time: formatTime(b.startTime),
      place: (t!.location || '').split(',').slice(0, 2).join(','),
      lat: t!.locationLat!,
      lon: t!.locationLon!,
    }));
});

async function ensureMap() {
  if (typeof window === 'undefined' || !mapEl.value) return;
  if (!L) L = (await import('leaflet')).default ?? (await import('leaflet'));
  if (!map) {
    map = L.map(mapEl.value, { zoomControl: true, attributionControl: true });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);
  }
  render();
}

async function render() {
  if (!map || !L) return;
  if (layer) { map.removeLayer(layer); layer = null; }
  const s = stops.value;
  if (s.length === 0) return;
  layer = L.layerGroup().addTo(map);

  const latlngs: [number, number][] = [];
  s.forEach((stop, i) => {
    const icon = L.divIcon({
      className: '',
      html: `<div style="background:#a855f7;color:#fff;width:22px;height:22px;border-radius:9999px;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4)">${i + 1}</div>`,
      iconSize: [22, 22],
      iconAnchor: [11, 11],
    });
    L.marker([stop.lat, stop.lon], { icon }).addTo(layer)
      .bindPopup(`<strong>${i + 1}. ${escapeHtml(stop.title)}</strong><br>${stop.time}${stop.place ? `<br><span style="opacity:.7">${escapeHtml(stop.place)}</span>` : ''}`);
    latlngs.push([stop.lat, stop.lon]);
  });
  map.fitBounds(L.latLngBounds(latlngs).pad(0.25), { maxZoom: 15 });

  if (latlngs.length > 1) {
    const mode = (store.settings?.travelMode ?? 'drive') as TravelMode;
    const color = MODE_COLOR[mode] ?? '#a855f7';
    // Real road geometry when available; straight dashed line otherwise.
    const geom = await routeGeometry(s.map((x) => ({ lat: x.lat, lon: x.lon })), mode);
    if (!map || !layer) return; // could have unmounted during await
    if (geom && geom.length > 1) {
      L.polyline(geom, { color, weight: 4, opacity: 0.7 }).addTo(layer);
    } else {
      L.polyline(latlngs, { color, weight: 3, opacity: 0.5, dashArray: '6 6' }).addTo(layer);
    }
  }
}

// ── Offline: cache the current map area's tiles ──────────────
function lonToTileX(lon: number, z: number) { return Math.floor(((lon + 180) / 360) * 2 ** z); }
function latToTileY(lat: number, z: number) {
  const r = (lat * Math.PI) / 180;
  return Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** z);
}
async function saveOffline() {
  if (!map || savingOffline.value) return;
  const b = map.getBounds();
  const z0 = Math.round(map.getZoom());
  const urls: string[] = [];
  const CAP = 400;
  for (const z of [z0, Math.min(z0 + 1, 18)]) {
    const x1 = lonToTileX(b.getWest(), z); const x2 = lonToTileX(b.getEast(), z);
    const y1 = latToTileY(b.getNorth(), z); const y2 = latToTileY(b.getSouth(), z);
    for (let x = Math.min(x1, x2); x <= Math.max(x1, x2); x++) {
      for (let y = Math.min(y1, y2); y <= Math.max(y1, y2); y++) {
        urls.push(`https://a.tile.openstreetmap.org/${z}/${x}/${y}.png`);
      }
    }
    if (urls.length >= CAP) break;
  }
  const capped = urls.slice(0, CAP);
  savingOffline.value = true; savedCount.value = 0;
  for (const u of capped) {
    try { await fetch(u, { mode: 'no-cors' }); savedCount.value++; } catch { /* ignore */ }
  }
  savingOffline.value = false;
  toast({ title: `Saved ${savedCount.value} tiles offline`, description: 'This area will load without a connection.' });
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));
}

onMounted(() => { nextTick(ensureMap); });
watch(stops, () => { if (map) render(); else nextTick(ensureMap); }, { deep: true });
onBeforeUnmount(() => { if (map) { map.remove(); map = null; layer = null; } });
</script>
