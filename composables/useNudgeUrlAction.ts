/**
 * Handle notification action URLs on app load.
 * Parses ?nudge=<id>&action=notnow|stop, applies feedback, and strips the query.
 */

import { applyNotificationAction, loadState, saveState } from '~/lib/home/nudge-state';

/**
 * Runs at setup, before useNudges loads its state, so the saved feedback is the
 * state useNudges starts from (client only; the app is gated on a session).
 */
export function useNudgeUrlAction() {
  {
    if (typeof window === 'undefined') return;

    const url = new URL(window.location.href);
    const nudgeId = url.searchParams.get('nudge');
    const action = url.searchParams.get('action');

    if (!nudgeId) return;

    // Apply feedback if action is present
    if (action) {
      const state = loadState();
      const newState = applyNotificationAction(state, nudgeId, action);
      saveState(newState);
    }

    // Strip query params from URL
    if (url.search) {
      url.searchParams.delete('nudge');
      url.searchParams.delete('action');
      window.history.replaceState({}, '', url.toString());
    }
  }
}
