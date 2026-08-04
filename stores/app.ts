import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type {
  Task, TimeBlock, TimeLogSession, DailyCapacity, Settings, GamificationLog,
  TaskStatus, GoogleCalendarStatus,
} from '~/lib/types';
import type { PlanningStreak, BrainDumpEntry } from '~/lib/types';
import { getMaxFocusForScore } from '~/lib/types';
import { todayKey, yesterdayKey, isSameDay, blockDurationMinutes } from '~/lib/time-utils';
import { fireConfetti } from '~/lib/confetti';
import {
  loadAll, saveSettings as persistSettings,
  getTasks as getTasksRaw,
  addTask, updateTask as updateTaskRow, deleteTask as deleteTaskRow,
  reorderTaskIds,
  addTimeBlock, updateTimeBlock as updateTimeBlockRow, deleteTimeBlock as deleteTimeBlockRow,
  deleteExternalEventsForDate, pruneStaleDayBlocks,
  setCapacity as setCapacityRow, ensureCapacity,
  getSettings as getSettingsRow,
  addGamificationEntry,
  addTimerSession, updateTimerSession,
  getGoogleCalendar as getGoogleCalendarRow, disconnectGoogleCalendar as clearGoogleCalendar,
  saveGoogleCalendar as persistGoogleCalendar,
  getActiveTimer, saveActiveTimer,
  getLastActiveDate, setLastActiveDate,
  getPlanningStreak, savePlanningStreak,
  getBrainDump, addBrainDumpEntry, updateBrainDumpEntry, deleteBrainDumpEntry,
  nowISO,
  type SettingsRow, type CapacityRow, type GoogleCalendarRow, type ActiveTimerRow,
} from '~/lib/local-storage';

async function fetchJSON<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, init);
  if (!r.ok) throw new Error(`${url}: ${r.status}`);
  return r.json();
}

interface ActiveTimer {
  taskId: string | null;
  type: 'pomodoro' | 'open_flow';
  startedAt: number;
  elapsedBeforeStart: number;
  targetSeconds: number;
  running: boolean;
}

export const useAppStore = defineStore('app', () => {
  // ── State ────────────────────────────────────────────────
  const tasks = ref<Task[]>([]);
  const timeBlocks = ref<TimeBlock[]>([]);
  const timerSessions = ref<TimeLogSession[]>([]);
  const capacity = ref<DailyCapacity | null>(null);
  const settings = ref<Settings | null>(null);
  const gamification = ref<GamificationLog[]>([]);
  const todayScore = ref(0);
  const loading = ref(false);
  const activeTab = ref('dashboard');
  const activeTimer = ref<ActiveTimer | null>(null);
  const googleCalendar = ref<GoogleCalendarStatus>({
    connected: false, calendarEmail: null, hasCredentials: false, lastSyncAt: null,
  });
  const planningStreak = ref<PlanningStreak>({ current: 0, longest: 0, lastPlannedDate: null });
  const brainDump = ref<BrainDumpEntry[]>([]);

  function persistTimer(t: ActiveTimer | null) {
    activeTimer.value = t;
    saveActiveTimer(t as ActiveTimerRow | null);
  }

  // ── Derived selectors ────────────────────────────────────
  const todayTasks = computed(() => tasks.value.filter((t) => t.status === 'today'));
  const backlogTasks = computed(() => tasks.value.filter((t) => t.status === 'backlog'));
  const incubatorTasks = computed(() => tasks.value.filter((t) => t.status === 'incubator'));
  const triageTasks = computed(() => tasks.value.filter((t) => t.status === 'triage_review'));
  const completedToday = computed(() =>
    tasks.value.filter((t) => t.status === 'completed' && t.completedAt
      && isSameDay(new Date(t.completedAt), new Date())),
  );
  /** Fix: only surface today's time blocks on the timeline. */
  const todayBlocks = computed(() =>
    timeBlocks.value.filter((b) => isSameDay(new Date(b.startTime), new Date())),
  );

  /** Calendar commitments today (external Google events), in minutes. */
  const committedMinutes = computed(() =>
    Math.round(todayBlocks.value
      .filter((b) => b.isExternalEvent)
      .reduce((sum, b) => sum + blockDurationMinutes(b.startTime, b.endTime), 0)),
  );
  /** Focus you've planned onto the timeline today (your own task blocks). */
  const scheduledFocusMinutes = computed(() =>
    Math.round(todayBlocks.value
      .filter((b) => !b.isAnchor && !b.isExternalEvent)
      .reduce((sum, b) => sum + blockDurationMinutes(b.startTime, b.endTime), 0)),
  );
  /** Focus capacity left after calendar commitments and already-scheduled focus. */
  const availableFocusMinutes = computed(() => {
    const max = capacity.value?.maxAllowedFocusMinutes ?? 270;
    return Math.max(0, max - committedMinutes.value - scheduledFocusMinutes.value);
  });

  /** Streak counts only while it's still "alive" (planned today or yesterday). */
  const planningStreakDisplay = computed(() => {
    const s = planningStreak.value;
    if (s.lastPlannedDate === todayKey() || s.lastPlannedDate === yesterdayKey()) return s.current;
    return 0;
  });
  const plannedToday = computed(() => planningStreak.value.lastPlannedDate === todayKey());

  const setActiveTab = (t: string) => { activeTab.value = t; };

  // ── Load ─────────────────────────────────────────────────
  function loadData() {
    loading.value = true;
    try {
      const date = todayKey();

      // Fix: day rollover — if the day changed since last visit, push
      // unfinished "today" tasks into triage and clear stale day blocks.
      const last = getLastActiveDate();
      if (last && last !== date) {
        runMidnightRolloverRaw();
      }
      pruneStaleDayBlocks(date);
      setLastActiveDate(date);

      const data = loadAll();
      tasks.value = data.tasks as Task[];
      timeBlocks.value = data.timeBlocks as TimeBlock[];
      timerSessions.value = data.timerSessions as TimeLogSession[];
      capacity.value = (data.capacityMap[date] as DailyCapacity | undefined) ?? null;
      settings.value = data.settings as Settings;
      gamification.value = (data.gamificationMap[date] as GamificationLog[] | undefined) ?? [];

      // Fix: resilient timer — restore any in-progress session across reloads.
      const persisted = getActiveTimer();
      if (persisted) activeTimer.value = persisted as ActiveTimer;

      planningStreak.value = getPlanningStreak();
      brainDump.value = getBrainDump() as BrainDumpEntry[];

      computeDailyScore();

      // Auto-refresh calendar so connecting actually surfaces events without
      // a manual Sync click.
      if (getGoogleCalendarRow().accessToken) void syncGoogleCalendar();
    } catch (e) {
      console.error('loadData failed', e);
    } finally {
      loading.value = false;
    }
  }

  function loadSettings() {
    settings.value = getSettingsRow() as Settings;
  }

  // ── Tasks ────────────────────────────────────────────────
  async function createTask(input: Partial<Task>): Promise<Task | null> {
    try {
      const row = addTask({
        title: input.title ?? '',
        notes: input.notes ?? null,
        status: input.status ?? 'backlog',
        eisenhowerCategory: input.eisenhowerCategory ?? 'schedule',
        estimatedMinutes: input.estimatedMinutes ?? 30,
        actualMinutes: input.actualMinutes ?? 0,
        category: input.category ?? 'Admin',
        rolledOverCount: input.rolledOverCount ?? 0,
        priority: input.priority ?? 2,
        sortOrder: input.sortOrder ?? 0,
        completedAt: input.completedAt ?? null,
      });
      tasks.value = [...tasks.value, row as Task];
      if (row.status === 'today') recordPlanningActivity();
      return row as Task;
    } catch (e) {
      console.error('createTask failed', e);
      return null;
    }
  }

  async function updateTask(id: string, patch: Partial<Task>) {
    try {
      const row = updateTaskRow(id, patch);
      if (row) {
        tasks.value = tasks.value.map((x) => (x.id === id ? (row as Task) : x));
        // Scheduling a task into "today" is a planning action.
        if (patch.status === 'today') recordPlanningActivity();
      }
    } catch (e) {
      console.error('updateTask failed', e);
    }
  }

  async function deleteTask(id: string) {
    try {
      deleteTaskRow(id);
      tasks.value = tasks.value.filter((x) => x.id !== id);
      timeBlocks.value = timeBlocks.value.filter((b) => b.taskId !== id);
    } catch (e) {
      console.error('deleteTask failed', e);
    }
  }

  async function completeTask(id: string, actualMinutes?: number) {
    try {
      const row = updateTaskRow(id, {
        status: 'completed',
        completedAt: nowISO(),
        actualMinutes: actualMinutes ?? tasks.value.find((t) => t.id === id)?.actualMinutes ?? 0,
      });
      if (row) {
        tasks.value = tasks.value.map((x) => (x.id === id ? (row as Task) : x));
        fireConfetti();
        await awardPoints('completion', 10, `Completed: ${row.title}`);
        // Realism: reward accurate estimates, but only when the task was
        // actually timed (otherwise we have no real duration to compare).
        if (row.actualMinutes > 0 && row.estimatedMinutes > 0) {
          const dev = Math.abs(row.actualMinutes / row.estimatedMinutes - 1);
          if (dev <= 0.2) {
            await awardPoints('realism', 8, `On-target estimate · ${row.actualMinutes}m vs ${row.estimatedMinutes}m est`);
          } else if (dev <= 0.4) {
            await awardPoints('realism', 3, `Close estimate · ${row.actualMinutes}m vs ${row.estimatedMinutes}m est`);
          }
        }
        await recalcScheduledFocus();
      }
    } catch (e) {
      console.error('completeTask failed', e);
    }
  }

  async function uncompleteTask(id: string) {
    try {
      const row = updateTaskRow(id, { status: 'today', completedAt: null });
      if (row) {
        tasks.value = tasks.value.map((x) => (x.id === id ? (row as Task) : x));
        await recalcScheduledFocus();
      }
    } catch (e) {
      console.error('uncompleteTask failed', e);
    }
  }

  async function reorderTasks(orderedIds: string[]) {
    try {
      reorderTaskIds(orderedIds);
      const idOrderMap = new Map(orderedIds.map((id, idx) => [id, idx]));
      tasks.value = tasks.value.map((t) => ({
        ...t,
        sortOrder: idOrderMap.has(t.id) ? idOrderMap.get(t.id)! : t.sortOrder,
      }));
    } catch (e) {
      console.error('reorderTasks failed', e);
    }
  }

  // ── Time Blocks ──────────────────────────────────────────
  async function createTimeBlock(input: Partial<TimeBlock>): Promise<TimeBlock | null> {
    try {
      const row = addTimeBlock({
        taskId: input.taskId ?? null,
        title: input.title ?? '',
        startTime: input.startTime ?? nowISO(),
        endTime: input.endTime ?? nowISO(),
        isAnchor: input.isAnchor ?? false,
        isExternalEvent: input.isExternalEvent ?? false,
        anchorType: input.anchorType ?? null,
        colorTag: input.colorTag ?? null,
      });
      timeBlocks.value = [...timeBlocks.value, row as TimeBlock];
      await recalcScheduledFocus();
      return row as TimeBlock;
    } catch (e) {
      console.error('createTimeBlock failed', e);
      return null;
    }
  }

  async function updateTimeBlock(id: string, patch: Partial<TimeBlock>) {
    try {
      const row = updateTimeBlockRow(id, patch);
      if (row) {
        timeBlocks.value = timeBlocks.value.map((x) => (x.id === id ? (row as TimeBlock) : x));
        await recalcScheduledFocus();
      }
    } catch (e) {
      console.error('updateTimeBlock failed', e);
    }
  }

  async function deleteTimeBlock(id: string) {
    try {
      deleteTimeBlockRow(id);
      timeBlocks.value = timeBlocks.value.filter((x) => x.id !== id);
      await recalcScheduledFocus();
    } catch (e) {
      console.error('deleteTimeBlock failed', e);
    }
  }

  /**
   * Honor (or un-honor) a health anchor for the day. Marking one done rewards
   * anchor discipline — meals/workout/sleep are worth more than a hydration sip.
   * Points are only awarded on the false→true transition, so toggling can't farm.
   */
  async function toggleAnchorDone(id: string) {
    const block = timeBlocks.value.find((b) => b.id === id);
    if (!block || !block.isAnchor) return;
    const nowDone = !block.completed;
    const row = updateTimeBlockRow(id, { completed: nowDone });
    if (!row) return;
    timeBlocks.value = timeBlocks.value.map((x) => (x.id === id ? (row as TimeBlock) : x));
    if (nowDone) {
      const pts = block.anchorType === 'water' ? 1 : 5;
      await awardPoints('anchor_discipline', pts, `Honored ${block.title.toLowerCase()}`);
    }
  }

  async function moveTaskToTimeline(taskId: string, startISO: string, endISO: string) {
    const task = tasks.value.find((t) => t.id === taskId);
    if (!task) return;
    const existing = timeBlocks.value.find((b) => b.taskId === taskId);
    if (existing) {
      await updateTimeBlock(existing.id, { startTime: startISO, endTime: endISO });
    } else {
      await createTimeBlock({
        taskId, title: task.title, startTime: startISO, endTime: endISO,
        isAnchor: false, isExternalEvent: false, colorTag: task.category,
      });
    }
    // Only pull into "today" when it's actually scheduled for today; future
    // scheduling leaves the task where it is but still creates the block.
    if (task.status !== 'today' && isSameDay(new Date(startISO), new Date())) {
      await updateTask(taskId, { status: 'today' as TaskStatus });
    }
    recordPlanningActivity();
  }

  async function recalcScheduledFocus() {
    const date = todayKey();
    let scheduled = 0;
    for (const b of timeBlocks.value) {
      if (b.isAnchor || b.isExternalEvent) continue; // external = committed, tracked separately
      if (!isSameDay(new Date(b.startTime), new Date())) continue;
      const s = new Date(b.startTime);
      const e = new Date(b.endTime);
      scheduled += Math.max(0, (e.getTime() - s.getTime()) / 60000);
    }
    scheduled = Math.round(scheduled);
    // Fix: always ensure a capacity row exists so the budget tracks even
    // before the user sets a readiness score.
    ensureCapacity(date);
    const row = setCapacityRow(date, { scheduledFocusMinutes: scheduled });
    capacity.value = row as unknown as DailyCapacity;
  }

  // ── Settings ────────────────────────────────────────────
  async function saveSettings(input: Partial<Settings>) {
    const current = getSettingsRow();
    const updated: SettingsRow = { ...current, ...input } as SettingsRow;
    persistSettings(updated);
    settings.value = updated as unknown as Settings;
  }

  // ── Capacity ────────────────────────────────────────────
  async function setCapacity(input: Partial<DailyCapacity>) {
    const date = todayKey();
    const row = setCapacityRow(date, {
      readinessScore: input.readinessScore ?? undefined,
      sleepHours: input.sleepHours ?? undefined,
      manualEnergyRating: input.manualEnergyRating ?? undefined,
      maxAllowedFocusMinutes: input.maxAllowedFocusMinutes ?? undefined,
      scheduledFocusMinutes: input.scheduledFocusMinutes ?? undefined,
      triageCompleted: input.triageCompleted ?? undefined,
      triageStreak: input.triageStreak ?? undefined,
    } as Partial<CapacityRow>);
    // Keep the focus budget in step with the readiness score.
    if (input.readinessScore != null) {
      const maxFocus = getMaxFocusForScore(input.readinessScore);
      const row2 = setCapacityRow(date, { maxAllowedFocusMinutes: maxFocus });
      capacity.value = row2 as unknown as DailyCapacity;
    } else {
      capacity.value = row as unknown as DailyCapacity;
    }
    // Setting your readiness or finishing triage both count as planning your day.
    if (input.readinessScore != null || input.triageCompleted === true) recordPlanningActivity();
  }

  async function generateAnchors(forDate?: Date) {
    if (!settings.value) return;
    const day = forDate ?? new Date();
    // Only guard against anchors that belong to the target day.
    const existing = timeBlocks.value.filter(
      (b) => b.isAnchor && isSameDay(new Date(b.startTime), day),
    );
    if (existing.length > 0) return;

    const s = settings.value;
    const today = day;
    const make = (timeStr: string, title: string, anchorType: string, durationMin: number) => {
      const [h, m] = timeStr.split(':').map(Number);
      const start = new Date(today);
      start.setHours(h, m, 0, 0);
      const end = new Date(start);
      end.setMinutes(end.getMinutes() + durationMin);
      return createTimeBlock({
        title, startTime: start.toISOString(), endTime: end.toISOString(),
        isAnchor: true, anchorType, colorTag: anchorType,
      });
    };
    await make(s.breakfastTime, 'Breakfast', 'breakfast', 30);
    await make(s.lunchTime, 'Lunch', 'lunch', 45);
    await make(s.dinnerTime, 'Dinner', 'dinner', 45);
    const startMins = 9 * 60;
    const endMins = 21 * 60;
    for (let m = startMins; m <= endMins; m += s.hydrationInterval) {
      const h = Math.floor(m / 60);
      const min = m % 60;
      const start = new Date(today);
      start.setHours(h, min, 0, 0);
      const end = new Date(start);
      end.setMinutes(end.getMinutes() + 5);
      await createTimeBlock({
        title: 'Hydration', startTime: start.toISOString(), endTime: end.toISOString(),
        isAnchor: true, anchorType: 'water', colorTag: 'water',
      });
    }
  }

  // ── Timer ───────────────────────────────────────────────
  async function startTimer(taskId: string | null, type: 'pomodoro' | 'open_flow', targetSeconds?: number) {
    if (activeTimer.value) await stopTimer(false);
    const target = targetSeconds ?? (type === 'pomodoro' ? (settings.value?.defaultPomodoroMinutes ?? 25) * 60 : 0);
    persistTimer({
      taskId, type, startedAt: Date.now(), elapsedBeforeStart: 0,
      targetSeconds: target, running: true,
    });
    if (taskId) {
      try {
        const session = addTimerSession({
          taskId, type, startTime: nowISO(), endTime: null,
          elapsedSeconds: 0, interrupted: false,
        });
        timerSessions.value = [...timerSessions.value, session as TimeLogSession];
      } catch (e) {
        console.error('startTimer session failed', e);
      }
    }
  }

  async function stopTimer(interrupted = false) {
    const t = activeTimer.value;
    if (!t) return;
    const elapsed = Math.max(0, t.elapsedBeforeStart + Math.floor((Date.now() - t.startedAt) / 1000));
    persistTimer(null);
    try {
      if (t.taskId) {
        updateTimerSession(
          timerSessions.value.find((s) => s.taskId === t.taskId && !s.endTime)?.id ?? '',
          { endTime: nowISO(), elapsedSeconds: elapsed, interrupted },
        );
        const task = tasks.value.find((x) => x.id === t.taskId);
        if (task) {
          await updateTask(task.id, { actualMinutes: task.actualMinutes + Math.round(elapsed / 60) });
        }
      }
      await awardPoints('focus_session', Math.max(1, Math.round(elapsed / 300)), `${elapsed}s focus`);
    } catch (e) {
      console.error('stopTimer failed', e);
    }
  }

  function tickTimer() {
    const t = activeTimer.value;
    if (!t || !t.running) return;
    if (t.type === 'pomodoro' && t.targetSeconds > 0) {
      const total = t.elapsedBeforeStart + Math.floor((Date.now() - t.startedAt) / 1000);
      if (total >= t.targetSeconds) void stopTimer(false);
    }
  }

  // ── Triage ──────────────────────────────────────────────
  function runMidnightRolloverRaw() {
    // Operates directly on storage (used during load, before state hydration).
    const stored = getTasksRaw();
    for (const t of stored) {
      if (t.status === 'today') {
        updateTaskRow(t.id, { status: 'triage_review', rolledOverCount: (t.rolledOverCount ?? 0) + 1 });
      }
    }
  }

  async function runMidnightRollover() {
    const todays = tasks.value.filter((t) => t.status === 'today');
    for (const t of todays) {
      await updateTask(t.id, {
        status: 'triage_review' as TaskStatus,
        rolledOverCount: t.rolledOverCount + 1,
      });
    }
  }

  async function resolveTriageItem(taskId: string, action: 'schedule_today' | 'incubator' | 'delete') {
    const task = tasks.value.find((t) => t.id === taskId);
    if (!task) return;
    if (action === 'delete') await deleteTask(taskId);
    else if (action === 'incubator') await updateTask(taskId, { status: 'incubator' as TaskStatus });
    else await updateTask(taskId, { status: 'today' as TaskStatus });
  }

  // ── Brain dump ──────────────────────────────────────────
  async function addBrainDump(content: string, context?: string | null): Promise<BrainDumpEntry | null> {
    const text = content.trim();
    if (!text) return null;
    try {
      const row = addBrainDumpEntry({ content: text, context: context?.trim() || null, date: todayKey() });
      brainDump.value = [...brainDump.value, row as BrainDumpEntry];
      return row as BrainDumpEntry;
    } catch (e) {
      console.error('addBrainDump failed', e);
      return null;
    }
  }

  async function updateBrainDump(id: string, patch: Partial<BrainDumpEntry>) {
    try {
      const row = updateBrainDumpEntry(id, patch);
      if (row) brainDump.value = brainDump.value.map((x) => (x.id === id ? (row as BrainDumpEntry) : x));
    } catch (e) {
      console.error('updateBrainDump failed', e);
    }
  }

  async function deleteBrainDump(id: string) {
    try {
      deleteBrainDumpEntry(id);
      brainDump.value = brainDump.value.filter((x) => x.id !== id);
    } catch (e) {
      console.error('deleteBrainDump failed', e);
    }
  }

  // ── Gamification ────────────────────────────────────────
  async function awardPoints(type: GamificationLog['type'], points: number, note?: string) {
    const date = todayKey();
    const entry = addGamificationEntry({ date, type, points, note });
    gamification.value = [...gamification.value, entry as GamificationLog];
    computeDailyScore();
  }

  /**
   * Record that the user planned their day. Idempotent per day: the first
   * planning action each day advances (or resets) the streak; later ones are
   * no-ops. A gap of a day or more breaks the streak back to 1.
   */
  function recordPlanningActivity() {
    const today = todayKey();
    const s = getPlanningStreak();
    if (s.lastPlannedDate === today) {
      planningStreak.value = s; // already counted today
      return;
    }
    const continued = s.lastPlannedDate === yesterdayKey();
    const current = continued ? s.current + 1 : 1;
    const next = { current, longest: Math.max(s.longest, current), lastPlannedDate: today };
    savePlanningStreak(next);
    planningStreak.value = next;

    const milestone = [3, 7, 14, 30, 60, 100].includes(current);
    const points = milestone ? 5 + current : 5;
    const note = milestone
      ? `🔥 ${current}-day planning streak!`
      : `Planned your day · ${current}-day streak`;
    void awardPoints('planning_streak', points, note);
  }

  function computeDailyScore() {
    todayScore.value = gamification.value.reduce((sum, g) => sum + g.points, 0);
  }

  // ── Google Calendar ─────────────────────────────────────
  function loadGoogleCalendarStatus() {
    const gc = getGoogleCalendarRow();
    const cfg = useRuntimeConfig();
    googleCalendar.value = {
      connected: gc.connected,
      calendarEmail: gc.calendarEmail ?? null,
      hasCredentials: !!cfg.public.googleClientId,
      lastSyncAt: gc.lastSyncAt ?? null,
    };
  }

  function connectGoogleCalendar() {
    const cfg = useRuntimeConfig();
    const clientId = cfg.public.googleClientId as string;
    if (!clientId) {
      console.error('Google Client ID not configured');
      return;
    }
    const redirectUri = `${window.location.origin}/api/google-calendar/callback`;
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/userinfo.email',
      access_type: 'offline',
      prompt: 'consent',
    });
    window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
  }

  function disconnectGoogleCalendar() {
    clearGoogleCalendar();
    loadGoogleCalendarStatus();
  }

  async function syncGoogleCalendar(date?: string): Promise<{ synced: number; total: number; filtered: number } | undefined> {
    const gc = getGoogleCalendarRow();
    if (!gc.accessToken) return undefined;

    let accessToken = gc.accessToken;
    if (gc.tokenExpiresAt && gc.refreshToken) {
      const expiresAt = new Date(gc.tokenExpiresAt).getTime();
      if (Date.now() > expiresAt - 60_000) {
        try {
          const refreshed = await fetchJSON<{ access_token: string; expires_in: number }>(
            '/api/google-calendar/refresh',
            { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refresh_token: gc.refreshToken }) },
          );
          accessToken = refreshed.access_token;
          const newGc: GoogleCalendarRow = {
            ...gc,
            accessToken: refreshed.access_token,
            tokenExpiresAt: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
          };
          persistGoogleCalendar(newGc);
        } catch (e) {
          console.error('Token refresh failed', e);
          return undefined;
        }
      }
    }

    const dateParam = date ?? todayKey();
    const startOfDay = new Date(`${dateParam}T00:00:00`);
    const endOfDay = new Date(`${dateParam}T23:59:59`);
    try {
      const params = new URLSearchParams({
        timeMin: startOfDay.toISOString(),
        timeMax: endOfDay.toISOString(),
        singleEvents: 'true',
        orderBy: 'startTime',
        maxResults: '50',
      });
      const r = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!r.ok) throw new Error(`Calendar API: ${r.status}`);
      const data = await r.json();
      const events = data.items ?? [];

      deleteExternalEventsForDate(dateParam);

      let synced = 0;
      for (const event of events) {
        if (!event.start?.dateTime || !event.end?.dateTime) continue;
        const startTime = new Date(event.start.dateTime);
        const endTime = new Date(event.end.dateTime);
        if (startTime < startOfDay || endTime > endOfDay) continue;
        addTimeBlock({
          title: event.summary || '(No title)',
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
          isExternalEvent: true,
          isAnchor: false,
          colorTag: event.colorId ?? 'external',
        });
        synced++;
      }

      persistGoogleCalendar({ ...getGoogleCalendarRow(), lastSyncAt: nowISO() });
      timeBlocks.value = loadAll().timeBlocks as TimeBlock[];
      loadGoogleCalendarStatus();
      return { synced, total: events.length, filtered: events.length - synced };
    } catch (e) {
      console.error('syncGoogleCalendar failed', e);
      return undefined;
    }
  }

  return {
    // state
    tasks, timeBlocks, timerSessions, capacity, settings, gamification,
    todayScore, loading, activeTab, activeTimer, googleCalendar, planningStreak, brainDump,
    // selectors
    todayTasks, backlogTasks, incubatorTasks, triageTasks, completedToday, todayBlocks,
    committedMinutes, scheduledFocusMinutes, availableFocusMinutes,
    planningStreakDisplay, plannedToday,
    // actions
    setActiveTab, loadData, loadSettings,
    createTask, updateTask, deleteTask, completeTask, uncompleteTask, reorderTasks,
    createTimeBlock, updateTimeBlock, deleteTimeBlock, toggleAnchorDone, moveTaskToTimeline, recalcScheduledFocus,
    saveSettings, setCapacity, generateAnchors,
    startTimer, stopTimer, tickTimer,
    runMidnightRollover, resolveTriageItem,
    addBrainDump, updateBrainDump, deleteBrainDump,
    awardPoints, computeDailyScore, recordPlanningActivity,
    loadGoogleCalendarStatus, connectGoogleCalendar, disconnectGoogleCalendar, syncGoogleCalendar,
  };
});
