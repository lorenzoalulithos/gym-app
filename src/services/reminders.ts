import { getMeta, setMeta } from '@/db';

// Promemoria allenamenti: il service worker controlla il calendario qualche volta al giorno
// (Periodic Background Sync) e notifica l'allenamento di oggi o quello saltato.
// Funziona solo con l'app installata su Chrome/Android; la frequenza la decide il browser.

const TAG = 'gym-reminder';

interface PeriodicSyncManager {
  register(tag: string, options?: { minInterval: number }): Promise<void>;
  unregister(tag: string): Promise<void>;
  getTags(): Promise<string[]>;
}

type RegWithSync = ServiceWorkerRegistration & { periodicSync?: PeriodicSyncManager };

export type ReminderStatus = 'active' | 'off' | 'denied' | 'not-installed' | 'unsupported';

async function registration(): Promise<RegWithSync | undefined> {
  if (!('serviceWorker' in navigator)) return undefined;
  return await navigator.serviceWorker.getRegistration();
}

async function syncPermission(): Promise<PermissionState | 'unknown'> {
  try {
    const s = await navigator.permissions.query({
      name: 'periodic-background-sync' as PermissionName,
    });
    return s.state;
  } catch {
    return 'unknown';
  }
}

export async function reminderStatus(): Promise<ReminderStatus> {
  const reg = await registration();
  if (!reg?.periodicSync || !('Notification' in window)) return 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  if ((await syncPermission()) !== 'granted') return 'not-installed';
  const tags = await reg.periodicSync.getTags();
  return tags.includes(TAG) && Notification.permission === 'granted' ? 'active' : 'off';
}

export async function enableReminders(): Promise<ReminderStatus> {
  if ('Notification' in window && Notification.permission === 'default') {
    await Notification.requestPermission();
  }
  const reg = await registration();
  if (reg?.periodicSync && (await syncPermission()) === 'granted') {
    await reg.periodicSync.register(TAG, { minInterval: 6 * 60 * 60 * 1000 });
  }
  await setMeta('reminder:enabled', true);
  return reminderStatus();
}

export async function disableReminders(): Promise<ReminderStatus> {
  const reg = await registration();
  await reg?.periodicSync?.unregister(TAG);
  await setMeta('reminder:enabled', false);
  return reminderStatus();
}

/** All'avvio: se l'utente li aveva attivati, ri-registra (es. dopo l'installazione). */
export async function restoreReminders() {
  if ((await getMeta<boolean>('reminder:enabled')) !== true) return;
  const reg = await registration();
  if (reg?.periodicSync && (await syncPermission()) === 'granted') {
    await reg.periodicSync.register(TAG, { minInterval: 6 * 60 * 60 * 1000 });
  }
}
