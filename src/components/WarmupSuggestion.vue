<template>
  <transition name="pop">
    <div v-if="visible" class="warmup q-pa-sm q-mb-sm">
      <div class="row items-center no-wrap">
        <q-icon name="local_fire_department" color="warning" size="20px" class="q-mr-sm" />
        <div class="col text-weight-bold">Riscaldamento suggerito</div>
      </div>
      <div class="sets tabular q-my-xs">
        <span v-for="(s, i) in sets" :key="i">{{ fmt(s.weightKg) }} × {{ s.reps }}</span>
      </div>
      <div class="text-caption text-muted">
        Rampa verso {{ fmt(workKg) }} {{ unit }}: poche ripetizioni, non deve stancare.
      </div>
      <div class="row justify-end q-gutter-sm q-mt-xs">
        <q-btn
          flat
          dense
          no-caps
          color="grey-5"
          label="No, grazie"
          @click="workout.dismissWarmup(itemId)"
        />
        <q-btn
          unelevated
          dense
          no-caps
          color="warning"
          text-color="dark"
          icon="add"
          label="Aggiungi"
          class="q-px-sm"
          @click="workout.addWarmup(bi, ii, sets)"
        />
      </div>
    </div>
  </transition>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { LOAD_MODES } from '@/domain/labels';
import { suggestWarmupFor } from '@/domain/warmup';
import { useExercisesStore } from '@/stores/exercises';
import { useSettingsStore } from '@/stores/settings';
import { useWorkoutStore } from '@/stores/workout';

const props = defineProps<{ bi: number; ii: number }>();

const workout = useWorkoutStore();
const exercises = useExercisesStore();
const settings = useSettingsStore();

const item = computed(() => workout.session?.blocks[props.bi]?.items[props.ii]);
const itemId = computed(() => item.value?.id ?? '');
const sets = computed(() =>
  workout.session ? suggestWarmupFor(workout.session, props.bi, props.ii, exercises.byId) : [],
);
const visible = computed(
  () =>
    settings.suggestWarmup &&
    workout.session?.status === 'active' &&
    sets.value.length > 0 &&
    !workout.warmupDismissed.has(itemId.value),
);
const workKg = computed(
  () => item.value?.sets.find((s) => s.target?.kind !== 'warmup')?.weightKg ?? 0,
);
const unit = computed(() => {
  const ex = item.value ? exercises.get(item.value.exerciseId) : undefined;
  return ex ? LOAD_MODES[ex.loadMode] : 'kg';
});
const fmt = (v: number | undefined) =>
  (v ?? 0).toLocaleString('it-IT', { maximumFractionDigits: 1 });
</script>

<style scoped lang="scss">
.warmup {
  border: 1px dashed rgba(255, 183, 77, 0.6);
  border-radius: 12px;
  background: rgba(255, 183, 77, 0.06);
}
.sets {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 12px;
  font-weight: 700;
}
</style>
