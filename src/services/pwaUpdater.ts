import {registerSW} from 'virtual:pwa-register';

let isInitialized = false;
let isReloading = false;

async function clearRuntimeAndStaleCaches() {
  if (typeof window === 'undefined' || !('caches' in window)) return;
  try {
    const keys = await caches.keys();
    await Promise.all(keys.map((key) => caches.delete(key)));
  } catch {
    // Ignore cache cleanup errors on restricted browsers
  }
}

export function initPWAUpdater() {
  if (isInitialized || typeof window === 'undefined') return;
  isInitialized = true;

  if (!('serviceWorker' in navigator)) return;

  // Only force-reload when an existing controller is replaced by a newer build
  const hadController = Boolean(navigator.serviceWorker.controller);

  const triggerCleanReload = async () => {
    if (isReloading) return;
    isReloading = true;
    await clearRuntimeAndStaleCaches();
    window.location.reload();
  };

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController) return;
    void triggerCleanReload();
  });

  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      void updateSW(true);
    },
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return;

      const checkForUpdates = () => {
        if (navigator.onLine) {
          registration.update().catch(() => {});
        }
      };

      // Check immediately on startup
      checkForUpdates();

      // Check whenever the user switches back or reopens the PWA
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          checkForUpdates();
        }
      });

      window.addEventListener('focus', checkForUpdates);

      // Periodic background check every 60 seconds
      window.setInterval(checkForUpdates, 60 * 1000);
    },
  });
}
