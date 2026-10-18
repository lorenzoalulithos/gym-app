<template>
  <q-dialog ref="dialogRef" position="bottom" @hide="onDialogHide">
    <q-card class="day-sheet">
      <q-card-section class="q-pb-sm">
        <div class="row items-center no-wrap">
          <div class="col">
            <div class="text-caption text-muted text-uppercase">{{ formatDate(date) }}</div>
            <div class="text-h6 ellipsis">{{ title }}</div>
            <div
              class="text-caption"
              :class="day.status === 'missed' ? 'text-negative' : 'text-muted'"
            >
              {{ statusText }}
            </div>
          </div>
          <q-btn flat round icon="close" @click="onDialogCancel" />
        </div>
      </q-card-section>

      <!-- Allenamenti fatti quel giorno -->
      <q-list v-if="day.sessions.length" class="q-px-sm">
        <q-item v-for="s in day.sessions" :key="s.id" clickable @click="openSession(s.id)">
          <q-item-section avatar><q-icon name="check_circle" color="primary" /></q-item-section>
          <q-item-section>
            <q-item-label class="text-weight-bold">{{ s.title }}</q-item-label>
            <q-item-label caption>Vedi i dettagli</q-item-label>
          </q-item-section>
          <q-item-section side><q-icon name="chevron_right" /></q-item-section>
        </q-item>
      </q-list>

      <!-- Anteprima dell'allenamento previsto -->
      <q-card-section v-else-if="day.planned" class="q-pt-none">
        <div class="preview">
          <div v-for="b in day.planned.blocks" :key="b.id" :class="{ ss: b.items.length > 1 }">
            <div v-for="it in b.items" :key="it.id" class="ellipsis">
              {{ exercises.nameOf(it.exerciseId) }}
              <span class="text-muted"
                >· {{ summarizeTargets(it.sets, exercises.get(it.exerciseId)) }}</span
              >
            </div>
          </div>
        </div>
      </q-card-section>

      <q-card-actions class="q-pa-md column items-stretch q-gutter-y-sm">
        <q-btn
          v-if="canStart"
          unelevated
          no-caps
          size="lg"
          color="primary"
          text-color="dark"
          icon="play_arrow"
          :label="date === today ? 'Inizia allenamento' : 'Fallo oggi e inizia'"
          class="text-weight-bold"
          :loading="busy"
          @click="start"
        />
        <div v-if="replacesToday" class="text-caption text-warning text-center">
          Oggi era previsto "{{ todayDay.planned?.name }}": verrà sostituito.
        </div>
        <div class="row q-gutter-sm justify-center">
          <q-btn v-if="canMove" outline no-caps icon="event" label="Sposta" @click="askMove" />
          <q-btn
            v-if="canMove"
            flat
            no-caps
            color="grey-5"
            icon="block"
            label="Salta"
            @click="skip"
          />
          <q-btn
            v-if="!day.planned && !day.sessions.length && date >= today && day.program"
            outline
            no-caps
            icon="add"
            label="Pianifica un allenamento"
            @click="askPlan"
          />
          <q-btn
            v-if="day.override"
            flat
            no-caps
            color="grey-5"
            icon="undo"
            label="Ripristina"
            @click="reset"
          />
        </div>
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useDialogPluginComponent, useQuasar } from 'quasar';
import { useRouter } from 'vue-router';
import MoveDialog from './MoveDialog.vue';
import {
  moveWorkout,
  planWorkout,
  resetDay,
  skipWorkout,
  useCalendar,
} from '@/composables/useCalendar';
import { addDays, calendarDay } from '@/domain/calendar';
import { formatDate, summarizeTargets } from '@/domain/format';
import { useToday } from '@/composables/useToday';
import { useExercisesStore } from '@/stores/exercises';
import { useWorkoutStore } from '@/stores/workout';

const props = defineProps<{ date: string }>();
defineEmits([...useDialogPluginComponent.emits]);
const { dialogRef, onDialogHide, onDialogOK, onDialogCancel } = useDialogPluginComponent();

const $q = useQuasar();
const router = useRouter();
const exercises = useExercisesStore();
const workout = useWorkoutStore();
const { input } = useCalendar();
const today = useToday().today.value;
const busy = ref(false);

const day = computed(() => calendarDay(props.date, input.value));
const todayDay = computed(() => calendarDay(today, input.value));

const title = computed(() => {
  if (day.value.sessions.length) return 'Allenamento fatto';
  if (day.value.planned) return day.value.planned.name;
  return day.value.status === 'skipped' ? 'Allenamento saltato' : 'Riposo';
});

const statusText = computed(() => {
  const o = day.value.override;
  const moved = o?.movedFrom
    ? ` · spostato da ${formatDate(o.movedFrom)}`
    : o?.movedTo
      ? `Spostato a ${formatDate(o.movedTo)}`
      : '';
  switch (day.value.status) {
    case 'missed':
      return `Non fatto${moved}`;
    case 'today':
      return `In programma oggi${moved}`;
    case 'planned':
      return `In programma${moved}`;
    default:
      return moved;
  }
});

const canStart = computed(
  () => !!day.value.planned && ['today', 'planned', 'missed'].includes(day.value.status),
);
const canMove = canStart;
const replacesToday = computed(
  () =>
    canStart.value &&
    props.date !== today &&
    !!todayDay.value.planned &&
    todayDay.value.status === 'today',
);

function openSession(id: string) {
  onDialogOK();
  void router.push({ name: 'workout', params: { id } });
}

async function start() {
  busy.value = true;
  try {
    // catturati prima dello spostamento: dopo, questa data diventa riposo
    const d = day.value.planned!;
    const program = day.value.program!;
    // con un allenamento già in corso si riapre quello, senza spostare nulla
    const running = await workout.activeId();
    if (!running && props.date !== today) await moveWorkout(day.value, today, input.value);
    const id = await workout.startFromDay(program, d);
    onDialogOK();
    void router.push({ name: 'workout', params: { id } });
  } finally {
    busy.value = false;
  }
}

function askMove() {
  const busyDates: Record<string, string> = {};
  for (let i = 0; i < 60; i++) {
    const c = calendarDay(addDays(today, i), input.value);
    if (c.date !== props.date && c.planned && c.status !== 'done')
      busyDates[c.date] = c.planned.name;
  }
  $q.dialog({
    component: MoveDialog,
    componentProps: { from: props.date, dayName: day.value.planned?.name ?? '', busy: busyDates },
  }).onOk((to: string) => void move(to));
}

async function move(to: string) {
  const name = day.value.planned?.name;
  await moveWorkout(day.value, to, input.value);
  onDialogOK({ movedTo: to });
  $q.notify({
    message: `${name} spostato a ${to === today ? 'oggi' : formatDate(to)}`,
    color: 'positive',
    textColor: 'dark',
    icon: 'event',
  });
}

async function skip() {
  await skipWorkout(day.value);
  onDialogOK();
}

async function reset() {
  await resetDay(day.value);
  onDialogOK();
}

function askPlan() {
  const p = day.value.program!;
  $q.bottomSheet({
    title: `Allenamento per ${formatDate(props.date)}`,
    dark: true,
    actions: p.days.map((d, i) => ({
      label: `${String.fromCharCode(65 + i)} · ${d.name}`,
      id: d.id,
      icon: 'fitness_center',
    })),
  }).onOk((a: { id: string }) => {
    void planWorkout(props.date, p.id, a.id).then(() => onDialogOK());
  });
}
</script>

<style scoped lang="scss">
.day-sheet {
  width: 100%;
  max-width: 640px;
  max-height: 85vh;
  border-radius: 20px 20px 0 0;
  padding-bottom: env(safe-area-inset-bottom);
}
.preview {
  font-size: 14px;
  line-height: 1.6;
  max-height: 34vh;
  overflow-y: auto;
  .ss {
    border-left: 2px dotted rgba(198, 255, 61, 0.5);
    padding-left: 8px;
    margin: 6px 0;
  }
}
</style>
