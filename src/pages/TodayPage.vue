<template>
  <q-page class="page-pad">
    <div class="q-mb-lg q-mt-sm">
      <div class="text-caption text-muted text-uppercase">{{ formatDate(today) }}</div>
      <div class="text-h4 text-weight-bold">{{ greeting }}</div>
    </div>

    <!-- Allenamento in corso -->
    <div v-if="active" class="card hero q-pa-md q-mb-md" @click="open(active.id)">
      <div class="section-label text-primary">In corso</div>
      <div class="text-h6 q-mt-xs">{{ active.title }}</div>
      <div class="text-muted">
        {{ doneSets(active) }} serie fatte · iniziato alle {{ timeOf(active.startedAt) }}
      </div>
      <q-btn
        unelevated
        color="primary"
        text-color="dark"
        no-caps
        size="lg"
        label="Riprendi"
        icon-right="play_arrow"
        class="full-width q-mt-md text-weight-bold"
      />
    </div>

    <!-- Foto del mese -->
    <div v-if="photoDue" class="card q-pa-md q-mb-md row items-center no-wrap photo-banner">
      <q-icon name="photo_camera" size="32px" color="secondary" class="q-mr-md" />
      <div class="col">
        <div class="text-weight-bold">Foto di {{ formatMonth(month) }}</div>
        <div class="text-caption text-muted">
          {{ photosThisMonth }}/3 pose · fronte, lato, schiena
        </div>
      </div>
      <q-btn
        flat
        dense
        no-caps
        color="grey-5"
        label="Dopo"
        @click.stop="settings.photoSnoozedMonth = month"
      />
      <q-btn unelevated dense no-caps color="secondary" label="Scatta" class="q-px-sm" to="/foto" />
    </div>

    <!-- Promemoria allenamenti saltati -->
    <div v-for="m in missed" :key="m.date" class="card q-pa-md q-mb-md missed-banner">
      <div class="row items-center no-wrap">
        <q-icon name="event_busy" size="28px" color="negative" class="q-mr-md" />
        <div class="col">
          <div class="text-weight-bold">Hai saltato {{ m.planned?.name }}</div>
          <div class="text-caption text-muted">{{ formatDate(m.date) }}</div>
        </div>
      </div>
      <div class="row q-gutter-sm q-mt-sm justify-end">
        <q-btn flat dense no-caps color="grey-5" label="Lascia perdere" @click="skipWorkout(m)" />
        <q-btn outline dense no-caps label="Sposta" class="q-px-sm" @click="askMove(m)" />
        <q-btn
          v-if="todayCal.status === 'rest' || todayCal.status === 'skipped'"
          unelevated
          dense
          no-caps
          color="primary"
          text-color="dark"
          label="Fallo oggi"
          class="q-px-sm"
          @click="moveWorkout(m, today, input)"
        />
      </div>
    </div>

    <!-- Prossimo giorno della scheda -->
    <template v-if="!active && program && next">
      <div class="card hero q-pa-md q-mb-md">
        <div class="row items-center">
          <div class="section-label col">{{ heroLabel }}</div>
          <q-btn
            flat
            dense
            round
            icon="swap_horiz"
            color="grey-5"
            aria-label="Scegli un altro giorno"
          >
            <q-menu auto-close>
              <q-list style="min-width: 220px">
                <q-item v-for="d in program.days" :key="d.id" clickable @click="chosenDayId = d.id">
                  <q-item-section>{{ d.name }}</q-item-section>
                  <q-item-section v-if="d.id === next.id" side
                    ><q-icon name="check" color="primary"
                  /></q-item-section>
                </q-item>
              </q-list>
            </q-menu>
          </q-btn>
        </div>
        <div class="text-h5 text-weight-bold q-mt-xs">{{ next.name }}</div>
        <div class="text-muted q-mb-sm">
          {{ next.blocks.length }} blocchi ·
          {{ next.blocks.reduce((n, b) => n + b.items.length, 0) }} esercizi
          <span v-if="lastOf(next.id)"> · ultima volta {{ relative(lastOf(next.id)!.date) }}</span>
        </div>
        <div class="ex-list">
          <div
            v-for="b in next.blocks"
            :key="b.id"
            class="ex-line"
            :class="{ ss: b.items.length > 1 }"
          >
            <div v-for="it in b.items" :key="it.id" class="ellipsis">
              {{ exercises.nameOf(it.exerciseId) }}
              <span class="text-muted">
                · {{ summarizeTargets(it.sets, exercises.get(it.exerciseId)) }}</span
              >
            </div>
          </div>
        </div>
        <q-btn
          unelevated
          color="primary"
          text-color="dark"
          no-caps
          size="lg"
          :label="isToday ? 'Inizia allenamento' : 'Allenati comunque oggi'"
          icon-right="play_arrow"
          class="full-width q-mt-md text-weight-bold"
          :loading="starting"
          @click="start"
        />
      </div>
    </template>

    <div v-else-if="!active && !program" class="card q-pa-lg q-mb-md text-center">
      <div class="text-h6">Nessuna scheda attiva</div>
      <div class="text-muted q-mb-md">Crea una scheda o allenati a corpo libero.</div>
      <q-btn
        unelevated
        color="primary"
        text-color="dark"
        no-caps
        label="Crea scheda"
        to="/schede"
      />
    </div>

    <q-btn
      v-if="!active"
      outline
      no-caps
      color="grey-5"
      icon="add"
      label="Allenamento libero"
      class="full-width q-py-sm q-mb-lg"
      style="border-radius: 14px"
      @click="startFree"
    />

    <!-- Settimana -->
    <div class="section-label q-mb-sm">Questa settimana</div>
    <div class="row q-col-gutter-sm q-mb-lg">
      <div v-for="d in week" :key="d.date" class="col">
        <div
          class="day-dot"
          :class="[d.status, { today: d.date === today }]"
          @click="router.push('/calendario')"
        >
          <div class="text-caption">{{ d.label }}</div>
          <div class="dot-tag">{{ d.tag }}</div>
        </div>
      </div>
    </div>

    <div v-if="recent.length" class="section-label q-mb-sm">Ultimi allenamenti</div>
    <q-list class="card" separator>
      <q-item v-for="r in recent" :key="r.id" clickable @click="open(r.id)">
        <q-item-section>
          <q-item-label class="text-weight-bold">{{ r.title }}</q-item-label>
          <q-item-label caption>{{ formatDate(r.date) }}</q-item-label>
        </q-item-section>
        <q-item-section side><q-icon name="chevron_right" /></q-item-section>
      </q-item>
    </q-list>
  </q-page>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useQuasar } from 'quasar';
import MoveDialog from '@/components/MoveDialog.vue';
import { moveWorkout, skipWorkout, useCalendar } from '@/composables/useCalendar';
import { useLiveQuery } from '@/composables/useLiveQuery';
import { db } from '@/db';
import type { Session } from '@/db/types';
import { formatDate, formatMonth, summarizeTargets } from '@/domain/format';
import { useToday } from '@/composables/useToday';
import {
  addDays,
  calendarDay,
  dayLetter,
  isoWeekday,
  nextPlanned,
  recentMissed,
  type CalendarDay,
} from '@/domain/calendar';
import { activeProgram, nextDay } from '@/domain/session';
import { useExercisesStore } from '@/stores/exercises';
import { useSettingsStore } from '@/stores/settings';
import { useWorkoutStore } from '@/stores/workout';

const router = useRouter();
const $q = useQuasar();
const { input } = useCalendar();
const exercises = useExercisesStore();
const settings = useSettingsStore();
const workout = useWorkoutStore();

const { today, month } = useToday();

const hour = new Date().getHours();
const greeting = hour < 12 ? 'Buongiorno 💪' : hour < 18 ? 'Si spinge? 🔥' : 'Ultimo sforzo 🌙';

const { data: sessions } = useLiveQuery(
  () => db.sessions.orderBy('date').reverse().toArray(),
  [],
  [],
);
const { data: programs } = useLiveQuery(() => db.programs.toArray(), [], []);
const { data: photosThisMonthData } = useLiveQuery(
  () => db.photos.where('month').equals(month.value).toArray(),
  [month],
  [],
);

const active = computed(() => sessions.value?.find((s) => s.status === 'active'));
const done = computed(() => (sessions.value ?? []).filter((s) => s.status === 'done'));
const program = computed(() => activeProgram(programs.value ?? [], today.value));
const chosenDayId = ref<string>();

const todayCal = computed(() => calendarDay(today.value, input.value));
const upcoming = computed(() =>
  nextPlanned(
    input.value,
    todayCal.value.status === 'done' ? addDays(today.value, 1) : today.value,
  ),
);
const missed = computed(() => recentMissed(input.value));

const next = computed(() => {
  const p = program.value;
  if (!p) return undefined;
  return (
    p.days.find((d) => d.id === chosenDayId.value) ??
    upcoming.value?.planned ??
    nextDay(p, done.value)
  );
});
const isToday = computed(
  () =>
    !chosenDayId.value &&
    todayCal.value.status === 'today' &&
    todayCal.value.planned?.id === next.value?.id,
);
const heroLabel = computed(() => {
  if (chosenDayId.value) return 'Scelto da te';
  if (isToday.value) return `Oggi · ${program.value?.name ?? ''}`;
  const when = upcoming.value ? formatDate(upcoming.value.date) : '';
  const prefix = todayCal.value.status === 'done' ? 'Fatto oggi ✓' : 'Oggi riposo';
  return when ? `${prefix} · prossimo ${when}` : prefix;
});

function askMove(d: CalendarDay) {
  const busy: Record<string, string> = {};
  for (let i = 0; i < 60; i++) {
    const c = calendarDay(addDays(today.value, i), input.value);
    if (c.planned && c.status !== 'done') busy[c.date] = c.planned.name;
  }
  $q.dialog({
    component: MoveDialog,
    componentProps: { from: d.date, dayName: d.planned?.name ?? '', busy },
  }).onOk((to: string) => void moveWorkout(d, to, input.value));
}
const recent = computed(() => done.value.slice(0, 3));

const photosThisMonth = computed(() => new Set(photosThisMonthData.value?.map((p) => p.pose)).size);
const photoDue = computed(
  () => photosThisMonth.value < 3 && settings.photoSnoozedMonth !== month.value,
);

const lastOf = (dayId: string) => done.value.find((s) => s.dayId === dayId);

const week = computed(() => {
  const monday = addDays(today.value, -(isoWeekday(today.value) - 1));
  return ['L', 'M', 'M', 'G', 'V', 'S', 'D'].map((label, i) => {
    const c = calendarDay(addDays(monday, i), input.value);
    const tag =
      c.status === 'done'
        ? '✓'
        : c.planned && c.status !== 'skipped'
          ? dayLetter(c.program, c.planned.id)
          : '·';
    return { label, date: c.date, status: c.status, tag };
  });
});

const doneSets = (s: Session) =>
  s.blocks.reduce(
    (n, b) => n + b.items.reduce((m, i) => m + i.sets.filter((x) => x.done).length, 0),
    0,
  );

const timeOf = (t?: number) =>
  t ? new Date(t).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }) : '';

function relative(iso: string) {
  const days = Math.round(
    (new Date(`${today.value}T12:00`).getTime() - new Date(`${iso}T12:00`).getTime()) / 86400000,
  );
  return days === 0 ? 'oggi' : days === 1 ? 'ieri' : `${days} giorni fa`;
}

const open = (id: string) => void router.push({ name: 'workout', params: { id } });

const starting = ref(false);
async function start() {
  const p = program.value;
  const day = next.value;
  if (!p || !day) return;
  starting.value = true;
  try {
    // allenarsi in un giorno di riposo "anticipa" il prossimo allenamento previsto
    const up = upcoming.value;
    if (!chosenDayId.value && up && up.date !== today.value && up.planned?.id === day.id) {
      await moveWorkout(up, today.value, input.value);
    }
    open(await workout.startFromDay(p, day));
  } finally {
    starting.value = false;
  }
}

async function startFree() {
  open(await workout.startEmpty());
}
</script>

<style scoped lang="scss">
.hero {
  background: linear-gradient(160deg, #1c2114 0%, $dark 55%);
  border: 1px solid rgba(198, 255, 61, 0.15);
}
.photo-banner {
  border: 1px solid rgba(124, 92, 255, 0.35);
}
.ex-list {
  font-size: 14px;
  line-height: 1.6;
}
.ex-line.ss {
  border-left: 2px dotted rgba(198, 255, 61, 0.5);
  padding-left: 8px;
  margin: 6px 0;
}
.missed-banner {
  border: 1px solid rgba(255, 82, 82, 0.35);
}
.dot-tag {
  font-weight: 800;
  font-size: 15px;
  line-height: 18px;
}
.day-dot {
  background: $dark;
  border-radius: 12px;
  text-align: center;
  padding: 6px 0;
  color: rgba(255, 255, 255, 0.35);
  &.done {
    background: rgba(198, 255, 61, 0.15);
    color: $primary;
  }
  &.planned,
  &.today {
    color: rgba(255, 255, 255, 0.85);
  }
  &.missed {
    background: rgba(255, 82, 82, 0.15);
    color: $negative;
  }
  &.today {
    outline: 1px solid rgba(255, 255, 255, 0.3);
  }
}
</style>
