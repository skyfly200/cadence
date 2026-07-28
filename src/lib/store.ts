'use client';

import { create } from 'zustand';
import type {
  Task, TimeBlock, TimeLogSession, DailyCapacity, Settings, GamificationLog,
  TaskStatus, EisenhowerCategory, GoogleCalendarStatus,
} from '@/lib/types';
import { getMaxFocusForScore, getCapacityTier } from '@/lib/types';
import { todayKey } from '@/lib/time-utils';
import {
  loadAll, saveTasks, saveTimeBlocks, saveCapacityMap, saveSettings,
  saveGamificationMap, saveTimerSessions, saveGoogleCalendar as persistGoogleCalendar,
  addTask, updateTask as updateTaskRow, deleteTask as deleteTaskRow,
  reorderTaskIds,
  addTimeBlock, updateTimeBlock as updateTimeBlockRow, deleteTimeBlock as deleteTimeBlockRow,
  deleteExternalEventsForDate,
  getCapacity as getCapacityRow, setCapacity as setCapacityRow,
  getSettings as getSettingsRow,
  getGamificationForDate, addGamificationEntry,
  addTimerSession, updateTimerSession,
  getGoogleCalendar as getGoogleCalendarRow, disconnectGoogleCalendar as clearGoogleCalendar,
  uid, nowISO,
  type TaskRow, type TimeBlockRow, type CapacityRow, type GamificationRow,
  type TimerSessionRow, type GoogleCalendarRow,
} from '@/lib/local-storage';

// ── Minimal fetch helper (only for serverless endpoints) ──────

async function fetchJSON<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, init);
  if (!r.ok) throw new Error(`${url}: ${r.status}`);
  return r.json();
}

interface AppState {
  // Data
  tasks: Task[];
  timeBlocks: TimeBlock[];
  timerSessions: TimeLogSession[];
  capacity: DailyCapacity | null;
  settings: Settings | null;
  gamification: GamificationLog[];
  todayScore: number;

  // UI state
  loading: boolean;
  activeTab: string;
  activeTimer: {
    taskId: string | null;
    type: 'pomodoro' | 'open_flow';
    startedAt: number;
    elapsedBeforeStart: number;
    targetSeconds: number;
    running: boolean;
  } | null;

  // Actions
  setActiveTab: (t: string) => void;
  loadData: () => void;
  loadSettings: () => void;

  // Tasks
  createTask: (input: Partial<Task>) => Promise<Task | null>;
  updateTask: (id: string, patch: Partial<Task>) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  completeTask: (id: string, actualMinutes?: number) => Promise<void>;
  uncompleteTask: (id: string) => Promise<void>;
  reorderTasks: (orderedIds: string[]) => Promise<void>;

  // Time blocks
  createTimeBlock: (input: Partial<TimeBlock>) => Promise<TimeBlock | null>;
  updateTimeBlock: (id: string, patch: Partial<TimeBlock>) => Promise<void>;
  deleteTimeBlock: (id: string) => Promise<void>;
  moveTaskToTimeline: (taskId: string, startISO: string, endISO: string) => Promise<void>;
  recalcScheduledFocus: () => Promise<void>;

  // Capacity
  setCapacity: (input: Partial<DailyCapacity>) => Promise<void>;
  generateAnchors: () => Promise<void>;

  // Timer
  startTimer: (taskId: string | null, type: 'pomodoro' | 'open_flow', targetSeconds?: number) => Promise<void>;
  stopTimer: (interrupted?: boolean) => Promise<void>;
  tickTimer: () => void;

  // Triage
  runMidnightRollover: () => Promise<void>;
  resolveTriageItem: (taskId: string, action: 'schedule_today' | 'incubator' | 'delete') => Promise<void>;

  // Gamification
  awardPoints: (type: GamificationLog['type'], points: number, note?: string) => Promise<void>;
  computeDailyScore: () => Promise<void>;

  // Google Calendar
  googleCalendar: GoogleCalendarStatus;
  loadGoogleCalendarStatus: () => void;
  connectGoogleCalendar: () => void;
  disconnectGoogleCalendar: () => void;
  syncGoogleCalendar: (date?: string) => Promise<{ synced: number; total: number; filtered: number } | undefined>;
}

export const useAppStore = create<AppState>((set, get) => ({
  tasks: [],
  timeBlocks: [],
  timerSessions: [],
  capacity: null,
  settings: null,
  gamification: [],
  todayScore: 0,
  loading: false,
  activeTab: 'dashboard',
  activeTimer: null,
  googleCalendar: { connected: false, calendarEmail: null, hasCredentials: false, lastSyncAt: null },

  setActiveTab: (t) => set({ activeTab: t }),

  // ── Load data from localStorage (synchronous) ──────────────
  loadData: () => {
    set({ loading: true });
    try {
      const data = loadAll();
      const date = todayKey();
      set({
        tasks: data.tasks as Task[],
        timeBlocks: data.timeBlocks as TimeBlock[],
        timerSessions: data.timerSessions as TimeLogSession[],
        capacity: data.capacityMap[date] as DailyCapacity | null,
        settings: data.settings as Settings,
        gamification: data.gamificationMap[date] as GamificationLog[] ?? [],
        loading: false,
      });
      get().computeDailyScore();
    } catch (e) {
      console.error('loadData failed', e);
      set({ loading: false });
    }
  },

  loadSettings: () => {
    const s = getSettingsRow();
    set({ settings: s as Settings });
  },

  // ── Tasks ────────────────────────────────────────────────
  createTask: async (input) => {
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
      set({ tasks: [...get().tasks, row as Task] });
      return row as Task;
    } catch (e) {
      console.error('createTask failed', e);
      return null;
    }
  },

  updateTask: async (id, patch) => {
    try {
      const row = updateTaskRow(id, patch);
      if (row) {
        set({ tasks: get().tasks.map((x) => (x.id === id ? (row as Task) : x)) });
      }
    } catch (e) {
      console.error('updateTask failed', e);
    }
  },

  deleteTask: async (id) => {
    try {
      deleteTaskRow(id);
      set({
        tasks: get().tasks.filter((x) => x.id !== id),
        timeBlocks: get().timeBlocks.filter((b) => b.taskId !== id),
      });
    } catch (e) {
      console.error('deleteTask failed', e);
    }
  },

  completeTask: async (id, actualMinutes) => {
    try {
      const row = updateTaskRow(id, {
        status: 'completed',
        completedAt: nowISO(),
        actualMinutes: actualMinutes ?? get().tasks.find((t) => t.id === id)?.actualMinutes ?? 0,
      });
      if (row) {
        set({ tasks: get().tasks.map((x) => (x.id === id ? (row as Task) : x)) });
        await get().awardPoints('completion', 10, `Completed: ${row.title}`);
        await get().recalcScheduledFocus();
      }
    } catch (e) {
      console.error('completeTask failed', e);
    }
  },

  uncompleteTask: async (id) => {
    try {
      const row = updateTaskRow(id, { status: 'today', completedAt: null });
      if (row) {
        set({ tasks: get().tasks.map((x) => (x.id === id ? (row as Task) : x)) });
        await get().recalcScheduledFocus();
      }
    } catch (e) {
      console.error('uncompleteTask failed', e);
    }
  },

  reorderTasks: async (orderedIds) => {
    try {
      reorderTaskIds(orderedIds);
      const idOrderMap = new Map(orderedIds.map((id, idx) => [id, idx]));
      set({
        tasks: get().tasks.map((t) => ({
          ...t,
          sortOrder: idOrderMap.has(t.id) ? idOrderMap.get(t.id)! : t.sortOrder,
        })),
      });
    } catch (e) {
      console.error('reorderTasks failed', e);
    }
  },

  // ── Time Blocks ──────────────────────────────────────────
  createTimeBlock: async (input) => {
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
      set({ timeBlocks: [...get().timeBlocks, row as TimeBlock] });
      await get().recalcScheduledFocus();
      return row as TimeBlock;
    } catch (e) {
      console.error('createTimeBlock failed', e);
      return null;
    }
  },

  updateTimeBlock: async (id, patch) => {
    try {
      const row = updateTimeBlockRow(id, patch);
      if (row) {
        set({ timeBlocks: get().timeBlocks.map((x) => (x.id === id ? (row as TimeBlock) : x)) });
        await get().recalcScheduledFocus();
      }
    } catch (e) {
      console.error('updateTimeBlock failed', e);
    }
  },

  deleteTimeBlock: async (id) => {
    try {
      deleteTimeBlockRow(id);
      set({ timeBlocks: get().timeBlocks.filter((x) => x.id !== id) });
      await get().recalcScheduledFocus();
    } catch (e) {
      console.error('deleteTimeBlock failed', e);
    }
  },

  moveTaskToTimeline: async (taskId, startISO, endISO) => {
    const task = get().tasks.find((t) => t.id === taskId);
    if (!task) return;
    const existing = get().timeBlocks.find((b) => b.taskId === taskId);
    if (existing) {
      await get().updateTimeBlock(existing.id, { startTime: startISO, endTime: endISO });
    } else {
      await get().createTimeBlock({
        taskId, title: task.title, startTime: startISO, endTime: endISO,
        isAnchor: false, isExternalEvent: false, colorTag: task.category,
      });
    }
    if (task.status !== 'today') {
      await get().updateTask(taskId, { status: 'today' as TaskStatus });
    }
  },

  recalcScheduledFocus: async () => {
    const { timeBlocks, capacity } = get();
    const date = todayKey();
    let scheduled = 0;
    for (const b of timeBlocks) {
      if (b.isAnchor) continue;
      const s = new Date(b.startTime);
      const e = new Date(b.endTime);
      scheduled += Math.max(0, (e.getTime() - s.getTime()) / 60000);
    }
    scheduled = Math.round(scheduled);
    if (capacity) {
      const updated = { ...capacity, scheduledFocusMinutes: scheduled };
      set({ capacity: updated });
      setCapacityRow(date, { scheduledFocusMinutes: scheduled });
    }
  },

  // ── Capacity ────────────────────────────────────────────
  setCapacity: async (input) => {
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
    set({ capacity: row as unknown as DailyCapacity });
  },

  generateAnchors: async () => {
    const { settings, timeBlocks } = get();
    if (!settings) return;
    const todayAnchors = timeBlocks.filter((b) => b.isAnchor);
    if (todayAnchors.length > 0) return;

    const today = new Date();
    const make = (timeStr: string, title: string, anchorType: string, durationMin: number) => {
      const [h, m] = timeStr.split(':').map(Number);
      const start = new Date(today);
      start.setHours(h, m, 0, 0);
      const end = new Date(start);
      end.setMinutes(end.getMinutes() + durationMin);
      return get().createTimeBlock({
        title, startTime: start.toISOString(), endTime: end.toISOString(),
        isAnchor: true, anchorType, colorTag: anchorType,
      });
    };
    await make(settings.breakfastTime, 'Breakfast', 'breakfast', 30);
    await make(settings.lunchTime, 'Lunch', 'lunch', 45);
    await make(settings.dinnerTime, 'Dinner', 'dinner', 45);
    const startMins = 9 * 60;
    const endMins = 21 * 60;
    for (let m = startMins; m <= endMins; m += settings.hydrationInterval) {
      const h = Math.floor(m / 60);
      const min = m % 60;
      const start = new Date(today);
      start.setHours(h, min, 0, 0);
      const end = new Date(start);
      end.setMinutes(end.getMinutes() + 5);
      await get().createTimeBlock({
        title: 'Hydration', startTime: start.toISOString(), endTime: end.toISOString(),
        isAnchor: true, anchorType: 'water', colorTag: 'water',
      });
    }
  },

  // ── Timer ───────────────────────────────────────────────
  startTimer: async (taskId, type, targetSeconds) => {
    const t = get().activeTimer;
    if (t) await get().stopTimer(false);
    const settings = get().settings;
    const target = targetSeconds ?? (type === 'pomodoro' ? (settings?.defaultPomodoroMinutes ?? 25) * 60 : 0);
    set({
      activeTimer: {
        taskId, type, startedAt: Date.now(), elapsedBeforeStart: 0,
        targetSeconds: target, running: true,
      },
    });
    if (taskId) {
      try {
        const session = addTimerSession({
          taskId, type, startTime: nowISO(), endTime: null,
          elapsedSeconds: 0, interrupted: false,
        });
        set({ timerSessions: [...get().timerSessions, session as TimeLogSession] });
      } catch (e) {
        console.error('startTimer session failed', e);
      }
    }
  },

  stopTimer: async (interrupted = false) => {
    const t = get().activeTimer;
    if (!t) return;
    const elapsed = t.elapsedBeforeStart + Math.floor((Date.now() - t.startedAt) / 1000);
    set({ activeTimer: null });
    try {
      if (t.taskId) {
        updateTimerSession(
          get().timerSessions.find((s) => s.taskId === t.taskId && !s.endTime)?.id ?? '',
          { endTime: nowISO(), elapsedSeconds: elapsed, interrupted },
        );
        const task = get().tasks.find((x) => x.id === t.taskId);
        if (task) {
          await get().updateTask(task.id, { actualMinutes: task.actualMinutes + Math.round(elapsed / 60) });
        }
      }
      await get().awardPoints('focus_session', Math.max(1, Math.round(elapsed / 300)), `${elapsed}s focus`);
    } catch (e) {
      console.error('stopTimer failed', e);
    }
  },

  tickTimer: () => {
    const t = get().activeTimer;
    if (!t || !t.running) return;
    if (t.type === 'pomodoro' && t.targetSeconds > 0) {
      const total = t.elapsedBeforeStart + Math.floor((Date.now() - t.startedAt) / 1000);
      if (total >= t.targetSeconds) {
        void get().stopTimer(false);
      }
    }
  },

  // ── Triage ──────────────────────────────────────────────
  runMidnightRollover: async () => {
    const { tasks } = get();
    const todayTasks = tasks.filter((t) => t.status === 'today');
    for (const t of todayTasks) {
      await get().updateTask(t.id, {
        status: 'triage_review' as TaskStatus,
        rolledOverCount: t.rolledOverCount + 1,
      });
    }
  },

  resolveTriageItem: async (taskId, action) => {
    const task = get().tasks.find((t) => t.id === taskId);
    if (!task) return;
    if (action === 'delete') {
      await get().deleteTask(taskId);
    } else if (action === 'incubator') {
      await get().updateTask(taskId, { status: 'incubator' as TaskStatus });
    } else {
      await get().updateTask(taskId, { status: 'today' as TaskStatus });
    }
  },

  // ── Gamification ────────────────────────────────────────
  awardPoints: async (type, points, note) => {
    const date = todayKey();
    const entry = addGamificationEntry({ date, type, points, note });
    set({ gamification: [...get().gamification, entry as GamificationLog] });
  },

  computeDailyScore: async () => {
    const { gamification } = get();
    const score = gamification.reduce((sum, g) => sum + g.points, 0);
    set({ todayScore: score });
  },

  // ── Google Calendar (client-side with serverless helpers) ──
  loadGoogleCalendarStatus: () => {
    const gc = getGoogleCalendarRow();
    set({
      googleCalendar: {
        connected: gc.connected,
        calendarEmail: gc.calendarEmail ?? null,
        hasCredentials: typeof window !== 'undefined' && !!process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
        lastSyncAt: gc.lastSyncAt ?? null,
      },
    });
  },

  connectGoogleCalendar: () => {
    const clientId = (typeof window !== 'undefined' && (window as unknown as Record<string, string>).NEXT_PUBLIC_GOOGLE_CLIENT_ID)
      ?? process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
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
  },

  disconnectGoogleCalendar: () => {
    clearGoogleCalendar();
    get().loadGoogleCalendarStatus();
  },

  syncGoogleCalendar: async (date) => {
    const gc = getGoogleCalendarRow();
    if (!gc.accessToken) return undefined;

    // Check if token needs refresh
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

    // Fetch events client-side (Google Calendar API supports CORS)
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

      // Delete previous external blocks for this date
      deleteExternalEventsForDate(dateParam);

      // Create new external blocks
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

      // Update lastSyncAt
      persistGoogleCalendar({ ...getGoogleCalendarRow(), lastSyncAt: nowISO() });

      // Reload time blocks in store
      const updatedBlocks = loadAll().timeBlocks as TimeBlock[];
      set({ timeBlocks: updatedBlocks });
      get().loadGoogleCalendarStatus();

      return { synced, total: events.length, filtered: events.length - synced };
    } catch (e) {
      console.error('syncGoogleCalendar failed', e);
      return undefined;
    }
  },
}));

// Selectors / helpers
export function useTodayTasks() {
  return useAppStore((s) => s.tasks.filter((t) => t.status === 'today'));
}
export function useBacklogTasks() {
  return useAppStore((s) => s.tasks.filter((t) => t.status === 'backlog'));
}
export function useIncubatorTasks() {
  return useAppStore((s) => s.tasks.filter((t) => t.status === 'incubator'));
}
export function useTriageTasks() {
  return useAppStore((s) => s.tasks.filter((t) => t.status === 'triage_review'));
}
export function useCompletedToday() {
  return useAppStore((s) =>
    s.tasks.filter((t) => t.status === 'completed' && t.completedAt && new Date(t.completedAt).toDateString() === new Date().toDateString())
  );
}
