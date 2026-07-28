/**
 * LocalStorage-based persistence layer.
 * Replaces Prisma/SQLite — zero database dependency.
 * All data lives in the browser, making the app fully client-renderable.
 */

export interface StoredData {
  tasks: TaskRow[];
  timeBlocks: TimeBlockRow[];
  capacityMap: Record<string, CapacityRow>; // date → capacity
  settings: SettingsRow;
  gamificationMap: Record<string, GamificationRow[]>; // date → entries[]
  timerSessions: TimerSessionRow[];
  googleCalendar: GoogleCalendarRow;
}

// ── Row types (lightweight, no Prisma dependency) ──────────

export interface TaskRow {
  id: string;
  title: string;
  notes?: string | null;
  status: string;
  eisenhowerCategory: string;
  estimatedMinutes: number;
  actualMinutes: number;
  category: string;
  rolledOverCount: number;
  priority: number;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  completedAt?: string | null;
}

export interface TimeBlockRow {
  id: string;
  taskId?: string | null;
  title: string;
  startTime: string;
  endTime: string;
  isAnchor: boolean;
  isExternalEvent: boolean;
  anchorType?: string | null;
  colorTag?: string | null;
}

export interface CapacityRow {
  id: string;
  date: string;
  readinessScore?: number | null;
  sleepHours?: number | null;
  manualEnergyRating?: number | null;
  maxAllowedFocusMinutes: number;
  scheduledFocusMinutes: number;
  triageCompleted: boolean;
  triageStreak: number;
}

export interface GamificationRow {
  id: string;
  date: string;
  type: string;
  points: number;
  note?: string | null;
}

export interface TimerSessionRow {
  id: string;
  taskId: string;
  type: string;
  startTime: string;
  endTime?: string | null;
  elapsedSeconds: number;
  interrupted: boolean;
}

export interface SettingsRow {
  id: string;
  wakeTime: string;
  sleepTime: string;
  breakfastTime: string;
  lunchTime: string;
  dinnerTime: string;
  hydrationInterval: number;
  defaultPomodoroMinutes: number;
  defaultBreakMinutes: number;
}

export interface GoogleCalendarRow {
  connected: boolean;
  accessToken?: string | null;
  refreshToken?: string | null;
  tokenExpiresAt?: string | null;
  calendarEmail?: string | null;
  lastSyncAt?: string | null;
}

// ── Storage keys ──────────────────────────────────────────

const STORAGE_PREFIX = 'cadence:';

const KEYS = {
  tasks: `${STORAGE_PREFIX}tasks`,
  timeBlocks: `${STORAGE_PREFIX}timeBlocks`,
  capacityMap: `${STORAGE_PREFIX}capacityMap`,
  settings: `${STORAGE_PREFIX}settings`,
  gamificationMap: `${STORAGE_PREFIX}gamificationMap`,
  timerSessions: `${STORAGE_PREFIX}timerSessions`,
  googleCalendar: `${STORAGE_PREFIX}googleCalendar`,
} as const;

// ── Safe JSON parse/stringify ───────────────────────────────

function load<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function save<T>(key: string, value: T): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error(`Failed to save ${key}:`, e);
  }
}

// ── Helpers ─────────────────────────────────────────────────

export function uid(): string {
  // Simple unique ID generator (no Prisma cuid dependency)
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 9)}`;
}

export function nowISO(): string {
  return new Date().toISOString();
}

// ── Task operations ─────────────────────────────────────────

export function getTasks(): TaskRow[] {
  return load<TaskRow[]>(KEYS.tasks, []);
}

export function saveTasks(tasks: TaskRow[]): void {
  save(KEYS.tasks, tasks);
}

export function addTask(task: Omit<TaskRow, 'id' | 'createdAt' | 'updatedAt'>): TaskRow {
  const tasks = getTasks();
  const now = nowISO();
  const row: TaskRow = { ...task, id: uid(), createdAt: now, updatedAt: now };
  tasks.push(row);
  saveTasks(tasks);
  return row;
}

export function updateTask(id: string, patch: Partial<TaskRow>): TaskRow | null {
  const tasks = getTasks();
  const idx = tasks.findIndex((t) => t.id === id);
  if (idx === -1) return null;
  tasks[idx] = { ...tasks[idx], ...patch, updatedAt: nowISO() };
  saveTasks(tasks);
  return tasks[idx];
}

export function deleteTask(id: string): void {
  const tasks = getTasks().filter((t) => t.id !== id);
  saveTasks(tasks);
}

export function reorderTaskIds(orderedIds: string[]): void {
  const tasks = getTasks();
  const orderMap = new Map(orderedIds.map((id, idx) => [id, idx]));
  for (const t of tasks) {
    if (orderMap.has(t.id)) {
      t.sortOrder = orderMap.get(t.id)!;
      t.updatedAt = nowISO();
    }
  }
  saveTasks(tasks);
}

// ── TimeBlock operations ───────────────────────────────────

export function getTimeBlocks(): TimeBlockRow[] {
  return load<TimeBlockRow[]>(KEYS.timeBlocks, []);
}

export function saveTimeBlocks(blocks: TimeBlockRow[]): void {
  save(KEYS.timeBlocks, blocks);
}

export function addTimeBlock(block: Omit<TimeBlockRow, 'id'>): TimeBlockRow {
  const blocks = getTimeBlocks();
  const row: TimeBlockRow = { ...block, id: uid() };
  blocks.push(row);
  saveTimeBlocks(blocks);
  return row;
}

export function updateTimeBlock(id: string, patch: Partial<TimeBlockRow>): TimeBlockRow | null {
  const blocks = getTimeBlocks();
  const idx = blocks.findIndex((b) => b.id === id);
  if (idx === -1) return null;
  blocks[idx] = { ...blocks[idx], ...patch };
  saveTimeBlocks(blocks);
  return blocks[idx];
}

export function deleteTimeBlock(id: string): void {
  const blocks = getTimeBlocks().filter((b) => b.id !== id);
  saveTimeBlocks(blocks);
}

export function deleteExternalEventsForDate(dateISO: string): void {
  // dateISO is YYYY-MM-DD
  const startOfDay = new Date(`${dateISO}T00:00:00`);
  const endOfDay = new Date(`${dateISO}T23:59:59`);
  const blocks = getTimeBlocks().filter(
    (b) => !(b.isExternalEvent && new Date(b.startTime) >= startOfDay && new Date(b.endTime) <= endOfDay),
  );
  saveTimeBlocks(blocks);
}

// ── Capacity operations ────────────────────────────────────

export function getCapacityMap(): Record<string, CapacityRow> {
  return load<Record<string, CapacityRow>>(KEYS.capacityMap, {});
}

export function saveCapacityMap(map: Record<string, CapacityRow>): void {
  save(KEYS.capacityMap, map);
}

export function getCapacity(date: string): CapacityRow | null {
  const map = getCapacityMap();
  return map[date] ?? null;
}

export function setCapacity(date: string, patch: Partial<CapacityRow>): CapacityRow {
  const map = getCapacityMap();
  const existing = map[date];
  const row: CapacityRow = existing
    ? { ...existing, ...patch }
    : { id: uid(), date, ...patch } as CapacityRow;
  map[date] = row;
  saveCapacityMap(map);
  return row;
}

// ── Settings operations ──────────────────────────────────────

const DEFAULT_SETTINGS: SettingsRow = {
  id: 'singleton',
  wakeTime: '07:00',
  sleepTime: '23:00',
  breakfastTime: '08:00',
  lunchTime: '13:00',
  dinnerTime: '19:00',
  hydrationInterval: 90,
  defaultPomodoroMinutes: 25,
  defaultBreakMinutes: 5,
};

export function getSettings(): SettingsRow {
  return load<SettingsRow>(KEYS.settings, DEFAULT_SETTINGS);
}

export function saveSettings(settings: SettingsRow): void {
  save(KEYS.settings, settings);
}

// ── Gamification operations ─────────────────────────────────

export function getGamificationMap(): Record<string, GamificationRow[]> {
  return load<Record<string, GamificationRow[]>>(KEYS.gamificationMap, {});
}

export function saveGamificationMap(map: Record<string, GamificationRow[]>): void {
  save(KEYS.gamificationMap, map);
}

export function getGamificationForDate(date: string): GamificationRow[] {
  const map = getGamificationMap();
  return map[date] ?? [];
}

export function addGamificationEntry(entry: Omit<GamificationRow, 'id'>): GamificationRow {
  const map = getGamificationMap();
  const row: GamificationRow = { ...entry, id: uid() };
  if (!map[entry.date]) map[entry.date] = [];
  map[entry.date].push(row);
  saveGamificationMap(map);
  return row;
}

// ── Timer Session operations ────────────────────────────────

export function getTimerSessions(): TimerSessionRow[] {
  return load<TimerSessionRow[]>(KEYS.timerSessions, []);
}

export function saveTimerSessions(sessions: TimerSessionRow[]): void {
  save(KEYS.timerSessions, sessions);
}

export function addTimerSession(session: Omit<TimerSessionRow, 'id'>): TimerSessionRow {
  const sessions = getTimerSessions();
  const row: TimerSessionRow = { ...session, id: uid() };
  sessions.push(row);
  saveTimerSessions(sessions);
  return row;
}

export function updateTimerSession(id: string, patch: Partial<TimerSessionRow>): TimerSessionRow | null {
  const sessions = getTimerSessions();
  const idx = sessions.findIndex((s) => s.id === id);
  if (idx === -1) return null;
  sessions[idx] = { ...sessions[idx], ...patch };
  saveTimerSessions(sessions);
  return sessions[idx];
}

// ── Google Calendar operations ───────────────────────────────

const DEFAULT_GCAL: GoogleCalendarRow = {
  connected: false,
  accessToken: null,
  refreshToken: null,
  tokenExpiresAt: null,
  calendarEmail: null,
  lastSyncAt: null,
};

export function getGoogleCalendar(): GoogleCalendarRow {
  return load<GoogleCalendarRow>(KEYS.googleCalendar, DEFAULT_GCAL);
}

export function saveGoogleCalendar(data: GoogleCalendarRow): void {
  save(KEYS.googleCalendar, data);
}

export function disconnectGoogleCalendar(): void {
  saveGoogleCalendar({ ...DEFAULT_GCAL });
}

// ── Bulk operations (for initial load) ──────────────────────

export function loadAll(): StoredData {
  return {
    tasks: getTasks(),
    timeBlocks: getTimeBlocks(),
    capacityMap: getCapacityMap(),
    settings: getSettings(),
    gamificationMap: getGamificationMap(),
    timerSessions: getTimerSessions(),
    googleCalendar: getGoogleCalendar(),
  };
}
