<template>
  <q-page class="page-pad stagger">
    <div class="row items-center q-mb-sm q-mt-sm">
      <q-btn flat round dense icon="chevron_left" aria-label="Mese precedente" @click="shift(-1)" />
      <div class="text-h6 text-weight-bold col text-center month-title">
        {{ formatMonth(month) }}
      </div>
      <q-btn flat round dense icon="chevron_right" aria-label="Mese successivo" @click="shift(1)" />
    </div>

    <!-- Griglia del mese -->
    <div class="grid q-mb-xs">
      <div v-for="(w, i) in ['L', 'M', 'M', 'G', 'V', 'S', 'D']" :key="i" class="wd">{{ w }}</div>
    </div>
    <div class="grid q-mb-sm">
      <button
        v-for="d in grid"
        :key="d.date"
        type="button"
        class="cell"
        :class="[
          d.status,
          { out: !d.date.startsWith(month), sel: d.date === selected, now: d.date === today },
        ]"
        @click="openDay(d.date)"
      >
        <span class="num">{{ Number(d.date.slice(8)) }}</span>
        <span class="tag">{{ tagOf(d) }}</span>
      </button>
    </div>
    <div class="legend q-mb-lg">
      <span><i class="done" />fatto</span>
      <span><i class="planned" />previsto</span>
      <span><i class="missed" />saltato</span>
      <span><i class="skipped" />annullato</span>
    </div>

    <!-- Allenamenti del mese -->
    <div class="row items-baseline q-mb-sm">
      <div class="section-label col">Allenamenti di {{ formatMonth(month) }}</div>
      <div class="text-caption text-muted">{{ monthSessions.length }}</div>
    </div>
    <div v-if="!monthSessions.length" class="text-muted q-mb-lg">Nessun allenamento.</div>
    <q-list v-else class="card" separator>
      <q-item v-for="s in monthSessions" :key="s.id" clickable class="q-py-md" @click="open(s.id)">
        <q-item-section>
          <q-item-label class="text-weight-bold">{{ s.title }}</q-item-label>
          <q-item-label caption>
            {{ formatDate(s.date) }}
            <template v-if="stats(s).minutes"> · {{ stats(s).minutes }} min</template>
            · {{ stats(s).sets }} serie
            <template v-if="stats(s).volume">
              · {{ Math.round(stats(s).volume).toLocaleString('it-IT') }} kg</template
            >
          </q-item-label>
        </q-item-section>
        <q-item-section v-if="s.status === 'active'" side>
          <q-badge color="primary" text-color="dark" label="in corso" />
        </q-item-section>
        <q-item-section v-else-if="s.difficulty" side>
          <div class="diff">
            <span v-for="i in 5" :key="i" :class="{ on: i <= s.difficulty! }" />
          </div>
        </q-item-section>
      </q-item>
    </q-list>
  </q-page>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useQuasar } from 'quasar';
import { useRouter } from 'vue-router';
import DaySheet from '@/components/DaySheet.vue';
import { useCalendar } from '@/composables/useCalendar';
import type { Session } from '@/db/types';
import { dayLetter, monthGrid, type CalendarDay } from '@/domain/calendar';
import { currentMonth, formatDate, formatMonth } from '@/domain/format';
import { useToday } from '@/composables/useToday';
import { sessionStats } from '@/domain/session';
import { useExercisesStore } from '@/stores/exercises';

const $q = useQuasar();
const router = useRouter();
const exercises = useExercisesStore();
const { input, sessions } = useCalendar();

const { today } = useToday();
const month = ref(currentMonth());
const selected = ref(today.value);

const grid = computed(() => monthGrid(month.value, input.value));

function shift(n: number) {
  const [y, m] = month.value.split('-').map(Number);
  const d = new Date(y!, m! - 1 + n, 15);
  month.value = currentMonth(d);
}

function tagOf(d: CalendarDay) {
  if (d.sessions.length) return d.planned ? dayLetter(d.program, d.planned.id) || '✓' : '✓';
  if (d.status === 'rest' || d.status === 'skipped') return '';
  return dayLetter(d.program, d.planned?.id);
}

const monthSessions = computed(() =>
  (sessions.value ?? [])
    .filter((s) => s.date.startsWith(month.value))
    .sort((a, b) => b.date.localeCompare(a.date)),
);

const cache = new WeakMap<Session, ReturnType<typeof sessionStats>>();
function stats(s: Session) {
  if (!cache.has(s)) cache.set(s, sessionStats(s, exercises.byId));
  return cache.get(s)!;
}

const open = (id: string) => void router.push({ name: 'workout', params: { id } });

function openDay(date: string) {
  selected.value = date;
  $q.dialog({ component: DaySheet, componentProps: { date } }).onOk((r?: { movedTo?: string }) => {
    if (r?.movedTo) selected.value = r.movedTo;
  });
}
</script>

<style scoped lang="scss">
.month-title {
  text-transform: capitalize;
}
.grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 4px;
}
.wd {
  text-align: center;
  font-size: 11px;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.4);
}
.cell {
  aspect-ratio: 1;
  border: 0;
  border-radius: 10px;
  background: $dark;
  color: rgba(255, 255, 255, 0.85);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1px;
  padding: 0;
  cursor: pointer;
  font: inherit;
  .num {
    font-size: 13px;
    line-height: 1;
  }
  .tag {
    font-size: 11px;
    font-weight: 800;
    min-height: 13px;
    line-height: 1;
  }
  &.out {
    opacity: 0.3;
  }
  &.done {
    background: rgba(198, 255, 61, 0.18);
    color: $primary;
  }
  &.planned,
  &.today {
    box-shadow: inset 0 0 0 1.5px rgba(255, 255, 255, 0.35);
  }
  &.today {
    box-shadow: inset 0 0 0 2px $primary;
  }
  &.missed {
    background: rgba(255, 82, 82, 0.16);
    color: $negative;
  }
  &.skipped .num {
    text-decoration: line-through;
    opacity: 0.6;
  }
  &.now .num {
    font-weight: 800;
  }
  &.sel {
    outline: 2px solid $secondary;
    outline-offset: 1px;
  }
}
.legend {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 14px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.6);
  i {
    display: inline-block;
    width: 10px;
    height: 10px;
    border-radius: 3px;
    margin-right: 5px;
    vertical-align: -1px;
  }
  .done {
    background: rgba(198, 255, 61, 0.5);
  }
  .planned {
    box-shadow: inset 0 0 0 1.5px rgba(255, 255, 255, 0.5);
  }
  .missed {
    background: rgba(255, 82, 82, 0.5);
  }
  .skipped {
    background: rgba(255, 255, 255, 0.12);
  }
}
.diff {
  display: flex;
  gap: 3px;
  span {
    width: 6px;
    height: 14px;
    border-radius: 2px;
    background: rgba(255, 255, 255, 0.12);
    &.on {
      background: $accent;
    }
  }
}
</style>
