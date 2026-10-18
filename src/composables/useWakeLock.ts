import { onBeforeUnmount, watch, type Ref } from 'vue';

/** Tiene lo schermo acceso finché `active` è vero (lo riprende quando si torna sull'app). */
export function useWakeLock(active: Ref<boolean>) {
  let lock: WakeLockSentinel | null = null;

  async function acquire() {
    if (!active.value || lock || !('wakeLock' in navigator)) return;
    try {
      lock = await navigator.wakeLock.request('screen');
      lock.addEventListener('release', () => (lock = null));
    } catch {
      /* batteria scarsa o permesso negato: si continua senza */
    }
  }

  async function release() {
    await lock?.release();
    lock = null;
  }

  const onVisible = () => {
    if (document.visibilityState === 'visible') void acquire();
  };

  watch(active, (v) => void (v ? acquire() : release()), { immediate: true });
  document.addEventListener('visibilitychange', onVisible);
  onBeforeUnmount(() => {
    document.removeEventListener('visibilitychange', onVisible);
    void release();
  });
}
