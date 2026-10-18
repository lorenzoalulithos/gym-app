<template>
  <q-page v-if="program && day" class="page-pad">
    <div class="row items-center q-mb-sm">
      <q-btn
        flat
        round
        icon="arrow_back"
        aria-label="Indietro"
        @click="router.push({ name: 'program', params: { id: programId } })"
      />
      <div class="text-caption text-muted ellipsis col">{{ program.name }}</div>
    </div>
    <q-input v-model="day.name" outlined label="Nome giorno" class="q-mb-lg" />

    <div v-for="(b, bi) in day.blocks" :key="b.id" class="card q-pa-md q-mb-md">
      <div class="row items-center q-mb-sm no-wrap">
        <q-btn-toggle
          v-model="b.type"
          dense
          no-caps
          unelevated
          toggle-color="primary"
          toggle-text-color="dark"
          color="grey-9"
          :options="[
            { label: 'Singolo', value: 'single' },
            { label: 'Superset', value: 'superset' },
            { label: 'Circuito', value: 'circuit' },
          ]"
        />
        <q-space />
        <q-chip
          v-if="b.type !== 'single'"
          dense
          outline
          clickable
          icon="timer"
          color="grey-6"
          :label="`${formatClock(b.restSec)} dopo il giro`"
          @click="editRest(b)"
        />
        <q-btn flat round dense icon="more_vert" color="grey-6">
          <q-menu auto-close>
            <q-list style="min-width: 180px">
              <q-item clickable @click="addTo(bi)"
                ><q-item-section>Aggiungi esercizio al blocco</q-item-section></q-item
              >
              <q-item clickable :disable="bi === 0" @click="move(bi, -1)"
                ><q-item-section>Sposta su</q-item-section></q-item
              >
              <q-item clickable :disable="bi === day.blocks.length - 1" @click="move(bi, 1)"
                ><q-item-section>Sposta giù</q-item-section></q-item
              >
              <q-item clickable class="text-negative" @click="day.blocks.splice(bi, 1)"
                ><q-item-section>Elimina blocco</q-item-section></q-item
              >
            </q-list>
          </q-menu>
        </q-btn>
      </div>

      <div :class="{ superset: b.items.length > 1 }">
        <div
          v-for="(it, ii) in b.items"
          :key="it.id"
          class="row items-center no-wrap q-py-xs item"
          @click="editSets(bi, ii)"
        >
          <ExerciseImage
            :src="exercises.get(it.exerciseId)?.images ?? []"
            size="44px"
            class="q-mr-sm"
          />
          <div class="col" style="min-width: 0">
            <div class="text-weight-bold ellipsis">{{ exercises.nameOf(it.exerciseId) }}</div>
            <div class="text-caption text-muted ellipsis">
              {{ summarizeTargets(it.sets, exercises.get(it.exerciseId)) }}
            </div>
            <div v-if="it.notes" class="text-caption text-warning ellipsis">{{ it.notes }}</div>
          </div>
          <q-chip
            dense
            outline
            clickable
            icon="timer"
            :color="it.restSec !== undefined ? 'primary' : 'grey-6'"
            :label="restAfter(b, ii) ? formatClock(restAfter(b, ii)) : 'no rec.'"
            @click.stop="editItemRest(b, ii)"
          />
          <q-btn flat round dense icon="close" color="grey-7" @click.stop="removeItem(bi, ii)" />
        </div>
      </div>
    </div>

    <q-btn
      outline
      no-caps
      icon="add"
      label="Aggiungi esercizio"
      color="grey-5"
      class="full-width q-py-sm"
      style="border-radius: 14px"
      @click="addTo()"
    />
  </q-page>
</template>

<script setup lang="ts">
import { computed, toRef } from 'vue';
import { useQuasar } from 'quasar';
import { useRouter } from 'vue-router';
import ExerciseImage from '@/components/ExerciseImage.vue';
import ExercisePicker from '@/components/ExercisePicker.vue';
import SetsEditorDialog from '@/components/SetsEditorDialog.vue';
import { useEditableProgram } from '@/composables/useEditableProgram';
import { newId } from '@/db';
import type { Block, SetTarget } from '@/db/types';
import { formatClock, summarizeTargets } from '@/domain/format';
import { restAfter } from '@/domain/session';
import { useRestPicker } from '@/composables/useRestPicker';
import { useExercisesStore } from '@/stores/exercises';
import { useSettingsStore } from '@/stores/settings';

const props = defineProps<{ programId: string; dayId: string }>();
const $q = useQuasar();
const router = useRouter();
const exercises = useExercisesStore();
const settings = useSettingsStore();
const { pickRest } = useRestPicker();
const program = useEditableProgram(toRef(props, 'programId'));
const day = computed(() => program.value?.days.find((d) => d.id === props.dayId));

function addTo(bi?: number) {
  $q.dialog({ component: ExercisePicker }).onOk((exerciseId: string) => {
    const d = day.value!;
    const ex = exercises.get(exerciseId);
    const defaultSet: SetTarget =
      ex?.measure === 'time' || ex?.measure === 'weight_time' ? { durationSec: 30 } : { reps: 10 };
    const item = {
      id: newId(),
      exerciseId,
      sets: [{ ...defaultSet }, { ...defaultSet }, { ...defaultSet }],
    };
    if (bi !== undefined) {
      const b = d.blocks[bi]!;
      b.items.push(item);
      if (b.type === 'single') b.type = 'superset';
    } else {
      d.blocks.push({
        id: newId(),
        type: 'single',
        restSec: settings.defaultRestSec,
        items: [item],
      });
    }
    editSets(bi ?? d.blocks.length - 1, bi !== undefined ? d.blocks[bi]!.items.length - 1 : 0);
  });
}

function editSets(bi: number, ii: number) {
  const it = day.value!.blocks[bi]!.items[ii]!;
  $q.dialog({
    component: SetsEditorDialog,
    componentProps: { exerciseId: it.exerciseId, targets: it.sets, notes: it.notes },
  }).onOk(({ targets, notes }: { targets: SetTarget[]; notes: string }) => {
    it.sets = targets;
    if (notes) it.notes = notes;
    else delete it.notes;
  });
}

function removeItem(bi: number, ii: number) {
  const b = day.value!.blocks[bi]!;
  b.items.splice(ii, 1);
  if (!b.items.length) day.value!.blocks.splice(bi, 1);
  else if (b.items.length === 1) b.type = 'single';
}

function move(bi: number, dir: -1 | 1) {
  const blocks = day.value!.blocks;
  [blocks[bi], blocks[bi + dir]] = [blocks[bi + dir]!, blocks[bi]!];
}

async function editRest(b: Block) {
  const v = await pickRest('Recupero dopo ogni giro', b.restSec);
  if (typeof v === 'number') b.restSec = v;
}

async function editItemRest(b: Block, ii: number) {
  const it = b.items[ii]!;
  const v = await pickRest(
    `Recupero dopo ogni serie di ${exercises.nameOf(it.exerciseId)}`,
    restAfter(b, ii),
    it.restSec !== undefined,
  );
  if (v === undefined) return;
  if (v === null) delete it.restSec;
  else if (b.type === 'single') {
    // in un blocco singolo il recupero dell'esercizio è quello del blocco
    b.restSec = v;
    delete it.restSec;
  } else it.restSec = v;
}
</script>

<style scoped lang="scss">
.superset {
  border-left: 2px dotted rgba(198, 255, 61, 0.5);
  padding-left: 10px;
}
.item {
  cursor: pointer;
}
</style>
