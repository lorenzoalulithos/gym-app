<template>
  <q-page class="page-pad">
    <div class="row items-center q-mb-md q-mt-sm">
      <q-btn flat round icon="arrow_back" aria-label="Indietro" @click="router.back()" />
      <div class="text-h5 text-weight-bold col">Peso e misure</div>
    </div>

    <!-- Ultimi valori -->
    <div class="row q-col-gutter-sm q-mb-md">
      <div v-for="f in FIELDS" :key="f" class="col-4">
        <div class="card tile" :class="{ sel: f === field }" @click="field = f">
          <div class="text-caption text-muted">{{ BODY_FIELDS[f].label }}</div>
          <div class="tile-num tabular">
            {{ latest(f) !== undefined ? fmt(latest(f)!) : '–' }}
            <span class="tile-unit">{{ BODY_FIELDS[f].unit }}</span>
          </div>
          <div v-if="delta(f) !== null" class="text-caption tabular" :class="deltaClass(f)">
            {{ delta(f)! > 0 ? '+' : '' }}{{ fmt(delta(f)!) }} in 30 gg
          </div>
        </div>
      </div>
    </div>

    <!-- Grafico della misura selezionata -->
    <div class="card q-pa-md q-mb-md">
      <div class="text-weight-bold">{{ BODY_FIELDS[field].label }}</div>
      <div class="text-caption text-muted q-mb-lg">Tocca un riquadro sopra per cambiare misura</div>
      <LineChart
        v-if="series.length > 1"
        :points="series"
        :unit="BODY_FIELDS[field].unit"
        :aria-label="`Andamento ${BODY_FIELDS[field].label}`"
      />
      <div v-else class="text-muted q-pb-sm">
        Servono almeno due misurazioni per vedere l'andamento.
      </div>
    </div>

    <!-- Nuova misurazione -->
    <div class="card q-pa-md q-mb-lg">
      <div class="row items-center q-mb-sm">
        <div class="text-weight-bold col">Nuova misurazione</div>
        <q-input v-model="form.date" dense outlined type="date" style="width: 150px" />
      </div>
      <div class="row q-col-gutter-sm">
        <div v-for="f in FIELDS" :key="f" class="col-6">
          <q-input
            v-model.number="form.values[f]"
            dense
            outlined
            type="number"
            inputmode="decimal"
            step="0.1"
            :label="`${BODY_FIELDS[f].label} (${BODY_FIELDS[f].unit})`"
            :hint="BODY_FIELDS[f].hint"
          />
        </div>
      </div>
      <q-btn
        unelevated
        no-caps
        color="primary"
        text-color="dark"
        label="Salva"
        class="full-width q-mt-md text-weight-bold"
        :disable="!hasValues"
        @click="save"
      />
      <div class="text-caption text-muted q-mt-xs">
        Basta anche solo il peso. Le misure vanno bene una volta al mese, con la foto.
      </div>
    </div>

    <!-- Storico -->
    <div v-if="sorted.length" class="section-label q-mb-sm">Storico</div>
    <q-list v-if="sorted.length" class="card" separator>
      <q-item v-for="m in sorted" :key="m.id">
        <q-item-section>
          <q-item-label class="text-weight-medium">{{ formatDate(m.date) }}</q-item-label>
          <q-item-label caption class="tabular">{{ summary(m) }}</q-item-label>
        </q-item-section>
        <q-item-section side>
          <q-btn
            flat
            round
            dense
            icon="delete"
            color="grey-6"
            aria-label="Elimina"
            @click="remove(m)"
          />
        </q-item-section>
      </q-item>
    </q-list>
  </q-page>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { useQuasar } from 'quasar';
import { useRouter } from 'vue-router';
import LineChart from '@/components/LineChart.vue';
import { useLiveQuery } from '@/composables/useLiveQuery';
import { useToday } from '@/composables/useToday';
import { db, newId } from '@/db';
import type { BodyField, BodyMetric } from '@/db/types';
import { addDays } from '@/domain/calendar';
import { formatDate } from '@/domain/format';
import { BODY_FIELDS } from '@/domain/labels';

const FIELDS: BodyField[] = ['weightKg', 'waistCm', 'chestCm', 'armCm', 'thighCm', 'hipsCm'];

const $q = useQuasar();
const router = useRouter();
const { today } = useToday();
const field = ref<BodyField>('weightKg');

const { data: metrics } = useLiveQuery(() => db.bodyMetrics.toArray(), [], [] as BodyMetric[]);
const sorted = computed(() =>
  [...(metrics.value ?? [])].sort((a, b) => b.date.localeCompare(a.date)),
);

const fmt = (v: number) => v.toLocaleString('it-IT', { maximumFractionDigits: 1 });

function latest(f: BodyField): number | undefined {
  return sorted.value.find((m) => m[f] !== undefined)?.[f];
}

function delta(f: BodyField): number | null {
  const withF = sorted.value.filter((m) => m[f] !== undefined);
  const last = withF[0];
  const ref30 = withF.find((m) => m.date <= addDays(today.value, -30));
  if (!last || !ref30 || last === ref30) return null;
  return Math.round((last[f]! - ref30[f]!) * 10) / 10;
}

// il peso che scende o la vita che si stringe non sono "rossi": colore neutro per il corpo
const deltaClass = (f: BodyField) => (delta(f) === 0 ? 'text-muted' : 'text-secondary');

const series = computed(() =>
  [...sorted.value]
    .reverse()
    .filter((m) => m[field.value] !== undefined)
    .map((m) => ({
      date: m.date,
      value: m[field.value]!,
      label: `${fmt(m[field.value]!)} ${BODY_FIELDS[field.value].unit}`,
    })),
);

const form = reactive<{ date: string; values: Partial<Record<BodyField, number | string>> }>({
  date: today.value,
  values: {},
});

const cleanValues = computed(() => {
  const out: Partial<Record<BodyField, number>> = {};
  for (const f of FIELDS) {
    const v = Number(form.values[f]);
    if (form.values[f] !== '' && form.values[f] !== undefined && Number.isFinite(v) && v > 0)
      out[f] = v;
  }
  return out;
});
const hasValues = computed(() => Object.keys(cleanValues.value).length > 0);

/** Una misurazione per giorno: i valori nuovi si uniscono a quelli già salvati quel giorno. */
async function save() {
  const existing = (metrics.value ?? []).find((m) => m.date === form.date);
  const entry: BodyMetric = {
    ...(existing ?? { id: newId(), date: form.date }),
    ...cleanValues.value,
  };
  await db.bodyMetrics.put(entry);
  form.values = {};
  $q.notify({
    message: 'Misurazione salvata',
    color: 'positive',
    textColor: 'dark',
    icon: 'check',
  });
}

function summary(m: BodyMetric) {
  return FIELDS.filter((f) => m[f] !== undefined)
    .map((f) => `${BODY_FIELDS[f].label} ${fmt(m[f]!)}`)
    .join(' · ');
}

function remove(m: BodyMetric) {
  $q.dialog({
    title: 'Eliminare la misurazione?',
    message: `${formatDate(m.date)} · ${summary(m)}`,
    cancel: { flat: true, label: 'Annulla' },
    ok: { label: 'Elimina', color: 'negative', unelevated: true },
  }).onOk(() => void db.bodyMetrics.delete(m.id));
}
</script>

<style scoped lang="scss">
.tile {
  padding: 10px;
  height: 100%;
  border: 1px solid transparent;
  cursor: pointer;
  &.sel {
    border-color: rgba(198, 255, 61, 0.5);
  }
}
.tile-num {
  font-size: 20px;
  font-weight: 800;
}
.tile-unit {
  font-size: 12px;
  font-weight: 400;
  color: rgba(255, 255, 255, 0.5);
}
</style>
