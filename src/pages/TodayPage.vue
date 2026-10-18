<template>
  <q-page class="page-pad home">
    <!-- Data, serie di settimane e settimana in corso -->
    <div class="row items-center q-mt-xs q-mb-sm">
      <div class="col text-caption text-muted text-uppercase text-weight-bold">
        {{ formatDate(today) }}
      </div>
      <div v-if="streak > 0" class="streak" @click="router.push('/calendario')">
        🔥 {{ streak }} {{ streak === 1 ? 'settimana' : 'settimane' }}
      </div>
    </div>
    <div class="week q-mb-md" @click="router.push('/calendario')">
      <div
        v-for="d in week"
        :key="d.date"
        class="day-dot"
        :class="[d.status, { today: d.date === today }]"
      >
        <div class="wd">{{ d.label }}</div>
        <div class="dot-tag">{{ d.tag }}</div>
      </div>
    </div>

    <!-- Allenamento in corso -->
    <div v-if="active" class="card hero q-pa-md q-mb-md" @click="open(active.id)">
      <div class="section-label text-primary">In corso</div>
      <div class="text-h5 text-weight-bold q-mt-xs">{{ active.title }}</div>
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
        icon="play_arrow"
        class="full-width q-mt-md cta"
      />
    </div>

    <!-- Prossimo allenamento -->
    <div v-else-if="program && next" class="card hero q-pa-md q-mb-md">
      <div class="row items-center no-wrap">
        <div class="section-label col ellipsis">{{ heroLabel }}</div>
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
              <q-item
                v-for="(d, i) in program.days"
                :key="d.id"
                clickable
                @click="chosenDayId = d.id"
              >
                <q-item-section avatar class="text-primary text-weight-bold">{{
                  String.fromCharCode(65 + i)
                }}</q-item-section>
                <q-item-section>{{ d.name }}</q-item-section>
                <q-item-section v-if="d.id === next.id" side
                  ><q-icon name="check" color="primary"
                /></q-item-section>
              </q-item>
            </q-list>
          </q-menu>
        </q-btn>
      </div>
      <div class="text-h5 text-weight-bold">{{ next.name }}</div>
      <div class="text-muted q-mt-xs">
        {{ exerciseCount }} esercizi · ~{{ estMinutes }} min<template
          v-if="isToday || !upcoming || upcoming.date === today"
        >
          · fine ~{{ endTime }}</template
        >
      </div>
      <div v-if="muscles.length" class="q-mt-sm">
        <q-chip
          v-for="m in muscles"
          :key="m"
          dense
          color="primary"
          text-color="dark"
          class="q-ml-none q-mr-xs"
        >
          {{ muscleLabel(m) }}
        </q-chip>
      </div>
      <div v-if="lastOfNext" class="text-caption text-muted q-mt-xs">
        Ultima volta {{ relative(lastOfNext.date) }}
        <template v-if="lastRecords">
          · <span class="text-warning">{{ lastRecords }} record</span></template
        >
      </div>

      <q-slide-transition>
        <div v-show="showList" class="ex-list q-mt-sm">
          <div
            v-for="b in next.blocks"
            :key="b.id"
            class="ex-line"
            :class="{ ss: b.items.length > 1 }"
          >
            <div v-for="it in b.items" :key="it.id" class="ellipsis">
              {{ exercises.nameOf(it.exerciseId) }}
              <span class="text-muted"
                >· {{ summarizeTargets(it.sets, exercises.get(it.exerciseId)) }}</span
              >
            </div>
          </div>
        </div>
      </q-slide-transition>
      <q-btn
        flat
        dense
        no-caps
        color="grey-5"
        class="q-mt-xs q-px-none"
        :icon="showList ? 'expand_less' : 'expand_more'"
        :label="showList ? 'Nascondi esercizi' : 'Vedi esercizi'"
        @click="showList = !showList"
      />

      <q-btn
        unelevated
        color="primary"
        text-color="dark"
        no-caps
        size="lg"
        :label="isToday ? 'Inizia allenamento' : 'Allenati oggi'"
        icon="play_arrow"
        class="full-width q-mt-sm cta"
        :loading="starting"
        @click="start"
      />
    </div>

    <div v-else-if="!program" class="card q-pa-lg q-mb-md text-center">
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

    <!-- Da fare -->
    <template v-if="missed.length || photoDue">
      <div class="section-label q-mb-xs">Da fare</div>
      <div class="card todo q-mb-md">
        <div v-for="m in missed" :key="m.date" class="todo-row">
          <q-icon name="event_busy" color="negative" size="22px" />
          <div class="col" style="min-width: 0">
            <div class="ellipsis text-weight-medium">Saltato: {{ m.planned?.name }}</div>
            <div class="text-caption text-muted">{{ formatDate(m.date) }}</div>
          </div>
          <q-btn
            v-if="todayCal.status === 'rest' || todayCal.status === 'skipped'"
            unelevated
            dense
            no-caps
            color="primary"
            text-color="dark"
            label="Oggi"
            class="q-px-sm"
            @click="moveWorkout(m, today, input)"
          />
          <q-btn flat dense round icon="more_vert" color="grey-5">
            <q-menu auto-close>
              <q-list style="min-width: 180px">
                <q-item clickable @click="askMove(m)"
                  ><q-item-section>Sposta…</q-item-section></q-item
                >
                <q-item clickable @click="skipWorkout(m)"
                  ><q-item-section>Lascia perdere</q-item-section></q-item
                >
              </q-list>
            </q-menu>
          </q-btn>
        </div>
        <div v-if="photoDue" class="todo-row">
          <q-icon name="photo_camera" color="secondary" size="22px" />
          <div class="col" style="min-width: 0">
            <div class="ellipsis text-weight-medium">Foto di {{ formatMonth(month) }}</div>
            <div class="text-caption text-muted">{{ photosThisMonth }}/3 pose</div>
          </div>
          <q-btn
            unelevated
            dense
            no-caps
            color="secondary"
            label="Scatta"
            class="q-px-sm"
            to="/foto"
          />
          <q-btn
            flat
            dense
            round
            icon="close"
            color="grey-5"
            aria-label="Rimanda"
            @click="settings.photoSnoozedMonth = month"
          />
        </div>
      </div>
    </template>

    <!-- Il mese -->
    <div class="row items-center q-mb-xs">
      <div class="section-label col">{{ monthName }}</div>
      <q-btn
        flat
        dense
        no-caps
        color="primary"
        label="Report"
        icon-right="chevron_right"
        to="/report"
      />
    </div>
    <div class="row q-col-gutter-sm q-mb-md">
      <div class="col-4">
        <div class="card stat-tile" @click="router.push('/calendario')">
          <div class="stat-num tabular">
            {{ stats.done }}<span class="stat-of">/{{ stats.planned }}</span>
          </div>
          <div class="stat-label">allenamenti</div>
        </div>
      </div>
      <div class="col-4">
        <div class="card stat-tile">
          <div class="stat-num tabular" :class="deltaColor(stats.volumeDeltaPct)">
            {{
              stats.volumeDeltaPct === null
                ? fmtTons(stats.volume)
                : `${stats.volumeDeltaPct > 0 ? '+' : ''}${stats.volumeDeltaPct}%`
            }}
          </div>
          <div class="stat-label">
            {{ stats.volumeDeltaPct === null ? 'volume' : 'volume vs mese prima' }}
          </div>
        </div>
      </div>
      <div class="col-4">
        <div class="card stat-tile" @click="router.push('/corpo')">
          <template v-if="weight">
            <div class="stat-num tabular">{{ weight.weightKg.toLocaleString('it-IT') }}</div>
            <div class="stat-label">
              kg<template v-if="weight.deltaKg !== null">
                · {{ weight.deltaKg > 0 ? '+' : '' }}{{ weight.deltaKg.toLocaleString('it-IT') }} in
                30 gg</template
              >
            </div>
          </template>
          <template v-else>
            <div class="stat-num text-muted">–</div>
            <div class="stat-label">peso · aggiungi</div>
          </template>
        </div>
      </div>
    </div>

    <!-- Record recenti -->
    <template v-if="records.length">
      <div class="section-label q-mb-xs">Ultimi record</div>
      <q-list class="card q-mb-md">
        <q-item
          v-for="r in records.slice(0, 4)"
          :key="r.exerciseId"
          clickable
          :to="{ name: 'exercise', params: { id: r.exerciseId } }"
        >
          <q-item-section avatar
            ><q-icon name="workspace_premium" color="warning"
          /></q-item-section>
          <q-item-section>
            <q-item-label class="ellipsis">{{ exercises.nameOf(r.exerciseId) }}</q-item-label>
            <q-item-label caption>{{ pbText(r.kinds) }} · {{ shortDate(r.date) }}</q-item-label>
          </q-item-section>
          <q-item-section side class="tabular text-weight-bold">{{ r.label }}</q-item-section>
        </q-item>
      </q-list>
    </template>

    <!-- Esercizi fermi -->
    <template v-if="stalled.length">
      <div class="section-label q-mb-xs">Fermi da un po'</div>
      <q-list class="card q-mb-md">
        <q-item
          v-for="st in stalled.slice(0, 4)"
          :key="st.exerciseId"
          clickable
          :to="{ name: 'exercise', params: { id: st.exerciseId } }"
        >
          <q-item-section avatar><q-icon name="pause_circle" color="grey-5" /></q-item-section>
          <q-item-section>
            <q-item-label class="ellipsis">{{ exercises.nameOf(st.exerciseId) }}</q-item-label>
            <q-item-label caption>nessun miglioramento dal {{ shortDate(st.since) }}</q-item-label>
          </q-item-section>
        </q-item>
      </q-list>
    </template>

    <q-btn
      v-if="!active"
      flat
      no-caps
      color="grey-5"
      icon="add"
      label="Allenamento libero"
      class="full-width q-py-sm"
      @click="startFree"
    />
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
import {
  estimateMinutes,
  focusMuscles,
  monthStats,
  recentRecords,
  stalledExercises,
  weekStreak,
  weightTrend,
} from '@/domain/dashboard';
import { muscleLabel } from '@/domain/labels';
import { PB_LABELS, type PbKind } from '@/domain/records';
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

const photosThisMonth = computed(() => new Set(photosThisMonthData.value?.map((p) => p.pose)).size);
const photoDue = computed(
  () => photosThisMonth.value < 3 && settings.photoSnoozedMonth !== month.value,
);

const lastOf = (dayId: string) => done.value.find((s) => s.dayId === dayId);

// --- riquadro principale
const showList = ref(false);
const exerciseCount = computed(
  () => next.value?.blocks.reduce((n, b) => n + b.items.length, 0) ?? 0,
);
const estMinutes = computed(() => (next.value ? estimateMinutes(next.value, done.value) : 0));
const endTime = computed(() =>
  new Date(Date.now() + estMinutes.value * 60000).toLocaleTimeString('it-IT', {
    hour: '2-digit',
    minute: '2-digit',
  }),
);
const muscles = computed(() => (next.value ? focusMuscles(next.value, exercises.byId) : []));
const lastOfNext = computed(() => (next.value ? lastOf(next.value.id) : undefined));
const records = computed(() => recentRecords(done.value, exercises.byId, today.value));
const lastRecords = computed(
  () => records.value.filter((r) => r.sessionId === lastOfNext.value?.id).length,
);

// --- mese, costanza, progressi
const streak = computed(() => weekStreak(input.value, today.value));
const stats = computed(() => monthStats(input.value, done.value, exercises.byId, today.value));
const stalled = computed(() => stalledExercises(done.value, exercises.byId));
const { data: metrics } = useLiveQuery(() => db.bodyMetrics.toArray(), [], []);
const weight = computed(() => weightTrend(metrics.value ?? [], today.value));
const monthName = computed(() => formatMonth(month.value));

const fmtTons = (kg: number) =>
  kg >= 1000
    ? `${(kg / 1000).toLocaleString('it-IT', { maximumFractionDigits: 1 })} t`
    : `${Math.round(kg)} kg`;
const deltaColor = (d: number | null) =>
  d === null ? '' : d > 0 ? 'text-primary' : d < 0 ? 'text-negative' : '';
const pbText = (kinds: PbKind[]) => kinds.map((k) => PB_LABELS[k]).join(' · ');
const shortDate = (iso: string) =>
  new Date(`${iso}T12:00`).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });

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
  background: linear-gradient(160deg, #1c2114 0%, $dark 60%);
  border: 1px solid rgba(198, 255, 61, 0.15);
}
.cta {
  font-weight: 800;
  border-radius: 14px;
  min-height: 56px;
}
.streak {
  font-size: 13px;
  font-weight: 800;
  color: $warning;
  cursor: pointer;
}
.week {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 6px;
  cursor: pointer;
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
.todo {
  padding: 4px 12px;
}
.todo-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 0;
  & + & {
    border-top: 1px solid rgba(255, 255, 255, 0.06);
  }
}
.stat-tile {
  padding: 12px 10px;
  height: 100%;
}
.stat-num {
  font-size: 22px;
  font-weight: 800;
  line-height: 1.1;
}
.stat-of {
  font-size: 15px;
  color: rgba(255, 255, 255, 0.5);
}
.stat-label {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.55);
  margin-top: 2px;
}
.wd {
  font-size: 11px;
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
    outline: 1.5px solid rgba(255, 255, 255, 0.45);
  }
}
</style>
