<template>
  <q-page v-if="ex" class="page-pad">
    <div class="row items-center q-mb-sm">
      <q-btn flat round icon="arrow_back" aria-label="Indietro" @click="router.back()" />
    </div>

    <ExerciseImage :src="ex.images" :alt="ex.name" size="100%" animate class="hero-img q-mb-md" />
    <div class="text-h5 text-weight-bold">{{ ex.name }}</div>
    <div v-if="ex.nameIt" class="text-muted">{{ ex.nameIt }}</div>
    <div class="q-mt-sm">
      <q-chip v-for="m in ex.primaryMuscles" :key="m" dense color="primary" text-color="dark">{{
        muscleLabel(m)
      }}</q-chip>
      <q-chip v-for="m in ex.secondaryMuscles" :key="m" dense outline color="grey-6">{{
        muscleLabel(m)
      }}</q-chip>
      <q-chip dense outline color="grey-6">{{ equipmentLabel(ex.equipment) }}</q-chip>
      <q-chip dense outline color="grey-6">{{ LOAD_MODES[ex.loadMode] }}</q-chip>
      <q-chip v-if="ex.perSide" dense outline color="grey-6">per lato</q-chip>
    </div>

    <!-- Record -->
    <div v-if="history.length" class="row q-col-gutter-sm q-mt-md">
      <div v-for="b in bestTiles" :key="b.label" class="col-6">
        <div class="card q-pa-md">
          <div class="text-caption text-muted">{{ b.label }}</div>
          <div class="text-h6 text-weight-bold tabular">{{ b.value }}</div>
        </div>
      </div>
    </div>

    <!-- Andamento -->
    <div v-if="trend.length > 1" class="card q-pa-md q-mt-md">
      <div class="text-weight-bold">{{ trendTitle }}</div>
      <div class="text-caption text-muted q-mb-lg">Migliore serie di ogni allenamento</div>
      <LineChart :points="trend" :unit="trendUnit" :aria-label="trendTitle" />
    </div>

    <!-- Storico -->
    <div v-if="history.length" class="section-label q-mt-lg q-mb-sm">Storico</div>
    <div
      v-for="h in history"
      :key="h.session.id"
      class="card q-pa-md q-mb-sm"
      @click="openSession(h.session.id)"
    >
      <div class="row items-baseline">
        <div class="col text-weight-bold">{{ formatDate(h.session.date) }}</div>
        <div class="text-caption text-muted ellipsis" style="max-width: 50%">
          {{ h.session.title }}
        </div>
      </div>
      <div class="tabular q-mt-xs sets-line">
        <span v-for="(s, i) in h.sets" :key="i">{{ formatSet(s, ex) }}</span>
      </div>
    </div>
    <div v-if="!history.length" class="text-muted q-mt-lg">Non l'hai ancora mai fatto.</div>

    <ol v-if="ex.instructions.length" class="instructions q-mt-lg">
      <li v-for="(s, i) in ex.instructions" :key="i">{{ s }}</li>
    </ol>

    <!-- Impostazioni -->
    <q-expansion-item
      class="card q-mt-lg"
      icon="tune"
      label="Impostazioni esercizio"
      caption="Nome, misura, convenzione carico"
    >
      <div class="q-pa-md q-gutter-y-md">
        <q-input v-model="form.name" outlined dense label="Nome" />
        <q-input v-model="form.nameIt" outlined dense label="Nome italiano" />
        <q-input v-model="aliasesText" outlined dense label="Altri nomi (separati da virgola)" />
        <q-select
          v-model="form.measure"
          outlined
          dense
          emit-value
          map-options
          :options="opts(MEASURES)"
          label="Cosa registri"
        />
        <q-select
          v-model="form.loadMode"
          outlined
          dense
          emit-value
          map-options
          :options="opts(LOAD_MODES)"
          label="Convenzione carico"
        />
        <q-select
          v-model="form.equipment"
          outlined
          dense
          emit-value
          map-options
          :options="opts(EQUIPMENT)"
          label="Attrezzo"
        />
        <q-select
          v-model="form.primaryMuscles"
          outlined
          dense
          multiple
          use-chips
          emit-value
          map-options
          :options="opts(MUSCLES)"
          label="Muscoli principali"
        />
        <q-toggle v-model="form.perSide" label="Ripetizioni/tempo per lato" />
        <q-toggle
          :model-value="form.implements === 2"
          label="Due attrezzi insieme (es. due manubri) — per il volume"
          @update:model-value="(v: boolean) => (form.implements = v ? 2 : 1)"
        />
        <q-input v-model="form.videoUrl" outlined dense label="Link video (YouTube…)" />
        <q-input
          v-model="form.notes"
          outlined
          dense
          autogrow
          label="Note personali (es. regolazione sedile)"
        />
        <div class="row justify-between">
          <q-btn
            v-if="ex.source === 'custom' && !history.length"
            flat
            no-caps
            color="negative"
            label="Elimina"
            @click="remove"
          />
          <q-space />
          <q-btn
            unelevated
            no-caps
            color="primary"
            text-color="dark"
            label="Salva"
            :disable="!dirty"
            @click="save"
          />
        </div>
      </div>
    </q-expansion-item>
  </q-page>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { useQuasar } from 'quasar';
import { useRouter } from 'vue-router';
import ExerciseImage from '@/components/ExerciseImage.vue';
import LineChart from '@/components/LineChart.vue';
import { useLiveQuery } from '@/composables/useLiveQuery';
import { db } from '@/db';
import type { Exercise, LoggedSet, Session } from '@/db/types';
import { sessionValue } from '@/domain/analysis';
import { formatDate, formatDuration, formatKg, formatSet } from '@/domain/format';
import {
  EQUIPMENT,
  LOAD_MODES,
  MEASURES,
  MUSCLES,
  equipmentLabel,
  muscleLabel,
} from '@/domain/labels';
import { bestsFor } from '@/domain/records';
import { useExercisesStore } from '@/stores/exercises';

const props = defineProps<{ id: string }>();
const $q = useQuasar();
const router = useRouter();
const store = useExercisesStore();
const ex = computed(() => store.get(props.id));

const { data: sessions } = useLiveQuery(
  () => db.sessions.where('exerciseIds').equals(props.id).toArray(),
  [() => props.id],
  [],
);

const done = computed(() =>
  (sessions.value ?? [])
    .filter((s) => s.status === 'done')
    .sort((a, b) => b.date.localeCompare(a.date)),
);

const history = computed(() =>
  done.value.map((session) => ({
    session,
    sets: session.blocks
      .flatMap((b) => b.items)
      .filter((i) => i.exerciseId === props.id)
      .flatMap((i) => i.sets.filter((s): s is LoggedSet => s.done)),
  })),
);

const bests = computed(() => (ex.value ? bestsFor(done.value, props.id, ex.value) : undefined));

const bestTiles = computed(() => {
  const b = bests.value;
  if (!b) return [];
  const tiles: { label: string; value: string }[] = [];
  if (b.e1rm)
    tiles.push({ label: 'Massimale stimato', value: formatKg(Math.round(b.e1rm * 10) / 10) });
  if (b.weight) tiles.push({ label: 'Carico più alto', value: formatKg(b.weight) });
  if (b.reps) tiles.push({ label: 'Più ripetizioni', value: `${b.reps} rip` });
  if (b.duration) tiles.push({ label: 'Tempo più lungo', value: formatDuration(b.duration) });
  if (b.volume)
    tiles.push({ label: 'Volume in un allenamento', value: formatKg(Math.round(b.volume)) });
  tiles.push({ label: 'Allenamenti', value: String(done.value.length) });
  return tiles;
});

const trend = computed(() => {
  const e = ex.value;
  if (!e) return [];
  return [...done.value]
    .reverse()
    .map((s: Session) => {
      const v = sessionValue(s, e);
      return v ? { date: s.date, value: v.value, label: v.topSet } : null;
    })
    .filter((x) => x !== null);
});

const trendTitle = computed(() => {
  switch (ex.value?.measure) {
    case 'weight_reps':
      return 'Massimale stimato (Epley)';
    case 'reps':
      return 'Ripetizioni migliori';
    default:
      return 'Tempo migliore';
  }
});
const trendUnit = computed(() =>
  ex.value?.measure === 'weight_reps' ? 'kg' : ex.value?.measure === 'reps' ? 'rip' : 'sec',
);

// --- impostazioni
const form = reactive({} as Exercise);
const aliasesText = ref('');
const snapshot = ref('');

watch(
  ex,
  (e) => {
    if (!e) return;
    Object.assign(form, structuredClone({ ...e }));
    aliasesText.value = e.aliases.join(', ');
    snapshot.value = JSON.stringify({ ...form, aliasesText: aliasesText.value });
  },
  { immediate: true },
);

const dirty = computed(
  () => JSON.stringify({ ...form, aliasesText: aliasesText.value }) !== snapshot.value,
);

const opts = (r: Record<string, string>) =>
  Object.entries(r).map(([value, label]) => ({ value, label }));

async function save() {
  const out: Exercise = {
    ...form,
    aliases: aliasesText.value
      .split(',')
      .map((a) => a.trim())
      .filter(Boolean),
  };
  if (!out.nameIt) delete out.nameIt;
  if (!out.videoUrl) delete out.videoUrl;
  if (!out.notes) delete out.notes;
  await store.save(JSON.parse(JSON.stringify(out)) as Exercise);
  $q.notify({ message: 'Esercizio salvato', color: 'positive', textColor: 'dark', icon: 'check' });
}

function remove() {
  $q.dialog({
    title: "Eliminare l'esercizio?",
    cancel: { flat: true, label: 'Annulla' },
    ok: { label: 'Elimina', color: 'negative', unelevated: true },
  }).onOk(() => {
    void db.exercises.delete(props.id).then(() => router.back());
  });
}

const openSession = (id: string) => void router.push({ name: 'workout', params: { id } });
</script>

<style scoped lang="scss">
.hero-img {
  aspect-ratio: 4 / 3;
  height: auto !important;
  border-radius: 20px;
}
.sets-line {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 14px;
  color: rgba(255, 255, 255, 0.85);
}
.instructions {
  padding-left: 20px;
  color: rgba(255, 255, 255, 0.75);
  li {
    margin-bottom: 6px;
  }
}
</style>
