/*
 * Service worker dell'app (workboxMode: 'InjectManifest').
 * - precache dell'app per l'uso offline
 * - cache delle immagini degli esercizi alla prima visualizzazione
 * - promemoria allenamenti tramite Periodic Background Sync (solo PWA installata su Chrome/Android)
 */

import { clientsClaim } from 'workbox-core';
import { ExpirationPlugin } from 'workbox-expiration';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { CacheFirst } from 'workbox-strategies';
import {
  cleanupOutdatedCaches,
  createHandlerBoundToURL,
  precacheAndRoute,
} from 'workbox-precaching';
import { db } from '../../src/db';
import { groupByDate, type CalendarInput } from '../../src/domain/calendar';
import { todayIso } from '../../src/domain/format';
import { reminderFor } from '../../src/domain/reminder';

declare const self: ServiceWorkerGlobalScope & typeof globalThis;

interface PeriodicSyncEvent extends ExtendableEvent {
  tag: string;
}

void self.skipWaiting();
clientsClaim();

precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

registerRoute(
  ({ url }) => url.pathname.includes('/exercises/'),
  new CacheFirst({
    cacheName: 'exercise-images',
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 3000 }),
    ],
  }),
);

if (import.meta.env.QUASAR_PROD) {
  registerRoute(
    new NavigationRoute(createHandlerBoundToURL(import.meta.env.QUASAR_PWA_FALLBACK_HTML), {
      denylist: [new RegExp(import.meta.env.QUASAR_PWA_SERVICE_WORKER_REGEX), /workbox-(.)*\.js$/],
    }),
  );
}

const REMINDER_TAG = 'gym-reminder';

async function checkReminder() {
  const hour = new Date().getHours();
  if (hour < 8 || hour >= 22) return;
  const today = todayIso();
  if ((await db.meta.get('reminder:last'))?.value === today) return;
  if ((await db.meta.get('reminder:enabled'))?.value === false) return;

  const [programs, overrides, sessions] = await Promise.all([
    db.programs.toArray(),
    db.schedule.toArray(),
    db.sessions.toArray(),
  ]);
  const done = sessions.filter((s) => s.status === 'done');
  const input: CalendarInput = {
    programs,
    overrides: new Map(overrides.map((o) => [o.date, o])),
    sessionsByDate: groupByDate(sessions),
    today,
  };
  const since = done.reduce<string | undefined>(
    (m, s) => (!m || s.date < m ? s.date : m),
    undefined,
  );
  if (since) input.since = since;

  const r = reminderFor(input, today);
  if (!r) return;
  await self.registration.showNotification(r.title, {
    body: r.body,
    tag: REMINDER_TAG,
    icon: 'icons/icon-192x192.png',
    badge: 'icons/icon-monochrome-512x512.png',
  });
  await db.meta.put({ key: 'reminder:last', value: today });
}

self.addEventListener('periodicsync', (event) => {
  const e = event as PeriodicSyncEvent;
  if (e.tag === REMINDER_TAG) e.waitUntil(checkReminder());
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const client = all[0];
      if (client) {
        await client.focus();
        if (event.notification.tag === REMINDER_TAG && 'navigate' in client) {
          await (client).navigate(`${self.registration.scope}#/`);
        }
      } else {
        await self.clients.openWindow(`${self.registration.scope}#/`);
      }
    })(),
  );
});
