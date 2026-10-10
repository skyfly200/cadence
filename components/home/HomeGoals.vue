<template>
  <section class="px-4 pt-4">
    <h1 class="text-xl font-semibold">Goals</h1>
    <GardenStrip @open="emit('open-garden')" />

    <p v-if="!graph.goalList.length" class="mt-3 text-[15px] text-slate-500 dark:text-slate-400">
      No goals yet. Add one, then give it a first step. Small is fine.
    </p>

    <article v-for="(row, i) in graph.goalList" :key="row.goal.id" class="mt-4 rounded-3xl bg-white p-4 shadow-sm dark:bg-dusk-card">
      <div class="flex items-start gap-1">
        <h2 class="min-w-0 flex-1 break-words font-serif text-lg leading-snug">{{ row.goal.title }}</h2>
        <button :class="icon" :disabled="i === 0" :aria-label="`Move ${row.goal.title} up`" title="Move up" @click="graph.moveGoal(row.goal.id, -1)"><ChevronUp class="size-4" /></button>
        <button :class="icon" :disabled="i === graph.goalList.length - 1" :aria-label="`Move ${row.goal.title} down`" title="Move down" @click="graph.moveGoal(row.goal.id, 1)"><ChevronDown class="size-4" /></button>
        <button :class="icon" :aria-label="`Edit ${row.goal.title}`" title="Edit" @click="emit('edit', row.goal.id)"><Pencil class="size-4" /></button>
        <button :class="[icon, 'text-red-600 dark:text-red-400']" :aria-label="`Delete ${row.goal.title}`" title="Delete" @click="confirmId = row.goal.id"><Trash2 class="size-4" /></button>
      </div>
      <div v-if="confirmId === row.goal.id" class="mt-2 rounded-xl border border-red-200 bg-red-50 p-3 dark:border-red-900 dark:bg-red-950/30">
        <p class="text-sm text-red-900 dark:text-red-300">Delete this goal? Its steps stay; they just stop being part of it.</p>
        <div class="mt-2 flex gap-2">
          <button class="min-h-[44px] flex-1 rounded-xl bg-stone-100 text-sm font-medium dark:bg-white/10" @click="confirmId = null">Cancel</button>
          <button class="min-h-[44px] flex-1 rounded-xl bg-red-600 text-sm font-medium text-white" @click="remove(row.goal.id)">Yes, delete</button>
        </div>
      </div>
      <div v-if="row.total" class="mt-2 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-white/20" role="progressbar" :aria-valuenow="Math.round(row.fraction * 100)" aria-valuemin="0" aria-valuemax="100" :aria-label="`${row.goal.title} progress`">
        <div class="h-full rounded-full bg-teal-400 dark:bg-lavender" :style="{ width: `${row.fraction * 100}%` }" />
      </div>
      <p v-if="row.total" class="mt-1 text-xs text-slate-500 dark:text-slate-400">{{ row.done }} of {{ row.total }} steps done</p>

      <ul v-if="row.milestones.length" class="mt-3 space-y-2">
        <li v-for="m in row.milestones" :key="m.goal.id">
          <span class="flex items-baseline justify-between gap-2 text-sm"><span class="break-words">{{ m.goal.title }}</span><span class="shrink-0 text-xs text-slate-500 dark:text-slate-400">{{ m.done }}/{{ m.total }}</span></span>
          <span class="mt-1 block h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-white/20"><span class="block h-full rounded-full bg-teal-300 dark:bg-lavender" :style="{ width: `${m.fraction * 100}%` }" /></span>
        </li>
      </ul>

      <p class="mt-3 text-[15px]">
        <span class="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">Next step</span><br>
        <span v-if="row.next" class="break-words">{{ row.next.title }}</span>
        <span v-else class="text-slate-500 dark:text-slate-400">{{ row.total ? 'Nothing open right now.' : 'Add a first step below.' }}</span>
      </p>

      <button class="mt-2 min-h-[44px] text-sm text-blue-600 dark:text-blue-400" @click="toggle(row.goal.id)">{{ openId === row.goal.id ? 'Close' : 'Add or attach' }}</button>
      <div v-if="openId === row.goal.id" class="mt-1 space-y-3">
        <form class="flex gap-2" @submit.prevent="step(row.goal.id)">
          <input v-model="stepTitle" class="min-h-[44px] min-w-0 flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 text-[16px] outline-none dark:border-white/10 dark:bg-dusk" placeholder="A step" maxlength="120" aria-label="New step">
          <button type="submit" class="min-h-[44px] rounded-xl bg-ember px-4 font-semibold text-white disabled:opacity-50" :disabled="!stepTitle.trim()">Add</button>
        </form>
        <form class="flex gap-2" @submit.prevent="milestone(row.goal.id)">
          <input v-model="milestoneTitle" class="min-h-[44px] min-w-0 flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 text-[16px] outline-none dark:border-white/10 dark:bg-dusk" placeholder="A milestone" maxlength="120" aria-label="New milestone">
          <button type="submit" class="min-h-[44px] rounded-xl bg-stone-100 px-4 font-medium dark:bg-white/10" :disabled="!milestoneTitle.trim()">Add</button>
        </form>
        <select v-if="graph.attachableTo(row.goal.id).length" class="min-h-[44px] w-full rounded-lg border border-slate-200 bg-slate-50 px-2 text-[16px] outline-none dark:border-white/10 dark:bg-dusk" aria-label="Attach an existing item" @change="attach(row.goal.id, $event)">
          <option value="">Attach something you already have…</option>
          <option v-for="c in graph.attachableTo(row.goal.id)" :key="c.id" :value="c.id">{{ c.title }}</option>
        </select>
      </div>
    </article>

    <button v-if="density < 2" class="mt-5 flex min-h-[44px] w-full items-center gap-2 rounded-2xl bg-white px-4 text-left text-sm text-slate-600 shadow-sm dark:bg-dusk-card dark:text-slate-300" @click="emit('capture')">
      <Plus class="size-4 shrink-0" />Add a goal: start with "goal:", like "goal: finish the projection mapping"
    </button>
    <form v-else class="mt-5 rounded-2xl bg-white p-3 shadow-sm dark:bg-dusk-card" @submit.prevent="add">
      <p class="text-sm font-medium">Add a goal</p>
      <input v-model="title" class="mt-2 min-h-[44px] w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-[16px] outline-none dark:border-white/10 dark:bg-dusk" placeholder="e.g. Finish the projection mapping" maxlength="120">
      <button type="submit" class="mt-3 min-h-[44px] w-full rounded-2xl bg-ember font-semibold text-white disabled:opacity-50" :disabled="!title.trim()">Add goal</button>
    </form>
  </section>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { ChevronDown, ChevronUp, Pencil, Plus, Trash2 } from 'lucide-vue-next';
import type { Density } from '~/lib/home/prefs';
import { useGraphStore } from '~/stores/graph';

defineProps<{ density: Density }>();
const emit = defineEmits<{ (e: 'said', msg: string): void; (e: 'edit', nodeId: string): void; (e: 'open-garden'): void; (e: 'capture'): void }>();
const icon = 'grid size-9 shrink-0 place-items-center rounded-lg text-slate-500 hover:bg-stone-100 disabled:opacity-30 dark:text-slate-300 dark:hover:bg-white/10';
const confirmId = ref<string | null>(null);
const graph = useGraphStore();

const title = ref('');
const openId = ref<string | null>(null);
const stepTitle = ref('');
const milestoneTitle = ref('');

const toggle = (id: string) => { openId.value = openId.value === id ? null : id; stepTitle.value = ''; milestoneTitle.value = ''; };

function remove(id: string) { graph.removeNode(id); confirmId.value = null; emit('said', 'Goal deleted.'); }
function add() {
  if (graph.createGoal(title.value)) { title.value = ''; emit('said', 'Goal added.'); }
}
function step(goalId: string) {
  if (graph.addStep(stepTitle.value, goalId)) { stepTitle.value = ''; emit('said', 'Step added.'); }
}
function milestone(goalId: string) {
  if (graph.createGoal(milestoneTitle.value, goalId)) { milestoneTitle.value = ''; emit('said', 'Milestone added.'); }
}
function attach(goalId: string, e: Event) {
  const el = e.target as HTMLSelectElement;
  if (el.value && graph.attachTo(el.value, goalId)) emit('said', 'Attached.');
  el.value = '';
}
</script>
