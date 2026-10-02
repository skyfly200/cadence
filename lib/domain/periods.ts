/**
 * Calendar period windows. Windows are half-open [start, end) in real instants
 * (so a DST day is 23 or 25 hours long), computed from wall-clock dates in an
 * IANA time zone. No date library: only Intl.
 *
 * Boundaries: week starts on `weekStartsOn` (default Monday); month, quarter
 * (3), four_months (Jan–Apr, May–Aug, Sep–Dec), six_months (Jan–Jun, Jul–Dec)
 * and year are calendar-aligned.
 */
import type { Period } from './types';

export interface PeriodOptions {
  /** IANA zone, e.g. 'Europe/London'. Defaults to the runtime's zone. */
  timeZone?: string;
  /** 0 = Sunday … 6 = Saturday. Default 1 (Monday). */
  weekStartsOn?: number;
}

export interface PeriodWindow {
  period: Period;
  start: Date;
  /** Exclusive. Equal to the start of the next window. */
  end: Date;
  /** Stable id: `${period}:${YYYY-MM-DD of the local start}`. */
  key: string;
}

const MONTH_SPAN: Record<Exclude<Period, 'day' | 'week'>, number> = {
  month: 1,
  quarter: 3,
  four_months: 4,
  six_months: 6,
  year: 12,
};

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatter(timeZone: string): Intl.DateTimeFormat {
  let f = formatters.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone, hourCycle: 'h23',
      year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric',
    });
    formatters.set(timeZone, f);
  }
  return f;
}

function zoneOf(opts: PeriodOptions): string {
  return opts.timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
}

interface LocalParts { y: number; m: number; d: number; h: number; mi: number; s: number }

/** Wall-clock parts of an instant in a zone. */
export function localParts(at: Date, timeZone: string): LocalParts {
  const out: Record<string, number> = {};
  for (const p of formatter(timeZone).formatToParts(at)) {
    if (p.type !== 'literal') out[p.type] = Number(p.value);
  }
  return { y: out.year, m: out.month, d: out.day, h: out.hour, mi: out.minute, s: out.second };
}

/** Minutes since midnight for an 'HH:mm' string. */
export const minutesOfDay = (hhmm: string): number => {
  const [h, m] = hhmm.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
};

/** Whether the local time at `now` falls inside an optional 'HH:mm' window (it may wrap past midnight). No window means always. */
export function inTimeWindow(windowStart: string | null | undefined, windowEnd: string | null | undefined, now: Date, timeZone: string): boolean {
  if (!windowStart && !windowEnd) return true;
  const p = localParts(now, timeZone);
  const cur = p.h * 60 + p.mi;
  const a = windowStart ? minutesOfDay(windowStart) : 0;
  const b = windowEnd ? minutesOfDay(windowEnd) : 24 * 60;
  return a <= b ? cur >= a && cur <= b : cur >= a || cur <= b;
}

/** The local calendar day of an instant as 'YYYY-MM-DD'. */
export function dayKey(at: Date, timeZone: string): string {
  const p = localParts(at, timeZone);
  return `${p.y}-${String(p.m).padStart(2, '0')}-${String(p.d).padStart(2, '0')}`;
}

/** Zone offset at an instant, in ms (local wall clock read as UTC, minus the instant). */
function offsetMs(at: Date, timeZone: string): number {
  const p = localParts(at, timeZone);
  const base = Math.floor(at.getTime() / 1000) * 1000;
  return Date.UTC(p.y, p.m - 1, p.d, p.h, p.mi, p.s) - base;
}

/** The instant of local midnight on (y, m, d) in a zone; y/m/d may overflow (m 1-12, d beyond month) and are normalised. */
function zonedMidnight(y: number, m: number, d: number, timeZone: string): Date {
  const guess = Date.UTC(y, m - 1, d);
  let t = guess - offsetMs(new Date(guess), timeZone);
  const second = guess - offsetMs(new Date(t), timeZone); // second pass fixes DST edges
  if (second !== t) t = second;
  return new Date(t);
}

const pad = (n: number) => String(n).padStart(2, '0');

/** 'YYYY-MM-DD' for a possibly-overflowing y/m/d. */
function dateKey(y: number, m: number, d: number): string {
  const n = new Date(Date.UTC(y, m - 1, d));
  return `${n.getUTCFullYear()}-${pad(n.getUTCMonth() + 1)}-${pad(n.getUTCDate())}`;
}

/** Local weekday of an instant: 0 = Sunday … 6 = Saturday. */
export function localWeekday(at: Date, opts: PeriodOptions = {}): number {
  const p = localParts(at, zoneOf(opts));
  return new Date(Date.UTC(p.y, p.m - 1, p.d)).getUTCDay();
}

/** The window of `period` that contains `at`. */
export function periodWindow(period: Period, at: Date, opts: PeriodOptions = {}): PeriodWindow {
  const tz = zoneOf(opts);
  const weekStartsOn = opts.weekStartsOn ?? 1;
  const p = localParts(at, tz);

  let sy = p.y, sm = p.m, sd = p.d; // local start (y, m, d)
  let ey = p.y, em = p.m, ed = p.d; // local end (exclusive)

  if (period === 'day') {
    ed = p.d + 1;
  } else if (period === 'week') {
    const weekday = new Date(Date.UTC(p.y, p.m - 1, p.d)).getUTCDay();
    const back = (weekday - weekStartsOn + 7) % 7;
    sd = p.d - back;
    ed = sd + 7;
  } else {
    const span = MONTH_SPAN[period];
    sm = Math.floor((p.m - 1) / span) * span + 1;
    sd = 1;
    em = sm + span;
    ed = 1;
  }

  return {
    period,
    start: zonedMidnight(sy, sm, sd, tz),
    end: zonedMidnight(ey, em, ed, tz),
    key: `${period}:${dateKey(sy, sm, sd)}`,
  };
}

export function previousWindow(w: PeriodWindow, opts: PeriodOptions = {}): PeriodWindow {
  return periodWindow(w.period, new Date(w.start.getTime() - 1), opts);
}

export function nextWindow(w: PeriodWindow, opts: PeriodOptions = {}): PeriodWindow {
  return periodWindow(w.period, w.end, opts);
}

export function inWindow(w: PeriodWindow, at: Date): boolean {
  return at.getTime() >= w.start.getTime() && at.getTime() < w.end.getTime();
}

/** How far through the window `at` is, 0..1, by real elapsed time (DST-aware). */
export function periodProgress(w: PeriodWindow, at: Date): number {
  const total = w.end.getTime() - w.start.getTime();
  const frac = (at.getTime() - w.start.getTime()) / total;
  return Math.min(1, Math.max(0, frac));
}
