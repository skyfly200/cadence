import { ref } from 'vue';

interface BIPEvent extends Event { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }>; }

// Module-level singletons shared by every caller.
const deferred = ref<BIPEvent | null>(null);
const canInstall = ref(false);
const installed = ref(false);
const isIOS = ref(false);
let registered = false;

/** Register the install listeners as early as possible (called from a client plugin). */
export function initInstallPrompt() {
  if (registered || typeof window === 'undefined') return;
  registered = true;

  window.addEventListener('beforeinstallprompt', (e: Event) => {
    e.preventDefault();
    deferred.value = e as BIPEvent;
    canInstall.value = true;
  });
  window.addEventListener('appinstalled', () => {
    installed.value = true;
    canInstall.value = false;
    deferred.value = null;
  });

  const standalone = window.matchMedia?.('(display-mode: standalone)').matches
    || (navigator as unknown as { standalone?: boolean }).standalone === true;
  if (standalone) installed.value = true;

  const ua = navigator.userAgent || '';
  isIOS.value = /iphone|ipad|ipod/i.test(ua) && !/crios|fxios/i.test(ua);
}

export function useInstallPrompt() {
  // Idempotent — safe even if the plugin already ran.
  initInstallPrompt();

  async function install() {
    if (!deferred.value) return;
    await deferred.value.prompt();
    await deferred.value.userChoice.catch(() => {});
    deferred.value = null;
    canInstall.value = false;
  }

  return { canInstall, installed, isIOS, install };
}
