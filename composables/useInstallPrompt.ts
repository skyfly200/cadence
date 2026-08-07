import { ref, onMounted, onUnmounted } from 'vue';

interface BIPEvent extends Event { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }>; }

// Module-level singletons so every caller shares one state.
const deferred = ref<BIPEvent | null>(null);
const canInstall = ref(false);
const installed = ref(false);
const isIOS = ref(false);

export function useInstallPrompt() {
  function onBIP(e: Event) {
    e.preventDefault();
    deferred.value = e as BIPEvent;
    canInstall.value = true;
  }
  function onInstalled() {
    installed.value = true;
    canInstall.value = false;
    deferred.value = null;
  }

  onMounted(() => {
    window.addEventListener('beforeinstallprompt', onBIP);
    window.addEventListener('appinstalled', onInstalled);
    const standalone = window.matchMedia('(display-mode: standalone)').matches
      || (navigator as unknown as { standalone?: boolean }).standalone === true;
    if (standalone) installed.value = true;
    const ua = navigator.userAgent;
    isIOS.value = /iphone|ipad|ipod/i.test(ua) && !/crios|fxios/i.test(ua);
  });
  onUnmounted(() => {
    window.removeEventListener('beforeinstallprompt', onBIP);
    window.removeEventListener('appinstalled', onInstalled);
  });

  async function install() {
    if (!deferred.value) return;
    await deferred.value.prompt();
    await deferred.value.userChoice.catch(() => {});
    deferred.value = null;
    canInstall.value = false;
  }

  return { canInstall, installed, isIOS, install };
}
