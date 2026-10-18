<template>
  <div class="ex-card">
    <div class="row items-center no-wrap q-gutter-x-md">
      <ExerciseImage
        :src="exercise?.images ?? []"
        :alt="exercise?.name"
        size="52px"
        class="cursor-pointer"
        @click="showInfo"
      />
      <div class="col" style="min-width: 0" @click="showInfo">
        <div class="ex-name ellipsis-2-lines">{{ exercise?.name ?? item.exerciseId }}</div>
        <div v-if="exercise?.nameIt" class="text-caption text-muted ellipsis">
          {{ exercise.nameIt }}
        </div>
      </div>
      <div v-if="mode !== 'view'" class="col-auto">
        <q-chip
          dense
          outline
          clickable
          icon="timer"
          :color="item.restSec !== undefined ? 'primary' : 'grey-6'"
          :label="restLabel"
          class="q-mr-none"
          @click.stop="editRest"
        />
      </div>
      <q-btn v-if="mode !== 'view'" flat round dense icon="more_vert" color="grey-6">
        <q-menu auto-close>
          <q-list style="min-width: 200px">
            <q-item clickable @click="workout.addSet(bi, ii)">
              <q-item-section avatar><q-icon name="add" /></q-item-section>
              <q-item-section>Aggiungi serie</q-item-section>
            </q-item>
            <q-item
              v-if="exercise?.loadMode === 'added'"
              clickable
              @click="forceWeight = !forceWeight"
            >
              <q-item-section avatar><q-icon name="fitness_center" /></q-item-section>
              <q-item-section>{{
                forceWeight ? 'Nascondi zavorra' : 'Aggiungi zavorra'
              }}</q-item-section>
            </q-item>
            <q-item clickable @click="showInfo">
              <q-item-section avatar><q-icon name="info" /></q-item-section>
              <q-item-section>Info esercizio</q-item-section>
            </q-item>
            <q-item clickable class="text-negative" @click="confirmRemove">
              <q-item-section avatar><q-icon name="delete" /></q-item-section>
              <q-item-section>Rimuovi esercizio</q-item-section>
            </q-item>
          </q-list>
        </q-menu>
      </q-btn>
    </div>

    <div v-if="mode !== 'view' && (targetSummary || lastSummary)" class="hints q-mt-sm">
      <div v-if="targetSummary"><span class="text-muted">Scheda</span> {{ targetSummary }}</div>
      <div v-if="lastSummary"><span class="text-muted">Ultima volta</span> {{ lastSummary }}</div>
      <q-chip
        v-if="suggestion"
        dense
        square
        color="primary"
        text-color="dark"
        icon="trending_up"
        class="q-ml-none q-mt-xs"
        :label="`Hai chiuso tutte le serie: prova +${suggestion} kg`"
      />
    </div>
    <div v-if="item.notes" class="text-caption text-warning q-mt-xs">{{ item.notes }}</div>

    <WarmupSuggestion v-if="mode === 'live'" :bi="bi" :ii="ii" class="q-mt-sm" />

    <div class="q-mt-sm">
      <template v-if="exercise">
        <SetRow
          v-for="(set, si) in item.sets"
          :key="si"
          :set="set"
          :index="si"
          :exercise="exercise"
          :mode="mode"
          :force-weight="forceWeight"
          :pb-kinds="records?.sets.get(`${item.id}:${si}`)"
          @update="(patch) => Object.assign(item.sets[si]!, patch)"
          @toggle="toggle(si)"
          @start-timer="startTimer(si)"
          @menu="setMenu(si)"
        />
      </template>
      <div v-if="mode === 'view' && records?.volume.has(item.id)" class="text-caption text-warning">
        <q-icon name="workspace_premium" /> Record di volume
      </div>
      <q-btn
        v-if="mode !== 'view'"
        flat
        dense
        no-caps
        icon="add"
        label="Serie"
        color="grey-5"
        class="q-mt-xs"
        @click="workout.addSet(bi, ii)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useQuasar } from 'quasar';
import ExerciseImage from './ExerciseImage.vue';
import SetRow from './SetRow.vue';
import WarmupSuggestion from './WarmupSuggestion.vue';
import ExerciseInfoDialog from './ExerciseInfoDialog.vue';
import type { SessionItem, SetTarget } from '@/db/types';
import { formatSet, summarizeTargets } from '@/domain/format';
import type { SessionRecords } from '@/domain/records';
import { restAfter, suggestIncrease } from '@/domain/session';
import { formatClock } from '@/domain/format';
import { useRestPicker } from '@/composables/useRestPicker';
import { useExercisesStore } from '@/stores/exercises';
import { useSettingsStore } from '@/stores/settings';
import { useTimerStore } from '@/stores/timer';
import { useWorkoutStore } from '@/stores/workout';
import { unlockAudio } from '@/services/feedback';

const props = defineProps<{
  item: SessionItem;
  bi: number;
  ii: number;
  mode: 'live' | 'edit' | 'view';
  last?: SessionItem | undefined;
  records?: SessionRecords | undefined;
}>();

const $q = useQuasar();
const exercises = useExercisesStore();
const workout = useWorkoutStore();
const timer = useTimerStore();
const settings = useSettingsStore();

const exercise = computed(() => exercises.get(props.item.exerciseId));
const { pickRest } = useRestPicker();

const block = computed(() => workout.session?.blocks[props.bi]);
const restSec = computed(() => (block.value ? restAfter(block.value, props.ii) : 0));
const restLabel = computed(() => (restSec.value ? formatClock(restSec.value) : 'no rec.'));

async function editRest() {
  const v = await pickRest(
    `Recupero dopo ogni serie di ${exercise.value?.name ?? ''}`,
    restSec.value,
    props.item.restSec !== undefined,
  );
  if (v === undefined) return;
  workout.setItemRest(props.bi, props.ii, v === null ? undefined : v);
}
const forceWeight = ref(false);

// il riscaldamento non fa parte della scheda né del suggerimento di carico
const targets = computed(() =>
  props.item.sets
    .map((s) => s.target)
    .filter((t): t is SetTarget => t !== undefined && t.kind !== 'warmup'),
);
const targetSummary = computed(() =>
  targets.value.length ? summarizeTargets(targets.value, exercise.value) : '',
);
const lastSummary = computed(() =>
  props.last ? props.last.sets.map((s) => formatSet(s, exercise.value)).join(' · ') : '',
);
const suggestion = computed(() =>
  exercise.value && props.mode === 'live'
    ? suggestIncrease(exercise.value, targets.value, props.last)
    : undefined,
);

function toggle(si: number) {
  unlockAudio();
  const set = props.item.sets[si]!;
  if (set.done) return workout.uncompleteSet(props.bi, props.ii, si);
  if (settings.vibration && 'vibrate' in navigator) navigator.vibrate(30);
  workout.completeSet(props.bi, props.ii, si);
}

function startTimer(si: number) {
  unlockAudio();
  const set = props.item.sets[si]!;
  const sec = set.durationSec ?? set.target?.durationSec ?? 30;
  timer.startWork(`${props.item.id}:${si}`, sec, exercise.value?.name ?? '', settings.countdownSec);
}

function setMenu(si: number) {
  const set = props.item.sets[si]!;
  $q.bottomSheet({
    title: `Serie ${si + 1}`,
    dark: true,
    actions: [
      {
        label:
          set.target?.kind === 'warmup' ? 'Segna come serie normale' : 'Segna come riscaldamento',
        icon: 'local_fire_department',
        id: 'warmup',
      },
      { label: 'Duplica serie', icon: 'content_copy', id: 'dup' },
      { label: 'Elimina serie', icon: 'delete', id: 'del', classes: 'text-negative' },
    ],
  }).onOk((a: { id: string }) => {
    if (a.id === 'warmup') {
      set.target = { ...set.target, kind: set.target?.kind === 'warmup' ? 'normal' : 'warmup' };
    } else if (a.id === 'dup') {
      workout.duplicateSet(props.bi, props.ii, si);
    } else if (a.id === 'del') {
      workout.removeSet(props.bi, props.ii, si);
    }
  });
}

function showInfo() {
  if (!exercise.value) return;
  $q.dialog({ component: ExerciseInfoDialog, componentProps: { exerciseId: exercise.value.id } });
}

function confirmRemove() {
  $q.dialog({
    title: "Rimuovere l'esercizio?",
    message: exercise.value?.name ?? '',
    cancel: { flat: true, label: 'Annulla' },
    ok: { label: 'Rimuovi', color: 'negative', unelevated: true },
  }).onOk(() => workout.removeItem(props.bi, props.ii));
}
</script>

<style scoped lang="scss">
.ex-name {
  font-size: 17px;
  font-weight: 700;
  line-height: 1.2;
}
.hints {
  font-size: 13px;
  line-height: 1.5;
}
</style>
