import { register } from 'register-service-worker';
import { Notify } from 'quasar';

register(import.meta.env.QUASAR_SERVICE_WORKER_FILE, {
  updated() {
    Notify.create({
      message: 'Nuova versione disponibile',
      icon: 'system_update',
      timeout: 0,
      actions: [{ label: 'Aggiorna', color: 'primary', handler: () => window.location.reload() }],
    });
  },
  error(err) {
    // senza rete il controllo degli aggiornamenti fallisce: è normale, l'app va offline
    if (navigator.onLine) console.error('Errore service worker:', err);
  },
});
