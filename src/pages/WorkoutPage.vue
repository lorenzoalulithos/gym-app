<template>
  <q-layout view="hHh lpR fFf">
    <q-header class="wk-header">
      <q-toolbar>
        <q-btn flat round icon="arrow_back" aria-label="Indietro" @click="goBack" />
        <q-toolbar-title class="wk-title" @click="rename">
          <div class="ellipsis">{{ s?.title }}</div>
          <div v-if="s" class="text-caption text-muted">{{ formatDate(s.date) }}</div>
        </q-toolbar-title>
        <q-btn
          v-if="mode === 'live' && roundsAvailable"
          flat
          round
          icon="sports_mma"
          aria-label="Modalità round"
          @click="router.push({ name: 'rounds', params: { id } })"
        />
        <q-btn
          v-if="mode === 'live'"
          flat
          round
          :icon="settings.focusMode ? 'view_agenda' : 'center_focus_strong'"
          :aria-label="settings.focusMode ? 'Vista elenco' : 'Modalità focus'"
          @click="settings.focusMode = !settings.focusMode"
        />
        <q-btn
          v-if="mode === 'view'"
          flat
          round
          icon="ios_share"
          aria-label="Condividi riepilogo"
          @click="openShare"
        />
        <q-btn
          v-if="mode === 'view'"
          flat
          round
          icon="edit"
          aria-label="Modifica"
          @click="editing = true"
        />
        <q-btn
          v-else-if="mode === 'edit'"
          flat
          no-caps
          color="primary"
          label="Fatto"
          @click="doneEditing"
        />
        <q-btn flat round icon="more_vert" aria-label="Altro">
          <q-menu auto-close>
            <q-list style="min-width: 200px">
              <q-item v-if="mode !== 'view'" clickable @click="addExercise()">
                <q-item-section avatar><q-icon name="add" /></q-item-section>
                <q-item-section>Aggiungi esercizio</q-item-section>
              </q-item>
              <q-item clickable class="text-negative" @click="confirmDelete">
                <q-item-section avatar><q-icon name="delete" /></q-item-section>
                <q-item-section>{{
                  mode === 'live' ? 'Annulla allenamento' : 'Elimina sessione'
                }}</q-item-section>
              </q-item>
            </q-list>
          </q-menu>
        </q-btn>
      </q-toolbar>
    </q-header>

    <q-page-container>
      <q-page v-if="s" class="page-pad">
        <div v-if="s.deload" class="deload-banner q-mb-md">
          <q-icon name="battery_charging_full" size="20px" />
          <span>
            Settimana di scarico: serie ridotte e carichi al 90%. Oggi si recupera, niente record.
          </span>
        </div>
        <FocusView
          v-if="mode === 'live' && settings.focusMode"
          :last-by-exercise="lastByExercise"
          @finish="finish"
          @add="addExercise()"
        />
        <template v-else>
          <!-- Riepilogo della sessione conclusa -->
          <div v-if="mode !== 'live'" class="card q-pa-md q-mb-md">
            <div class="row text-center">
              <div class="col">
                <div class="stat tabular">{{ stats.minutes ?? '–' }}</div>
                <div class="text-caption text-muted">minuti</div>
              </div>
              <template v-if="s.mode === 'rounds'">
                <div class="col">
                  <div class="stat tabular">{{ stats.sets }}</div>
                  <div class="text-caption text-muted">round</div>
                </div>
                <div class="col">
                  <div class="stat tabular">{{ formatClock(rounds.workSec) }}</div>
                  <div class="text-caption text-muted">di lavoro</div>
                </div>
                <div class="col">
                  <div class="stat tabular">
                    {{ s.rpe ?? '–' }}<span v-if="s.rpe" class="text-caption">/10</span>
                  </div>
                  <div class="text-caption text-muted">fatica</div>
                </div>
              </template>
              <template v-else>
                <div class="col">
                  <div class="stat tabular">{{ stats.sets }}</div>
                  <div class="text-caption text-muted">serie</div>
                </div>
                <div class="col">
                  <div class="stat tabular">
                    {{ Math.round(stats.volume).toLocaleString('it-IT') }}
                  </div>
                  <div class="text-caption text-muted">kg volume</div>
                </div>
                <div class="col">
                  <div class="stat tabular text-warning">{{ records?.count ?? 0 }}</div>
                  <div class="text-caption text-muted">record</div>
                </div>
              </template>
            </div>
            <div v-if="s.difficulty || s.notes" class="q-mt-sm text-center text-muted">
              <span v-if="s.difficulty">Difficoltà: {{ DIFFICULTY[s.difficulty] }}</span>
              <span v-if="s.notes"> · {{ s.notes }}</span>
            </div>
          </div>

          <!-- Dove hai spinto di più rispetto all'ultima volta -->
          <div v-if="mode === 'view' && progress.length" class="card q-pa-md q-mb-md">
            <div class="text-weight-bold q-mb-xs">Rispetto all'ultima volta</div>
            <div class="text-caption text-muted q-mb-sm">
              Serie migliore di ogni esercizio: massimale stimato, ripetizioni o tempo
            </div>
            <div
              v-for="p in progress"
              :key="p.exerciseId"
              class="prog-row row items-center no-wrap"
            >
              <div class="col" style="min-width: 0">
                <div class="ellipsis text-weight-medium">{{ p.name }}</div>
                <div class="text-caption text-muted tabular">
                  <template v-if="p.before !== null">
                    {{ fmtMetric(p.metric, p.before) }} → {{ fmtMetric(p.metric, p.now) }}
                  </template>
                  <template v-else>prima volta · {{ fmtMetric(p.metric, p.now) }}</template>
                </div>
              </div>
              <div class="delta tabular" :class="deltaClass(p.deltaPct)">
                <template v-if="p.deltaPct === null">nuovo</template>
                <template v-else>{{ p.deltaPct > 0 ? '+' : '' }}{{ p.deltaPct }}%</template>
              </div>
            </div>
          </div>

          <div v-for="(block, bi) in s.blocks" :key="block.id" class="card block q-mb-md">
            <div class="row items-center q-mb-xs">
              <div class="section-label col">
                {{
                  block.type === 'superset'
                    ? 'Superset'
                    : block.type === 'circuit'
                      ? 'Circuito'
                      : ''
                }}
              </div>
              <q-chip
                v-if="mode !== 'view' && block.type !== 'single'"
                dense
                outline
                clickable
                icon="timer"
                color="grey-6"
                :label="`${formatClock(block.restSec)} dopo il giro`"
                @click="editRest(bi)"
              />
              <q-btn
                v-if="mode !== 'view'"
                flat
                round
                dense
                size="sm"
                icon="more_horiz"
                color="grey-6"
              >
                <q-menu auto-close>
                  <q-list style="min-width: 200px">
                    <q-item clickable @click="addExercise(bi)">
                      <q-item-section avatar><q-icon name="link" /></q-item-section>
                      <q-item-section>Aggiungi in superset</q-item-section>
                    </q-item>
                    <q-item v-if="block.type !== 'single'" clickable @click="editRest(bi)">
                      <q-item-section avatar><q-icon name="timer" /></q-item-section>
                      <q-item-section>Recupero dopo il giro</q-item-section>
                    </q-item>
                    <q-item clickable :disable="bi === 0" @click="workout.moveBlock(bi, -1)">
                      <q-item-section avatar><q-icon name="arrow_upward" /></q-item-section>
                      <q-item-section>Sposta su</q-item-section>
                    </q-item>
                    <q-item
                      clickable
                      :disable="bi === s.blocks.length - 1"
                      @click="workout.moveBlock(bi, 1)"
                    >
                      <q-item-section avatar><q-icon name="arrow_downward" /></q-item-section>
                      <q-item-section>Sposta giù</q-item-section>
                    </q-item>
                  </q-list>
                </q-menu>
              </q-btn>
            </div>
            <div :class="{ superset: block.items.length > 1 }">
              <ExerciseCard
                v-for="(it, ii) in block.items"
                :key="it.id"
                :item="it"
                :bi="bi"
                :ii="ii"
                :mode="mode"
                :last="lastByExercise.get(it.exerciseId)"
                :records="records"
                :class="{ 'q-mt-lg': ii > 0 }"
              />
            </div>
          </div>

          <q-btn
            v-if="mode !== 'view'"
            outline
            no-caps
            icon="add"
            label="Aggiungi esercizio"
            color="grey-5"
            class="full-width q-py-sm"
            style="border-radius: 14px"
            @click="addExercise()"
          />
        </template>
      </q-page>
    </q-page-container>

    <q-footer v-if="mode === 'live' && s">
      <TimerBar :started-at="s.startedAt" :hide-rest="settings.focusMode" @finish="finish" />
    </q-footer>
    <WorkOverlay @stop="onWorkStopped" />
    <StartSplash v-if="splash" :title="s?.title ?? ''" :subtitle="splashSub" />
  </q-layout>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, shallowRef, watch } from 'vue';
import { useQuasar } from 'quasar';
import { useRouter } from 'vue-router';
import ExerciseCard from '@/components/ExerciseCard.vue';
import ExercisePicker from '@/components/ExercisePicker.vue';
import FinishDialog from '@/components/FinishDialog.vue';
import { canRunAsRounds, roundStats } from '@/domain/rounds';
import FocusView from '@/components/FocusView.vue';
import ShareDialog from '@/components/ShareDialog.vue';
import StartSplash from '@/components/StartSplash.vue';
import type { ShareCardData } from '@/services/shareCard';
import TimerBar from '@/components/TimerBar.vue';
import WorkOverlay from '@/components/WorkOverlay.vue';
import { useRestPicker } from '@/composables/useRestPicker';
import { useWakeLock } from '@/composables/useWakeLock';
import { db } from '@/db';
import type { SessionItem } from '@/db/types';
import { compareWithLast, type ExerciseProgress } from '@/domain/compare';
import { formatClock, formatDate, formatDuration, formatKg } from '@/domain/format';
import { DIFFICULTY } from '@/domain/labels';
import { sessionRecords, type SessionRecords } from '@/domain/records';
import { lastPerformance, sessionStats } from '@/domain/session';
import { askNotificationPermission } from '@/services/feedback';
import { useExercisesStore } from '@/stores/exercises';
import { useSettingsStore } from '@/stores/settings';
import { useTimerStore } from '@/stores/timer';
import { useWorkoutStore } from '@/stores/workout';

const props = defineProps<{ id: string }>();
const $q = useQuasar();
const router = useRouter();
const workout = useWorkoutStore();
const exercises = useExercisesStore();
const timer = useTimerStore();
const settings = useSettingsStore();
const { pickRest } = useRestPicker();

const s = computed(() => workout.session);
/** Solo serie a tempo (sacco, corda…): si può fare col timer a round. */
const rounds = computed(() => (s.value ? roundStats(s.value) : { done: 0, total: 0, workSec: 0 }));
const roundsAvailable = computed(() => !!s.value && canRunAsRounds(s.value));
const editing = ref(false);
const mode = computed<'live' | 'edit' | 'view'>(() =>
  s.value?.status === 'active' ? 'live' : editing.value ? 'edit' : 'view',
);

const splash = ref(false);
const splashSub = computed(() => {
  const n = s.value?.blocks.reduce((k, b) => k + b.items.length, 0) ?? 0;
  const sets =
    s.value?.blocks.reduce((k, b) => k + b.items.reduce((m, i) => m + i.sets.length, 0), 0) ?? 0;
  return n ? `${n} esercizi · ${sets} serie` : '';
});

const lastByExercise = shallowRef(new Map<string, SessionItem>());
const records = shallowRef<SessionRecords>();
const progress = shallowRef<ExerciseProgress[]>([]);

function fmtMetric(metric: ExerciseProgress['metric'], v: number) {
  if (metric === 'e1rm') return formatKg(Math.round(v * 10) / 10);
  if (metric === 'reps') return `${Math.floor(v)} rip`;
  return formatDuration(Math.round(v));
}

// ±2% è rumore (un rip in più o in meno): lo mostriamo neutro.
const deltaClass = (d: number | null) =>
  d === null ? 'new' : d > 2 ? 'up' : d < -2 ? 'down' : 'flat';

async function loadContext() {
  const cur = s.value;
  if (!cur) return;
  const history = (await db.sessions.orderBy('date').reverse().toArray()).filter(
    (x) =>
      x.id !== cur.id &&
      x.status === 'done' &&
      (x.date < cur.date || (x.date === cur.date && (x.startedAt ?? 0) < (cur.startedAt ?? 0))),
  );
  const last = new Map<string, SessionItem>();
  for (const id of cur.exerciseIds) {
    const p = lastPerformance(history, id);
    if (p) last.set(id, p);
  }
  lastByExercise.value = last;
  if (cur.status === 'done') {
    records.value = sessionRecords(cur, history, exercises.byId);
    progress.value = compareWithLast(cur, history, exercises.byId);
  }
}

watch(
  () => props.id,
  async (id) => {
    const loaded = await workout.load(id);
    if (!loaded) return void router.replace('/');
    // sessione a round in corso: si apre il timer (dalla vista elenco si arriva con ?lista)
    if (
      loaded.mode === 'rounds' &&
      loaded.status === 'active' &&
      !router.currentRoute.value.query.lista
    )
      return void router.replace({ name: 'rounds', params: { id } });
    // allenamento appena avviato: schermata di partenza
    splash.value = loaded.status === 'active' && Date.now() - (loaded.startedAt ?? 0) < 4000;
    await loadContext();
    if (loaded.status === 'active') void askNotificationPermission();
  },
  { immediate: true },
);

// Ricalcola "ultima volta" quando si aggiunge un esercizio al volo.
watch(
  () => s.value?.exerciseIds.length,
  () => void loadContext(),
);

useWakeLock(computed(() => mode.value === 'live' && settings.keepAwake));

function findSet(key: string) {
  const [itemId, idx] = key.split(':');
  for (const [bi, b] of (s.value?.blocks ?? []).entries())
    for (const [ii, it] of b.items.entries())
      if (it.id === itemId) return { bi, ii, si: Number(idx) };
  return undefined;
}

timer.setWorkDoneHandler((key) => {
  const pos = findSet(key);
  if (pos) workout.completeSet(pos.bi, pos.ii, pos.si);
});

function onWorkStopped(result: { setKey: string; elapsedSec: number } | null) {
  const pos = result && findSet(result.setKey);
  if (!pos || result.elapsedSec < 3) return;
  $q.dialog({
    title: 'Serie interrotta',
    message: `Registrare ${formatClock(result.elapsedSec)} come fatta?`,
    cancel: { flat: true, label: 'No' },
    ok: { label: 'Sì', color: 'primary', unelevated: true },
  }).onOk(() => {
    s.value!.blocks[pos.bi]!.items[pos.ii]!.sets[pos.si]!.durationSec = result.elapsedSec;
    workout.completeSet(pos.bi, pos.ii, pos.si);
  });
}

const stats = computed(() =>
  s.value ? sessionStats(s.value, exercises.byId) : { sets: 0, volume: 0, minutes: undefined },
);

function addExercise(joinBlock?: number) {
  $q.dialog({
    component: ExercisePicker,
    componentProps: {
      title: joinBlock === undefined ? 'Aggiungi esercizio' : 'Aggiungi in superset',
    },
  }).onOk((id: string) => void workout.addExercise(id, joinBlock));
}

async function editRest(bi: number) {
  const block = s.value!.blocks[bi]!;
  const v = await pickRest(
    block.type === 'single' ? 'Recupero tra le serie' : 'Recupero dopo ogni giro',
    block.restSec,
  );
  if (typeof v === 'number') block.restSec = v;
}

function rename() {
  if (!s.value || mode.value === 'view') return;
  $q.dialog({
    title: 'Nome allenamento',
    prompt: { model: s.value.title, type: 'text' },
    cancel: { flat: true, label: 'Annulla' },
    ok: { label: 'OK', color: 'primary', unelevated: true },
  }).onOk((v: string) => (s.value!.title = v.trim() || s.value!.title));
}

function finish() {
  const sets = s.value!.blocks.flatMap((b) => b.items.flatMap((i) => i.sets));
  const pending = sets.filter((x) => !x.done).length;
  if (pending === sets.length) {
    // niente da salvare: una sessione vuota segnerebbe il giorno come fatto
    $q.dialog({
      title: 'Nessuna serie segnata',
      message: 'Spunta le serie fatte con ✓. Vuoi annullare questo allenamento?',
      cancel: { flat: true, label: 'Continua' },
      ok: { label: 'Annulla allenamento', color: 'negative', unelevated: true },
    }).onOk(() => void workout.discard().then(() => router.replace('/')));
    return;
  }
  $q.dialog({ component: FinishDialog, componentProps: { pending } }).onOk(
    (data: { difficulty?: number; notes?: string }) => void saveFinished(data),
  );
}

async function saveFinished(data: { difficulty?: number; notes?: string }) {
  await workout.finish(data);
  await loadContext();
  const n = records.value?.count ?? 0;
  $q.notify({
    message: n ? `Allenamento salvato · ${n} record battuti!` : 'Allenamento salvato',
    icon: n ? 'workspace_premium' : 'check_circle',
    color: n ? 'warning' : 'positive',
    textColor: 'dark',
    timeout: 5000,
    actions: [{ label: 'Condividi', color: 'dark', handler: openShare }],
  });
}

/** Immagine di riepilogo: numeri della sessione e dove hai spinto di più. */
function openShare() {
  const cur = s.value;
  if (!cur) return;
  // prima i miglioramenti, poi i confronti, infine gli esercizi nuovi
  const ups = progress.value.filter((p) => (p.deltaPct ?? 0) > 2);
  const compared = progress.value.filter((p) => p.deltaPct !== null);
  const picks = (ups.length ? ups : compared.length ? compared : progress.value).slice(0, 3);
  const data: ShareCardData = {
    title: cur.title,
    dateLabel: new Date(`${cur.date}T12:00`).toLocaleDateString('it-IT', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    }),
    minutes: stats.value.minutes,
    sets: stats.value.sets,
    volumeKg: stats.value.volume,
    records: records.value?.count ?? 0,
    deload: !!cur.deload,
    highlights: picks.map((p) => ({
      name: p.name,
      detail:
        p.before !== null
          ? `${fmtMetric(p.metric, p.before)} → ${fmtMetric(p.metric, p.now)}`
          : `prima volta · ${fmtMetric(p.metric, p.now)}`,
      deltaPct: p.deltaPct,
    })),
  };
  $q.dialog({
    component: ShareDialog,
    componentProps: { data, filename: `gym-${cur.date}.png` },
  });
}

async function doneEditing() {
  editing.value = false;
  // le serie aggiunte in modifica e non spuntate non sono state fatte
  workout.pruneUndone();
  await workout.flush();
  await loadContext();
}

function confirmDelete() {
  $q.dialog({
    title: mode.value === 'live' ? "Annullare l'allenamento?" : 'Eliminare la sessione?',
    message: 'Le serie registrate andranno perse.',
    cancel: { flat: true, label: 'Indietro' },
    ok: { label: 'Elimina', color: 'negative', unelevated: true },
  }).onOk(() => {
    void workout.discard().then(() => router.replace('/'));
  });
}

function goBack() {
  if (window.history.length > 1) router.back();
  else void router.replace('/');
}

onBeforeUnmount(() => {
  // il timer di una serie a tempo non deve continuare (e spuntare serie) fuori da questa pagina
  timer.stopWork();
  timer.setWorkDoneHandler(() => undefined);
  void workout.flush();
});
</script>

<style scoped lang="scss">
.wk-header {
  background: rgba(11, 12, 15, 0.92);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}
.wk-title {
  line-height: 1.2;
  font-size: 17px;
  font-weight: 700;
}
.block {
  padding: 14px 14px 10px;
}
.superset {
  border-left: 2px dotted rgba(198, 255, 61, 0.5);
  padding-left: 10px;
}
.deload-banner {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 12px;
  font-size: 13px;
  color: $info;
  background: rgba(79, 195, 247, 0.1);
  border: 1px solid rgba(79, 195, 247, 0.35);
}
.prog-row {
  padding: 6px 0;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
}
.delta {
  font-weight: 800;
  min-width: 64px;
  text-align: right;
  &.up {
    color: $primary;
  }
  &.down {
    color: $negative;
  }
  &.flat,
  &.new {
    color: rgba(255, 255, 255, 0.5);
  }
}
.stat {
  font-size: 22px;
  font-weight: 800;
}
</style>
