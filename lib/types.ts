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
  createdAt: string;
  updatedAt: string;
  completedAt?: string | null;
}

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
  type: 'realism' | 'anchor_discipline' | 'triage_streak' | 'completion' | 'focus_session';
  points: number;
  note?: string | null;
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
}

export interface GoogleCalendarStatus {
  connected: boolean;
  calendarEmail: string | null;
  hasCredentials: boolean;
  lastSyncAt: string | null;
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
