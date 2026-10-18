<template>
  <div v-if="mode === 'view'" class="set-row view">
    <span class="idx">{{ index + 1 }}</span>
    <span class="col tabular">{{ formatSet(set, exercise) }}</span>
    <q-icon
      v-for="k in pbKinds ?? []"
      :key="k"
      name="workspace_premium"
      color="warning"
      size="18px"
    >
      <q-tooltip>{{ PB_LABELS[k] }}</q-tooltip>
    </q-icon>
    <span v-if="e1rm" class="e1rm tabular">{{ e1rm }}</span>
  </div>

  <div v-else class="set-row" :class="{ done: set.done, warmup: set.target?.kind === 'warmup' }">
    <button class="idx-btn" type="button" @click="emit('menu')">
      {{ set.target?.kind === 'warmup' ? 'R' : index + 1 }}
    </button>

    <div class="fields">
      <NumberField
        v-if="showWeight"
        :model-value="set.weightKg"
        :step="weightStep"
        :unit="LOAD_MODES[exercise.loadMode]"
        label="Carico (kg)"
        @update:model-value="(v) => emit('update', { weightKg: v })"
      />
      <NumberField
        v-if="showTime"
        :model-value="set.durationSec"
        :step="5"
        kind="time"
        :unit="exercise.perSide ? 'tempo /lato' : 'tempo'"
        label="Durata"
        @update:model-value="(v) => emit('update', { durationSec: v })"
      />
      <NumberField
        v-if="showReps"
        :model-value="set.reps"
        :unit="repsUnit"
        label="Ripetizioni"
        @update:model-value="(v) => emit('update', { reps: v })"
      />
    </div>

    <q-btn
      v-if="mode === 'live' && showTime && !set.done"
      round
      unelevated
      color="secondary"
      icon="play_arrow"
      class="action"
      aria-label="Avvia timer serie"
      @click="emit('start-timer')"
    />
    <q-btn
      round
      unelevated
      :color="set.done ? 'primary' : 'grey-9'"
      :text-color="set.done ? 'dark' : 'grey-5'"
      icon="check"
      class="action"
      :aria-label="set.done ? 'Segna come non fatta' : 'Segna come fatta'"
      @click="emit('toggle')"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import NumberField from './NumberField.vue';
import type { Exercise, LoggedSet } from '@/db/types';
import { epley } from '@/domain/e1rm';
import { formatReps, formatSet } from '@/domain/format';
import { LOAD_MODES } from '@/domain/labels';
import { PB_LABELS, type PbKind } from '@/domain/records';

const props = defineProps<{
  set: LoggedSet;
  index: number;
  exercise: Exercise;
  mode: 'live' | 'edit' | 'view';
  pbKinds?: PbKind[] | undefined;
  /** Mostra il carico anche per esercizi a corpo libero (zavorra). */
  forceWeight?: boolean;
}>();

const emit = defineEmits<{
  update: [patch: { [K in keyof LoggedSet]?: LoggedSet[K] | undefined }];
  toggle: [];
  'start-timer': [];
  menu: [];
}>();

const m = computed(() => props.exercise.measure);
const showWeight = computed(
  () =>
    m.value === 'weight_reps' ||
    m.value === 'weight_time' ||
    (props.exercise.loadMode === 'added' && (props.forceWeight || !!props.set.weightKg)),
);
const showReps = computed(
  () => m.value === 'reps' || m.value === 'weight_reps' || m.value === 'time_reps',
);
const showTime = computed(
  () => m.value === 'time' || m.value === 'weight_time' || m.value === 'time_reps',
);

const repsUnit = computed(() => {
  const t = props.set.target?.reps;
  const base = props.exercise.perSide ? 'rip /lato' : 'rip';
  return t !== undefined && typeof t !== 'number' ? `${base} (${formatReps(t)})` : base;
});

const weightStep = computed(() =>
  props.exercise.loadMode === 'total' || props.exercise.loadMode === 'stack' ? 2.5 : 1,
);

const e1rm = computed(() => {
  if (m.value !== 'weight_reps' || !props.set.weightKg || !props.set.reps) return 0;
  return Math.round(epley(props.set.weightKg, props.set.reps));
});
</script>

<style scoped lang="scss">
.set-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 0;
  transition: opacity 0.2s;
  &.done .fields {
    opacity: 0.55;
  }
  &.warmup .idx-btn {
    color: $warning;
  }
  &.view {
    padding: 4px 0;
    font-size: 16px;
  }
}
.idx,
.idx-btn {
  width: 28px;
  flex: none;
  text-align: center;
  color: rgba(255, 255, 255, 0.5);
  font-weight: 700;
}
.idx-btn {
  background: none;
  border: 0;
  padding: 8px 0;
  font-size: 15px;
}
.fields {
  flex: 1;
  display: flex;
  gap: 6px;
  min-width: 0;
  > * {
    flex: 1;
  }
}
.action {
  flex: none;
  width: 48px;
  height: 48px;
}
.e1rm {
  color: rgba(255, 255, 255, 0.5);
  min-width: 36px;
  text-align: right;
}
</style>
