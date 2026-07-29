import { format, parseISO, startOfDay, differenceInMinutes, addMinutes, set, isSameDay } from 'date-fns';

export function todayKey(d: Date = new Date()): string {
  return format(d, 'yyyy-MM-dd');
}

export function dateKey(d: Date): string {
  return format(d, 'yyyy-MM-dd');
}

export function yesterdayKey(d: Date = new Date()): string {
  const y = new Date(d);
  y.setDate(y.getDate() - 1);
  return format(y, 'yyyy-MM-dd');
}

export function parseTimeOnDate(date: Date, timeStr: string): Date {
  // timeStr = "HH:mm"
  const [h, m] = timeStr.split(':').map(Number);
  return set(date, { hours: h, minutes: m, seconds: 0, milliseconds: 0 });
}

export function minutesToTimeSlot(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

export function timeToMinutes(timeStr: string): number {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

// CSS Grid timeline: 48 rows of 30 minutes each, starting at 00:00
export const SLOT_MINUTES = 30;
export const SLOTS_PER_DAY = 48;

export function timeToGridRow(date: Date): number {
  const mins = date.getHours() * 60 + date.getMinutes();
  return Math.floor(mins / SLOT_MINUTES) + 1; // grid lines are 1-indexed
}

export function durationToRows(minutes: number): number {
  return Math.max(1, Math.round(minutes / SLOT_MINUTES));
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

export function formatTime(date: Date | string): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, 'h:mm a');
}

export function formatRange(start: Date | string, end: Date | string): string {
  const s = typeof start === 'string' ? parseISO(start) : start;
  const e = typeof end === 'string' ? parseISO(end) : end;
  return `${format(s, 'h:mm a')} – ${format(e, 'h:mm a')}`;
}

export function blockDurationMinutes(start: string, end: string): number {
  const s = typeof start === 'string' ? parseISO(start) : start;
  const e = typeof end === 'string' ? parseISO(end) : end;
  return Math.max(0, differenceInMinutes(e, s));
}

export function blocksOverlap(
  aStart: Date, aEnd: Date, bStart: Date, bEnd: Date,
): boolean {
  return aStart < bEnd && bStart < aEnd;
}

export function formatSeconds(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export { format, parseISO, startOfDay, addMinutes, isSameDay };
