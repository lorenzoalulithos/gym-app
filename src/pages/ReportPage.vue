<template>
  <q-page class="page-pad stagger">
    <div class="row items-center q-mb-sm q-mt-sm">
      <q-btn flat round icon="arrow_back" aria-label="Indietro" @click="router.back()" />
      <div class="text-h5 text-weight-bold col">Report</div>
    </div>
    <div class="row items-center q-mb-md">
      <q-btn flat round dense icon="chevron_left" aria-label="Mese precedente" @click="shift(-1)" />
      <div class="col text-center text-h6 month">{{ formatMonth(month) }}</div>
      <q-btn
        flat
        round
        dense
        icon="chevron_right"
        aria-label="Mese successivo"
        :disable="month >= currentMonthValue"
        @click="shift(1)"
      />
    </div>

    <template v-if="r">
      <!-- Numeri del mese -->
      <div class="row q-col-gutter-sm q-mb-md">
        <div class="col-4">
          <div class="card tile">
            <div class="tile-num tabular">
              {{ r.done }}<span class="tile-of">/{{ r.planned }}</span>
            </div>
            <div class="tile-label">allenamenti</div>
          </div>
        </div>
        <div class="col-4">
          <div class="card tile">
            <div class="tile-num tabular">
              {{ r.adherencePct ?? '–' }}<span class="tile-of">%</span>
            </div>
            <div class="tile-label">costanza</div>
          </div>
        </div>
        <div class="col-4">
          <div class="card tile">
            <div class="tile-num tabular text-warning">{{ r.records }}</div>
            <div class="tile-label">record</div>
          </div>
        </div>
        <div class="col-4">
          <div class="card tile">
            <div class="tile-num tabular">{{ hours }}</div>
            <div class="tile-label">in palestra</div>
          </div>
        </div>
        <div class="col-4">
          <div class="card tile">
            <div class="tile-num tabular">{{ r.sets }}</div>
            <div class="tile-label">serie</div>
          </div>
        </div>
        <div class="col-4">
          <div class="card tile">
            <div class="tile-num tabular">{{ tons(r.volume) }}</div>
            <div class="tile-label">
              volume<template v-if="volumeDelta !== null">
                ·
                <span :class="volumeDelta >= 0 ? 'text-primary' : 'text-negative'"
                  >{{ volumeDelta > 0 ? '+' : '' }}{{ volumeDelta }}%</span
                ></template
              >
            </div>
          </div>
        </div>
      </div>

      <!-- Settimane -->
      <div class="section-label q-mb-xs">Settimane</div>
      <div class="card q-pa-md q-mb-md">
        <div v-for="w in weeks" :key="w.monday" class="week-row row items-center no-wrap">
          <div class="col-auto week-label text-caption text-muted">{{ weekLabel(w.monday) }}</div>
          <div class="col dots">
            <span v-for="i in w.done" :key="'d' + i" class="dot done" />
            <span v-for="i in w.missed" :key="'m' + i" class="dot missed" />
            <span
              v-for="i in Math.max(0, w.planned - w.done - w.missed)"
              :key="'p' + i"
              class="dot planned"
            />
          </div>
          <div class="col-auto tabular text-caption">{{ w.done }}/{{ w.planned }}</div>
        </div>
        <div class="legend text-caption text-muted q-mt-sm">
          <span><i class="dot done" />fatto</span>
          <span><i class="dot missed" />saltato</span>
          <span><i class="dot planned" />previsto</span>
        </div>
      </div>

      <!-- Muscoli -->
      <template v-if="r.muscleSets.length">
        <div class="section-label q-mb-xs">Serie a settimana per muscolo</div>
        <div class="card q-pa-md q-mb-md">
          <div v-for="m in r.muscleSets" :key="m.muscle" class="bar-row">
            <div class="bar-label">{{ muscleLabel(m.muscle) }}</div>
            <div class="bar-track">
              <div class="bar" :style="{ width: `${(m.perWeek / maxSets) * 100}%` }" />
            </div>
            <div class="bar-value tabular">{{ fmt(m.perWeek) }}</div>
          </div>
          <div class="text-caption text-muted q-mt-sm">
            Media sulle settimane del mese, contando solo i muscoli principali di ogni esercizio.
            Per crescere di solito si sta tra 10 e 20 serie a settimana per muscolo.
          </div>
        </div>
      </template>

      <!-- Esercizi -->
      <template v-if="r.exercises.length">
        <div class="section-label q-mb-xs">Esercizi</div>
        <q-list v-if="shownExercises.length" class="card q-mb-sm" separator>
          <q-item
            v-for="e in shownExercises"
            :key="e.exerciseId"
            clickable
            :to="{ name: 'exercise', params: { id: e.exerciseId } }"
          >
            <q-item-section>
              <q-item-label class="ellipsis">{{ exercises.nameOf(e.exerciseId) }}</q-item-label>
              <q-item-label caption class="tabular">
                {{ fmtMetric(e.metric, e.first) }} → {{ fmtMetric(e.metric, e.last) }} ·
                {{ e.sessions }} {{ e.sessions === 1 ? 'volta' : 'volte' }}
                <template v-if="e.comparedWithPrevious"> · vs mese prima</template>
                <template v-if="stalledIds.has(e.exerciseId)">
                  · <span class="text-warning">fermo</span></template
                >
              </q-item-label>
            </q-item-section>
            <q-item-section side class="tabular text-weight-bold" :class="deltaClass(e.deltaPct)">
              {{ e.deltaPct === null ? '–' : `${e.deltaPct > 0 ? '+' : ''}${e.deltaPct}%` }}
            </q-item-section>
          </q-item>
        </q-list>
        <q-btn
          v-if="hiddenCount > 0"
          flat
          dense
          no-caps
          color="grey-5"
          :icon="showAll ? 'expand_less' : 'expand_more'"
          :label="showAll ? 'Mostra meno' : `Altri ${hiddenCount} esercizi senza confronto`"
          class="full-width q-mb-md"
          @click="showAll = !showAll"
        />
      </template>

      <!-- Corpo -->
      <div class="section-label q-mb-xs">Corpo</div>
      <div class="card q-pa-md q-mb-md">
        <div v-if="r.body.length" class="row q-col-gutter-sm">
          <div v-for="b in r.body" :key="b.field" class="col-4">
            <div class="text-caption text-muted">{{ BODY_FIELDS[b.field].label }}</div>
            <div class="text-weight-bold tabular">
              {{ fmt(b.last) }} {{ BODY_FIELDS[b.field].unit }}
            </div>
            <div v-if="b.delta !== 0" class="text-caption tabular text-secondary">
              {{ b.delta > 0 ? '+' : '' }}{{ fmt(b.delta) }}
            </div>
          </div>
        </div>
        <div v-else class="text-muted">Nessuna misurazione in questo mese.</div>
        <div v-if="photoUrls.length" class="photos q-mt-md">
          <img v-for="p in photoUrls" :key="p.id" :src="p.url" :alt="p.label" />
        </div>
        <div class="row q-gutter-sm q-mt-sm">
          <q-btn flat dense no-caps color="primary" label="Peso e misure" to="/corpo" />
          <q-btn flat dense no-caps color="secondary" label="Foto" to="/foto" />
        </div>
      </div>

      <q-btn
        outline
        no-caps
        icon="ios_share"
        label="Esporta dati per la scheda del mese dopo"
        class="full-width q-py-sm"
        style="border-radius: 14px"
        @click="exportJson"
      />
    </template>
  </q-page>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useCalendar } from '@/composables/useCalendar';
import { useLiveQuery } from '@/composables/useLiveQuery';
import { useToday } from '@/composables/useToday';
import { db } from '@/db';
import type { ExerciseProgress } from '@/domain/compare';
import { addDays } from '@/domain/calendar';
import { stalledExercises } from '@/domain/dashboard';
import { formatDuration, formatKg, formatMonth } from '@/domain/format';
import { BODY_FIELDS, POSES, muscleLabel } from '@/domain/labels';
import { monthReport } from '@/domain/report';
import { exportJson } from '@/services/backup';
import { useExercisesStore } from '@/stores/exercises';

const router = useRouter();
const exercises = useExercisesStore();
const { input, sessions } = useCalendar();
const { today, month: currentMonthRef } = useToday();
const currentMonthValue = computed(() => currentMonthRef.value);

const month = ref(
  (router.currentRoute.value.query.mese as string | undefined) ?? currentMonthRef.value,
);

function shift(n: number) {
  const [y, m] = month.value.split('-').map(Number);
  const d = new Date(y!, m! - 1 + n, 15);
  month.value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

const { data: metrics } = useLiveQuery(() => db.bodyMetrics.toArray(), [], []);
const { data: photos } = useLiveQuery(
  () => db.photos.where('month').equals(month.value).toArray(),
  [month],
  [],
);

const r = computed(() =>
  monthReport(
    month.value,
    input.value,
    sessions.value ?? [],
    exercises.byId,
    metrics.value ?? [],
    today.value,
  ),
);
const stalledIds = computed(
  () => new Set(stalledExercises(sessions.value ?? [], exercises.byId).map((s) => s.exerciseId)),
);

// settimane prima dell'inizio del tracciamento: niente da mostrare
const weeks = computed(() => r.value.weeks.filter((w) => w.planned > 0 || w.done > 0));

// prima gli esercizi con un confronto (almeno due volte, o con il mese prima)
const showAll = ref(false);
const comparable = computed(() => r.value.exercises.filter((e) => e.deltaPct !== null));
const hiddenCount = computed(() => r.value.exercises.length - comparable.value.length);
const shownExercises = computed(() => (showAll.value ? r.value.exercises : comparable.value));

const maxSets = computed(() => Math.max(20, ...r.value.muscleSets.map((m) => m.perWeek)));
const volumeDelta = computed(() =>
  r.value.prevVolume > 0
    ? Math.round(((r.value.volume - r.value.prevVolume) / r.value.prevVolume) * 100)
    : null,
);
const hours = computed(() => {
  const h = Math.floor(r.value.minutes / 60);
  const m = r.value.minutes % 60;
  return h ? `${h}h${m ? ` ${m}m` : ''}` : `${m}m`;
});

const fmt = (v: number) => v.toLocaleString('it-IT', { maximumFractionDigits: 1 });
const tons = (kg: number) =>
  kg >= 1000
    ? `${(kg / 1000).toLocaleString('it-IT', { maximumFractionDigits: 1 })} t`
    : `${Math.round(kg)} kg`;

function fmtMetric(metric: ExerciseProgress['metric'], v: number) {
  if (metric === 'e1rm') return formatKg(Math.round(v * 10) / 10);
  if (metric === 'reps') return `${Math.floor(v)} rip`;
  return formatDuration(Math.round(v));
}

const deltaClass = (d: number | null) =>
  d === null ? 'text-muted' : d > 2 ? 'text-primary' : d < -2 ? 'text-negative' : 'text-muted';

function weekLabel(monday: string) {
  const f = (iso: string) =>
    new Date(`${iso}T12:00`).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });
  return `${f(monday)} – ${f(addDays(monday, 6))}`;
}

// anteprime delle foto del mese
const photoUrls = ref<{ id: string; url: string; label: string }[]>([]);
watch(
  photos,
  (list) => {
    photoUrls.value.forEach((p) => URL.revokeObjectURL(p.url));
    const order = { front: 0, side: 1, back: 2 };
    photoUrls.value = [...(list ?? [])]
      .sort((a, b) => order[a.pose] - order[b.pose])
      .map((p) => ({ id: p.id, url: URL.createObjectURL(p.blob), label: POSES[p.pose] }));
  },
  { immediate: true },
);
onBeforeUnmount(() => photoUrls.value.forEach((p) => URL.revokeObjectURL(p.url)));
</script>

<style scoped lang="scss">
.month {
  text-transform: capitalize;
}
.tile {
  padding: 12px 10px;
  height: 100%;
}
.tile-num {
  font-size: 22px;
  font-weight: 800;
  line-height: 1.1;
}
.tile-of {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.5);
}
.tile-label {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.55);
  margin-top: 2px;
}
.week-row {
  gap: 10px;
  padding: 5px 0;
}
.week-label {
  width: 104px;
}
.dots {
  display: flex;
  gap: 5px;
}
.dot {
  display: inline-block;
  width: 12px;
  height: 12px;
  border-radius: 4px;
  &.done {
    background: $primary;
  }
  &.missed {
    background: $negative;
  }
  &.planned {
    box-shadow: inset 0 0 0 1.5px rgba(255, 255, 255, 0.4);
  }
}
.legend {
  display: flex;
  gap: 14px;
  i {
    margin-right: 5px;
    vertical-align: -1px;
    width: 10px;
    height: 10px;
  }
}
.bar-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 4px 0;
}
.bar-label {
  width: 92px;
  font-size: 13px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.bar-track {
  flex: 1;
  height: 10px;
}
.bar {
  height: 100%;
  min-width: 4px;
  background: $primary;
  border-radius: 0 4px 4px 0;
}
.bar-value {
  width: 34px;
  text-align: right;
  font-size: 13px;
  font-weight: 700;
}
.photos {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;
  img {
    width: 100%;
    aspect-ratio: 3 / 4;
    object-fit: cover;
    border-radius: 10px;
  }
}
</style>
