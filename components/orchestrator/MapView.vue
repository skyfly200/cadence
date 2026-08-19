<template>
  <Card class="p-0 overflow-hidden flex flex-col">
    <div class="flex items-center justify-between px-2 sm:px-2.5 py-1.5 border-b shrink-0 gap-2">
      <div class="flex items-center gap-1.5">
        <MapIcon class="size-3.5" />
        <h3 class="text-[11px] sm:text-xs font-semibold">Day map</h3>
        <span class="text-[9px] text-muted-foreground hidden sm:inline">places you'll be today, in order</span>
      </div>
      <span class="text-[9px] text-muted-foreground tabular-nums">{{ stops.length }} stop{{ stops.length !== 1 ? 's' : '' }}</span>
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
import { Map as MapIcon, MapPin } from 'lucide-vue-next';
import { useAppStore } from '~/stores/app';
import { isSameDay, formatTime } from '~/lib/time-utils';

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

function render() {
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
  if (latlngs.length > 1) {
    L.polyline(latlngs, { color: '#a855f7', weight: 3, opacity: 0.6, dashArray: '6 6' }).addTo(layer);
  }
  map.fitBounds(L.latLngBounds(latlngs).pad(0.25), { maxZoom: 15 });
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));
}

onMounted(() => { nextTick(ensureMap); });
watch(stops, () => { if (map) render(); else nextTick(ensureMap); }, { deep: true });
onBeforeUnmount(() => { if (map) { map.remove(); map = null; layer = null; } });
</script>
