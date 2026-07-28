'use client';

import { create } from 'zustand';
import type {
  Task, TimeBlock, TimeLogSession, DailyCapacity, Settings, GamificationLog,
  TaskStatus, EisenhowerCategory, GoogleCalendarStatus,
} from '@/lib/types';
import { getMaxFocusForScore, getCapacityTier } from '@/lib/types';
import { todayKey } from '@/lib/time-utils';

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
    startedAt: number; // epoch ms
    elapsedBeforeStart: number; // seconds already accumulated
    targetSeconds: number; // for pomodoro
    running: boolean;
  } | null;

  // Actions
  setActiveTab: (t: string) => void;
  loadData: () => Promise<void>;
  loadSettings: () => Promise<void>;

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
  loadGoogleCalendarStatus: () => Promise<void>;
  saveGoogleCredentials: (clientId: string, clientSecret: string) => Promise<void>;
  connectGoogleCalendar: () => Promise<void>;
  disconnectGoogleCalendar: () => Promise<void>;
  syncGoogleCalendar: (date?: string) => Promise<{ synced: Array<{ id: string; title: string; start: string; end: string }>; total: number; filtered: number } | undefined>;
}

const api = {
  async get<T>(url: string): Promise<T> {
    const r = await fetch(url);
    if (!r.ok) throw new Error(`${url}: ${r.status}`);
    return r.json();
  },
  async post<T>(url: string, body: unknown): Promise<T> {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!r.ok) throw new Error(`${url}: ${r.status}`);
    return r.json();
  },
  async patch<T>(url: string, body: unknown): Promise<T> {
    const r = await fetch(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!r.ok) throw new Error(`${url}: ${r.status}`);
    return r.json();
  },
  async del(url: string): Promise<void> {
    const r = await fetch(url, { method: 'DELETE' });
    if (!r.ok) throw new Error(`${url}: ${r.status}`);
  },
  async delete_<T>(url: string): Promise<T> {
    const r = await fetch(url, { method: 'DELETE' });
    if (!r.ok) throw new Error(`${url}: ${r.status}`);
    return r.json();
  },
};

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

  loadData: async () => {
    set({ loading: true });
    try {
      const date = todayKey();
      const [tasks, blocks, capacity, gamification] = await Promise.all([
        api.get<Task[]>('/api/tasks'),
        api.get<TimeBlock[]>(`/api/time-blocks?date=${date}`),
        api.get<DailyCapacity>(`/api/capacity?date=${date}`).catch(() => null),
        api.get<GamificationLog[]>(`/api/gamification?date=${date}`).catch(() => []),
      ]);
      set({
        tasks,
        timeBlocks: blocks,
        capacity,
        gamification,
        loading: false,
      });
      await get().computeDailyScore();
    } catch (e) {
      console.error('loadData failed', e);
      set({ loading: false });
    }
  },

  loadSettings: async () => {
    try {
      const s = await api.get<Settings>('/api/settings');
      set({ settings: s });
    } catch {
      // create default settings
      const s = await api.post<Settings>('/api/settings', {});
      set({ settings: s });
    }
  },

  createTask: async (input) => {
    try {
      const t = await api.post<Task>('/api/tasks', input);
      set({ tasks: [...get().tasks, t] });
      return t;
    } catch (e) {
      console.error('createTask failed', e);
      return null;
    }
  },

  updateTask: async (id, patch) => {
    try {
      const t = await api.patch<Task>(`/api/tasks/${id}`, patch);
      set({ tasks: get().tasks.map((x) => (x.id === id ? t : x)) });
    } catch (e) {
      console.error('updateTask failed', e);
    }
  },

  deleteTask: async (id) => {
    try {
      await api.del(`/api/tasks/${id}`);
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
      const t = await api.post<Task>(`/api/tasks/${id}/complete`, { actualMinutes });
      set({ tasks: get().tasks.map((x) => (x.id === id ? t : x)) });
      // award completion points
      await get().awardPoints('completion', 10, `Completed: ${t.title}`);
      await get().recalcScheduledFocus();
      await get().computeDailyScore();
    } catch (e) {
      console.error('completeTask failed', e);
    }
  },

  uncompleteTask: async (id) => {
    try {
      const t = await api.delete_<Task>(`/api/tasks/${id}/complete`);
      set({ tasks: get().tasks.map((x) => (x.id === id ? t : x)) });
      await get().recalcScheduledFocus();
      await get().computeDailyScore();
    } catch (e) {
      console.error('uncompleteTask failed', e);
    }
  },

  reorderTasks: async (orderedIds) => {
    try {
      await api.post('/api/tasks/reorder', { orderedIds });
      // Update local state to reflect new sort orders
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

  createTimeBlock: async (input) => {
    try {
      const b = await api.post<TimeBlock>('/api/time-blocks', input);
      set({ timeBlocks: [...get().timeBlocks, b] });
      await get().recalcScheduledFocus();
      return b;
    } catch (e) {
      console.error('createTimeBlock failed', e);
      return null;
    }
  },

  updateTimeBlock: async (id, patch) => {
    try {
      const b = await api.patch<TimeBlock>(`/api/time-blocks/${id}`, patch);
      set({ timeBlocks: get().timeBlocks.map((x) => (x.id === id ? b : x)) });
      await get().recalcScheduledFocus();
    } catch (e) {
      console.error('updateTimeBlock failed', e);
    }
  },

  deleteTimeBlock: async (id) => {
    try {
      await api.del(`/api/time-blocks/${id}`);
      set({ timeBlocks: get().timeBlocks.filter((x) => x.id !== id) });
      await get().recalcScheduledFocus();
    } catch (e) {
      console.error('deleteTimeBlock failed', e);
    }
  },

  moveTaskToTimeline: async (taskId, startISO, endISO) => {
    const task = get().tasks.find((t) => t.id === taskId);
    if (!task) return;
    // remove existing non-anchor block for this task today
    const existing = get().timeBlocks.find((b) => b.taskId === taskId);
    if (existing) {
      await get().updateTimeBlock(existing.id, {
        startTime: startISO, endTime: endISO,
      });
    } else {
      await get().createTimeBlock({
        taskId,
        title: task.title,
        startTime: startISO,
        endTime: endISO,
        isAnchor: false,
        isExternalEvent: false,
        colorTag: task.category,
      });
    }
    // mark task as 'today'
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
      try {
        await api.patch<DailyCapacity>(`/api/capacity?date=${date}`, { scheduledFocusMinutes: scheduled });
      } catch (e) {
        console.error('recalcScheduledFocus persist failed', e);
      }
    }
  },

  setCapacity: async (input) => {
    const date = todayKey();
    try {
      const c = await api.patch<DailyCapacity>(`/api/capacity?date=${date}`, input);
      set({ capacity: c });
    } catch (e) {
      console.error('setCapacity failed', e);
    }
  },

  generateAnchors: async () => {
    const { settings, timeBlocks } = get();
    if (!settings) return;
    // Check if anchors already exist for today
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
    // Hydration breaks every interval
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
    // persist session start (only for task-linked timers)
    if (taskId) {
      try {
        const session = await api.post<TimeLogSession>('/api/timer/start', { taskId, type });
        set({ timerSessions: [...get().timerSessions, session] });
      } catch (e) {
        console.error('startTimer failed', e);
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
        await api.post('/api/timer/stop', {
          taskId: t.taskId, elapsedSeconds: elapsed, interrupted,
        });
        const task = get().tasks.find((x) => x.id === t.taskId);
        if (task) {
          const addedMinutes = Math.round(elapsed / 60);
          await get().updateTask(task.id, { actualMinutes: task.actualMinutes + addedMinutes });
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
    // For pomodoro, check completion
    if (t.type === 'pomodoro' && t.targetSeconds > 0) {
      const total = t.elapsedBeforeStart + Math.floor((Date.now() - t.startedAt) / 1000);
      if (total >= t.targetSeconds) {
        void get().stopTimer(false);
      }
    }
  },

  runMidnightRollover: async () => {
    // Move all 'today' tasks that are not completed into triage_review
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

  awardPoints: async (type, points, note) => {
    const date = todayKey();
    try {
      const g = await api.post<GamificationLog>('/api/gamification', { date, type, points, note });
      set({ gamification: [...get().gamification, g] });
    } catch (e) {
      console.error('awardPoints failed', e);
    }
  },

  computeDailyScore: async () => {
    const { gamification } = get();
    const score = gamification.reduce((sum, g) => sum + g.points, 0);
    set({ todayScore: score });
  },

  // ── Google Calendar ──────────────────────────────────────
  loadGoogleCalendarStatus: async () => {
    try {
      const status = await api.get<GoogleCalendarStatus>('/api/google-calendar');
      set({ googleCalendar: status });
    } catch {
      // ignore — not configured yet
    }
  },

  saveGoogleCredentials: async (clientId, clientSecret) => {
    try {
      await api.post('/api/google-calendar', { clientId, clientSecret });
      await get().loadGoogleCalendarStatus();
    } catch (e) {
      console.error('saveGoogleCredentials failed', e);
    }
  },

  connectGoogleCalendar: async () => {
    try {
      const { url } = await api.get<{ url: string }>('/api/google-calendar?mode=auth-url');
      // Redirect to Google OAuth
      window.location.href = url;
    } catch (e) {
      console.error('connectGoogleCalendar failed', e);
    }
  },

  disconnectGoogleCalendar: async () => {
    try {
      await api.del('/api/google-calendar');
      await get().loadGoogleCalendarStatus();
    } catch (e) {
      console.error('disconnectGoogleCalendar failed', e);
    }
  },

  syncGoogleCalendar: async (date) => {
    try {
      const dateParam = date ?? todayKey();
      const result = await api.post<{ synced: Array<{ id: string; title: string; start: string; end: string }>; total: number; filtered: number }>(
        `/api/google-calendar/sync?date=${dateParam}`,
        {},
      );
      // Reload time blocks to pick up synced events
      const blocks = await api.get<TimeBlock[]>(`/api/time-blocks?date=${dateParam}`);
      set({ timeBlocks: blocks });
      await get().loadGoogleCalendarStatus();
      return result;
    } catch (e) {
      console.error('syncGoogleCalendar failed', e);
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
