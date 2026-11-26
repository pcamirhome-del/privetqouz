import {registerSW} from 'virtual:pwa-register';

let isInitialized = false;
let isReloading = false;

export async function forceHardUpdateAndReload(serverVersion?: string): Promise<void> {
  if (isReloading || typeof window === 'undefined') return;
  isReloading = true;

  try {
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
    }
    const nextVersion = serverVersion || Date.now().toString();
    try {
      localStorage.setItem('app_build_id', nextVersion);
      sessionStorage.setItem('app_reloaded_for_v', nextVersion);
    } catch {
      // Ignore storage errors in restricted modes
    }
  } finally {
    const targetVersion = serverVersion || Date.now().toString();
    window.location.href = `${window.location.pathname}?v=${encodeURIComponent(targetVersion)}`;
  }
}

async function checkServerVersion(): Promise<void> {
  if (isReloading || typeof window === 'undefined' || !navigator.onLine) return;

  try {
    const res = await fetch(`/version.json?t=${Date.now()}`, {
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        Pragma: 'no-cache',
      },
    });
    if (!res.ok) return;
    const data = (await res.json()) as {version?: string | number};
    const serverVersion = data?.version ? String(data.version).trim() : '';
    if (!serverVersion) return;

    const compiledBuildId =
      typeof __APP_BUILD_ID__ !== 'undefined' ? String(__APP_BUILD_ID__) : '';

    let storedBuildId: string | null = null;
    let reloadedForVersion: string | null = null;
    try {
      storedBuildId = localStorage.getItem('app_build_id');
      reloadedForVersion = sessionStorage.getItem('app_reloaded_for_v');
    } catch {
      // ignore storage errors
    }

    // Prevent infinite reload loop if reload for this exact version was just attempted
    if (reloadedForVersion === serverVersion && compiledBuildId === serverVersion) {
      return;
    }

    const differsFromCompiled =
      Boolean(compiledBuildId) && serverVersion !== compiledBuildId;
    const differsFromStored =
      Boolean(storedBuildId) && serverVersion !== storedBuildId;

    if (
      (differsFromCompiled || differsFromStored) &&
      reloadedForVersion !== serverVersion
    ) {
      await forceHardUpdateAndReload(serverVersion);
    } else if (!storedBuildId) {
      try {
        localStorage.setItem('app_build_id', compiledBuildId || serverVersion);
      } catch {
        // ignore
      }
    }
  } catch {
    // Ignore transient offline or network fetch errors
  }
}

export function initPWAUpdater() {
  if (isInitialized || typeof window === 'undefined') return;
  isInitialized = true;

  const compiledBuildId =
    typeof __APP_BUILD_ID__ !== 'undefined' ? String(__APP_BUILD_ID__) : '';
  if (compiledBuildId) {
    try {
      localStorage.setItem('app_build_id', compiledBuildId);
    } catch {
      // ignore
    }
  }

  // Active version polling on launch, visibilitychange, and every 30 seconds
  void checkServerVersion();

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      void checkServerVersion();
    }
  });

  window.addEventListener('focus', () => {
    void checkServerVersion();
  });

  window.setInterval(() => {
    void checkServerVersion();
  }, 30 * 1000);

  if (!('serviceWorker' in navigator)) return;

  const hadController = Boolean(navigator.serviceWorker.controller);

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController) return;
    void forceHardUpdateAndReload();
  });

  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      void updateSW(true);
    },
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return;

      const triggerSwUpdate = () => {
        if (navigator.onLine) {
          registration.update().catch(() => {});
        }
      };

      triggerSwUpdate();
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          triggerSwUpdate();
        }
      });
      window.setInterval(triggerSwUpdate, 30 * 1000);
    },
  });
}
