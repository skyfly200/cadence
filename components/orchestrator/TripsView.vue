<template>
  <div class="space-y-2 sm:space-y-3">
    <!-- Header + new trip -->
    <Card class="p-2 sm:p-3">
      <div class="flex items-center gap-1.5 mb-2">
        <RouteIcon class="size-4 text-indigo-500" />
        <h3 class="text-xs sm:text-sm font-semibold">Trip planner</h3>
        <span class="text-[10px] text-muted-foreground hidden sm:inline">multi-day, multi-modal — road trips, flights, EV, backpacking & bikepacking</span>
      </div>

      <div class="flex flex-wrap items-end gap-2">
        <div class="flex-1 min-w-[140px]">
          <label class="text-[10px] text-muted-foreground">Name</label>
          <Input v-model="newName" placeholder="e.g. PNW loop, Sierra thru-hike" class="h-7 text-[11px]" @keydown.enter="createTrip" />
        </div>
        <div>
          <label class="text-[10px] text-muted-foreground">Kind</label>
          <select v-model="newKind" class="h-7 text-[11px] rounded-md border bg-background px-1.5 outline-none block">
            <option v-for="k in TRIP_KINDS" :key="k.value" :value="k.value">{{ k.emoji }} {{ k.label }}</option>
          </select>
        </div>
        <div>
          <label class="text-[10px] text-muted-foreground">Start</label>
          <Input v-model="newStart" type="date" class="h-7 text-[11px] w-[9rem]" />
        </div>
        <div>
          <label class="text-[10px] text-muted-foreground">End</label>
          <Input v-model="newEnd" type="date" class="h-7 text-[11px] w-[9rem]" />
        </div>
        <Button size="sm" class="h-7 text-[11px]" :disabled="!newName.trim()" @click="createTrip">
          <Plus class="size-3" /> New trip
        </Button>
      </div>
    </Card>

    <!-- Trip picker chips -->
    <div v-if="store.trips.length" class="flex flex-wrap items-center gap-1.5">
      <button v-for="t in sortedTrips" :key="t.id" type="button"
        :class="cn('flex items-center gap-1 rounded-full border px-2 py-1 text-[11px] transition-colors',
          selectedId === t.id ? 'bg-indigo-500/15 border-indigo-500/50 text-indigo-700 dark:text-indigo-300 font-medium' : 'bg-background hover:bg-muted')"
        @click="selectedId = t.id">
        <span>{{ kindMeta(t.kind).emoji }}</span>
        <span class="truncate max-w-[10rem]">{{ t.name }}</span>
        <span class="text-[9px] text-muted-foreground">{{ t.segments.length }}</span>
      </button>
    </div>

    <div v-if="store.trips.length === 0" class="py-8 text-center text-xs text-muted-foreground">
      <RouteIcon class="size-5 mx-auto mb-1 text-muted-foreground/40" />
      No trips yet — name one above and start adding legs.
    </div>

    <!-- Selected trip editor -->
    <template v-if="trip">
      <Card class="p-2 sm:p-3 space-y-2">
        <div class="flex flex-wrap items-center gap-2">
          <Input :model-value="trip.name" class="h-7 text-[11px] font-semibold flex-1 min-w-[140px]"
            @update:model-value="(v: string) => store.updateTrip(trip!.id, { name: v })" />
          <select :value="trip.kind" class="h-7 text-[11px] rounded-md border bg-background px-1.5 outline-none"
            @change="(e: Event) => store.updateTrip(trip!.id, { kind: (e.target as HTMLSelectElement).value as TripKind })">
            <option v-for="k in TRIP_KINDS" :key="k.value" :value="k.value">{{ k.emoji }} {{ k.label }}</option>
          </select>
          <Input :model-value="trip.startDate ?? ''" type="date" class="h-7 text-[11px] w-[9rem]"
            @update:model-value="(v: string) => store.updateTrip(trip!.id, { startDate: v || null })" />
          <span class="text-[10px] text-muted-foreground">→</span>
          <Input :model-value="trip.endDate ?? ''" type="date" class="h-7 text-[11px] w-[9rem]"
            @update:model-value="(v: string) => store.updateTrip(trip!.id, { endDate: v || null })" />
          <Button size="sm" variant="ghost" class="h-7 text-[10px] px-2 text-destructive hover:text-destructive ml-auto"
            @click="removeTrip(trip.id)">
            <Trash2 class="size-3" /> Delete
          </Button>
        </div>

        <!-- Trip summary -->
        <div class="flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-muted-foreground">
          <span>{{ trip.segments.length }} legs</span>
          <span v-if="totalDistanceKm > 0">≈ {{ totalDistanceKm.toFixed(0) }} km</span>
          <span v-if="totalDurationMin > 0">≈ {{ formatDur(totalDurationMin) }} moving</span>
          <span v-if="dayKeys.length">{{ dayKeys.length }} day{{ dayKeys.length !== 1 ? 's' : '' }}</span>
        </div>
      </Card>

      <!-- Trip map -->
      <Card v-if="mapPoints.length" class="p-0 overflow-hidden">
        <div class="px-2 py-1.5 border-b flex items-center gap-1.5">
          <MapIcon class="size-3.5" />
          <h4 class="text-[11px] font-semibold">Trip map</h4>
          <span class="text-[9px] text-muted-foreground">{{ mapPoints.length }} mapped point{{ mapPoints.length !== 1 ? 's' : '' }}</span>
          <label class="ml-auto flex items-center gap-1 text-[10px] text-muted-foreground cursor-pointer select-none" title="Fetch real road/trail geometry for driving, cycling & walking legs">
            <input type="checkbox" v-model="showRoads" class="size-3 accent-indigo-500" />
            Road paths
            <Loader2 v-if="loadingRoads" class="size-3 animate-spin" />
          </label>
        </div>
        <ClientOnly>
          <div ref="mapEl" class="w-full" style="height: min(50vh, 420px)" />
        </ClientOnly>
      </Card>

      <!-- Day-by-day segments -->
      <div v-for="day in daySections" :key="day.key" class="space-y-1.5">
        <div class="flex items-center gap-2">
          <span class="text-[11px] font-semibold">{{ day.label }}</span>
          <span class="text-[9px] text-muted-foreground tabular-nums">{{ day.segs.length }} leg{{ day.segs.length !== 1 ? 's' : '' }}</span>
          <div class="flex-1 h-px bg-border/60" />
          <Button v-if="day.key !== 'unscheduled' && day.segs.length" size="sm" variant="outline" class="h-6 text-[10px] px-1.5 gap-1"
            @click="scheduleDay(day.key)">
            <CalendarPlus class="size-3" /> To timeline
          </Button>
        </div>
        <!-- Day summary: distance/time moved + where you sleep -->
        <div v-if="day.segs.length" class="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[10px] text-muted-foreground -mt-0.5">
          <span v-if="day.summary.distanceKm > 0">{{ day.summary.distanceKm.toFixed(0) }} km</span>
          <span v-if="day.summary.durationMin > 0">{{ formatDur(day.summary.durationMin) }} moving</span>
          <span v-if="day.summary.lodging" class="flex items-center gap-1 text-violet-600 dark:text-violet-400">
            <BedDouble class="size-3" /> {{ day.summary.lodging }}
          </span>
          <span v-else-if="day.summary.endsAt" class="flex items-center gap-1">
            <Moon class="size-3" /> night in {{ day.summary.endsAt }}
          </span>
        </div>

        <Card v-for="s in day.segs" :key="s.id" class="p-2 group">
          <div class="flex items-start gap-2">
            <span class="text-base leading-none mt-0.5">{{ meta(s.mode).emoji }}</span>
            <div class="min-w-0 flex-1 space-y-1.5">
              <!-- Row 1: mode + title -->
              <div class="flex flex-wrap items-center gap-1.5">
                <select :value="s.mode" class="h-6 text-[10px] rounded border bg-background px-1 outline-none"
                  @change="(e: Event) => store.updateSegment(trip!.id, s.id, { mode: (e.target as HTMLSelectElement).value as TripSegmentMode })">
                  <option v-for="m in SEGMENT_MODES" :key="m" :value="m">{{ TRIP_SEGMENT_META[m].emoji }} {{ TRIP_SEGMENT_META[m].label }}</option>
                </select>
                <Input :model-value="s.title ?? ''" placeholder="label (optional)" class="h-6 text-[10px] flex-1 min-w-[100px]"
                  @update:model-value="(v: string) => store.updateSegment(trip!.id, s.id, { title: v || null })" />
              </div>

              <!-- Row 2: from / to place search -->
              <div class="grid sm:grid-cols-2 gap-1.5">
                <TripPlaceField label="From" :waypoint="s.from" @pick="(w) => store.updateSegment(trip!.id, s.id, { from: w })" />
                <TripPlaceField label="To" :waypoint="s.to" @pick="(w) => store.updateSegment(trip!.id, s.id, { to: w })" />
              </div>

              <!-- Row 3: date / time / duration / distance -->
              <div class="flex flex-wrap items-center gap-1.5">
                <Input :model-value="s.date ?? ''" type="date" class="h-6 text-[10px] w-[8.5rem]" title="Day"
                  @update:model-value="(v: string) => store.updateSegment(trip!.id, s.id, { date: v || null })" />
                <Input :model-value="s.startTime ?? ''" type="time" class="h-6 text-[10px] w-[6.5rem]" title="Start time"
                  @update:model-value="(v: string) => store.updateSegment(trip!.id, s.id, { startTime: v || null })" />
                <div class="flex items-center gap-0.5">
                  <Input :model-value="s.durationMin ?? ''" type="number" min="0" placeholder="min" class="h-6 text-[10px] w-[4.5rem]" title="Duration (min)"
                    @update:model-value="(v: string) => store.updateSegment(trip!.id, s.id, { durationMin: v === '' ? null : Number(v) })" />
                  <span class="text-[9px] text-muted-foreground">min</span>
                </div>
                <span v-if="s.distanceKm != null" class="text-[9px] text-muted-foreground">{{ s.distanceKm }} km</span>
                <Button size="sm" variant="outline" class="h-6 text-[10px] px-1.5 gap-1"
                  :disabled="estimatingId === s.id || s.from.lat == null || s.to.lat == null"
                  title="Auto-estimate duration & distance"
                  @click="estimate(s)">
                  <Gauge :class="cn('size-3', estimatingId === s.id && 'animate-pulse')" /> Estimate
                </Button>
              </div>

              <!-- Row 4: mode-specific fields -->
              <div v-if="s.mode === 'ev_charge'" class="flex flex-wrap items-center gap-1.5">
                <Input :model-value="s.evNetwork ?? ''" placeholder="network (Tesla, EA…)" class="h-6 text-[10px] w-[10rem]"
                  @update:model-value="(v: string) => store.updateSegment(trip!.id, s.id, { evNetwork: v || null })" />
                <div class="flex items-center gap-0.5">
                  <Input :model-value="s.chargeKwh ?? ''" type="number" min="0" placeholder="kWh" class="h-6 text-[10px] w-[4.5rem]"
                    @update:model-value="(v: string) => store.updateSegment(trip!.id, s.id, { chargeKwh: v === '' ? null : Number(v) })" />
                  <span class="text-[9px] text-muted-foreground">kWh</span>
                </div>
              </div>
              <div v-if="s.mode === 'flight'" class="flex items-center gap-1.5">
                <Input :model-value="s.flightNumber ?? ''" placeholder="flight # (e.g. UA123)" class="h-6 text-[10px] w-[11rem]"
                  @update:model-value="(v: string) => store.updateSegment(trip!.id, s.id, { flightNumber: v || null })" />
                <span class="text-[9px] text-muted-foreground">enter flights manually — schedule/times aren't looked up</span>
              </div>

              <!-- EV charger finder -->
              <div v-if="s.to.lat != null" class="space-y-1">
                <button type="button" class="text-[10px] text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
                  @click="toggleChargers(s)">
                  <Zap class="size-3" /> {{ chargerFor === s.id ? 'Hide chargers' : 'Find EV chargers near destination' }}
                </button>
                <div v-if="chargerFor === s.id" class="rounded-md border bg-muted/30 p-1.5 space-y-1">
                  <p v-if="loadingChargers" class="text-[10px] text-muted-foreground">Searching Open Charge Map…</p>
                  <p v-else-if="chargers.length === 0" class="text-[10px] text-muted-foreground">No chargers found within 25 km.</p>
                  <div v-for="(c, i) in chargers" :key="i" class="flex items-center gap-1.5 text-[10px]">
                    <span class="truncate flex-1">
                      {{ c.label }}
                      <span v-if="c.network" class="text-muted-foreground">· {{ c.network }}</span>
                      <span v-if="c.powerKw" class="text-muted-foreground">· {{ c.powerKw }}kW</span>
                      <span v-if="c.distanceKm != null" class="text-muted-foreground">· {{ c.distanceKm }}km</span>
                    </span>
                    <Button size="sm" variant="ghost" class="h-5 text-[9px] px-1.5" @click="addChargeStop(s, c)">
                      <Plus class="size-2.5" /> Add stop
                    </Button>
                  </div>
                </div>
              </div>

              <!-- Notes -->
              <Input :model-value="s.notes ?? ''" placeholder="notes (optional)" class="h-6 text-[10px]"
                @update:model-value="(v: string) => store.updateSegment(trip!.id, s.id, { notes: v || null })" />
            </div>

            <!-- Reorder / delete -->
            <div class="flex flex-col items-center gap-0.5 shrink-0">
              <Button size="icon" variant="ghost" class="size-5" aria-label="Move up" @click="store.moveSegment(trip!.id, s.id, -1)"><ChevronUp class="size-3" /></Button>
              <Button size="icon" variant="ghost" class="size-5" aria-label="Move down" @click="store.moveSegment(trip!.id, s.id, 1)"><ChevronDown class="size-3" /></Button>
              <Button size="icon" variant="ghost" class="size-5 text-destructive hover:text-destructive" aria-label="Delete leg" @click="store.deleteSegment(trip!.id, s.id)"><Trash2 class="size-3" /></Button>
            </div>
          </div>
        </Card>
      </div>

      <!-- Add leg -->
      <div class="flex flex-wrap items-center gap-1.5">
        <span class="text-[10px] text-muted-foreground">Add leg:</span>
        <Button v-for="m in QUICK_MODES" :key="m" size="sm" variant="outline" class="h-7 text-[10px] px-2 gap-1"
          @click="quickAdd(m)">
          <span>{{ TRIP_SEGMENT_META[m].emoji }}</span> {{ TRIP_SEGMENT_META[m].label }}
        </Button>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue';
import { Route as RouteIcon, Plus, Trash2, ChevronUp, ChevronDown, Gauge, Zap, CalendarPlus, Map as MapIcon, BedDouble, Moon, Loader2 } from 'lucide-vue-next';
import { useAppStore } from '~/stores/app';
import { useToast } from '~/composables/useToast';
import { cn } from '~/lib/utils';
import {
  TRIP_KINDS, TRIP_SEGMENT_META, segmentRoutingMode,
  type Trip, type TripSegment, type TripSegmentMode, type TripKind,
} from '~/lib/types';
import {
  travelMatrix, transitDurationSec, routeGeometry, haversineKm, isOsrmMode, findEvChargers,
  type Charger, type TravelMode,
} from '~/lib/geo';
import { format } from '~/lib/time-utils';

const store = useAppStore();
const { toast } = useToast();

const SEGMENT_MODES = Object.keys(TRIP_SEGMENT_META) as TripSegmentMode[];
const QUICK_MODES: TripSegmentMode[] = ['drive', 'transit', 'flight', 'ev_charge', 'hike', 'bike', 'lodging'];

// ── New trip form ──
const newName = ref('');
const newKind = ref<TripKind>('roadtrip');
const newStart = ref('');
const newEnd = ref('');
const selectedId = ref<string | null>(null);

const sortedTrips = computed(() => [...store.trips].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1)));
const trip = computed<Trip | null>(() => store.trips.find((t) => t.id === selectedId.value) ?? null);

// auto-select first/most-recent trip
watch(sortedTrips, (list) => {
  if (!selectedId.value && list.length) selectedId.value = list[0].id;
  if (selectedId.value && !list.some((t) => t.id === selectedId.value)) selectedId.value = list[0]?.id ?? null;
}, { immediate: true });

function kindMeta(k: TripKind) { return TRIP_KINDS.find((x) => x.value === k) ?? TRIP_KINDS[0]; }
function meta(m: TripSegmentMode) { return TRIP_SEGMENT_META[m]; }

async function createTrip() {
  if (!newName.value.trim()) return;
  const t = await store.createTrip({ name: newName.value, kind: newKind.value, startDate: newStart.value || null, endDate: newEnd.value || null });
  selectedId.value = t.id;
  newName.value = '';
  toast({ title: 'Trip created' });
}
function removeTrip(id: string) {
  store.deleteTrip(id);
  toast({ title: 'Trip deleted' });
}

// ── Segments ──
const orderedSegs = computed(() =>
  trip.value ? [...trip.value.segments].sort((a, b) => a.sortOrder - b.sortOrder) : []);

const totalDistanceKm = computed(() => orderedSegs.value.reduce((s, x) => s + (x.distanceKm ?? 0), 0));
const totalDurationMin = computed(() => orderedSegs.value.reduce((s, x) => s + (x.durationMin ?? 0), 0));

// Distinct day keys from the trip's date range + any assigned segment dates.
const dayKeys = computed(() => {
  const set = new Set<string>();
  const t = trip.value;
  if (t?.startDate) {
    const start = new Date(`${t.startDate}T00:00:00`);
    const end = t.endDate ? new Date(`${t.endDate}T00:00:00`) : start;
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) set.add(format(new Date(d), 'yyyy-MM-dd'));
  }
  for (const s of orderedSegs.value) if (s.date) set.add(s.date);
  return [...set].sort();
});

interface DaySummary { distanceKm: number; durationMin: number; lodging: string | null; endsAt: string | null; }
function summarize(segs: TripSegment[]): DaySummary {
  const distanceKm = segs.reduce((s, x) => s + (x.distanceKm ?? 0), 0);
  const durationMin = segs.reduce((s, x) => s + (x.durationMin ?? 0), 0);
  const lodgingSegs = segs.filter((s) => s.mode === 'lodging');
  const lodging = lodgingSegs.length
    ? lodgingSegs.map((s) => s.title || s.to.label || s.from.label).filter(Boolean).map((l) => l.split(',')[0]).join(', ')
    : null;
  // Where the day physically ends (last leg's destination), for night-stop context.
  let endsAt: string | null = null;
  for (let i = segs.length - 1; i >= 0; i--) {
    const to = segs[i].to.label || segs[i].from.label;
    if (to) { endsAt = to.split(',')[0]; break; }
  }
  return { distanceKm, durationMin, lodging, endsAt };
}

const daySections = computed(() => {
  const sections: { key: string; label: string; segs: TripSegment[]; summary: DaySummary }[] = [];
  for (const key of dayKeys.value) {
    const segs = orderedSegs.value.filter((s) => s.date === key);
    sections.push({ key, label: format(new Date(`${key}T00:00:00`), 'EEE, MMM d'), segs, summary: summarize(segs) });
  }
  const unscheduled = orderedSegs.value.filter((s) => !s.date);
  if (unscheduled.length) sections.push({ key: 'unscheduled', label: 'Unscheduled', segs: unscheduled, summary: summarize(unscheduled) });
  // Always show at least one bucket so the add-leg UI has context.
  if (sections.length === 0) sections.push({ key: 'unscheduled', label: 'Unscheduled', segs: [], summary: summarize([]) });
  return sections;
});

function formatDur(min: number): string {
  const h = Math.floor(min / 60); const m = Math.round(min % 60);
  return h ? `${h}h${m ? ` ${m}m` : ''}` : `${m}m`;
}

function quickAdd(mode: TripSegmentMode) {
  if (!trip.value) return;
  // Chain the new leg's "from" off the previous leg's "to".
  const prev = orderedSegs.value[orderedSegs.value.length - 1];
  store.addSegment(trip.value.id, {
    mode,
    from: prev ? { ...prev.to } : { label: '' },
    to: { label: '' },
    date: prev?.date ?? trip.value.startDate ?? null,
  });
}

// ── Estimate duration/distance ──
const estimatingId = ref<string | null>(null);
const SPEED_KMH: Record<string, number> = { walk: 4.5, hike: 4, cycle: 15, bike: 14, drive: 65, transfer: 45, transit: 30, flight: 800 };

async function estimate(s: TripSegment) {
  if (!trip.value || s.from.lat == null || s.to.lat == null) return;
  estimatingId.value = s.id;
  try {
    const from = { lat: s.from.lat, lon: s.from.lon! };
    const to = { lat: s.to.lat, lon: s.to.lon! };
    const distKm = haversineKm(from, to);
    let durMin: number | null = null;

    if (s.mode === 'ev_charge') {
      durMin = s.chargeKwh ? Math.round((s.chargeKwh / 50) * 60) : 30; // ~50kW DC assumption
    } else if (s.mode === 'flight') {
      durMin = Math.round((distKm / 800) * 60) + 30; // cruise + taxi/approach pad
    } else {
      const rmode = segmentRoutingMode(s.mode);
      if (rmode === 'transit' && store.settings?.transitApiKey) {
        const sec = await transitDurationSec(from, to, store.settings.transitApiKey);
        if (sec) durMin = Math.round(sec / 60);
      } else if (rmode && isOsrmMode(rmode as TravelMode)) {
        const m = await travelMatrix([from, to], rmode as TravelMode);
        if (m && m[0] && m[0][1] != null) durMin = Math.round(m[0][1] / 60);
      }
    }
    if (durMin == null) {
      const speed = SPEED_KMH[s.mode] ?? 40;
      durMin = Math.max(5, Math.round((distKm / speed) * 60));
    }
    store.updateSegment(trip.value.id, s.id, { durationMin: durMin, distanceKm: Math.round(distKm * 10) / 10 });
    toast({ title: `≈ ${formatDur(durMin)}`, description: `${Math.round(distKm)} km straight-line` });
  } finally {
    estimatingId.value = null;
  }
}

// ── EV charger finder ──
const chargerFor = ref<string | null>(null);
const chargers = ref<Charger[]>([]);
const loadingChargers = ref(false);

async function toggleChargers(s: TripSegment) {
  if (chargerFor.value === s.id) { chargerFor.value = null; return; }
  if (s.to.lat == null) return;
  chargerFor.value = s.id;
  chargers.value = [];
  loadingChargers.value = true;
  try {
    chargers.value = await findEvChargers({ lat: s.to.lat, lon: s.to.lon! });
  } finally {
    loadingChargers.value = false;
  }
}

function addChargeStop(after: TripSegment, c: Charger) {
  if (!trip.value) return;
  store.addSegment(trip.value.id, {
    mode: 'ev_charge',
    title: c.label,
    from: { label: c.label, lat: c.lat, lon: c.lon },
    to: { label: c.label, lat: c.lat, lon: c.lon },
    date: after.date ?? null,
    evNetwork: c.network,
    chargeKwh: 40,
    durationMin: 30,
  });
  toast({ title: 'Charge stop added', description: 'Reorder it with the up/down arrows if needed.' });
}

// ── Schedule a day onto the timeline ──
async function scheduleDay(key: string) {
  if (!trip.value) return;
  const n = await store.scheduleTripDay(trip.value.id, key);
  toast({ title: n ? `Scheduled ${n} leg${n !== 1 ? 's' : ''}` : 'Nothing to schedule', description: n ? 'Open the Timeline to see them.' : 'Assign start times or a day first.' });
}

// ── Trip map (Leaflet, client-only) ──
const mapEl = ref<HTMLElement | null>(null);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let lmap: any = null; let L: any = null; let mlayer: any = null;

interface MapPt { lat: number; lon: number; label: string; }
const mapPoints = computed<MapPt[]>(() => {
  const pts: MapPt[] = [];
  for (const s of orderedSegs.value) {
    for (const w of [s.from, s.to]) {
      if (w.lat != null && w.lon != null) {
        const last = pts[pts.length - 1];
        if (!last || last.lat !== w.lat || last.lon !== w.lon) pts.push({ lat: w.lat, lon: w.lon, label: w.label });
      }
    }
  }
  return pts;
});

const SEG_COLOR: Record<string, string> = {
  drive: '#6366f1', transfer: '#6366f1', walk: '#10b981', hike: '#10b981',
  cycle: '#f59e0b', bike: '#f59e0b', transit: '#0ea5e9', flight: '#ec4899',
  ev_charge: '#22c55e', lodging: '#8b5cf6', custom: '#64748b',
};

const showRoads = ref(true);
const loadingRoads = ref(false);
// Cache OSRM geometry so toggling/redraws don't re-hit the routing server.
const geomCache = new Map<string, [number, number][] | null>();
let renderToken = 0;

async function ensureMap() {
  if (typeof window === 'undefined' || !mapEl.value || mapPoints.value.length === 0) return;
  if (!L) L = (await import('leaflet')).default ?? (await import('leaflet'));
  if (!lmap) {
    lmap = L.map(mapEl.value, { zoomControl: true });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap contributors' }).addTo(lmap);
    // The container may have been laid out after creation (tab switch) — fix sizing.
    setTimeout(() => lmap && lmap.invalidateSize(), 60);
  }
  await renderMap();
}

async function geomFor(s: TripSegment): Promise<[number, number][] | null> {
  const rmode = segmentRoutingMode(s.mode);
  if (!rmode || !isOsrmMode(rmode as TravelMode) || s.from.lat == null || s.to.lat == null) return null;
  const key = `${rmode}:${s.from.lat},${s.from.lon}->${s.to.lat},${s.to.lon}`;
  if (geomCache.has(key)) return geomCache.get(key)!;
  const g = await routeGeometry([{ lat: s.from.lat, lon: s.from.lon! }, { lat: s.to.lat, lon: s.to.lon! }], rmode as TravelMode);
  geomCache.set(key, g);
  return g;
}

async function renderMap() {
  if (!lmap || !L) return;
  const token = ++renderToken;
  if (mlayer) { lmap.removeLayer(mlayer); mlayer = null; }
  const pts = mapPoints.value;
  if (pts.length === 0) return;
  mlayer = L.layerGroup().addTo(lmap);
  const bounds: [number, number][] = [];
  pts.forEach((p, i) => {
    const icon = L.divIcon({
      className: '',
      html: `<div style="background:#6366f1;color:#fff;width:20px;height:20px;border-radius:9999px;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4)">${i + 1}</div>`,
      iconSize: [20, 20], iconAnchor: [10, 10],
    });
    L.marker([p.lat, p.lon], { icon }).addTo(mlayer).bindPopup(escapeHtml(p.label || `Stop ${i + 1}`));
    bounds.push([p.lat, p.lon]);
  });

  const legs = orderedSegs.value.filter((s) => s.from.lat != null && s.to.lat != null);
  // Straight dashed line first — instant overview, replaced by road geometry below.
  for (const s of legs) {
    L.polyline([[s.from.lat!, s.from.lon!], [s.to.lat!, s.to.lon!]], {
      color: SEG_COLOR[s.mode] ?? '#6366f1', weight: 3, opacity: 0.55, dashArray: '5 5',
    }).addTo(mlayer);
  }
  if (bounds.length) lmap.fitBounds(L.latLngBounds(bounds).pad(0.25), { maxZoom: 13 });

  // Real road/trail geometry for drive/cycle/walk/hike/bike/transfer legs.
  if (showRoads.value) {
    const routable = legs.filter((s) => segmentRoutingMode(s.mode) && isOsrmMode(segmentRoutingMode(s.mode) as TravelMode));
    if (routable.length) {
      loadingRoads.value = true;
      try {
        for (const s of routable) {
          const g = await geomFor(s);
          if (token !== renderToken || !mlayer) return; // superseded / unmounted
          if (g && g.length > 1) {
            L.polyline(g, { color: SEG_COLOR[s.mode] ?? '#6366f1', weight: 4, opacity: 0.85 }).addTo(mlayer);
          }
        }
      } finally {
        if (token === renderToken) loadingRoads.value = false;
      }
    }
  }
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));
}

watch(mapPoints, () => { if (lmap) renderMap(); else nextTick(ensureMap); }, { deep: true });
watch(trip, () => { nextTick(ensureMap); });
watch(showRoads, () => { if (lmap) renderMap(); });
onMounted(() => { nextTick(ensureMap); });
onBeforeUnmount(() => { if (lmap) { lmap.remove(); lmap = null; mlayer = null; } });
</script>
