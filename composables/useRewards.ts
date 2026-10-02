/**
 * Reward moments for the Home components: the text for the toast, and the soft tone. The wording and
 * rules live in lib/home/rewards.ts (pure, tested); this only gathers what the rules need from the
 * stores and the device settings, and plays the tone unless it is muted or inside quiet hours.
 */
import { dayKey, habitProgress, inQuiet, keptRun, type NudgeSettings, type Period } from '~/lib/domain';
import { playChime } from '~/lib/home/chime';
import { loadState } from '~/lib/home/nudge-state';
import { getDelightState, getRewardPrefs, setDelightState } from '~/lib/home/prefs';
import { nextDelight, rewardFor, type Moment } from '~/lib/home/rewards';
import { useAppStore } from '~/stores/app';
import { useGraphStore } from '~/stores/graph';

const PERIOD_PHRASE: Record<Period, string> = {
  day: 'today', week: 'this week', month: 'this month', quarter: 'this quarter', four_months: 'this stretch', six_months: 'this stretch', year: 'this year',
};

export interface RewardOptions {
  /** The habit just logged (for the moment 'habit'). */
  habitId?: string;
  /** The item is a slog (for 'start' and 'done'). */
  slog?: boolean;
  /** The reply the action already has, e.g. a capture's "Got it, in the heap.". */
  ack?: string;
}

export function useRewards() {
  const graph = useGraphStore();
  const app = useAppStore();

  function soundAllowed(now: Date, tz: string): boolean {
    if (loadState().muted) return false;
    const s = (app.settings ?? { wakeTime: '07:00', sleepTime: '23:00' }) as NudgeSettings;
    return !inQuiet(now.getTime(), s, tz);
  }

  /** Say something warm for a reward moment: returns the text and plays the soft tone. */
  function reward(moment: Moment, opt: RewardOptions = {}): string {
    const now = new Date();
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const prefs = getRewardPrefs();

    let progress: string | null = null;
    let met = false;
    let run: { periods: number; period: Period } | null = null;
    const habit = opt.habitId ? graph.habits.find((h) => h.id === opt.habitId) : undefined;
    if (habit) {
      const p = habitProgress(habit, graph.occurrences, now);
      met = p.met;
      progress = `${p.count} of ${p.target} ${PERIOD_PHRASE[habit.recurrence.period]}.`;
      const periods = met ? keptRun(habit, graph.occurrences, now) : null;
      if (periods) run = { periods, period: habit.recurrence.period };
    } else if (moment === 'done') {
      progress = `${graph.kept.length} accomplished today.`;
    }

    let delight = false;
    if (prefs.lines) {
      const d = nextDelight(getDelightState(), dayKey(now, tz), Math.random());
      delight = d.show;
      if (d.show) setDelightState(d.state);
    }

    const r = rewardFor({ moment, prefs, slog: opt.slog, met, progress, weeklyKept: graph.weeklyTally, run, ack: opt.ack, pick: Math.random(), delight });
    if (r.tone !== 'none' && soundAllowed(now, tz)) playChime(r.tone);
    return r.text;
  }

  return { reward };
}
