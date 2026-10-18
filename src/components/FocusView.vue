<template>
  <div v-if="s" class="focus">
    <!-- Avanzamento -->
    <div class="row items-center q-mb-xs">
      <div class="col text-caption text-muted tabular">
        {{ doneCount }} / {{ order.length }} serie
      </div>
      <div v-if="blockLabel" class="text-caption text-weight-bold text-primary">
        {{ blockLabel }}
      </div>
    </div>
    <q-linear-progress
      :value="order.length ? doneCount / order.length : 0"
      color="primary"
      track-color="grey-9"
      rounded
      size="6px"
      class="q-mb-md"
    />

    <!-- Recupero in corso -->
    <div v-if="timer.rest" class="card rest-card q-pa-md q-mb-md text-center">
      <div class="section-label">Recupero</div>
      <div class="rest-big tabular">{{ formatClock(timer.restLeft) }}</div>
      <div class="row justify-center q-gutter-sm">
        <q-btn outline rounded no-caps label="-15" @click="timer.addRest(-15)" />
        <q-btn outline rounded no-caps label="+15" @click="timer.addRest(15)" />
        <q-btn
          unelevated
          rounded
          no-caps
          color="primary"
          text-color="dark"
          icon="skip_next"
          label="Vai"
          @click="timer.stopRest()"
        />
      </div>
    </div>

    <!-- Tutto fatto -->
    <div v-if="!cur" class="card q-pa-lg text-center">
      <div class="text-h4 q-mb-sm">🎉</div>
      <div class="text-h6">Hai finito tutte le serie</div>
      <div class="text-muted q-mb-md">Salva l'allenamento per vedere il riepilogo e i record.</div>
      <q-btn
        unelevated
        no-caps
        size="lg"
        color="primary"
        text-color="dark"
        icon="check"
        label="Salva allenamento"
        class="full-width big-btn"
        @click="emit('finish')"
      />
      <q-btn
        flat
        no-caps
        color="grey-5"
        icon="add"
        label="Aggiungi un esercizio"
        class="q-mt-sm"
        @click="emit('add')"
      />
    </div>

    <template v-else-if="ex && item && set">
      <!-- Esercizio -->
      <div class="row items-center no-wrap q-mb-sm" @click="showInfo">
        <ExerciseImage :src="ex.images" :alt="ex.name" size="84px" animate class="q-mr-md" />
        <div class="col" style="min-width: 0">
          <div class="ex-name">{{ ex.name }}</div>
          <div v-if="ex.nameIt" class="text-caption text-muted ellipsis">{{ ex.nameIt }}</div>
        </div>
      </div>

      <WarmupSuggestion :bi="cur.bi" :ii="cur.ii" />

      <div class="row items-baseline q-mb-xs">
        <div class="col text-h6">
          <template v-if="isWarmup">
            <span class="text-warning">Riscaldamento {{ cur.si + 1 }}</span>
            <span class="text-muted"> di {{ warmupCount }}</span>
          </template>
          <template v-else>
            Serie {{ cur.si - warmupCount + 1 }}
            <span class="text-muted">di {{ item.sets.length - warmupCount }}</span>
          </template>
        </div>
        <q-chip
          dense
          outline
          clickable
          icon="timer"
          color="grey-6"
          :label="restLabel"
          class="q-mr-none"
          @click="editRest"
        />
      </div>
      <div class="hints q-mb-md">
        <div v-if="set.target">
          <span class="text-muted">{{ isWarmup ? 'Obiettivo' : 'Scheda' }}</span>
          {{ formatTarget(set.target, ex) }}
        </div>
        <div v-if="lastSet">
          <span class="text-muted">Ultima volta</span> {{ formatSet(lastSet, ex) }}
        </div>
        <div v-if="item.notes" class="text-warning">{{ item.notes }}</div>
      </div>

      <!-- Valori -->
      <div class="big-fields q-gutter-y-sm">
        <NumberField
          v-if="showWeight"
          :model-value="set.weightKg"
          :step="ex.loadMode === 'total' || ex.loadMode === 'stack' ? 2.5 : 1"
          :unit="LOAD_MODES[ex.loadMode]"
          label="Carico (kg)"
          @update:model-value="(v) => patch({ weightKg: v })"
        />
        <NumberField
          v-if="showTime"
          :model-value="set.durationSec"
          :step="5"
          kind="time"
          :unit="ex.perSide ? 'tempo per lato' : 'tempo'"
          label="Durata"
          @update:model-value="(v) => patch({ durationSec: v })"
        />
        <NumberField
          v-if="showReps"
          :model-value="set.reps"
          :unit="ex.perSide ? 'ripetizioni per lato' : 'ripetizioni'"
          label="Ripetizioni"
          @update:model-value="(v) => patch({ reps: v })"
        />
      </div>

      <!-- Azioni -->
      <q-btn
        v-if="showTime && !set.done"
        unelevated
        no-caps
        size="lg"
        color="secondary"
        icon="play_arrow"
        label="Avvia timer"
        class="full-width big-btn q-mt-md"
        @click="startTimer"
      />
      <q-btn
        unelevated
        no-caps
        size="xl"
        :color="set.done ? 'grey-9' : 'primary'"
        :text-color="set.done ? 'grey-4' : 'dark'"
        :icon="set.done ? 'undo' : 'check'"
        :label="set.done ? 'Fatta · annulla' : 'Fatto'"
        class="full-width done-btn q-mt-md"
        @click="toggle"
      />

      <div class="row items-center q-mt-md">
        <q-btn
          flat
          no-caps
          color="grey-5"
          icon="chevron_left"
          label="Prec."
          :disable="index <= 0"
          @click="go(-1)"
        />
        <q-space />
        <div v-if="nextLabel" class="text-caption text-muted ellipsis next-label">
          Poi: {{ nextLabel }}
        </div>
        <q-space />
        <q-btn
          flat
          no-caps
          color="grey-5"
          icon-right="chevron_right"
          label="Succ."
          :disable="index >= order.length - 1"
          @click="go(1)"
        />
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useQuasar } from 'quasar';
import ExerciseImage from './ExerciseImage.vue';
import ExerciseInfoDialog from './ExerciseInfoDialog.vue';
import NumberField from './NumberField.vue';
import WarmupSuggestion from './WarmupSuggestion.vue';
import { useRestPicker } from '@/composables/useRestPicker';
import type { LoggedSet, SessionItem } from '@/db/types';
import { firstUndone, setOrder } from '@/domain/focus';
import { formatClock, formatSet, formatTarget } from '@/domain/format';
import { LOAD_MODES } from '@/domain/labels';
import { restAfter } from '@/domain/session';
import { unlockAudio } from '@/services/feedback';
import { useExercisesStore } from '@/stores/exercises';
import { useSettingsStore } from '@/stores/settings';
import { useTimerStore } from '@/stores/timer';
import { useWorkoutStore } from '@/stores/workout';

const props = defineProps<{ lastByExercise: Map<string, SessionItem> }>();
const emit = defineEmits<{ finish: []; add: [] }>();

const $q = useQuasar();
const workout = useWorkoutStore();
const exercises = useExercisesStore();
const timer = useTimerStore();
const settings = useSettingsStore();
const { pickRest } = useRestPicker();

const s = computed(() => workout.session);
const order = computed(() => (s.value ? setOrder(s.value) : []));
const doneCount = computed(
  () => order.value.filter((p) => s.value!.blocks[p.bi]!.items[p.ii]!.sets[p.si]!.done).length,
);

/** Serie scelta a mano con Prec./Succ.; null = segue da sola la prima non fatta. */
const manual = ref<number | null>(null);
const index = computed(() => manual.value ?? (s.value ? firstUndone(s.value, order.value) : -1));
const cur = computed(() => (index.value >= 0 ? order.value[index.value] : undefined));

// se cambiano gli esercizi (aggiunti/rimossi) l'indice manuale non è più affidabile
watch(
  () => order.value.length,
  () => (manual.value = null),
);

const block = computed(() => (cur.value ? s.value!.blocks[cur.value.bi] : undefined));
const item = computed(() => (cur.value ? block.value!.items[cur.value.ii] : undefined));
const set = computed(() => (cur.value ? item.value!.sets[cur.value.si] : undefined));
const ex = computed(() => (item.value ? exercises.get(item.value.exerciseId) : undefined));
const isWarmup = computed(() => set.value?.target?.kind === 'warmup');
const warmupCount = computed(
  () => item.value?.sets.filter((x) => x.target?.kind === 'warmup').length ?? 0,
);

const lastSet = computed(() => {
  const last = item.value ? props.lastByExercise.get(item.value.exerciseId) : undefined;
  if (!last || isWarmup.value) return undefined;
  const wi = cur.value!.si - warmupCount.value;
  return last.sets[wi] ?? last.sets.at(-1);
});

const blockLabel = computed(() => {
  const b = block.value;
  if (!b || b.type === 'single') return '';
  return `${b.type === 'superset' ? 'Superset' : 'Circuito'} · ${cur.value!.ii + 1}/${b.items.length}`;
});

const m = computed(() => ex.value?.measure);
const showWeight = computed(
  () =>
    m.value === 'weight_reps' ||
    m.value === 'weight_time' ||
    (ex.value?.loadMode === 'added' && !!set.value?.weightKg),
);
const showReps = computed(
  () => m.value === 'reps' || m.value === 'weight_reps' || m.value === 'time_reps',
);
const showTime = computed(
  () => m.value === 'time' || m.value === 'weight_time' || m.value === 'time_reps',
);

const restSec = computed(() =>
  block.value && cur.value ? restAfter(block.value, cur.value.ii, set.value?.target?.restSec) : 0,
);
const restLabel = computed(() =>
  restSec.value ? `${formatClock(restSec.value)} rec.` : 'no rec.',
);

const nextLabel = computed(() => {
  const n = order.value[index.value + 1];
  if (!n) return '';
  const it = s.value!.blocks[n.bi]!.items[n.ii]!;
  const warm = it.sets.filter((x) => x.target?.kind === 'warmup').length;
  const what = n.si < warm ? `riscaldamento ${n.si + 1}` : `serie ${n.si - warm + 1}`;
  return `${exercises.nameOf(it.exerciseId)} · ${what}`;
});

function patch(p: { [K in keyof LoggedSet]?: LoggedSet[K] | undefined }) {
  if (set.value) Object.assign(set.value, p);
}

function toggle() {
  unlockAudio();
  const c = cur.value;
  if (!c || !set.value) return;
  if (set.value.done) {
    workout.uncompleteSet(c.bi, c.ii, c.si);
    manual.value = index.value;
    return;
  }
  if (settings.vibration && 'vibrate' in navigator) navigator.vibrate(30);
  workout.completeSet(c.bi, c.ii, c.si);
  // torna a seguire la prima serie non fatta
  manual.value = null;
}

function startTimer() {
  unlockAudio();
  const c = cur.value;
  if (!c || !item.value || !set.value) return;
  const sec = set.value.durationSec ?? set.value.target?.durationSec ?? 30;
  timer.startWork(`${item.value.id}:${c.si}`, sec, ex.value?.name ?? '', settings.countdownSec);
  manual.value = null;
}

function go(dir: -1 | 1) {
  manual.value = Math.min(order.value.length - 1, Math.max(0, index.value + dir));
}

async function editRest() {
  const c = cur.value;
  if (!c) return;
  const v = await pickRest(
    `Recupero dopo ogni serie di ${ex.value?.name ?? ''}`,
    restSec.value,
    item.value?.restSec !== undefined,
  );
  if (v === undefined) return;
  workout.setItemRest(c.bi, c.ii, v === null ? undefined : v);
}

function showInfo() {
  if (ex.value)
    $q.dialog({ component: ExerciseInfoDialog, componentProps: { exerciseId: ex.value.id } });
}
</script>

<style scoped lang="scss">
.focus {
  max-width: 560px;
  margin: 0 auto;
}
.ex-name {
  font-size: 22px;
  font-weight: 800;
  line-height: 1.15;
}
.hints {
  font-size: 15px;
  line-height: 1.5;
}
.big-fields :deep(.number-field) {
  min-height: 76px;
  .nf-num {
    font-size: 34px;
  }
  .nf-unit {
    font-size: 12px;
  }
  .nf-btn {
    width: 64px;
    height: 64px;
    font-size: 22px;
  }
}
.big-btn {
  min-height: 60px;
  border-radius: 16px;
  font-weight: 800;
}
.done-btn {
  min-height: 84px;
  border-radius: 20px;
  font-size: 22px;
  font-weight: 900;
}
.rest-card {
  border: 1px solid rgba(198, 255, 61, 0.3);
}
.rest-big {
  font-size: 64px;
  font-weight: 900;
  line-height: 1;
  color: $primary;
  margin: 6px 0 12px;
}
.next-label {
  max-width: 45%;
}
</style>
