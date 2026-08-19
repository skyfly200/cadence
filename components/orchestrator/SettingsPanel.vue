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

        <div>
          <h4 class="text-xs font-semibold text-muted-foreground mb-2">Travel</h4>
          <div class="flex items-center gap-2 flex-wrap">
            <Label class="text-xs">Default mode</Label>
            <select v-model="form.travelMode" class="h-8 text-sm rounded-md border bg-background px-2 outline-none">
              <option value="drive">🚗 Drive</option>
              <option value="walk">🚶 Walk</option>
              <option value="cycle">🚲 Cycle</option>
              <option v-if="form.transitEnabled" value="transit">🚆 Transit</option>
            </select>
            <span class="text-[10px] text-muted-foreground">Estimates travel time between task locations when auto-planning.</span>
          </div>

          <div class="mt-2 rounded-md border border-border/60 bg-muted/20 p-2 space-y-1.5">
            <label class="flex items-center gap-2 cursor-pointer select-none">
              <span :class="switchCls(form.transitEnabled)" @click="form.transitEnabled = !form.transitEnabled">
                <span :class="knobCls(form.transitEnabled)" />
              </span>
              <span class="text-[11px] font-medium">Enable public transit (bring your own key)</span>
            </label>
            <template v-if="form.transitEnabled">
              <Input v-model="form.transitApiKey" type="password" placeholder="HERE API key" class="h-7 text-[11px]" />
              <p class="text-[10px] text-muted-foreground">
                Transit uses the <a href="https://platform.here.com/" target="_blank" rel="noopener noreferrer" class="text-sky-600 dark:text-sky-400 underline">HERE</a> Transit API — create a free key, paste it here. Stored only on this device; not verified until you Save &amp; auto-plan.
              </p>
            </template>
          </div>
        </div>

        <div class="flex flex-wrap items-center gap-2 pt-2">
          <Button @click="save"><Save class="size-4" /> Save settings</Button>
          <Button variant="outline" @click="regenerateAnchors"><RefreshCw class="size-4" /> Regenerate anchors</Button>
        </div>
      </div>
    </Card>

    <!-- Install app -->
    <Card class="p-3 sm:p-4 max-w-2xl">
      <div class="flex items-center gap-2 mb-2">
        <DownloadCloud class="size-4" />
        <h3 class="text-sm font-semibold">Install app</h3>
      </div>
      <p v-if="installed" class="text-[11px] text-emerald-600 flex items-center gap-1"><Check class="size-3" /> Installed on this device.</p>
      <template v-else-if="canInstall">
        <p class="text-[11px] text-muted-foreground mb-2">Install Cadence for a full-screen, offline experience.</p>
        <Button size="sm" @click="installApp"><DownloadCloud class="size-4" /> Install Cadence</Button>
      </template>
      <p v-else-if="isIOS" class="text-[11px] text-muted-foreground">
        On iPhone/iPad: open in <strong>Safari</strong>, tap the <strong>Share</strong> icon, then <strong>Add to Home Screen</strong>.
      </p>
      <p v-else class="text-[11px] text-muted-foreground">
        No install prompt yet. In Chrome/Edge, use the browser menu (⋮) → <strong>Install app</strong> / <strong>Add to Home screen</strong>.
        The header <strong>Install</strong> button appears automatically once your browser allows it (needs HTTPS + a little interaction).
      </p>
    </Card>

    <!-- Notifications -->
    <Card class="p-3 sm:p-4 max-w-2xl">
      <div class="flex items-center gap-2 mb-2">
        <Bell class="size-4" />
        <h3 class="text-sm font-semibold">Notifications</h3>
      </div>
      <p class="text-[11px] text-muted-foreground mb-3">
        Local reminders while Cadence is open (an installed app counts). Nothing leaves your device.
      </p>

      <p v-if="!notifSupported" class="text-[11px] text-amber-600">This browser doesn’t support notifications.</p>

      <div v-else-if="!prefs.enabled">
        <Button size="sm" @click="enableNotifs"><Bell class="size-4" /> Enable notifications</Button>
      </div>

      <div v-else class="space-y-2.5">
        <label class="flex items-center gap-2 cursor-pointer select-none">
          <span :class="switchCls(prefs.anchors)" @click="store.setNotificationPrefs({ anchors: !prefs.anchors })">
            <span :class="knobCls(prefs.anchors)" />
          </span>
          <span class="text-[11px]">Anchor &amp; meal reminders</span>
        </label>
        <label class="flex items-center gap-2 cursor-pointer select-none">
          <span :class="switchCls(prefs.timer)" @click="store.setNotificationPrefs({ timer: !prefs.timer })">
            <span :class="knobCls(prefs.timer)" />
          </span>
          <span class="text-[11px]">Pomodoro complete</span>
        </label>
        <div class="flex items-center gap-2">
          <span class="text-[11px]">Daily habit reminder</span>
          <Input type="time" v-model="habitsReminder" class="h-7 w-28 text-[11px]" />
          <Button v-if="habitsReminder" size="sm" variant="ghost" class="h-6 text-[10px] px-2" @click="habitsReminder = ''">off</Button>
        </div>
        <div class="flex gap-2 pt-1">
          <Button size="sm" variant="outline" @click="testNotif">Send test</Button>
          <Button size="sm" variant="ghost" class="text-muted-foreground" @click="store.setNotificationPrefs({ enabled: false })">Turn off</Button>
        </div>
      </div>
    </Card>

    <!-- Data backup -->
    <Card class="p-3 sm:p-4 max-w-2xl">
      <div class="flex items-center gap-2 mb-2">
        <Database class="size-4" />
        <h3 class="text-sm font-semibold">Data</h3>
      </div>
      <p class="text-[11px] text-muted-foreground mb-3">
        Everything lives in this browser. Export a backup to keep it safe or move it to another device.
      </p>
      <div class="flex flex-wrap gap-2">
        <Button variant="outline" @click="exportBackup"><Download class="size-4" /> Export backup</Button>
        <Button variant="outline" @click="fileInput?.click()"><Upload class="size-4" /> Import backup</Button>
        <input ref="fileInput" type="file" accept="application/json,.json" class="hidden" @change="importBackup" />
      </div>
    </Card>

    <GoogleCalendarSettings />
  </div>
</template>

<script setup lang="ts">
import { reactive, ref, computed, watch } from 'vue';
import { Settings as SettingsIcon, Save, RefreshCw, Database, Download, Upload, Bell, DownloadCloud, Check } from 'lucide-vue-next';
import { useAppStore } from '~/stores/app';
import { useToast } from '~/composables/useToast';
import { useInstallPrompt } from '~/composables/useInstallPrompt';
import { formatDuration } from '~/lib/time-utils';
import { exportAllData, importAllData } from '~/lib/local-storage';
import { notificationsSupported, showNotification } from '~/lib/notifications';
import { cn } from '~/lib/utils';

const { canInstall, installed, isIOS, install: installApp } = useInstallPrompt();

const store = useAppStore();
const { toast } = useToast();

const DEFAULTS = {
  wakeTime: '07:00', sleepTime: '23:00', breakfastTime: '08:00', lunchTime: '13:00',
  dinnerTime: '19:00', hydrationInterval: 90, defaultPomodoroMinutes: 25, defaultBreakMinutes: 5,
  travelMode: 'drive' as 'drive' | 'walk' | 'cycle' | 'transit',
  transitEnabled: false,
  transitApiKey: '',
};

const form = reactive({ ...DEFAULTS });

function hydrate() {
  const s = store.settings;
  if (s) Object.assign(form, {
    wakeTime: s.wakeTime, sleepTime: s.sleepTime, breakfastTime: s.breakfastTime,
    lunchTime: s.lunchTime, dinnerTime: s.dinnerTime, hydrationInterval: s.hydrationInterval,
    defaultPomodoroMinutes: s.defaultPomodoroMinutes, defaultBreakMinutes: s.defaultBreakMinutes,
    travelMode: s.travelMode ?? 'drive',
    transitEnabled: s.transitEnabled ?? false,
    transitApiKey: s.transitApiKey ?? '',
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

// ── Notifications ────────────────────────────────────────
const notifSupported = notificationsSupported();
const prefs = computed(() => store.notificationPrefs);
const habitsReminder = computed({
  get: () => prefs.value.habitsReminder,
  set: (v: string) => store.setNotificationPrefs({ habitsReminder: v }),
});
const switchCls = (on: boolean) => cn('relative h-4 w-7 rounded-full transition-colors inline-block', on ? 'bg-primary' : 'bg-muted-foreground/30');
const knobCls = (on: boolean) => cn('absolute top-0.5 size-3 rounded-full bg-background transition-transform', on ? 'translate-x-3.5' : 'translate-x-0.5');
async function enableNotifs() {
  const ok = await store.enableNotifications();
  if (!ok) toast({ title: 'Permission denied', description: 'Allow notifications for this site in your browser settings.', variant: 'destructive' });
}
function testNotif() { void showNotification('Test reminder', { body: 'This is how Cadence reminders look.', tag: 'test' }); }

// ── Data backup ──────────────────────────────────────────
const fileInput = ref<HTMLInputElement | null>(null);

function exportBackup() {
  const payload = {
    app: 'cadence',
    version: 1,
    exportedAt: new Date().toISOString(),
    data: exportAllData(),
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `cadence-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  toast({ title: 'Backup downloaded' });
}

async function importBackup(e: Event) {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  try {
    const parsed = JSON.parse(await file.text());
    const data = (parsed?.data ?? parsed) as Record<string, unknown>;
    if (!data || typeof data !== 'object') throw new Error('bad');
    importAllData(data);
    store.loadData();
    store.loadSettings();
    toast({ title: 'Backup imported', description: 'Your data has been restored.' });
  } catch {
    toast({ title: 'Import failed', description: 'That file isn’t a valid Cadence backup.', variant: 'destructive' });
  } finally {
    input.value = '';
  }
}
</script>
