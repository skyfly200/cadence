/**
 * On-device capture parser (Phase 1, before the AI exists).
 *
 * Turns a raw Capture into a Commitment draft when it contains a date or time,
 * otherwise leaves it as an Idea. Deterministic: it takes `now` and an IANA
 * time zone and never reads the clock or the machine's zone.
 *
 * Engine: chrono-node (English only, tree-shakeable) reads the phrase. It is
 * used ONLY to find the phrase and its calendar components; every instant is
 * built here from the components in the given zone, because chrono ignores
 * IANA zone names (it falls back to the machine zone) and does naive wall-clock
 * arithmetic across daylight-saving changes.
 *
 * Rules (documented so they can be tested and changed in one place):
 *  - A specific time ("at 3pm", "tomorrow 3pm", "in 2 hours") is a FIXED time.
 *  - "by / before / until / due <day or time>" is a DEADLINE; a bare day with
 *    no time is a deadline at 23:59 that day.
 *  - "morning / afternoon / evening / tonight" with no clock time is a WINDOW
 *    (06-12, 12-17, 17-21, 18-23) and a deadline at the window's end.
 *  - A range ("from 5 to 6 pm") is a WINDOW plus the fixed start and a duration.
 *  - A bare hour with no am/pm ("at 6") picks the next sensible occurrence:
 *    7-11 read as AM, 12 as noon, 1-6 as PM; with no day named, if that instant
 *    has passed it tries the other half of the day, then tomorrow. Always
 *    flagged `ambiguous`.
 *  - When unsure, it stays an Idea (never mis-promote): several different
 *    dates, a lone month or abbreviated weekday word, "now", recurrence words.
 */
import { en } from 'chrono-node';

export interface ParseCaptureOptions {
  /** The moment the capture was made. */
  now: Date;
  /** IANA zone the user is in, e.g. 'America/Denver'. */
  timeZone: string;
}

export interface ParsedCapture {
  kind: 'commitment' | 'idea';
  /** Commitment: the text with the date phrase removed. Idea: the original text, untouched. */
  title: string;
  /** The capture exactly as received. Always preserved. */
  text: string;
  /** ISO instant it happens at. */
  fixedAt?: string;
  /** ISO instant it must be done by. */
  deadline?: string;
  /** 'HH:mm' (in the user's zone) earliest it can be done. */
  windowStart?: string;
  /** 'HH:mm' (in the user's zone) latest it can be done. */
  windowEnd?: string;
  /** Length of a stated range, in minutes. */
  durationMinutes?: number;
  /** The phrases that were read as dates or times. */
  matched: string[];
  /** The reading involved a guess (a bare hour, a rolled-over time). */
  ambiguous?: boolean;
  /** Looks like a repeating thing ("every Monday"); stays an Idea, the user decides. */
  suggestsRecurrence?: boolean;
}

// ── time zone helpers (Intl only; no machine-zone dependence) ──────────────

interface Wall { year: number; month: number; day: number; hour: number; minute: number; second: number }

const formatters = new Map<string, Intl.DateTimeFormat>();
function formatter(timeZone: string): Intl.DateTimeFormat {
  let f = formatters.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
    formatters.set(timeZone, f);
  }
  return f;
}

/** The wall-clock reading of an instant in a zone. */
export function wallInZone(ms: number, timeZone: string): Wall {
  const p: Record<string, number> = {};
  for (const part of formatter(timeZone).formatToParts(new Date(ms))) {
    if (part.type !== 'literal') p[part.type] = Number(part.value);
  }
  return { year: p.year!, month: p.month!, day: p.day!, hour: p.hour! % 24, minute: p.minute!, second: p.second! };
}

const wallAsUtc = (w: Wall) => Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute, w.second);
const offsetAt = (ms: number, timeZone: string) => wallAsUtc(wallInZone(ms, timeZone)) - Math.floor(ms / 1000) * 1000;

/**
 * The instant at which a zone's wall clock reads the given time. In a spring-
 * forward gap (a time that does not exist) it lands just after the gap; in an
 * autumn overlap (a time that happens twice) it picks the first.
 */
export function instantFromWall(w: Omit<Wall, 'second'> & { second?: number }, timeZone: string): number {
  const second = w.second ?? 0;
  const target = Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute, second);
  const before = target - offsetAt(target - 86_400_000, timeZone);
  const after = target - offsetAt(target + 86_400_000, timeZone);
  const matches = (c: number) => wallAsUtc(wallInZone(c, timeZone)) === target;
  const valid = [before, after].filter(matches);
  return valid.length ? Math.min(...valid) : before;
}

// ── small calendar helpers on plain wall values ────────────────────────────

const pad = (n: number) => String(n).padStart(2, '0');
const hhmm = (h: number, m: number) => `${pad(h)}:${pad(m)}`;
const daysInMonth = (year: number, month: number) => new Date(Date.UTC(year, month, 0)).getUTCDate();
function addDays(w: Pick<Wall, 'year' | 'month' | 'day'>, n: number): Pick<Wall, 'year' | 'month' | 'day'> {
  const d = new Date(Date.UTC(w.year, w.month - 1, w.day + n));
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

// ── "on the 12th": chrono's English parser does not read a bare ordinal ───

const ORDINAL_DAY = /\b(?:on\s+)?the\s+(\d{1,2})(?:st|nd|rd|th)\b/i;
const ordinalParser: en.Parser = {
  pattern: () => ORDINAL_DAY,
  extract: (context, match) => {
    const day = Number(match[1]);
    if (day < 1 || day > 31) return null;
    // The reference is the user's wall clock as a local Date (see parseCapture).
    const ref = context.refDate;
    let year = ref.getFullYear();
    let month = ref.getMonth() + 1;
    if (day < ref.getDate()) {
      month += 1;
      if (month > 12) { month = 1; year += 1; }
    }
    // Skip months that do not have that day (the 31st in a 30-day month).
    for (let i = 0; i < 12 && day > daysInMonth(year, month); i++) {
      month += 1;
      if (month > 12) { month = 1; year += 1; }
    }
    return context.createParsingComponents({ year, month, day });
  },
};

const parser = en.casual.clone();
parser.parsers.push(ordinalParser);

// ── guards against mis-promotion ───────────────────────────────────────────

const RECURRENCE = new RegExp(
  [
    String.raw`\b(?:every|each)\s+(?:other\s+)?(?:day|night|morning|afternoon|evening|week|weekend|weekday|month|year|monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|tues|wed|thu|thur|thurs|fri|sat|sun|\d+\s+(?:days|weeks|months))\b`,
    String.raw`\b(?:daily|nightly|weekly|biweekly|fortnightly|monthly|quarterly|yearly|annually)\b`,
    String.raw`\b(?:\d+|once|twice|thrice)\s+(?:a|per|each)\s+(?:day|week|month|year)\b`,
    String.raw`\b(?:\d+|one|two|three|four|five|six|seven|several|a\s+few)\s+times\s+(?:a|per|each|every)\s+(?:day|week|month|year)\b`,
  ].join('|'),
  'i',
);

const NOT_A_DATE = /^(?:right\s+)?now$/i;
const LONE_MONTH = /^(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\.?$/i;
const ABBREVIATED_WEEKDAY = /^(?:mon|tue|tues|wed|thu|thur|thurs|fri|sat|sun)\.?$/;
const DEADLINE_WORD = /\b(?:by|before|until|till|due(?:\s+on)?|no\s+later\s+than)\s*$/i;
const RELATIVE_SHORT = /^(?:in|within)\s+(an?|\d+(?:\.\d+)?|half\s+an?|a\s+couple\s+of)\s*(second|sec|minute|min|hour|hr)s?\b/i;

const DAY_PARTS: Array<{ re: RegExp; start: [number, number]; end: [number, number] }> = [
  { re: /\bmorning\b/i, start: [6, 0], end: [12, 0] },
  { re: /\bafternoon\b/i, start: [12, 0], end: [17, 0] },
  { re: /\b(?:this\s+)?evening\b/i, start: [17, 0], end: [21, 0] },
  { re: /\b(?:tonight|night)\b/i, start: [18, 0], end: [23, 0] },
];

const idea = (text: string, extra: Partial<ParsedCapture> = {}): ParsedCapture => ({
  kind: 'idea', title: text, text, matched: [], ...extra,
});

/** Remove the matched phrase (and a connecting word just before it) and tidy what is left. */
function cleanTitle(text: string, index: number, length: number, extraBefore: number): string {
  const before = text.slice(0, index - extraBefore);
  const after = text.slice(index + length);
  const joined = `${before} ${after}`
    .replace(/\s{2,}/g, ' ')
    .trim()
    .replace(/^(?:(?:on|at|by|for|before|until|due|around|from|this|next)\s+)+/i, '')
    .replace(/(?:\s+(?:on|at|by|for|before|until|due|around|from|this|next|and))+$/i, '')
    .replace(/^[\s,;:.\-–—]+|[\s,;:\-–—]+$/g, '')
    .trim();
  return joined;
}

export function parseCapture(text: string, options: ParseCaptureOptions): ParsedCapture {
  const { now, timeZone } = options;
  if (!text || !text.trim()) return idea(text ?? '');

  // Recurrence is the user's call (a Habit or a repeating Commitment), never inferred here.
  if (RECURRENCE.test(text)) return idea(text, { suggestsRecurrence: true });

  // chrono gets the user's wall clock as a LOCAL Date with no zone of its own, so all of its calendar
  // math (today, tomorrow, next Monday) happens in one consistent frame that matches the user's
  // wall clock whatever zone the machine is in. Only calendar components are read back from it.
  const nowWall = wallInZone(now.getTime(), timeZone);
  const reference = new Date(nowWall.year, nowWall.month - 1, nowWall.day, nowWall.hour, nowWall.minute, nowWall.second);

  const results = parser.parse(text, reference, { forwardDate: true }).filter((r) => {
    const t = r.text.trim();
    if (NOT_A_DATE.test(t) || /^\d+$/.test(t) || LONE_MONTH.test(t) || ABBREVIATED_WEEKDAY.test(t)) return false;
    return true;
  });
  if (results.length === 0) return idea(text);
  // Two different dates in one capture: too easy to get wrong, leave it to the user.
  if (results.length > 1) return idea(text, { matched: results.map((r) => r.text), ambiguous: true });

  const r = results[0]!;
  const start = r.start;
  const end = r.end;
  const hasTime = start.isCertain('hour');
  const hasDay = start.isCertain('day') || start.isCertain('weekday');
  let ambiguous = false;

  // How much text to remove before the match (a deadline word like "by").
  const prefix = DEADLINE_WORD.exec(text.slice(0, r.index));
  const isDeadlineWord = !!prefix;
  const extraBefore = prefix ? prefix[0].length : 0;

  let fixedAt: number | undefined;
  let deadline: number | undefined;
  let windowStart: string | undefined;
  let windowEnd: string | undefined;
  let durationMinutes: number | undefined;

  const dayOf = (c: typeof start) => ({ year: c.get('year')!, month: c.get('month')!, day: c.get('day')! });
  const endOfDay = (d: Pick<Wall, 'year' | 'month' | 'day'>) => instantFromWall({ ...d, hour: 23, minute: 59 }, timeZone);

  const relative = RELATIVE_SHORT.exec(r.text);
  if (relative) {
    // "in 2 hours": exact instant arithmetic, immune to wall-clock jumps.
    const word = relative[1]!.toLowerCase();
    const amount = /^an?$/.test(word) ? 1 : word.startsWith('half') ? 0.5 : word.startsWith('a couple') ? 2 : Number(word);
    const unit = relative[2]!.toLowerCase();
    const ms = unit.startsWith('s') ? 1000 : unit.startsWith('m') ? 60_000 : 3_600_000;
    fixedAt = now.getTime() + Math.round(amount * ms);
  } else if (hasTime) {
    let day = dayOf(start);
    let hour = start.get('hour')!;
    const minute = start.get('minute') ?? 0;
    const bareHour = !start.isCertain('meridiem') && hour >= 1 && hour <= 12 && !/\b0\d:\d\d\b/.test(r.text) && !/\bnoon\b/i.test(r.text);

    if (bareHour) {
      // "at 6": 7-11 -> AM, 12 -> noon, 1-6 -> PM.
      ambiguous = true;
      const h12 = hour % 12;
      const preferred = hour === 12 ? 12 : hour >= 7 ? h12 : h12 + 12;
      const other = preferred === 12 ? 0 : preferred < 12 ? preferred + 12 : preferred - 12;
      if (hasDay) {
        hour = preferred;
      } else {
        const today = nowWall;
        const tomorrow = addDays(today, 1);
        const candidates = [
          { ...today, hour: preferred }, { ...today, hour: other }, { ...tomorrow, hour: preferred },
        ];
        const pick = candidates.find((c) => instantFromWall({ ...c, minute }, timeZone) > now.getTime()) ?? candidates[2]!;
        day = { year: pick.year, month: pick.month, day: pick.day };
        hour = pick.hour;
      }
    } else if (!hasDay && instantFromWall({ ...day, hour, minute }, timeZone) <= now.getTime()) {
      // A clock time with am/pm and no day that has already passed today means the next one.
      day = addDays(day, 1);
      ambiguous = true;
    }

    const startMs = instantFromWall({ ...day, hour, minute }, timeZone);
    if (end && end.isCertain('hour')) {
      const endDay = dayOf(end);
      const endHour = end.get('hour')!;
      const endMinute = end.get('minute') ?? 0;
      let endMs = instantFromWall({ ...endDay, hour: endHour, minute: endMinute }, timeZone);
      // A same-day range read before the day was fixed shifts with the start.
      if (!hasDay && (endDay.year !== day.year || endDay.month !== day.month || endDay.day !== day.day)) {
        endMs = instantFromWall({ ...day, hour: endHour, minute: endMinute }, timeZone);
      }
      if (endMs > startMs) {
        fixedAt = startMs;
        windowStart = hhmm(hour, minute);
        const endWall = wallInZone(endMs, timeZone);
        windowEnd = hhmm(endWall.hour, endWall.minute);
        durationMinutes = Math.round((endMs - startMs) / 60_000);
      } else {
        fixedAt = startMs;
      }
    } else if (isDeadlineWord) {
      deadline = startMs;
    } else {
      fixedAt = startMs;
    }
  } else {
    const part = DAY_PARTS.find((p) => p.re.test(r.text));
    let day = dayOf(start);
    // Tie-breaks chrono settles by comparing against an implied noon, which makes them depend on
    // the machine's zone. They are explicit here so the result never varies by machine.
    const today = { year: nowWall.year, month: nowWall.month, day: nowWall.day };
    if (start.isCertain('weekday') && !start.isCertain('day') && !/\b(?:today|this|tonight)\b/i.test(r.text)
      && day.year === today.year && day.month === today.month && day.day === today.day) {
      day = addDays(day, 7); // "Monday" said on a Monday means next Monday
    } else if (start.isCertain('month') && start.isCertain('day') && !start.isCertain('year')) {
      const passed = day.month < today.month || (day.month === today.month && day.day < today.day);
      day = { ...day, year: today.year + (passed ? 1 : 0) }; // "Oct 5th": this year unless it has passed
    }
    if (part) {
      windowStart = hhmm(...part.start);
      windowEnd = hhmm(...part.end);
      deadline = instantFromWall({ ...day, hour: part.end[0], minute: part.end[1] }, timeZone);
    } else {
      deadline = endOfDay(day);
    }
  }

  const title = cleanTitle(text, r.index, r.text.length, extraBefore);
  // Nothing left but the date phrase ("tomorrow 3pm"): there is no action, so keep it as an Idea.
  if (!title) return idea(text, { matched: [r.text] });

  const iso = (ms: number) => new Date(ms).toISOString();
  const out: ParsedCapture = { kind: 'commitment', title, text, matched: [r.text] };
  if (fixedAt !== undefined) out.fixedAt = iso(fixedAt);
  if (deadline !== undefined) out.deadline = iso(deadline);
  if (windowStart) out.windowStart = windowStart;
  if (windowEnd) out.windowEnd = windowEnd;
  if (durationMinutes !== undefined) out.durationMinutes = durationMinutes;
  if (ambiguous) out.ambiguous = true;
  return out;
}
