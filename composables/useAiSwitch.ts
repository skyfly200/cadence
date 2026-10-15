/**
 * The one AI switch, shared by Settings and the privacy page: the device copy (prefs) and, when signed in,
 * the server's copy, which is the one enforced. A failed save puts the switch back.
 */
import { ref } from 'vue';
import { getAiOn, setAiOn } from '~/lib/home/prefs';
import { getAiEnabledFromServer, setAiEnabledOnServer } from '~/lib/account-client';
import { useAppStore } from '~/stores/app';

export function useAiSwitch() {
  const app = useAppStore();
  const token = () => app.session?.access_token as string | undefined;
  const aiOn = ref(true);
  const aiBusy = ref(false);
  const aiNote = ref('');

  async function toggleAi(on: boolean) {
    aiNote.value = '';
    const before = aiOn.value;
    aiOn.value = on;
    setAiOn(on);
    if (!app.signedIn) return; // signed out: the device switch is the whole story
    aiBusy.value = true;
    const r = await setAiEnabledOnServer(on, token());
    aiBusy.value = false;
    if (r.status !== 'ok') {
      aiOn.value = before;
      setAiOn(before);
      aiNote.value = r.status === 'failed' ? r.message : 'Sign in again to change this.';
    }
  }

  /** Read the device copy, then (signed in) show what the server will enforce. */
  async function loadAi() {
    aiOn.value = getAiOn();
    if (!app.signedIn) return;
    const ai = await getAiEnabledFromServer(token());
    if (ai.status === 'ok') { aiOn.value = ai.data.enabled; setAiOn(ai.data.enabled); }
  }

  return { aiOn, aiBusy, aiNote, toggleAi, loadAi };
}
