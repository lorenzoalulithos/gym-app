<template>
  <q-page v-if="program" class="page-pad">
    <div class="row items-center q-mb-sm">
      <q-btn flat round icon="arrow_back" aria-label="Indietro" @click="router.push('/schede')" />
      <div class="text-caption text-muted">Le modifiche si salvano da sole</div>
    </div>

    <q-input v-model="program.name" outlined label="Nome scheda" class="q-mb-sm" />
    <div class="row q-col-gutter-sm q-mb-sm">
      <div class="col-6">
        <q-input
          v-model="program.startDate"
          outlined
          dense
          type="date"
          label="Inizio"
          stack-label
        />
      </div>
      <div class="col-6">
        <q-input
          :model-value="program.endDate ?? ''"
          outlined
          dense
          type="date"
          label="Fine"
          stack-label
          @update:model-value="(v) => setEnd(String(v ?? ''))"
        />
      </div>
    </div>
    <q-input v-model="program.notes" outlined dense autogrow label="Note" class="q-mb-lg" />

    <div class="section-label q-mb-xs">Giorni della scheda</div>
    <div class="text-caption text-muted q-mb-sm">
      Il giorno della settimana decide cosa compare nel calendario.
    </div>
    <div
      v-for="(d, di) in program.days"
      :key="d.id"
      class="card q-pa-md q-mb-sm row items-center no-wrap"
      @click="openDay(d.id)"
    >
      <div class="col" style="min-width: 0">
        <div class="text-weight-bold ellipsis">
          <span class="text-primary">{{ String.fromCharCode(65 + di) }}</span> · {{ d.name }}
        </div>
        <div class="text-caption text-muted ellipsis">
          {{
            d.blocks
              .flatMap((b) => b.items)
              .map((i) => exercises.nameOf(i.exerciseId))
              .join(', ') || 'Vuoto'
          }}
        </div>
      </div>
      <q-btn
        flat
        dense
        no-caps
        :color="d.weekday ? 'primary' : 'grey-6'"
        :label="d.weekday ? WEEKDAYS[d.weekday - 1]!.slice(0, 3) : 'Giorno?'"
        icon="event"
        class="q-mr-xs"
        @click.stop="pickWeekday(di)"
      />
      <q-btn flat round dense icon="more_vert" color="grey-6" @click.stop>
        <q-menu auto-close>
          <q-list style="min-width: 180px">
            <q-item clickable @click="renameDay(di)"
              ><q-item-section>Rinomina</q-item-section></q-item
            >
            <q-item clickable :disable="di === 0" @click="move(di, -1)"
              ><q-item-section>Sposta su</q-item-section></q-item
            >
            <q-item clickable :disable="di === program.days.length - 1" @click="move(di, 1)"
              ><q-item-section>Sposta giù</q-item-section></q-item
            >
            <q-item clickable @click="duplicateDay(di)"
              ><q-item-section>Duplica</q-item-section></q-item
            >
            <q-item clickable class="text-negative" @click="program.days.splice(di, 1)"
              ><q-item-section>Elimina</q-item-section></q-item
            >
          </q-list>
        </q-menu>
      </q-btn>
    </div>
    <q-btn
      outline
      no-caps
      icon="add"
      label="Aggiungi giorno"
      color="grey-5"
      class="full-width q-py-sm"
      style="border-radius: 14px"
      @click="addDay"
    />
  </q-page>
</template>

<script setup lang="ts">
import { toRef } from 'vue';
import { useQuasar } from 'quasar';
import { useRouter } from 'vue-router';
import { useEditableProgram } from '@/composables/useEditableProgram';
import { newId } from '@/db';
import type { ProgramDay } from '@/db/types';
import { useExercisesStore } from '@/stores/exercises';

const props = defineProps<{ id: string }>();
const $q = useQuasar();
const router = useRouter();
const exercises = useExercisesStore();
const program = useEditableProgram(toRef(props, 'id'));

const openDay = (dayId: string) =>
  void router.push({ name: 'day', params: { programId: props.id, dayId } });

function setEnd(v: string) {
  if (!program.value) return;
  if (v) program.value.endDate = v;
  else delete program.value.endDate;
}

function addDay() {
  const days = program.value!.days;
  const letter = String.fromCharCode(65 + days.length);
  days.push({ id: newId(), name: `Giorno ${letter}`, blocks: [] });
}

const WEEKDAYS = ['lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato', 'domenica'];

/** Giorno della settimana fisso: è quello che usa il calendario. */
function pickWeekday(di: number) {
  const d = program.value!.days[di]!;
  $q.bottomSheet({
    title: `Quando fai "${d.name}"?`,
    dark: true,
    actions: [
      ...WEEKDAYS.map((label, i) => ({
        label,
        id: String(i + 1),
        icon: d.weekday === i + 1 ? 'check' : 'event',
      })),
      { label: 'Nessun giorno fisso', id: '0', icon: 'event_busy' },
    ],
  }).onOk((a: { id: string }) => {
    const n = Number(a.id);
    if (n) d.weekday = n;
    else delete d.weekday;
  });
}

function renameDay(di: number) {
  const d = program.value!.days[di]!;
  $q.dialog({
    title: 'Nome giorno',
    prompt: { model: d.name, type: 'text' },
    cancel: { flat: true, label: 'Annulla' },
    ok: { label: 'OK', color: 'primary', unelevated: true },
  }).onOk((v: string) => (d.name = v.trim() || d.name));
}

function move(di: number, dir: -1 | 1) {
  const days = program.value!.days;
  [days[di], days[di + dir]] = [days[di + dir]!, days[di]!];
}

function duplicateDay(di: number) {
  const copy = JSON.parse(JSON.stringify(program.value!.days[di])) as ProgramDay;
  copy.id = newId();
  copy.name += ' (copia)';
  for (const b of copy.blocks) {
    b.id = newId();
    for (const i of b.items) i.id = newId();
  }
  program.value!.days.splice(di + 1, 0, copy);
}
</script>
