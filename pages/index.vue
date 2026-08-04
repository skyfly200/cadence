<template>
  <div class="min-h-dvh flex flex-col bg-muted/30">
    <!-- Header -->
    <header class="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div class="mx-auto max-w-7xl px-3 sm:px-4 py-2 sm:py-3">
        <div class="flex items-center justify-between gap-2 sm:gap-3">
          <div class="flex items-center gap-2 min-w-0">
            <div class="flex size-8 sm:size-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 text-white shadow-sm">
              <Sparkles class="size-4 sm:size-5" />
            </div>
            <div class="min-w-0">
              <h1 class="text-sm font-bold tracking-tight truncate">Cadence</h1>
              <p class="text-[10px] sm:text-[11px] text-muted-foreground hidden sm:block">
                Capacity-aware planning · resilient timers · process-based scoring
              </p>
            </div>
          </div>
          <div class="flex items-center gap-1.5 sm:gap-2">
            <div v-if="streak > 0"
              class="flex items-center gap-1 rounded-full border border-orange-500/30 bg-orange-500/10 px-2 sm:px-2.5 py-1"
              :title="`${streak}-day planning streak${plannedToday ? '' : ' — plan today to keep it'}`">
              <Flame :class="['size-3.5', plannedToday ? 'text-orange-500' : 'text-orange-400/70']" />
              <span class="text-xs sm:text-sm font-bold tabular-nums">{{ streak }}</span>
            </div>
            <div class="hidden xs:flex items-center gap-1.5 rounded-full border bg-muted/50 px-2.5 sm:px-3 py-1">
              <span class="text-[9px] sm:text-[10px] font-medium text-muted-foreground">SCORE</span>
              <span class="text-xs sm:text-sm font-bold tabular-nums">{{ todayScore }}</span>
            </div>
            <Button v-if="store.canUndo" variant="ghost" size="icon" aria-label="Undo" title="Undo (⌘Z)" class="size-8 sm:size-9 hidden sm:inline-flex" @click="store.undo()">
              <Undo2 class="size-4" />
            </Button>
            <Button v-if="store.canRedo" variant="ghost" size="icon" aria-label="Redo" title="Redo (⇧⌘Z)" class="size-8 sm:size-9 hidden sm:inline-flex" @click="store.redo()">
              <Redo2 class="size-4" />
            </Button>
            <Button variant="ghost" size="icon" aria-label="Quick capture" class="size-8 sm:size-9" @click="captureOpen = true">
              <Mic class="size-4" />
            </Button>
            <ClientOnly>
              <Button variant="ghost" size="icon" aria-label="Toggle theme" class="size-8 sm:size-9" @click="toggleTheme">
                <Sun v-if="colorMode.value === 'dark'" class="size-4" />
                <Moon v-else class="size-4" />
              </Button>
            </ClientOnly>
          </div>
        </div>
      </div>
    </header>

    <!-- Quick Capture Dialog -->
    <Dialog :open="captureOpen" content-class="sm:max-w-md" @update:open="captureOpen = $event">
      <div class="space-y-3">
        <div>
          <h2 class="flex items-center gap-2 text-sm font-semibold"><Mic class="size-4" /> Quick Capture</h2>
          <p class="text-[11px] text-muted-foreground mt-0.5">Speak or type a task — e.g. “Add design new poster to Incubator list”</p>
        </div>
        <VoiceInput :auto-start="captureOpen" />
      </div>
    </Dialog>

    <!-- Main -->
    <main class="flex-1 mx-auto w-full max-w-7xl px-2 sm:px-3 md:px-4 py-2">
      <div class="space-y-2">
        <!-- Tab bar -->
        <div class="grid w-full grid-cols-4 xs:grid-cols-7 h-auto rounded-md bg-muted p-1 gap-1">
          <button v-for="tab in tabs" :key="tab.value"
            :class="cn(
              'relative flex flex-col xs:flex-row items-center justify-center gap-0.5 py-1.5 rounded-md text-[10px] xs:text-xs transition-colors',
              tab.hiddenMobile && 'hidden xs:flex',
              activeTab === tab.value ? 'bg-background shadow-sm font-medium' : 'text-muted-foreground hover:text-foreground',
            )"
            @click="store.setActiveTab(tab.value)">
            <component :is="tab.icon" class="size-3.5" />
            <span class="truncate">{{ tab.label }}</span>
            <span v-if="tab.badge && tab.badge > 0"
              :class="cn('absolute -top-0.5 -right-0.5 size-4 rounded-full text-white text-[9px] flex items-center justify-center font-bold', tab.value === 'triage' ? 'bg-amber-500' : 'bg-primary')">
              {{ tab.badge }}
            </span>
          </button>
        </div>

        <div class="mt-0">
          <Dashboard v-if="activeTab === 'dashboard'" />
          <TimelineView v-else-if="activeTab === 'timeline'" />
          <BacklogIncubator v-else-if="activeTab === 'backlog'" variant="backlog" />
          <BrainDump v-else-if="activeTab === 'braindump'" />
          <BacklogIncubator v-else-if="activeTab === 'incubator'" variant="incubator" />
          <TriagePanel v-else-if="activeTab === 'triage'" />
          <StatsView v-else-if="activeTab === 'stats'" />
        </div>
      </div>

      <!-- Settings -->
      <details class="mt-4 group">
        <summary class="cursor-pointer inline-flex items-center gap-1.5 text-[10px] text-muted-foreground hover:text-foreground">
          <SettingsIcon class="size-3.5" /> Settings &amp; anchor configuration
        </summary>
        <div class="mt-3"><SettingsPanel /></div>
      </details>
    </main>

    <!-- Footer -->
    <footer class="border-t bg-background mt-auto">
      <div class="mx-auto max-w-7xl px-2 sm:px-3 md:px-4 py-2">
        <div class="flex flex-col sm:flex-row items-center justify-between gap-1.5 sm:gap-2 text-[10px] sm:text-[11px] text-muted-foreground">
          <p>Local-first · capacity-aware · no auto-rollover</p>
          <p class="flex items-center gap-1">
            <span class="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
            All data persists locally in your browser
          </p>
        </div>
      </div>
    </footer>

    <div v-if="loading" class="fixed inset-0 bg-background/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <Card class="p-4 sm:p-6 flex items-center gap-3">
        <div class="size-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        <span class="text-sm">Loading your day…</span>
      </Card>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import {
  LayoutDashboard, Calendar, Inbox, AlertTriangle, BarChart3, Settings as SettingsIcon,
  Moon, Sun, Sparkles, Mic, Flame, NotebookPen, Undo2, Redo2,
} from 'lucide-vue-next';
import { useAppStore } from '~/stores/app';
import { captureGoogleOAuthTokens } from '~/lib/local-storage';
import { useReminders } from '~/composables/useReminders';
import { cn } from '~/lib/utils';

const store = useAppStore();
useReminders();
const colorMode = useColorMode();
const captureOpen = ref(false);

const activeTab = computed(() => store.activeTab);
const todayScore = computed(() => store.todayScore);
const loading = computed(() => store.loading);
const streak = computed(() => store.planningStreakDisplay);
const plannedToday = computed(() => store.plannedToday);

const triageCount = computed(() => store.triageTasks.length);
const backlogCount = computed(() => store.backlogTasks.length);
const incubatorCount = computed(() => store.incubatorTasks.length);

const tabs = computed(() => [
  { value: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, hiddenMobile: false, badge: 0 },
  { value: 'timeline', label: 'Timeline', icon: Calendar, hiddenMobile: false, badge: 0 },
  { value: 'backlog', label: 'Backlog', icon: Inbox, hiddenMobile: false, badge: backlogCount.value },
  { value: 'braindump', label: 'Brain Dump', icon: NotebookPen, hiddenMobile: false, badge: 0 },
  { value: 'incubator', label: 'Incubator', icon: Sparkles, hiddenMobile: true, badge: incubatorCount.value },
  { value: 'triage', label: 'Triage', icon: AlertTriangle, hiddenMobile: true, badge: triageCount.value },
  { value: 'stats', label: 'Stats', icon: BarChart3, hiddenMobile: true, badge: 0 },
]);

function toggleTheme() {
  colorMode.preference = colorMode.value === 'dark' ? 'light' : 'dark';
}

function onKey(e: KeyboardEvent) {
  const mod = e.metaKey || e.ctrlKey;
  if (!mod) return;
  const el = document.activeElement as HTMLElement | null;
  const editable = !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable);
  if (editable) return; // let native text undo/redo work inside fields
  const key = e.key.toLowerCase();
  if (key === 'z') {
    e.preventDefault();
    if (e.shiftKey) store.redo(); else store.undo();
  } else if (key === 'y') {
    e.preventDefault();
    store.redo();
  }
}

onMounted(() => {
  // Capture the Google OAuth redirect here (not in the collapsed Settings
  // panel) so returning from Google always registers the connection.
  if (captureGoogleOAuthTokens(window.location.hash)) {
    window.history.replaceState({}, '', '/');
  }
  store.loadData();
  store.loadSettings();
  store.loadGoogleCalendarStatus();
  window.addEventListener('keydown', onKey);
});
onUnmounted(() => window.removeEventListener('keydown', onKey));
</script>
