<template>
  <div v-if="item" class="item-row">
    <div class="row items-center no-wrap">
      <ExerciseImage
        :src="ex?.images ?? []"
        :alt="ex?.name"
        size="40px"
        class="q-mr-sm"
        @click="info"
      />
      <div class="col" style="min-width: 0" @click="info">
        <div class="text-weight-bold ellipsis">{{ ex?.name ?? item.exerciseId }}</div>
        <div v-if="ex?.nameIt || item.notes" class="text-caption text-muted ellipsis">
          {{ [ex?.nameIt, item.notes].filter(Boolean).join(' · ') }}
        </div>
      </div>
      <q-btn flat round dense icon="more_vert" color="grey-6">
        <q-menu auto-close>
          <q-list style="min-width: 220px">
            <q-item-label header>Schema veloce</q-item-label>
            <div class="presets q-px-md q-pb-sm">
              <q-chip
                v-for="pr in PRESETS"
                :key="pr.label"
                clickable
                dense
                outline
                color="primary"
                @click="applyPreset(item, pr)"
              >
                {{ pr.label }}
              </q-chip>
            </div>
            <q-separator dark />
            <q-item clickable @click="editSets">
              <q-item-section avatar><q-icon name="tune" /></q-item-section>
              <q-item-section>Serie una per una (piramidi…)</q-item-section>
            </q-item>
            <q-item clickable @click="editNotes">
              <q-item-section avatar><q-icon name="sticky_note_2" /></q-item-section>
              <q-item-section>Note</q-item-section>
            </q-item>
            <q-item v-if="canLink" clickable @click="emit('link')">
              <q-item-section avatar><q-icon name="link" /></q-item-section>
              <q-item-section>Superset con il successivo</q-item-section>
            </q-item>
            <q-item v-if="inSuperset" clickable @click="emit('unlink')">
              <q-item-section avatar><q-icon name="link_off" /></q-item-section>
              <q-item-section>Togli dal superset</q-item-section>
            </q-item>
            <q-item clickable @click="emit('replace')">
              <q-item-section avatar><q-icon name="swap_horiz" /></q-item-section>
              <q-item-section>Sostituisci esercizio</q-item-section>
            </q-item>
            <q-item clickable @click="emit('duplicate')">
              <q-item-section avatar><q-icon name="content_copy" /></q-item-section>
              <q-item-section>Duplica</q-item-section>
            </q-item>
            <q-item clickable class="text-negative" @click="emit('remove')">
              <q-item-section avatar><q-icon name="delete" /></q-item-section>
              <q-item-section>Elimina</q-item-section>
            </q-item>
          </q-list>
        </q-menu>
      </q-btn>
    </div>

    <!-- serie, ripetizioni, carico, recupero: modificabili direttamente -->
    <div v-if="uniform" class="fields">
      <div class="stepper">
        <button type="button" aria-label="Una serie in meno" @click="setCount(item, count - 1)">
          −
        </button>
        <span class="tabular"
          ><b>{{ count }}</b> serie</span
        >
        <button type="button" aria-label="Una serie in più" @click="setCount(item, count + 1)">
          +
        </button>
      </div>
      <q-input
        :model-value="reps"
        dense
        outlined
        class="f-reps"
        :label="isTime ? 'tempo' : 'ripetizioni'"
        :error="repsError"
        hide-bottom-space
        @update:model-value="onReps"
        @blur="commitReps"
        @keyup.enter="commitReps"
      />
      <q-input
        v-if="showWeight"
        :model-value="weight"
        dense
        outlined
        type="number"
        inputmode="decimal"
        class="f-kg"
        label="kg"
        @update:model-value="
          (v) => applyWeight(item!, v === '' || v === null ? undefined : Number(v))
        "
      />
    </div>
    <div v-else class="q-mt-xs">
      <q-chip clickable dense outline color="warning" icon="tune" @click="editSets">
        {{ summarizeTargets(item.sets, ex) }}
      </q-chip>
    </div>
    <div v-if="showRest" class="q-mt-xs">
      <q-chip
        dense
        outline
        clickable
        icon="timer"
        :color="item.restSec !== undefined ? 'primary' : 'grey-6'"
        :label="restSec ? `${formatClock(restSec)} di recupero` : 'nessun recupero'"
        class="q-ml-none"
        @click="emit('rest')"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useQuasar } from 'quasar';
import ExerciseImage from '../ExerciseImage.vue';
import ExerciseInfoDialog from '../ExerciseInfoDialog.vue';
import SetsEditorDialog from '../SetsEditorDialog.vue';
import type { Block, SetTarget } from '@/db/types';
import { formatClock, summarizeTargets } from '@/domain/format';
import {
  PRESETS,
  applyPreset,
  applyRepsText,
  applyWeight,
  isUniform,
  repsText,
  setCount,
} from '@/domain/programEdit';
import { restAfter } from '@/domain/session';
import { useExercisesStore } from '@/stores/exercises';

const props = defineProps<{ block: Block; ii: number; canLink: boolean }>();
const emit = defineEmits<{
  link: [];
  unlink: [];
  replace: [];
  duplicate: [];
  remove: [];
  rest: [];
}>();

const $q = useQuasar();
const exercises = useExercisesStore();

// l'oggetto item è quello della scheda (reattiva): lo si modifica direttamente
const item = computed(() => props.block.items[props.ii]);
const ex = computed(() => (item.value ? exercises.get(item.value.exerciseId) : undefined));
const work = computed(() => item.value?.sets.filter((s) => s.kind !== 'warmup') ?? []);
const count = computed(() => work.value.length);
const uniform = computed(() => (item.value ? isUniform(item.value.sets) : true));
const isTime = computed(() => !!work.value[0]?.durationSec);
const inSuperset = computed(() => props.block.items.length > 1);
const showWeight = computed(
  () =>
    ex.value?.measure === 'weight_reps' ||
    ex.value?.measure === 'weight_time' ||
    (ex.value?.loadMode === 'added' && !!work.value[0]?.weightKg),
);
const weight = computed(() => work.value[0]?.weightKg ?? '');
const restSec = computed(() => restAfter(props.block, props.ii));
// nei superset il recupero si mostra sull'ultimo esercizio (fine giro) o se ne ha uno proprio
const showRest = computed(
  () =>
    !inSuperset.value ||
    props.ii === props.block.items.length - 1 ||
    item.value?.restSec !== undefined,
);

const reps = ref('');
const repsError = ref(false);
watch(
  () => (item.value ? repsText(item.value.sets) : ''),
  (v) => (reps.value = v),
  { immediate: true },
);

/** Si applica mentre si scrive (se il valore è valido): nulla si perde uscendo dalla pagina. */
function onReps(v: string | number | null) {
  reps.value = String(v ?? '');
  if (item.value && applyRepsText(item.value, reps.value)) repsError.value = false;
}

function commitReps() {
  if (!item.value) return;
  if (reps.value.trim() === repsText(item.value.sets)) return;
  repsError.value = !applyRepsText(item.value, reps.value);
}

function editSets() {
  const it = item.value!;
  $q.dialog({
    component: SetsEditorDialog,
    componentProps: { exerciseId: it.exerciseId, targets: it.sets, notes: it.notes },
  }).onOk(({ targets, notes }: { targets: SetTarget[]; notes: string }) => {
    it.sets = targets;
    if (notes) it.notes = notes;
    else delete it.notes;
  });
}

function editNotes() {
  const it = item.value!;
  $q.dialog({
    title: 'Note',
    message: 'Tecnica, tempo sotto tensione, regolazioni della macchina…',
    prompt: { model: it.notes ?? '', type: 'textarea' },
    cancel: { flat: true, label: 'Annulla' },
    ok: { label: 'OK', color: 'primary', textColor: 'dark', unelevated: true },
  }).onOk((v: string) => {
    if (v.trim()) it.notes = v.trim();
    else delete it.notes;
  });
}

function info() {
  if (ex.value)
    $q.dialog({ component: ExerciseInfoDialog, componentProps: { exerciseId: ex.value.id } });
}
</script>

<style scoped lang="scss">
.item-row {
  padding: 8px 0;
}
.fields {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
}
.stepper {
  display: flex;
  align-items: center;
  background: rgba(255, 255, 255, 0.06);
  border-radius: 10px;
  height: 40px;
  flex: none;
  button {
    width: 36px;
    height: 40px;
    border: 0;
    background: none;
    color: rgba(255, 255, 255, 0.8);
    font-size: 20px;
    cursor: pointer;
  }
  span {
    font-size: 13px;
    min-width: 54px;
    text-align: center;
  }
}
.f-reps {
  flex: 1;
  min-width: 70px;
}
.f-kg {
  width: 82px;
  flex: none;
}
.presets {
  display: flex;
  flex-wrap: wrap;
  max-width: 280px;
}
</style>
