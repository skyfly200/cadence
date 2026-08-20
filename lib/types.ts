// Core domain types — shared across frontend and backend

export type TaskStatus = 'backlog' | 'incubator' | 'today' | 'completed' | 'triage_review';
export type EisenhowerCategory = 'do_first' | 'schedule' | 'delegate' | 'eliminate';
export type TaskCategory = 'Creative' | 'Admin' | 'Maintenance' | 'Health' | 'Learning' | 'Social';
export type AnchorType = 'breakfast' | 'lunch' | 'dinner' | 'water' | 'sleep' | 'workout';
export type TimerType = 'pomodoro' | 'open_flow';

export interface Task {
  id: string;
  title: string;
  notes?: string | null;
  status: TaskStatus;
  eisenhowerCategory: EisenhowerCategory;
  estimatedMinutes: number;
  actualMinutes: number;
  category: string;
  rolledOverCount: number;
  priority: number;
  sortOrder: number;
  projectId?: string | null;
  // Planning constraints
  location?: string | null;      // where it happens (for grouping errands)
  locationLat?: number | null;   // geocoded (navigable) coordinates
  locationLon?: number | null;
  deadline?: string | null;      // ISO datetime it must be done by
  windowStart?: string | null;   // HH:mm earliest it can be done (e.g. store opens)
  windowEnd?: string | null;     // HH:mm latest it can be done (e.g. store closes)
  dependsOn?: string[];          // task ids that must be completed first
  dirty?: boolean;               // this task makes me dirty / is grimy
  needsClean?: boolean;          // best done while clean / presentable
  isHygiene?: boolean;           // this is the shower / cleanup pivot
  createdAt: string;
  updatedAt: string;
  completedAt?: string | null;
}

export interface Project {
  id: string;
  name: string;
  color: string; // key into PROJECT_COLORS
  createdAt: string;
}

export const PROJECT_COLORS: Record<string, string> = {
  purple: 'bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30',
  pink: 'bg-pink-500/15 text-pink-700 dark:text-pink-300 border-pink-500/30',
  orange: 'bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/30',
  emerald: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
  teal: 'bg-teal-500/15 text-teal-700 dark:text-teal-300 border-teal-500/30',
  amber: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30',
  rose: 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30',
  sky: 'bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30',
};
export const PROJECT_COLOR_KEYS = Object.keys(PROJECT_COLORS);

export interface TimeBlock {
  id: string;
  taskId?: string | null;
  title: string;
  startTime: string;
  endTime: string;
  isAnchor: boolean;
  isExternalEvent: boolean;
  anchorType?: string | null;
  colorTag?: string | null;
  completed?: boolean; // for anchors: honored/checked off for the day
}

export interface TimeLogSession {
  id: string;
  taskId: string;
  type: TimerType;
  startTime: string;
  endTime?: string | null;
  elapsedSeconds: number;
  interrupted: boolean;
}

export interface DailyCapacity {
  id: string;
  date: string; // YYYY-MM-DD
  readinessScore?: number | null;
  sleepHours?: number | null;
  manualEnergyRating?: number | null;
  maxAllowedFocusMinutes: number;
  scheduledFocusMinutes: number;
  triageCompleted: boolean;
  triageStreak: number;
}

export interface GamificationLog {
  id: string;
  date: string;
  type: 'realism' | 'anchor_discipline' | 'triage_streak' | 'completion' | 'focus_session' | 'planning_streak' | 'habit';
  points: number;
  note?: string | null;
}

export interface PlanningStreak {
  current: number;        // consecutive days planned, up to and including lastPlannedDate
  longest: number;        // best run ever
  lastPlannedDate: string | null; // YYYY-MM-DD of the most recent planned day
}

// ── Trip planner ───────────────────────────────────────────

export type TripSegmentMode =
  | 'drive' | 'walk' | 'cycle' | 'transit' | 'flight'
  | 'ev_charge' | 'hike' | 'bike' | 'transfer' | 'lodging' | 'custom';

export type TripKind = 'general' | 'roadtrip' | 'flight' | 'backpacking' | 'bikepacking' | 'ev';

export interface TripWaypoint {
  label: string;
  lat?: number | null;
  lon?: number | null;
}

export interface TripSegment {
  id: string;
  mode: TripSegmentMode;
  title?: string | null;
  from: TripWaypoint;
  to: TripWaypoint;
  date?: string | null;        // YYYY-MM-DD assigned day (shufflable)
  startTime?: string | null;   // HH:mm
  durationMin?: number | null;
  distanceKm?: number | null;
  notes?: string | null;
  evNetwork?: string | null;
  chargeKwh?: number | null;
  flightNumber?: string | null;
  sortOrder: number;
}

export interface Trip {
  id: string;
  name: string;
  kind: TripKind;
  startDate?: string | null;   // YYYY-MM-DD
  endDate?: string | null;
  notes?: string | null;
  segments: TripSegment[];
  createdAt: string;
  updatedAt: string;
}

export const TRIP_SEGMENT_META: Record<TripSegmentMode, { label: string; emoji: string; routable: boolean }> = {
  drive: { label: 'Drive', emoji: '🚗', routable: true },
  walk: { label: 'Walk', emoji: '🚶', routable: true },
  cycle: { label: 'Cycle', emoji: '🚲', routable: true },
  transit: { label: 'Transit', emoji: '🚆', routable: true },
  flight: { label: 'Flight', emoji: '✈️', routable: false },
  ev_charge: { label: 'EV charge', emoji: '🔌', routable: false },
  hike: { label: 'Hike', emoji: '🥾', routable: true },
  bike: { label: 'Bikepack', emoji: '🚵', routable: true },
  transfer: { label: 'Transfer', emoji: '🔀', routable: true },
  lodging: { label: 'Lodging', emoji: '🏕️', routable: false },
  custom: { label: 'Custom', emoji: '📍', routable: false },
};

export const TRIP_KINDS: { value: TripKind; label: string; emoji: string }[] = [
  { value: 'general', label: 'General', emoji: '🧭' },
  { value: 'roadtrip', label: 'Road trip', emoji: '🚗' },
  { value: 'ev', label: 'EV road trip', emoji: '🔌' },
  { value: 'flight', label: 'Flights', emoji: '✈️' },
  { value: 'backpacking', label: 'Backpacking', emoji: '🥾' },
  { value: 'bikepacking', label: 'Bikepacking', emoji: '🚵' },
];

/** Map a trip segment mode to an OSRM/HERE routing mode, or null if not auto-routable. */
export function segmentRoutingMode(m: TripSegmentMode): 'drive' | 'walk' | 'cycle' | 'transit' | null {
  switch (m) {
    case 'drive': case 'transfer': return 'drive';
    case 'walk': case 'hike': return 'walk';
    case 'cycle': case 'bike': return 'cycle';
    case 'transit': return 'transit';
    default: return null;
  }
}

export type HabitCadence = 'daily' | 'weekly';

export interface Habit {
  id: string;
  name: string;
  emoji?: string | null;
  cadence: HabitCadence;
  days: number[];          // weekly: weekday numbers (0=Sun … 6=Sat); empty for daily
  createdAt: string;
  completions: string[];   // YYYY-MM-DD dates completed
}

export interface BrainDumpEntry {
  id: string;
  content: string;
  context?: string | null; // free-form tag: "work", "idea", "errand"…
  date: string;            // YYYY-MM-DD the thought belongs to
  createdAt: string;       // ISO
  updatedAt: string;       // ISO
}

export interface Settings {
  id: string;
  wakeTime: string;
  sleepTime: string;
  breakfastTime: string;
  lunchTime: string;
  dinnerTime: string;
  hydrationInterval: number;
  defaultPomodoroMinutes: number;
  defaultBreakMinutes: number;
  travelMode?: 'drive' | 'walk' | 'cycle' | 'transit';
  transitEnabled?: boolean;
  transitApiKey?: string;
}

export interface NotificationPrefs {
  enabled: boolean;
  anchors: boolean;         // meal / hydration / anchor start reminders
  timer: boolean;           // pomodoro complete
  habitsReminder: string;   // 'HH:mm' daily nudge for unfinished habits, or '' to disable
}

export interface GoogleCalendarStatus {
  connected: boolean;
  calendarEmail: string | null;
  hasCredentials: boolean;
  lastSyncAt: string | null;
  autoSync: boolean;
}

// Capacity tier mapping
export const CAPACITY_TIERS = {
  high: { min: 85, maxFocus: 360, label: 'Peak', color: 'emerald' },
  medium: { min: 60, maxFocus: 270, label: 'Steady', color: 'amber' },
  low: { min: 0, maxFocus: 180, label: 'Conservation', color: 'rose' },
} as const;

export function getCapacityTier(score?: number | null) {
  if (!score && score !== 0) return CAPACITY_TIERS.medium;
  if (score >= CAPACITY_TIERS.high.min) return CAPACITY_TIERS.high;
  if (score >= CAPACITY_TIERS.medium.min) return CAPACITY_TIERS.medium;
  return CAPACITY_TIERS.low;
}

export function getMaxFocusForScore(score?: number | null): number {
  return getCapacityTier(score).maxFocus;
}

// Color palette per category (no indigo/blue)
export const CATEGORY_COLORS: Record<string, string> = {
  Creative: 'bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30',
  Admin: 'bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/30',
  Maintenance: 'bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/30',
  Health: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
  Learning: 'bg-teal-500/15 text-teal-700 dark:text-teal-300 border-teal-500/30',
  Social: 'bg-pink-500/15 text-pink-700 dark:text-pink-300 border-pink-500/30',
};

export const ANCHOR_COLORS: Record<string, string> = {
  breakfast: 'bg-amber-500/20 border-amber-500/40 text-amber-800 dark:text-amber-200',
  lunch: 'bg-orange-500/20 border-orange-500/40 text-orange-800 dark:text-orange-200',
  dinner: 'bg-rose-500/20 border-rose-500/40 text-rose-800 dark:text-rose-200',
  water: 'bg-cyan-500/20 border-cyan-500/40 text-cyan-800 dark:text-cyan-200',
  sleep: 'bg-violet-500/20 border-violet-500/40 text-violet-800 dark:text-violet-200',
  workout: 'bg-lime-500/20 border-lime-500/40 text-lime-800 dark:text-lime-200',
};

export const EISENHOWER_LABELS: Record<EisenhowerCategory, { label: string; short: string; urgent: boolean; important: boolean }> = {
  do_first: { label: 'Do First', short: 'DO', urgent: true, important: true },
  schedule: { label: 'Schedule', short: 'SCH', urgent: false, important: true },
  delegate: { label: 'Delegate', short: 'DEL', urgent: true, important: false },
  eliminate: { label: 'Eliminate', short: 'ELM', urgent: false, important: false },
};

export const TASK_CATEGORIES: TaskCategory[] = ['Creative', 'Admin', 'Maintenance', 'Health', 'Learning', 'Social'];

export const PRESET_DURATIONS = [15, 30, 60, 90, 120, 180];

// Google Calendar external event colors
export const EXTERNAL_EVENT_COLORS: Record<string, string> = {
  external: 'bg-sky-500/15 border-sky-500/40 text-sky-800 dark:text-sky-200',
  lavender: 'bg-purple-500/15 border-purple-500/40 text-purple-800 dark:text-purple-200',
  slate: 'bg-slate-500/15 border-slate-500/40 text-slate-800 dark:text-slate-200',
  grape: 'bg-violet-500/15 border-violet-500/40 text-violet-800 dark:text-violet-200',
  flamingo: 'bg-pink-500/15 border-pink-500/40 text-pink-800 dark:text-pink-200',
  banana: 'bg-amber-500/15 border-amber-500/40 text-amber-800 dark:text-amber-200',
  tangerine: 'bg-orange-500/15 border-orange-500/40 text-orange-800 dark:text-orange-200',
  peacock: 'bg-teal-500/15 border-teal-500/40 text-teal-800 dark:text-teal-200',
  graphite: 'bg-zinc-500/15 border-zinc-500/40 text-zinc-800 dark:text-zinc-200',
  blueberry: 'bg-purple-500/15 border-purple-500/40 text-purple-800 dark:text-purple-200',
  basil: 'bg-emerald-500/15 border-emerald-500/40 text-emerald-800 dark:text-emerald-200',
  tomato: 'bg-rose-500/15 border-rose-500/40 text-rose-800 dark:text-rose-200',
};
