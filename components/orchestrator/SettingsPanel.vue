<template>
  <div class="space-y-3">
    <Card class="p-3 sm:p-4 max-w-2xl">
      <div class="flex items-center gap-2 mb-3 sm:mb-4">
        <SettingsIcon class="size-4" />
        <h3 class="text-sm font-semibold">Settings</h3>
      </div>

      <div class="space-y-3 sm:space-y-4">
        <div>
          <h4 class="text-xs font-semibold text-muted-foreground mb-2">Daily Rhythm</h4>
          <div class="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
            <div class="space-y-1">
              <Label class="text-xs">Wake time</Label>
              <Input type="time" v-model="form.wakeTime" class="h-8 text-sm" />
            </div>
            <div class="space-y-1">
              <Label class="text-xs">Sleep time</Label>
              <Input type="time" v-model="form.sleepTime" class="h-8 text-sm" />
            </div>
            <div class="col-span-2 sm:col-span-1 space-y-1">
              <Label class="text-xs">Hydration interval</Label>
              <div class="flex items-center gap-2">
                <Slider :model-value="form.hydrationInterval" :min="30" :max="180" :step="15" class="flex-1" @update:model-value="(v) => form.hydrationInterval = v" />
                <span class="text-xs tabular-nums w-12">{{ form.hydrationInterval }}m</span>
              </div>
            </div>
          </div>
        </div>

        <div>
          <h4 class="text-xs font-semibold text-muted-foreground mb-2">Anchor Blocks (meals)</h4>
          <div class="grid grid-cols-3 gap-2 sm:gap-3">
            <div class="space-y-1"><Label class="text-xs">Breakfast</Label><Input type="time" v-model="form.breakfastTime" class="h-8 text-sm" /></div>
            <div class="space-y-1"><Label class="text-xs">Lunch</Label><Input type="time" v-model="form.lunchTime" class="h-8 text-sm" /></div>
            <div class="space-y-1"><Label class="text-xs">Dinner</Label><Input type="time" v-model="form.dinnerTime" class="h-8 text-sm" /></div>
          </div>
        </div>

        <div>
          <h4 class="text-xs font-semibold text-muted-foreground mb-2">Timer defaults</h4>
          <div class="grid grid-cols-2 gap-2 sm:gap-3">
            <div class="space-y-1">
              <Label class="text-xs">Pomodoro focus ({{ formatDuration(form.defaultPomodoroMinutes) }})</Label>
              <Slider :model-value="form.defaultPomodoroMinutes" :min="15" :max="60" :step="5" @update:model-value="(v) => form.defaultPomodoroMinutes = v" />
            </div>
            <div class="space-y-1">
              <Label class="text-xs">Break ({{ formatDuration(form.defaultBreakMinutes) }})</Label>
              <Slider :model-value="form.defaultBreakMinutes" :min="5" :max="30" :step="5" @update:model-value="(v) => form.defaultBreakMinutes = v" />
            </div>
          </div>
        </div>

        <div class="flex flex-wrap items-center gap-2 pt-2">
          <Button @click="save"><Save class="size-4" /> Save settings</Button>
          <Button variant="outline" @click="regenerateAnchors"><RefreshCw class="size-4" /> Regenerate anchors</Button>
        </div>
      </div>
    </Card>

    <GoogleCalendarSettings />
  </div>
</template>

<script setup lang="ts">
import { reactive, watch } from 'vue';
import { Settings as SettingsIcon, Save, RefreshCw } from 'lucide-vue-next';
import { useAppStore } from '~/stores/app';
import { useToast } from '~/composables/useToast';
import { formatDuration } from '~/lib/time-utils';

const store = useAppStore();
const { toast } = useToast();

const DEFAULTS = {
  wakeTime: '07:00', sleepTime: '23:00', breakfastTime: '08:00', lunchTime: '13:00',
  dinnerTime: '19:00', hydrationInterval: 90, defaultPomodoroMinutes: 25, defaultBreakMinutes: 5,
};

const form = reactive({ ...DEFAULTS });

function hydrate() {
  const s = store.settings;
  if (s) Object.assign(form, {
    wakeTime: s.wakeTime, sleepTime: s.sleepTime, breakfastTime: s.breakfastTime,
    lunchTime: s.lunchTime, dinnerTime: s.dinnerTime, hydrationInterval: s.hydrationInterval,
    defaultPomodoroMinutes: s.defaultPomodoroMinutes, defaultBreakMinutes: s.defaultBreakMinutes,
  });
}
watch(() => store.settings, hydrate, { immediate: true });

async function save() {
  try {
    await store.saveSettings({ ...form });
    toast({ title: 'Settings saved' });
  } catch {
    toast({ title: 'Save failed', variant: 'destructive' });
  }
}

async function regenerateAnchors() {
  const anchors = store.timeBlocks.filter((b) => b.isAnchor);
  for (const a of anchors) await store.deleteTimeBlock(a.id);
  await store.generateAnchors();
  toast({ title: 'Anchors regenerated' });
}
</script>
