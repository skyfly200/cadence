import { onMounted, onUnmounted } from 'vue';
import { useAppStore } from '~/stores/app';
import { showNotification, notificationPermission } from '~/lib/notifications';
import { format, todayKey } from '~/lib/time-utils';
import type { Habit } from '~/lib/types';

/**
 * Runs while the app is open and fires local reminders:
 * - anchor start times (meals, hydration, workout, …)
 * - a daily nudge for unfinished habits at a chosen time
 * (Pomodoro-complete is fired from the store's timer tick.)
 */
export function useReminders() {
  const store = useAppStore();
  let interval: ReturnType<typeof setInterval> | null = null;
  const notifiedAnchors = new Set<string>();
  let lastHabitNudge = '';

  function isDue(h: Habit): boolean {
    return h.cadence === 'daily' || h.days.includes(new Date().getDay());
  }

  function tick() {
    const prefs = store.notificationPrefs;
    if (!prefs.enabled || notificationPermission() !== 'granted') return;
    const now = new Date();

    if (prefs.anchors) {
      for (const b of store.todayBlocks) {
        if (!b.isAnchor || b.completed) continue;
        const diffSec = (new Date(b.startTime).getTime() - now.getTime()) / 1000;
        // Fire once as the anchor's start time passes (within a ~90s window).
        if (diffSec <= 0 && diffSec > -90 && !notifiedAnchors.has(b.id)) {
          notifiedAnchors.add(b.id);
          void showNotification(`${b.title} time`, {
            body: 'A moment to honor this anchor — tap it done on your timeline.',
            tag: `anchor-${b.id}`,
          });
        }
      }
    }

    if (prefs.habitsReminder) {
      const hhmm = format(now, 'HH:mm');
      const day = todayKey();
      if (hhmm === prefs.habitsReminder && lastHabitNudge !== day) {
        lastHabitNudge = day;
        const due = store.habits.filter(isDue);
        const remaining = due.filter((h) => !h.completions.includes(day)).length;
        if (remaining > 0) {
          void showNotification('Habits', {
            body: `${remaining} habit${remaining !== 1 ? 's' : ''} still to do today.`,
            tag: 'habits',
          });
        }
      }
    }
  }

  onMounted(() => {
    interval = setInterval(tick, 30_000);
    tick();
  });
  onUnmounted(() => { if (interval) clearInterval(interval); });
}
