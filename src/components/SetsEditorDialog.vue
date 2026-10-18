<template>
  <q-dialog ref="dialogRef" position="bottom" @hide="onDialogHide">
    <q-card class="sets-card">
      <q-card-section class="row items-center">
        <div class="col">
          <div class="text-h6">{{ exercise?.name }}</div>
          <div class="text-caption text-muted">
            {{ MEASURES[measure] }} · {{ exercise ? LOAD_MODES[exercise.loadMode] : ''
            }}{{ exercise?.perSide ? ' · per lato' : '' }}
          </div>
        </div>
        <q-btn flat round icon="close" @click="onDialogCancel" />
      </q-card-section>

      <!-- Compilazione rapida: "4 × 8-10 @ 20 kg" -->
      <q-card-section class="q-pt-none">
        <div class="section-label q-mb-xs">Compila tutte</div>
        <div class="row q-col-gutter-xs items-end">
          <div class="col">
            <q-input v-model.number="quick.n" dense outlined type="number" label="Serie" />
          </div>
          <div v-if="hasReps" class="col">
            <q-input v-model="quick.reps" dense outlined label="Rip (8 o 8-10)" />
          </div>
          <div v-if="hasTime" class="col">
            <q-input v-model.number="quick.sec" dense outlined type="number" label="Sec" />
          </div>
          <div v-if="hasWeight" class="col">
            <q-input v-model.number="quick.kg" dense outlined type="number" step="0.5" label="Kg" />
          </div>
          <div class="col-auto">
            <q-btn unelevated color="secondary" icon="done_all" @click="applyQuick" />
          </div>
        </div>
      </q-card-section>

      <q-separator dark />
      <q-card-section class="sets-list">
        <div
          v-for="(t, i) in sets"
          :key="i"
          class="row q-col-gutter-xs items-center q-mb-xs no-wrap"
        >
          <div class="col-auto idx" :class="{ warm: t.kind === 'warmup' }" @click="toggleWarmup(t)">
            {{ t.kind === 'warmup' ? 'R' : i + 1 }}
          </div>
          <div v-if="hasReps" class="col">
            <q-input
              :model-value="repsText(t)"
              dense
              outlined
              label="Rip"
              @update:model-value="(v) => setReps(t, String(v ?? ''))"
            />
          </div>
          <div v-if="hasTime" class="col">
            <q-input v-model.number="t.durationSec" dense outlined type="number" label="Sec" />
          </div>
          <div v-if="hasWeight" class="col">
            <q-input
              v-model.number="t.weightKg"
              dense
              outlined
              type="number"
              step="0.5"
              label="Kg"
            />
          </div>
          <div class="col-auto">
            <q-btn flat round dense icon="close" color="grey-6" @click="sets.splice(i, 1)" />
          </div>
        </div>
        <q-btn
          flat
          no-caps
          dense
          icon="add"
          label="Serie"
          color="grey-5"
          @click="sets.push({ ...(sets.at(-1) ?? {}) })"
        />
        <div class="text-caption text-muted q-mt-sm">
          Tocca il numero per segnare una serie di riscaldamento (R).
        </div>
      </q-card-section>

      <q-card-section class="q-pt-none">
        <q-input
          v-model="notes"
          dense
          outlined
          autogrow
          label="Note per l'esercizio (tempo, tecnica, drop set…)"
        />
      </q-card-section>

      <q-card-actions align="right" class="q-pa-md">
        <q-btn unelevated no-caps color="primary" text-color="dark" label="Fatto" @click="ok" />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { useDialogPluginComponent } from 'quasar';
import type { SetTarget } from '@/db/types';
import { formatReps } from '@/domain/format';
import { LOAD_MODES, MEASURES } from '@/domain/labels';
import { useExercisesStore } from '@/stores/exercises';

const props = defineProps<{
  exerciseId: string;
  targets: SetTarget[];
  notes?: string | undefined;
}>();
defineEmits([...useDialogPluginComponent.emits]);
const { dialogRef, onDialogHide, onDialogOK, onDialogCancel } = useDialogPluginComponent();

const exercise = computed(() => useExercisesStore().get(props.exerciseId));
const measure = computed(() => exercise.value?.measure ?? 'weight_reps');
const hasReps = computed(() => ['reps', 'weight_reps', 'time_reps'].includes(measure.value));
const hasTime = computed(() => ['time', 'weight_time', 'time_reps'].includes(measure.value));
const hasWeight = computed(
  () =>
    ['weight_reps', 'weight_time'].includes(measure.value) || exercise.value?.loadMode === 'added',
);

const sets = ref<SetTarget[]>(JSON.parse(JSON.stringify(props.targets)) as SetTarget[]);
const notes = ref(props.notes ?? '');

const first = props.targets[0];
const quick = reactive({
  n: props.targets.length || 3,
  reps: first?.reps !== undefined ? formatReps(first.reps) : '',
  sec: first?.durationSec,
  kg: first?.weightKg,
});

function parseReps(v: string): SetTarget['reps'] {
  const m = v.trim().match(/^(\d+)\s*[-–]\s*(\d+)$/);
  if (m) return { min: Number(m[1]), max: Number(m[2]) };
  const n = Number(v.trim());
  return v.trim() && Number.isFinite(n) ? n : undefined;
}

const repsText = (t: SetTarget) => (t.reps === undefined ? '' : formatReps(t.reps));

function setReps(t: SetTarget, v: string) {
  const r = parseReps(v);
  if (r === undefined) delete t.reps;
  else t.reps = r;
}

function toggleWarmup(t: SetTarget) {
  t.kind = t.kind === 'warmup' ? 'normal' : 'warmup';
}

function applyQuick() {
  const t: SetTarget = {};
  const r = parseReps(String(quick.reps ?? ''));
  if (hasReps.value && r !== undefined) t.reps = r;
  if (hasTime.value && quick.sec) t.durationSec = Number(quick.sec);
  if (hasWeight.value && quick.kg) t.weightKg = Number(quick.kg);
  sets.value = Array.from({ length: Math.max(1, Number(quick.n) || 1) }, () => ({ ...t }));
}

/** Toglie i campi vuoti lasciati dagli input numerici. */
function clean(t: SetTarget): SetTarget {
  const out: SetTarget = {};
  for (const [k, v] of Object.entries(t)) {
    if (v !== '' && v !== null && v !== undefined && !(typeof v === 'number' && Number.isNaN(v)))
      (out as Record<string, unknown>)[k] = v;
  }
  if (out.kind === 'normal') delete out.kind;
  return out;
}

function ok() {
  onDialogOK({ targets: sets.value.map(clean), notes: notes.value.trim() });
}
</script>

<style scoped lang="scss">
.sets-card {
  width: 100%;
  max-width: 640px;
  max-height: 90vh;
  border-radius: 20px 20px 0 0;
}
.sets-list {
  max-height: 40vh;
  overflow-y: auto;
}
.idx {
  width: 28px;
  text-align: center;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.5);
  cursor: pointer;
  &.warm {
    color: $warning;
  }
}
</style>
