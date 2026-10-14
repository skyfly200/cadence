<template>
  <div class="relative">
    <div class="flex gap-2">
      <input
        :value="modelValue" type="text" autocomplete="off" role="combobox" :aria-expanded="results.length > 0" aria-label="Location"
        class="min-w-0 flex-1 rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-[16px] outline-none dark:border-white/10 dark:bg-dusk"
        placeholder="Search for a place"
        @input="onInput(($event.target as HTMLInputElement).value)" @focus="void requestLocation()"
      />
      <button
        type="button" aria-label="Use my current location" :disabled="locating"
        class="min-h-[44px] min-w-[44px] rounded-xl bg-stone-100 text-lg hover:bg-stone-200 disabled:opacity-50 dark:bg-white/10 dark:hover:bg-white/15"
        @click="useMyLocation"
      >📍</button>
      <button
        v-if="modelValue" type="button" aria-label="Clear location"
        class="min-h-[44px] min-w-[44px] rounded-xl bg-stone-100 text-stone-600 hover:bg-stone-200 dark:bg-white/10 dark:text-stone-300 dark:hover:bg-white/15"
        @click="clear"
      ><X class="mx-auto size-4" /></button>
    </div>
    <ul v-if="results.length" class="absolute inset-x-0 z-10 mt-1 max-h-48 overflow-y-auto rounded-xl border border-stone-200 bg-white shadow-lg dark:border-white/10 dark:bg-dusk-card" role="listbox">
      <li v-for="(p, i) in results" :key="i" role="option">
        <button type="button" class="block min-h-[44px] w-full truncate px-3 text-left text-sm hover:bg-stone-100 dark:hover:bg-white/10" @click="pick(p)">{{ p.label }}</button>
      </li>
    </ul>
    <p v-if="note" class="mt-1 text-sm text-slate-500 dark:text-slate-400">{{ note }}</p>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue';
import { X } from 'lucide-vue-next';
import { reversePlace, searchPlaces, type Place } from '~/lib/geo';
import { useCurrentLocation } from '~/composables/useCurrentLocation';

defineProps<{ modelValue: string }>();
const emit = defineEmits<{ (e: 'update:modelValue', v: string): void; (e: 'coords', c: { lat: number; lon: number } | null): void }>();

const { coords: myLocation, request: requestLocation } = useCurrentLocation();
const results = ref<Place[]>([]);
const note = ref('');
const locating = ref(false);
let timer: ReturnType<typeof setTimeout> | null = null;
let seq = 0;

function onInput(v: string) {
  emit('update:modelValue', v);
  emit('coords', null); // typed text has no known position until a suggestion is picked
  note.value = '';
  if (timer) clearTimeout(timer);
  const q = v.trim();
  const mine = ++seq;
  if (q.length < 3) { results.value = []; return; }
  timer = setTimeout(async () => {
    const found = await searchPlaces(q, myLocation.value);
    if (mine === seq) results.value = found; // drop answers to an older query
  }, 450);
}
function pick(p: Place) {
  seq++;
  results.value = [];
  emit('update:modelValue', p.label);
  emit('coords', { lat: p.lat, lon: p.lon });
}
function clear() {
  seq++;
  results.value = [];
  note.value = '';
  emit('update:modelValue', '');
  emit('coords', null);
}
async function useMyLocation() {
  locating.value = true;
  note.value = '';
  const here = await requestLocation();
  if (!here) {
    note.value = 'Could not get your location. Allow location access for this site, or search for a place.';
  } else {
    const place = await reversePlace(here);
    pick(place ?? { label: `${here.lat.toFixed(4)}, ${here.lon.toFixed(4)}`, lat: here.lat, lon: here.lon });
  }
  locating.value = false;
}
onBeforeUnmount(() => { if (timer) clearTimeout(timer); });
</script>
