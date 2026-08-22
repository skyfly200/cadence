<template>
  <div class="relative">
    <label class="text-[9px] text-muted-foreground flex items-center gap-1">
      {{ label }}
      <MapPin :class="cn('size-2.5', hasCoords ? 'text-emerald-500' : 'text-muted-foreground/50')" />
    </label>
    <div class="flex items-center gap-1">
      <Input v-model="text" :placeholder="`search a place…`" class="h-6 text-[10px] flex-1" @input="onInput" @focus="onInput" />
      <Button v-if="text" size="icon" variant="ghost" class="size-5 shrink-0" aria-label="Clear" @click="clear"><X class="size-2.5" /></Button>
    </div>
    <div v-if="results.length" class="absolute z-30 left-0 right-0 mt-0.5 rounded-md border bg-background shadow-lg max-h-40 overflow-y-auto">
      <button v-for="(p, i) in results" :key="i" type="button"
        class="block w-full text-left px-2 py-1 text-[10px] hover:bg-muted border-b last:border-b-0 truncate"
        @click="pick(p)">{{ p.label }}</button>
    </div>
    <p v-if="searching" class="text-[9px] text-muted-foreground mt-0.5">Searching…</p>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { MapPin, X } from 'lucide-vue-next';
import { cn } from '~/lib/utils';
import { searchPlaces, type Place } from '~/lib/geo';
import { useCurrentLocation } from '~/composables/useCurrentLocation';
import type { TripWaypoint } from '~/lib/types';

const props = defineProps<{ label: string; waypoint: TripWaypoint }>();
const emit = defineEmits<{ (e: 'pick', w: TripWaypoint): void }>();

const text = ref(props.waypoint.label ?? '');
const results = ref<Place[]>([]);
const searching = ref(false);
let timer: ReturnType<typeof setTimeout> | null = null;

const hasCoords = computed(() => props.waypoint.lat != null && props.waypoint.lon != null);

// Keep in sync when the parent swaps the waypoint (e.g. chaining legs).
watch(() => props.waypoint.label, (v) => { if (v !== text.value) text.value = v ?? ''; });

const { coords: myLocation, request: requestLocation } = useCurrentLocation();

function onInput() {
  void requestLocation();
  if (timer) clearTimeout(timer);
  const q = text.value.trim();
  if (q.length < 3) { results.value = []; searching.value = false; return; }
  searching.value = true;
  timer = setTimeout(async () => {
    results.value = await searchPlaces(q, myLocation.value);
    searching.value = false;
  }, 450);
}
function pick(p: Place) {
  text.value = p.label;
  results.value = [];
  emit('pick', { label: p.label, lat: p.lat, lon: p.lon });
}
function clear() {
  text.value = '';
  results.value = [];
  emit('pick', { label: '', lat: null, lon: null });
}
</script>
