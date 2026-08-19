/**
 * LocalStorage-based persistence layer.
 * Zero database dependency — all data lives in the browser,
 * making the app fully client-renderable.
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

// ── Row types (lightweight, no ORM dependency) ─────────────

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
  projectId?: string | null;
  location?: string | null;
  locationLat?: number | null;
  locationLon?: number | null;
  deadline?: string | null;
  windowStart?: string | null;
  windowEnd?: string | null;
  dependsOn?: string[];
  dirty?: boolean;
  needsClean?: boolean;
  isHygiene?: boolean;
  createdAt: string;
  updatedAt: string;
  completedAt?: string | null;
}

export interface ProjectRow {
  id: string;
  name: string;
  color: string;
  createdAt: string;
}

export interface HabitRow {
  id: string;
  name: string;
  emoji?: string | null;
  cadence: 'daily' | 'weekly';
  days: number[];
  createdAt: string;
  completions: string[];
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
  completed?: boolean;
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
  travelMode?: 'drive' | 'walk' | 'cycle';
}

export interface GoogleCalendarRow {
  connected: boolean;
  accessToken?: string | null;
  refreshToken?: string | null;
  tokenExpiresAt?: string | null;
  calendarEmail?: string | null;
  lastSyncAt?: string | null;
  autoSync?: boolean;
}

export interface ActiveTimerRow {
  taskId: string | null;
  type: 'pomodoro' | 'open_flow';
  startedAt: number;
  elapsedBeforeStart: number;
  targetSeconds: number;
  running: boolean;
}

export interface PlanningStreakRow {
  current: number;
  longest: number;
  lastPlannedDate: string | null;
}

export interface BrainDumpRow {
  id: string;
  content: string;
  context?: string | null;
  date: string;
  createdAt: string;
  updatedAt: string;
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
  activeTimer: `${STORAGE_PREFIX}activeTimer`,
  lastActiveDate: `${STORAGE_PREFIX}lastActiveDate`,
  planningStreak: `${STORAGE_PREFIX}planningStreak`,
  brainDump: `${STORAGE_PREFIX}brainDump`,
  projects: `${STORAGE_PREFIX}projects`,
  habits: `${STORAGE_PREFIX}habits`,
  notifications: `${STORAGE_PREFIX}notifications`,
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

/** Fix: prune anchors/external blocks that don't belong to `keepDateISO` (YYYY-MM-DD). */
export function pruneStaleDayBlocks(keepDateISO: string): void {
  const start = new Date(`${keepDateISO}T00:00:00`);
  const end = new Date(`${keepDateISO}T23:59:59`);
  const blocks = getTimeBlocks().filter((b) => {
    // Keep task-linked blocks regardless; drop anchors/external events from other days.
    if (!b.isAnchor && !b.isExternalEvent) return true;
    const s = new Date(b.startTime);
    return s >= start && s <= end;
  });
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

const DEFAULT_CAPACITY = (date: string): CapacityRow => ({
  id: uid(),
  date,
  readinessScore: null,
  sleepHours: null,
  manualEnergyRating: null,
  maxAllowedFocusMinutes: 270,
  scheduledFocusMinutes: 0,
  triageCompleted: false,
  triageStreak: 0,
});

/** Ensure a capacity row exists for the date (fix: recalc/budget must never no-op). */
export function ensureCapacity(date: string): CapacityRow {
  const map = getCapacityMap();
  if (!map[date]) {
    map[date] = DEFAULT_CAPACITY(date);
    saveCapacityMap(map);
  }
  return map[date];
}

export function setCapacity(date: string, patch: Partial<CapacityRow>): CapacityRow {
  const map = getCapacityMap();
  const existing = map[date] ?? DEFAULT_CAPACITY(date);
  const row: CapacityRow = { ...existing, ...patch };
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
  travelMode: 'drive',
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

// ── Active timer persistence (fix: resilient across reload) ─

export function getActiveTimer(): ActiveTimerRow | null {
  return load<ActiveTimerRow | null>(KEYS.activeTimer, null);
}

export function saveActiveTimer(timer: ActiveTimerRow | null): void {
  if (timer === null) {
    if (typeof window !== 'undefined') {
      try { localStorage.removeItem(KEYS.activeTimer); } catch { /* noop */ }
    }
    return;
  }
  save(KEYS.activeTimer, timer);
}

// ── Day rollover tracking ──────────────────────────────────

export function getLastActiveDate(): string | null {
  return load<string | null>(KEYS.lastActiveDate, null);
}

export function setLastActiveDate(date: string): void {
  save(KEYS.lastActiveDate, date);
}

// ── Planning streak ────────────────────────────────────────

const DEFAULT_STREAK: PlanningStreakRow = { current: 0, longest: 0, lastPlannedDate: null };

export function getPlanningStreak(): PlanningStreakRow {
  return load<PlanningStreakRow>(KEYS.planningStreak, { ...DEFAULT_STREAK });
}

export function savePlanningStreak(streak: PlanningStreakRow): void {
  save(KEYS.planningStreak, streak);
}

// ── Brain dump ─────────────────────────────────────────────

export function getBrainDump(): BrainDumpRow[] {
  return load<BrainDumpRow[]>(KEYS.brainDump, []);
}

export function saveBrainDump(rows: BrainDumpRow[]): void {
  save(KEYS.brainDump, rows);
}

export function addBrainDumpEntry(entry: { content: string; context?: string | null; date: string }): BrainDumpRow {
  const rows = getBrainDump();
  const now = nowISO();
  const row: BrainDumpRow = {
    id: uid(),
    content: entry.content,
    context: entry.context ?? null,
    date: entry.date,
    createdAt: now,
    updatedAt: now,
  };
  rows.push(row);
  saveBrainDump(rows);
  return row;
}

export function updateBrainDumpEntry(id: string, patch: Partial<BrainDumpRow>): BrainDumpRow | null {
  const rows = getBrainDump();
  const idx = rows.findIndex((r) => r.id === id);
  if (idx === -1) return null;
  rows[idx] = { ...rows[idx], ...patch, updatedAt: nowISO() };
  saveBrainDump(rows);
  return rows[idx];
}

export function deleteBrainDumpEntry(id: string): void {
  saveBrainDump(getBrainDump().filter((r) => r.id !== id));
}

// ── Projects ───────────────────────────────────────────────

export function getProjects(): ProjectRow[] {
  return load<ProjectRow[]>(KEYS.projects, []);
}

export function saveProjects(rows: ProjectRow[]): void {
  save(KEYS.projects, rows);
}

export function addProject(entry: { name: string; color: string }): ProjectRow {
  const rows = getProjects();
  const row: ProjectRow = { id: uid(), name: entry.name, color: entry.color, createdAt: nowISO() };
  rows.push(row);
  saveProjects(rows);
  return row;
}

export function updateProject(id: string, patch: Partial<ProjectRow>): ProjectRow | null {
  const rows = getProjects();
  const idx = rows.findIndex((r) => r.id === id);
  if (idx === -1) return null;
  rows[idx] = { ...rows[idx], ...patch };
  saveProjects(rows);
  return rows[idx];
}

export function deleteProject(id: string): void {
  saveProjects(getProjects().filter((r) => r.id !== id));
  // Un-assign any tasks that pointed at it.
  const tasks = getTasks();
  let changed = false;
  for (const t of tasks) {
    if (t.projectId === id) { t.projectId = null; t.updatedAt = nowISO(); changed = true; }
  }
  if (changed) saveTasks(tasks);
}

// ── Google Calendar operations ───────────────────────────────

const DEFAULT_GCAL: GoogleCalendarRow = {
  connected: false,
  accessToken: null,
  refreshToken: null,
  tokenExpiresAt: null,
  calendarEmail: null,
  lastSyncAt: null,
  autoSync: true,
};

/** Parse the OAuth `#gcal_tokens=` fragment (base64url JSON) and persist it. */
export function captureGoogleOAuthTokens(hash: string): boolean {
  const marker = '#gcal_tokens=';
  if (typeof window === 'undefined' || !hash.startsWith(marker)) return false;
  try {
    let b64 = hash.slice(marker.length).replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4) b64 += '=';
    const t = JSON.parse(decodeURIComponent(escape(atob(b64))));
    const existing = getGoogleCalendar();
    saveGoogleCalendar({
      ...existing,
      connected: true,
      accessToken: t.access_token,
      refreshToken: t.refresh_token,
      tokenExpiresAt: new Date(Date.now() + (t.expires_in ?? 3600) * 1000).toISOString(),
      calendarEmail: t.calendar_email || existing.calendarEmail || null,
      lastSyncAt: null,
    });
    return true;
  } catch (e) {
    console.error('Failed to capture Google OAuth tokens', e);
    return false;
  }
}

export function getGoogleCalendar(): GoogleCalendarRow {
  return load<GoogleCalendarRow>(KEYS.googleCalendar, DEFAULT_GCAL);
}

export function saveGoogleCalendar(data: GoogleCalendarRow): void {
  save(KEYS.googleCalendar, data);
}

export function disconnectGoogleCalendar(): void {
  saveGoogleCalendar({ ...DEFAULT_GCAL });
}

// ── Habits ─────────────────────────────────────────────────

export function getHabits(): HabitRow[] {
  return load<HabitRow[]>(KEYS.habits, []);
}

export function saveHabits(rows: HabitRow[]): void {
  save(KEYS.habits, rows);
}

export function addHabit(entry: Omit<HabitRow, 'id' | 'createdAt' | 'completions'>): HabitRow {
  const rows = getHabits();
  const row: HabitRow = { ...entry, id: uid(), createdAt: nowISO(), completions: [] };
  rows.push(row);
  saveHabits(rows);
  return row;
}

export function updateHabit(id: string, patch: Partial<HabitRow>): HabitRow | null {
  const rows = getHabits();
  const idx = rows.findIndex((r) => r.id === id);
  if (idx === -1) return null;
  rows[idx] = { ...rows[idx], ...patch };
  saveHabits(rows);
  return rows[idx];
}

export function deleteHabit(id: string): void {
  saveHabits(getHabits().filter((r) => r.id !== id));
}

// ── Notification preferences ───────────────────────────────

export interface NotificationPrefsRow {
  enabled: boolean;
  anchors: boolean;
  timer: boolean;
  habitsReminder: string;
}

const DEFAULT_NOTIFICATIONS: NotificationPrefsRow = {
  enabled: false, anchors: true, timer: true, habitsReminder: '',
};

export function getNotificationPrefs(): NotificationPrefsRow {
  return load<NotificationPrefsRow>(KEYS.notifications, { ...DEFAULT_NOTIFICATIONS });
}

export function saveNotificationPrefs(prefs: NotificationPrefsRow): void {
  save(KEYS.notifications, prefs);
}

// ── Full backup export / import ─────────────────────────────

export function exportAllData(): Record<string, unknown> {
  if (typeof window === 'undefined') return {};
  const out: Record<string, unknown> = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(STORAGE_PREFIX)) {
      const raw = localStorage.getItem(key);
      try { out[key] = raw ? JSON.parse(raw) : null; } catch { out[key] = raw; }
    }
  }
  return out;
}

export function importAllData(data: Record<string, unknown>): void {
  if (typeof window === 'undefined') return;
  for (const [key, value] of Object.entries(data)) {
    if (!key.startsWith(STORAGE_PREFIX)) continue;
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* quota */ }
  }
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
