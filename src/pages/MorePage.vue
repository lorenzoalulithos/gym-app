<template>
  <q-page class="page-pad">
    <div class="text-h5 text-weight-bold q-mb-md q-mt-sm">Altro</div>

    <q-list class="card q-mb-lg" separator>
      <q-item clickable to="/report">
        <q-item-section avatar><q-icon name="insights" color="primary" /></q-item-section>
        <q-item-section>
          <q-item-label>Report mensile</q-item-label>
          <q-item-label caption>Costanza, muscoli, esercizi, corpo</q-item-label>
        </q-item-section>
        <q-item-section side><q-icon name="chevron_right" /></q-item-section>
      </q-item>
      <q-item clickable to="/corpo">
        <q-item-section avatar><q-icon name="monitor_weight" color="secondary" /></q-item-section>
        <q-item-section>
          <q-item-label>Peso e misure</q-item-label>
          <q-item-label caption>Peso, vita, petto, braccio, coscia, fianchi</q-item-label>
        </q-item-section>
        <q-item-section side><q-icon name="chevron_right" /></q-item-section>
      </q-item>
      <q-item clickable to="/foto">
        <q-item-section avatar><q-icon name="photo_camera" color="secondary" /></q-item-section>
        <q-item-section>
          <q-item-label>Foto progressi</q-item-label>
          <q-item-label caption>Fronte, lato, schiena ogni mese</q-item-label>
        </q-item-section>
        <q-item-section side><q-icon name="chevron_right" /></q-item-section>
      </q-item>
    </q-list>

    <div class="section-label q-mb-sm">Dati</div>
    <q-list class="card q-mb-lg" separator>
      <q-item clickable :disable="busy" @click="run(exportJson)">
        <q-item-section avatar><q-icon name="ios_share" color="primary" /></q-item-section>
        <q-item-section>
          <q-item-label>Esporta dati (JSON)</q-item-label>
          <q-item-label caption
            >Allenamenti, schede e andamento: da dare a Claude per la scheda del mese
            dopo</q-item-label
          >
        </q-item-section>
      </q-item>
      <q-item clickable :disable="busy" @click="run(exportFullZip)">
        <q-item-section avatar><q-icon name="archive" /></q-item-section>
        <q-item-section>
          <q-item-label>Backup completo (ZIP)</q-item-label>
          <q-item-label caption>Dati + foto, per cambiare telefono</q-item-label>
        </q-item-section>
      </q-item>
      <q-item clickable :disable="busy" @click="fileInput?.click()">
        <q-item-section avatar><q-icon name="restore" /></q-item-section>
        <q-item-section>
          <q-item-label>Ripristina da file</q-item-label>
          <q-item-label caption>JSON o ZIP esportati da questa app</q-item-label>
        </q-item-section>
      </q-item>
    </q-list>

    <div class="section-label q-mb-sm">Allenamento</div>
    <q-list class="card q-mb-lg">
      <q-item tag="label">
        <q-item-section>
          <q-item-label>Promemoria allenamenti</q-item-label>
          <q-item-label caption>{{ REMINDER_TEXT[reminder] }}</q-item-label>
        </q-item-section>
        <q-item-section side>
          <q-toggle
            :model-value="reminder === 'active'"
            :disable="reminder === 'unsupported'"
            @update:model-value="(v: boolean) => void toggleReminder(v)"
          />
        </q-item-section>
      </q-item>
      <q-item tag="label">
        <q-item-section>
          <q-item-label>Riscaldamento suggerito</q-item-label>
          <q-item-label caption>Prima del primo esercizio pesante di ogni muscolo</q-item-label>
        </q-item-section>
        <q-item-section side><q-toggle v-model="settings.suggestWarmup" /></q-item-section>
      </q-item>
      <q-item tag="label">
        <q-item-section><q-item-label>Suono a fine timer</q-item-label></q-item-section>
        <q-item-section side><q-toggle v-model="settings.sound" /></q-item-section>
      </q-item>
      <q-item tag="label">
        <q-item-section><q-item-label>Vibrazione</q-item-label></q-item-section>
        <q-item-section side><q-toggle v-model="settings.vibration" /></q-item-section>
      </q-item>
      <q-item tag="label">
        <q-item-section>
          <q-item-label>Schermo sempre acceso</q-item-label>
          <q-item-label caption>Durante l'allenamento</q-item-label>
        </q-item-section>
        <q-item-section side><q-toggle v-model="settings.keepAwake" /></q-item-section>
      </q-item>
      <q-item>
        <q-item-section><q-item-label>Recupero predefinito</q-item-label></q-item-section>
        <q-item-section side>
          <q-select
            v-model="settings.defaultRestSec"
            dense
            borderless
            emit-value
            map-options
            :options="restOpts"
          />
        </q-item-section>
      </q-item>
      <q-item>
        <q-item-section>
          <q-item-label>Conto alla rovescia</q-item-label>
          <q-item-label caption>Prima delle serie a tempo</q-item-label>
        </q-item-section>
        <q-item-section side>
          <q-select
            v-model="settings.countdownSec"
            dense
            borderless
            emit-value
            map-options
            :options="[0, 3, 5, 10].map((v) => ({ value: v, label: `${v}s` }))"
          />
        </q-item-section>
      </q-item>
      <q-item clickable @click="testSound">
        <q-item-section><q-item-label>Prova suono e notifiche</q-item-label></q-item-section>
        <q-item-section side><q-icon name="volume_up" /></q-item-section>
      </q-item>
    </q-list>

    <div class="section-label q-mb-sm">Spazio</div>
    <div class="card q-pa-md q-mb-lg text-caption">
      <div>
        Archiviazione persistente: <b>{{ persisted === null ? '…' : persisted ? 'sì' : 'no' }}</b>
      </div>
      <div v-if="usage">Usati {{ usage }}</div>
      <div class="text-muted q-mt-xs">
        I dati stanno solo su questo telefono. Fai un backup completo ogni tanto.
      </div>
    </div>

    <div class="text-caption text-muted text-center q-mt-xl">
      Versione {{ build }}<br />
      Libreria esercizi e immagini: free-exercise-db (Unlicense)
    </div>

    <input
      ref="fileInput"
      type="file"
      accept=".json,.zip,application/json,application/zip"
      class="hidden"
      @change="onImport"
    />
  </q-page>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useQuasar } from 'quasar';
import { applyBackup, exportFullZip, exportJson, readBackup } from '@/services/backup';
import { askNotificationPermission, beep, notify, unlockAudio } from '@/services/feedback';
import {
  disableReminders,
  enableReminders,
  reminderStatus,
  type ReminderStatus,
} from '@/services/reminders';
import { useSettingsStore } from '@/stores/settings';
import { useWorkoutStore } from '@/stores/workout';

const $q = useQuasar();
const settings = useSettingsStore();
const workout = useWorkoutStore();
const busy = ref(false);
const build = __APP_BUILD__;
const fileInput = ref<HTMLInputElement>();
const persisted = ref<boolean | null>(null);
const usage = ref('');

const reminder = ref<ReminderStatus>('off');
const REMINDER_TEXT: Record<ReminderStatus, string> = {
  active: "Attivi: notifica l'allenamento del giorno e quelli saltati",
  off: "Notifica l'allenamento del giorno e quelli saltati",
  denied: 'Notifiche bloccate: riattivale dalle impostazioni di Chrome',
  'not-installed': "Installa l'app (Aggiungi a schermata Home) per attivarli",
  unsupported: 'Non supportati da questo browser: usa Chrome su Android',
};

async function toggleReminder(on: boolean) {
  reminder.value = on ? await enableReminders() : await disableReminders();
}

const restOpts = [30, 45, 60, 75, 90, 120, 150, 180].map((v) => ({ value: v, label: `${v}s` }));

onMounted(async () => {
  reminder.value = await reminderStatus();
  persisted.value = (await navigator.storage?.persisted?.()) ?? false;
  const est = await navigator.storage?.estimate?.();
  if (est?.usage) usage.value = `${(est.usage / 1024 / 1024).toFixed(1)} MB`;
});

async function run(fn: () => Promise<void>) {
  busy.value = true;
  try {
    await fn();
  } catch (e) {
    $q.notify({ message: `Errore: ${(e as Error).message}`, color: 'negative' });
  } finally {
    busy.value = false;
  }
}

async function onImport(e: Event) {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file) return;
  await run(async () => {
    const { data, photos, summary } = await readBackup(file);
    $q.dialog({
      title: 'Ripristinare il backup?',
      message:
        `${summary.sessions} allenamenti, ${summary.programs} schede, ${summary.exercises} esercizi` +
        (photos ? `, ${summary.photos} foto` : '') +
        '. Allenamenti, schede e misure attuali verranno sostituiti.',
      cancel: { flat: true, label: 'Annulla' },
      ok: { label: 'Ripristina', color: 'negative', unelevated: true },
    }).onOk(
      () =>
        void run(async () => {
          await applyBackup(data, photos);
          workout.reset();
          $q.notify({
            message: 'Backup ripristinato',
            color: 'positive',
            textColor: 'dark',
            icon: 'check',
          });
        }),
    );
  });
}

async function testSound() {
  unlockAudio();
  beep('end');
  await askNotificationPermission();
  if (Notification?.permission === 'granted') {
    setTimeout(() => void notify('Prova notifica', 'Così arriva a fine recupero'), 3000);
    $q.notify({ message: 'Blocca lo schermo: tra 3 secondi arriva una notifica di prova' });
  }
}
</script>
