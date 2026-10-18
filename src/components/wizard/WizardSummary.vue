<template>
  <div v-if="p">
    <div class="card q-pa-md q-mb-md">
      <div class="text-h6 text-weight-bold">{{ p.name || 'Senza nome' }}</div>
      <div class="text-muted">
        Dal {{ formatDate(p.startDate) }}
        <template v-if="p.endDate"> al {{ formatDate(p.endDate) }}</template>
        <template v-else> · senza fine</template>
        <template v-if="p.deloadLastWeek"> · ultima settimana di scarico</template>
      </div>
      <div v-if="p.notes" class="text-caption q-mt-xs">{{ p.notes }}</div>
    </div>

    <!-- avvisi -->
    <div v-if="warnings.length" class="card warn q-pa-md q-mb-md">
      <div v-for="w in warnings" :key="w" class="row items-start no-wrap q-py-xs">
        <q-icon name="warning" color="warning" size="20px" class="q-mr-sm" />
        <div>{{ w }}</div>
      </div>
    </div>

    <!-- giorni -->
    <div class="section-label q-mb-xs">Giorni</div>
    <div
      v-for="(d, di) in p.days"
      :key="d.id"
      class="card q-pa-md q-mb-sm day"
      @click="emit('edit-day', di)"
    >
      <div class="row items-center no-wrap">
        <div class="letter">{{ String.fromCharCode(65 + di) }}</div>
        <div class="col" style="min-width: 0">
          <div class="text-weight-bold ellipsis">{{ d.name }}</div>
          <div class="text-caption text-muted">
            {{ d.weekday ? WEEKDAY_LONG[d.weekday - 1] : 'nessun giorno fisso' }} ·
            {{ d.blocks.reduce((n, b) => n + b.items.length, 0) }} esercizi · ~{{
              estimateMinutes(d, [])
            }}
            min
          </div>
        </div>
        <q-icon name="edit" color="grey-6" />
      </div>
      <div class="ex-names text-caption q-mt-xs">
        {{
          d.blocks
            .flatMap((b) => b.items)
            .map((i) => exercises.nameOf(i.exerciseId))
            .join(' · ')
        }}
      </div>
    </div>

    <!-- serie per muscolo -->
    <template v-if="muscles.length">
      <div class="section-label q-mt-md q-mb-xs">Serie a settimana per muscolo</div>
      <div class="card q-pa-md q-mb-md">
        <div v-for="m in muscles" :key="m.muscle" class="bar-row">
          <div class="bar-label">{{ muscleLabel(m.muscle) }}</div>
          <div class="bar-track">
            <div
              class="bar"
              :class="{ low: m.sets < 10, high: m.sets > 20 }"
              :style="{ width: `${(m.sets / maxSets) * 100}%` }"
            />
          </div>
          <div class="bar-value tabular">{{ m.sets }}</div>
        </div>
        <div class="text-caption text-muted q-mt-sm">
          Muscoli principali di ogni esercizio, contando ogni giorno una volta a settimana. Di
          solito per crescere si sta tra 10 e 20.
        </div>
      </div>
    </template>

    <div class="row q-gutter-sm">
      <q-btn outline no-caps icon="share" label="Condividi testo" class="col" @click="shareText" />
      <q-btn outline no-caps icon="download" label="Esporta file" class="col" @click="exportFile" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useQuasar } from 'quasar';
import { WEEKDAY_LONG, useWizardProgram } from './context';
import { estimateMinutes } from '@/domain/dashboard';
import { formatDate } from '@/domain/format';
import { muscleLabel } from '@/domain/labels';
import { weeklyMuscleSets } from '@/domain/programEdit';
import { exportProgramFile, shareProgramText } from '@/services/programFile';
import { useExercisesStore } from '@/stores/exercises';

const emit = defineEmits<{ 'edit-day': [number] }>();
const p = useWizardProgram();
const $q = useQuasar();
const exercises = useExercisesStore();

const muscles = computed(() => (p.value ? weeklyMuscleSets(p.value.days, exercises.byId) : []));
const maxSets = computed(() => Math.max(20, ...muscles.value.map((m) => m.sets)));

const warnings = computed(() => {
  const x = p.value;
  if (!x) return [];
  const out: string[] = [];
  if (!x.name.trim()) out.push('La scheda non ha un nome.');
  if (!x.days.length) out.push('Non ci sono giorni.');
  const empty = x.days.filter((d) => !d.blocks.length).map((d) => d.name);
  if (empty.length) out.push(`Senza esercizi: ${empty.join(', ')}.`);
  const noDay = x.days.filter((d) => !d.weekday).map((d) => d.name);
  if (noDay.length)
    out.push(
      `Senza giorno della settimana (non compariranno nel calendario): ${noDay.join(', ')}.`,
    );
  const seen = new Map<number, string>();
  for (const d of x.days) {
    if (!d.weekday) continue;
    if (seen.has(d.weekday))
      out.push(
        `${seen.get(d.weekday)} e ${d.name} sono lo stesso giorno: nel calendario vale solo il primo.`,
      );
    else seen.set(d.weekday, d.name);
  }
  return out;
});

async function shareText() {
  const r = await shareProgramText(p.value!, exercises.nameOf);
  if (r === 'copied')
    $q.notify({
      message: 'Scheda copiata negli appunti',
      color: 'positive',
      textColor: 'dark',
      icon: 'content_copy',
    });
}

const exportFile = () => void exportProgramFile(JSON.parse(JSON.stringify(p.value)));
</script>

<style scoped lang="scss">
.warn {
  border: 1px solid rgba(255, 183, 77, 0.4);
}
.day {
  cursor: pointer;
}
.letter {
  width: 30px;
  height: 30px;
  border-radius: 9px;
  background: rgba(198, 255, 61, 0.15);
  color: $primary;
  font-weight: 900;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 10px;
  flex: none;
}
.ex-names {
  color: rgba(255, 255, 255, 0.65);
  line-height: 1.5;
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
  &.low {
    background: rgba(198, 255, 61, 0.45);
  }
}
.bar-value {
  width: 30px;
  text-align: right;
  font-size: 13px;
  font-weight: 700;
}
</style>
