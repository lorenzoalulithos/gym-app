<template>
  <div class="rounds" :class="[`ph-${phase}`, { paused }]" @click="onTap">
    <!-- barra in alto -->
    <div class="top row items-center no-wrap" @click.stop>
      <q-btn flat round icon="close" aria-label="Esci" @click="leave" />
      <div class="col text-center ellipsis top-title">{{ s?.title }}</div>
      <q-btn flat round icon="view_agenda" aria-label="Vista elenco" @click="toList" />
    </div>

    <!-- prima di partire: elenco dei round -->
    <div v-if="phase === 'idle' && s" class="idle col column no-wrap">
      <div class="idle-head">
        <div class="big-title">{{ steps.length }} round</div>
        <div class="text-muted">
          {{ clock(plan.work) }} lavoro · {{ clock(plan.rest) }} pausa ·
          {{ Math.round(total / 60) }}
          min in tutto
        </div>
      </div>
      <div class="round-list col scroll" @click.stop>
        <div
          v-for="(st, i) in steps"
          :key="`${st.bi}-${st.ii}-${st.si}`"
          class="round-row row items-center no-wrap"
          :class="{ done: isDone(i) }"
          @click="editTheme(i)"
        >
          <div class="r-num">R{{ i + 1 }}</div>
          <div class="col" style="min-width: 0">
            <div class="ellipsis text-weight-bold">{{ exercises.nameItOf(st.exerciseId) }}</div>
            <div class="ellipsis r-theme" :class="{ empty: !st.theme }">
              {{ st.theme ?? 'Aggiungi un tema…' }}
            </div>
          </div>
          <div class="text-muted tabular">{{ clock(st.workSec) }}</div>
          <q-icon v-if="isDone(i)" name="check" color="primary" class="q-ml-sm" />
        </div>
      </div>
      <button type="button" class="go-btn" @click.stop="begin">
        <q-icon name="sports_mma" size="30px" />
        {{ state.idx > 0 ? `Riprendi dal round ${state.idx + 1}` : 'Inizia' }}
      </button>
    </div>

    <!-- timer -->
    <div v-else-if="phase !== 'done' && step" class="live col column items-center justify-center">
      <div class="phase-label">{{ phaseLabel }}</div>
      <div class="round-count">
        <template v-if="phase === 'rest'"
          >Prossimo: round {{ state.idx + 2 }} di {{ steps.length }}</template
        >
        <template v-else>Round {{ state.idx + 1 }} di {{ steps.length }}</template>
      </div>

      <div class="ring-wrap">
        <svg viewBox="0 0 200 200" class="ring" aria-hidden="true">
          <circle cx="100" cy="100" r="90" class="track" />
          <circle
            cx="100"
            cy="100"
            r="90"
            class="bar"
            :style="{ strokeDashoffset: String(565.5 * (1 - progress)) }"
          />
        </svg>
        <div class="time tabular" :class="{ warn: phase === 'work' && left <= 10 }">
          {{ clock(Math.ceil(left)) }}
        </div>
      </div>

      <div class="exercise">{{ exercises.nameItOf(shown?.exerciseId ?? '') }}</div>
      <div v-if="shown?.theme" :key="shown.theme" class="theme">{{ shown.theme }}</div>

      <div v-if="phase === 'work' && nextStep" class="after">
        Dopo: {{ step.restSec ? `pausa ${clock(step.restSec)}` : 'subito il prossimo' }}
        <template v-if="nextStep.theme"> → {{ nextStep.theme }}</template>
      </div>
      <div v-else-if="phase === 'work'" class="after">Ultimo round: dai tutto!</div>

      <div v-if="paused" class="paused-badge">
        <q-icon name="pause" size="28px" /> In pausa · tocca per riprendere
      </div>
    </div>

    <!-- fine -->
    <div v-else-if="phase === 'done' && s" class="done col column no-wrap" @click.stop>
      <div class="text-center q-mt-lg">
        <q-icon name="emoji_events" size="56px" color="primary" class="pop" />
        <div class="big-title q-mt-sm">Fatto!</div>
      </div>
      <div class="row q-col-gutter-sm q-mt-md text-center">
        <div class="col-6">
          <div class="card q-pa-md">
            <div class="stat tabular">{{ stats.done }}/{{ stats.total }}</div>
            <div class="text-caption text-muted">round</div>
          </div>
        </div>
        <div class="col-6">
          <div class="card q-pa-md">
            <div class="stat tabular">{{ clock(stats.workSec) }}</div>
            <div class="text-caption text-muted">di lavoro</div>
          </div>
        </div>
      </div>
      <div class="q-mt-lg text-weight-bold">Quanto è stata dura?</div>
      <div class="rpe-grid q-mt-sm">
        <button
          v-for="n in 10"
          :key="n"
          type="button"
          class="rpe"
          :class="{ on: rpe === n, [rpeTone(n)]: true }"
          @click="rpe = n"
        >
          {{ n }}
        </button>
      </div>
      <div class="text-caption text-muted q-mt-xs text-center">
        {{ rpe ? RPE_LABELS[rpeTone(rpe)] : '1 = passeggiata · 10 = non ne avevo più' }}
      </div>
      <q-input v-model="notes" outlined autogrow class="q-mt-md" label="Note (facoltative)" />
      <div class="col" />
      <q-btn
        unelevated
        no-caps
        color="primary"
        text-color="dark"
        class="full-width q-py-sm q-mt-md text-weight-bold"
        size="lg"
        :label="stats.done ? 'Salva allenamento' : 'Esci senza salvare'"
        @click="save"
      />
      <q-btn
        v-if="stats.done < stats.total"
        flat
        no-caps
        color="grey-5"
        class="full-width q-mt-sm"
        label="Continua con i round rimasti"
        @click="resume"
      />
    </div>

    <!-- comandi: piccoli, il resto dello schermo mette in pausa -->
    <div
      v-if="phase === 'ready' || phase === 'work' || phase === 'rest'"
      class="controls"
      @click.stop
    >
      <q-btn
        round
        flat
        size="lg"
        icon="replay"
        aria-label="Ricomincia il round"
        :disable="phase !== 'work'"
        @click="restartRound"
      />
      <q-btn
        round
        unelevated
        size="xl"
        class="pp"
        :icon="paused ? 'play_arrow' : 'pause'"
        :aria-label="paused ? 'Riprendi' : 'Pausa'"
        @click="togglePause"
      />
      <q-btn round flat size="lg" icon="skip_next" aria-label="Avanti" @click="skip" />
      <q-btn round flat size="lg" icon="stop" aria-label="Termina" @click="askStop" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useQuasar } from 'quasar';
import { useRouter } from 'vue-router';
import { useRoundPlayer } from '@/composables/useRoundPlayer';
import { useWakeLock } from '@/composables/useWakeLock';
import { roundStats } from '@/domain/rounds';
import { askNotificationPermission, unlockAudio } from '@/services/feedback';
import { useExercisesStore } from '@/stores/exercises';
import { useWorkoutStore } from '@/stores/workout';

const props = defineProps<{ id: string }>();
const $q = useQuasar();
const router = useRouter();
const workout = useWorkoutStore();
const exercises = useExercisesStore();

const s = computed(() => workout.session);
const {
  steps,
  state,
  step,
  nextStep,
  paused,
  left,
  progress,
  start,
  togglePause,
  skip,
  restartRound,
  stop,
} = useRoundPlayer(s);

watch(
  () => props.id,
  async (id) => {
    const loaded = await workout.load(id);
    if (!loaded) return void router.replace('/');
    if (loaded.status !== 'active') return void router.replace({ name: 'workout', params: { id } });
  },
  { immediate: true },
);

const phase = computed(() => state.value.phase);
useWakeLock(computed(() => ['ready', 'work', 'rest'].includes(phase.value)));

/** In pausa si mostra già il round che arriva. */
const shown = computed(() => (phase.value === 'rest' ? nextStep.value : step.value));
const phaseLabel = computed(
  () => ({ ready: 'Preparati', work: 'Lavoro', rest: 'Pausa', idle: '', done: '' })[phase.value],
);

const plan = computed(() => ({
  work: steps.value[0]?.workSec ?? 0,
  rest: steps.value[0]?.restSec ?? 0,
}));
const total = computed(() => steps.value.reduce((t, st) => t + st.workSec + st.restSec, 0));
const stats = computed(() => (s.value ? roundStats(s.value) : { done: 0, total: 0, workSec: 0 }));

const clock = (sec: number) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;

const isDone = (i: number) => {
  const st = steps.value[i];
  return !!st && !!s.value?.blocks[st.bi]?.items[st.ii]?.sets[st.si]?.done;
};

function begin() {
  unlockAudio();
  void askNotificationPermission();
  start();
}

function onTap() {
  if (['ready', 'work', 'rest'].includes(phase.value)) togglePause();
}

function editTheme(i: number) {
  const st = steps.value[i];
  if (!st || !s.value) return;
  const set = s.value.blocks[st.bi]!.items[st.ii]!.sets[st.si]!;
  $q.dialog({
    title: `Tema del round ${i + 1}`,
    message: 'Cosa allenare in questo round (es. ganci, schivate + contro).',
    prompt: { model: st.theme ?? '', type: 'text' },
    cancel: { flat: true, label: 'Annulla' },
    ok: { label: 'OK', color: 'primary', textColor: 'dark', unelevated: true },
  }).onOk((v: string) => {
    const theme = v.trim();
    set.target ??= {};
    if (theme) set.target.note = theme;
    else delete set.target.note;
  });
}

function askStop() {
  const wasPaused = paused.value;
  if (!wasPaused) togglePause();
  $q.dialog({
    title: 'Terminare qui?',
    message: 'I round fatti restano salvati.',
    cancel: { flat: true, label: 'Continua' },
    ok: { label: 'Termina', color: 'negative', unelevated: true },
  })
    .onOk(() => stop())
    .onCancel(() => !wasPaused && togglePause());
}

/** Dalla schermata finale si torna ai round che mancano. */
function resume() {
  state.value = { ...state.value, phase: 'idle', pausedLeft: null };
  const i = steps.value.findIndex((_, k) => !isDone(k));
  if (i !== -1) state.value.idx = i;
}

const rpe = ref<number>();
const notes = ref('');
const RPE_LABELS = {
  easy: 'Leggero: potevi andare avanti a lungo',
  mid: 'Moderato: fiato corto ma sotto controllo',
  hard: 'Duro: gli ultimi round li hai sentiti',
  max: 'Al limite: non ne avevi più',
} as const;
const rpeTone = (n: number) => (n <= 3 ? 'easy' : n <= 6 ? 'mid' : n <= 8 ? 'hard' : 'max');

async function save() {
  if (!stats.value.done) {
    await workout.discard();
    return void router.replace('/');
  }
  const data: { rpe?: number; notes?: string } = {};
  if (rpe.value) data.rpe = rpe.value;
  if (notes.value.trim()) data.notes = notes.value.trim();
  await workout.finish(data);
  $q.notify({
    message: 'Allenamento salvato',
    icon: 'check_circle',
    color: 'positive',
    textColor: 'dark',
  });
  void router.replace('/');
}

function leave() {
  if (['ready', 'work', 'rest'].includes(phase.value) && !paused.value) togglePause();
  void router.replace('/');
}

const toList = () =>
  void router.push({ name: 'workout', params: { id: props.id }, query: { lista: '1' } });
</script>

<style scoped lang="scss">
.rounds {
  position: fixed;
  inset: 0;
  display: flex;
  flex-direction: column;
  background: $dark-page;
  color: #fff;
  padding: env(safe-area-inset-top) 16px calc(16px + env(safe-area-inset-bottom));
  transition: background-color 0.5s ease;
  user-select: none;
  -webkit-tap-highlight-color: transparent;
  --accent: #{$primary};
  &.ph-ready {
    background: #2a2108;
    --accent: #{$warning};
  }
  &.ph-work {
    background: #0d2a14;
    --accent: #{$positive};
  }
  &.ph-rest {
    background: #2e0f12;
    --accent: #{$negative};
  }
  &.paused {
    filter: saturate(0.4);
  }
}
.top {
  min-height: 56px;
}
.top-title {
  font-weight: 700;
  opacity: 0.8;
}
.big-title {
  font-size: 34px;
  font-weight: 800;
  line-height: 1.1;
}
.idle-head {
  padding: 8px 4px 16px;
}
.round-list {
  margin: 0 -4px;
}
.round-row {
  gap: 12px;
  padding: 12px;
  border-radius: 14px;
  background: $dark;
  margin-bottom: 8px;
  cursor: pointer;
  &.done {
    opacity: 0.5;
  }
}
.r-num {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 800;
  background: rgba(198, 255, 61, 0.12);
  color: $primary;
}
.r-theme {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.75);
  &.empty {
    color: rgba(255, 255, 255, 0.35);
    font-style: italic;
  }
}
.go-btn {
  margin-top: 12px;
  width: 100%;
  min-height: 72px;
  border: 0;
  border-radius: 20px;
  background: $primary;
  color: $dark-page;
  font: inherit;
  font-size: 22px;
  font-weight: 800;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  cursor: pointer;
  &:active {
    transform: scale(0.97);
  }
}
.live {
  text-align: center;
  gap: 6px;
}
.phase-label {
  font-size: 40px;
  font-weight: 900;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--accent);
  line-height: 1;
}
.round-count {
  font-size: 18px;
  font-weight: 700;
  opacity: 0.85;
}
.ring-wrap {
  position: relative;
  width: min(78vw, 46vh, 340px);
  aspect-ratio: 1;
  margin: 10px 0;
}
.ring {
  width: 100%;
  height: 100%;
  transform: rotate(-90deg);
  circle {
    fill: none;
    stroke-width: 10;
  }
  .track {
    stroke: rgba(255, 255, 255, 0.1);
  }
  .bar {
    stroke: var(--accent);
    stroke-linecap: round;
    stroke-dasharray: 565.5;
    transition: stroke-dashoffset 0.2s linear;
  }
}
.time {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: min(22vw, 13vh, 96px);
  font-weight: 800;
  &.warn {
    color: $warning;
    animation: pulse 1s ease-in-out infinite;
  }
}
.exercise {
  font-size: 20px;
  font-weight: 700;
  opacity: 0.85;
}
.theme {
  font-size: 30px;
  font-weight: 800;
  line-height: 1.15;
  color: var(--accent);
  max-width: 100%;
  overflow-wrap: anywhere;
  animation: pop 0.35s ease;
}
.after {
  margin-top: 8px;
  font-size: 15px;
  opacity: 0.7;
}
.paused-badge {
  margin-top: 14px;
  padding: 10px 16px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.12);
  font-weight: 700;
  display: flex;
  align-items: center;
  gap: 8px;
}
.controls {
  display: flex;
  justify-content: space-around;
  align-items: center;
  padding-top: 8px;
  .pp {
    background: rgba(255, 255, 255, 0.14);
  }
}
.done {
  overflow-y: auto;
}
.stat {
  font-size: 28px;
  font-weight: 800;
}
.rpe-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 8px;
}
.rpe {
  height: 48px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 12px;
  background: $dark;
  color: #fff;
  font: inherit;
  font-size: 18px;
  font-weight: 800;
  cursor: pointer;
  &.on.easy {
    background: $positive;
    color: $dark-page;
  }
  &.on.mid {
    background: $primary;
    color: $dark-page;
  }
  &.on.hard {
    background: $warning;
    color: $dark-page;
  }
  &.on.max {
    background: $negative;
    color: #fff;
  }
}
@keyframes pulse {
  50% {
    opacity: 0.55;
  }
}
@keyframes pop {
  from {
    transform: scale(0.9);
    opacity: 0;
  }
}
@media (prefers-reduced-motion: reduce) {
  .time.warn,
  .theme {
    animation: none;
  }
}
</style>
