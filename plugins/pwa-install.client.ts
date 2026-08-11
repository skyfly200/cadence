import { initInstallPrompt } from '~/composables/useInstallPrompt';

// Register the beforeinstallprompt/appinstalled listeners at app startup so
// the event isn't missed if it fires before the page component mounts.
export default defineNuxtPlugin(() => {
  initInstallPrompt();
});
