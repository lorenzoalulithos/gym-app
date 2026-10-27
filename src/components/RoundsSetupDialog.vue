<template>
  <q-dialog
    ref="dialogRef"
    maximized
    transition-show="slide-up"
    transition-hide="slide-down"
    @hide="onDialogHide"
  >
    <q-card class="setup column no-wrap">
      <q-toolbar class="q-px-sm">
        <q-btn flat round icon="close" aria-label="Chiudi" @click="onDialogCancel" />
        <q-toolbar-title class="text-weight-bold">Allenamento a round</q-toolbar-title>
      </q-toolbar>

      <div class="col scroll q-px-md q-pb-md">
        <!-- programmi pronti -->
        <div class="section-title">Parti da</div>
        <div class="presets">
          <button
            v-for="p in ROUND_PRESETS"
            :key="p.key"
            type="button"
            class="preset"
            :class="{ on: presetKey === p.key }"
            @click="applyPreset(p)"
          >
            <span class="p-label">{{ p.label }}</span>
            <span class="p-hint">{{ p.hint }}</span>
          </button>
        </div>

        <!-- esercizi -->
        <div class="section-title">
          Cosa fai
          <span class="text-muted text-weight-regular">· più di uno = si alternano</span>
        </div>
        <div class="chips">
          <q-chip
            v-for="id in exerciseChoices"
            :key="id"
            clickable
            :outline="!plan.exerciseIds.includes(id)"
            :color="plan.exerciseIds.includes(id) ? 'primary' : 'grey-6'"
            :text-color="plan.exerciseIds.includes(id) ? 'dark' : undefined"
            class="q-ma-none"
            @click="toggleExercise(id)"
          >
            <b v-if="plan.exerciseIds.includes(id) && plan.exerciseIds.length > 1" class="q-mr-xs">
              {{ plan.exerciseIds.indexOf(id) + 1 }}
            </b>
            {{ exercises.nameItOf(id) }}
          </q-chip>
          <q-chip
            clickable
            outline
            color="grey-6"
            icon="search"
            class="q-ma-none"
            @click="pickOther"
          >
            Altro…
          </q-chip>
        </div>

        <!-- tempi -->
        <div class="section-title">Tempi</div>
        <div class="card q-pa-sm">
          <div v-for="f in FIELDS" :key="f.key" class="stepper row items-center no-wrap">
            <div class="col">
              <div class="text-weight-bold">{{ f.label }}</div>
            </div>
            <q-btn
              flat
              round
              icon="remove"
              :aria-label="`${f.label} meno`"
              @click="bump(f.key, -f.step)"
            />
            <div class="value tabular">
              {{ f.key === 'rounds' ? plan.rounds : clock(plan[f.key]) }}
            </div>
            <q-btn
              flat
              round
              icon="add"
              :aria-label="`${f.label} più`"
              @click="bump(f.key, f.step)"
            />
          </div>
        </div>

        <!-- temi -->
        <div class="row items-center q-mt-lg q-mb-sm">
          <div class="section-title col q-ma-none">Temi per round</div>
          <q-toggle v-model="useThemes" color="primary" />
        </div>
        <template v-if="useThemes">
          <div class="text-caption text-muted q-mb-sm">
            Compaiono in grande durante il round: su cosa concentrarti.
          </div>
          <div v-for="i in plan.rounds" :key="i" class="row items-center no-wrap q-mb-xs theme-row">
            <div class="r-num">R{{ i }}</div>
            <q-input
              v-model="plan.themes[i - 1]"
              dense
              outlined
              class="col"
              :placeholder="exerciseFor(i - 1)"
            />
          </div>
          <q-btn
            flat
            no-caps
            dense
            color="primary"
            icon="auto_awesome"
            label="Proponi temi da boxe"
            class="q-mt-xs"
            @click="plan.themes = suggestThemes(plan.rounds, plan.exerciseIds)"
          />
        </template>
      </div>

      <div class="footer q-pa-md">
        <div class="text-center text-muted q-mb-sm">
          {{ plan.rounds }} round · circa {{ Math.round(totalSec(plan) / 60) }} minuti
        </div>
        <q-btn
          unelevated
          no-caps
          size="lg"
          color="primary"
          text-color="dark"
          icon="sports_mma"
          label="Vai ai round"
          class="full-width text-weight-bold"
          :disable="!plan.exerciseIds.length"
          @click="confirm"
        />
      </div>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { useDialogPluginComponent, useQuasar } from 'quasar';
import ExercisePicker from '@/components/ExercisePicker.vue';
import {
  ROUND_EXERCISES,
  ROUND_PRESETS,
  suggestThemes,
  totalSec,
  type RoundPlan,
  type RoundPreset,
} from '@/domain/rounds';
import { useExercisesStore } from '@/stores/exercises';

defineEmits([...useDialogPluginComponent.emits]);
const { dialogRef, onDialogHide, onDialogOK, onDialogCancel } = useDialogPluginComponent();
const $q = useQuasar();
const exercises = useExercisesStore();

const LAST_KEY = 'gym:rounds-plan';

function lastPlan(): (RoundPlan & { preset?: string; useThemes?: boolean }) | null {
  try {
    return JSON.parse(localStorage.getItem(LAST_KEY) ?? 'null') as RoundPlan | null;
  } catch {
    return null;
  }
}

const saved = lastPlan();
const first = ROUND_PRESETS[0]!;
const plan = reactive<RoundPlan>({
  exerciseIds: saved?.exerciseIds ?? [...first.plan.exerciseIds],
  rounds: saved?.rounds ?? first.plan.rounds,
  workSec: saved?.workSec ?? first.plan.workSec,
  restSec: saved?.restSec ?? first.plan.restSec,
  themes: saved?.themes ?? suggestThemes(first.plan.rounds),
});
const presetKey = ref<string | undefined>(saved ? saved.preset : first.key);
const useThemes = ref(saved?.useThemes ?? true);
const extra = ref<string[]>(plan.exerciseIds.filter((id) => !ROUND_EXERCISES.includes(id)));

const exerciseChoices = computed(() =>
  [...ROUND_EXERCISES, ...extra.value].filter((id) => exercises.byId.has(id)),
);

const FIELDS = [
  { key: 'workSec', label: 'Lavoro', step: 15 },
  { key: 'restSec', label: 'Pausa', step: 15 },
  { key: 'rounds', label: 'Round', step: 1 },
] as const;

const clock = (sec: number) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;

function applyPreset(p: RoundPreset) {
  presetKey.value = p.key;
  Object.assign(plan, { ...p.plan, exerciseIds: [...p.plan.exerciseIds] });
  plan.themes = suggestThemes(p.plan.rounds, p.plan.exerciseIds);
  useThemes.value = plan.themes.some(Boolean);
}

function bump(key: 'workSec' | 'restSec' | 'rounds', delta: number) {
  presetKey.value = undefined;
  if (key === 'rounds') plan.rounds = Math.min(30, Math.max(1, plan.rounds + delta));
  else {
    // fino al minuto si va di 5 secondi (tabata), oltre di 15
    const small = delta < 0 ? plan[key] <= 60 : plan[key] < 60;
    const step = (small ? 5 : 15) * Math.sign(delta);
    plan[key] = Math.min(900, Math.max(key === 'restSec' ? 0 : 5, plan[key] + step));
  }
}

function toggleExercise(id: string) {
  presetKey.value = undefined;
  const i = plan.exerciseIds.indexOf(id);
  if (i === -1) plan.exerciseIds.push(id);
  else plan.exerciseIds.splice(i, 1);
}

function pickOther() {
  $q.dialog({ component: ExercisePicker, componentProps: { title: 'Esercizio a round' } }).onOk(
    (id: string) => {
      if (!exerciseChoices.value.includes(id)) extra.value.push(id);
      if (!plan.exerciseIds.includes(id)) plan.exerciseIds.push(id);
      presetKey.value = undefined;
    },
  );
}

const exerciseFor = (r: number) =>
  exercises.nameItOf(plan.exerciseIds[r % Math.max(1, plan.exerciseIds.length)] ?? '');

function confirm() {
  const out: RoundPlan = {
    exerciseIds: [...plan.exerciseIds],
    rounds: plan.rounds,
    workSec: plan.workSec,
    restSec: plan.restSec,
    themes: useThemes.value ? plan.themes.slice(0, plan.rounds).map((t) => t ?? '') : [],
  };
  try {
    localStorage.setItem(
      LAST_KEY,
      JSON.stringify({
        ...out,
        themes: plan.themes,
        preset: presetKey.value,
        useThemes: useThemes.value,
      }),
    );
  } catch {
    /* ignorato */
  }
  onDialogOK(out);
}
</script>

<style scoped lang="scss">
.setup {
  background: $dark-page;
  max-width: 640px;
  margin: 0 auto;
}
.section-title {
  margin: 20px 0 10px;
  font-weight: 800;
  font-size: 15px;
}
.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.presets {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}
.preset {
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 14px;
  background: $dark;
  color: #fff;
  font: inherit;
  padding: 12px;
  text-align: left;
  display: flex;
  flex-direction: column;
  gap: 2px;
  cursor: pointer;
  &.on {
    border-color: $primary;
    background: rgba(198, 255, 61, 0.1);
  }
  &:active {
    transform: scale(0.97);
  }
}
.p-label {
  font-weight: 800;
}
.p-hint {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.6);
}
.stepper {
  padding: 4px 4px 4px 8px;
  & + & {
    border-top: 1px solid rgba(255, 255, 255, 0.06);
  }
}
.value {
  min-width: 64px;
  text-align: center;
  font-size: 22px;
  font-weight: 800;
}
.theme-row {
  gap: 10px;
}
.r-num {
  width: 36px;
  font-weight: 800;
  color: $primary;
}
.footer {
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  padding-bottom: calc(16px + env(safe-area-inset-bottom));
}
</style>
