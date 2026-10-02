/**
 * Handle notification action URLs on app load: ?nudge=<id>&action=notnow|stop.
 * Runs at setup, before useNudges loads its state, so the saved feedback is the
 * state useNudges starts from (client only). The logic is consumeNudgeUrl.
 */
import { consumeNudgeUrl, loadState, saveState } from '~/lib/home/nudge-state';

export function useNudgeUrlAction() {
  if (typeof window === 'undefined') return;
  const result = consumeNudgeUrl(window.location.href, loadState());
  if (!result) return;
  saveState(result.state);
  window.history.replaceState({}, '', result.href);
}
