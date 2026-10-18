<template>
  <q-page class="page-pad">
    <div class="row items-center q-mb-md q-mt-sm">
      <div class="text-h5 text-weight-bold col">Esercizi</div>
      <q-btn
        unelevated
        round
        color="primary"
        text-color="dark"
        icon="add"
        aria-label="Nuovo esercizio"
        @click="create"
      />
    </div>

    <q-input v-model="query" dense outlined clearable placeholder="Cerca" class="q-mb-sm">
      <template #prepend><q-icon name="search" /></template>
    </q-input>
    <div class="filters q-mb-sm">
      <q-chip
        clickable
        dense
        :outline="!onlyMine"
        :color="onlyMine ? 'secondary' : 'grey-7'"
        icon="star"
        @click="onlyMine = !onlyMine"
      >
        Usati / miei
      </q-chip>
      <q-chip
        v-for="(label, key) in MUSCLES"
        :key="key"
        clickable
        dense
        :outline="muscle !== key"
        :color="muscle === key ? 'primary' : 'grey-7'"
        :text-color="muscle === key ? 'dark' : undefined"
        @click="muscle = muscle === key ? '' : key"
      >
        {{ label }}
      </q-chip>
    </div>
    <div class="text-caption text-muted q-mb-sm">{{ results.length }} esercizi</div>

    <q-list class="card">
      <q-item
        v-for="ex in visible"
        :key="ex.id"
        clickable
        :to="{ name: 'exercise', params: { id: ex.id } }"
        class="q-py-sm"
      >
        <q-item-section avatar>
          <ExerciseImage :src="ex.images" :alt="ex.name" size="52px" />
        </q-item-section>
        <q-item-section>
          <q-item-label class="text-weight-bold">{{ ex.name }}</q-item-label>
          <q-item-label caption>
            {{
              [ex.nameIt, ...ex.primaryMuscles.map(muscleLabel), equipmentLabel(ex.equipment)]
                .filter(Boolean)
                .join(' · ')
            }}
          </q-item-label>
        </q-item-section>
      </q-item>
    </q-list>
    <q-btn
      v-if="visible.length < results.length"
      flat
      no-caps
      class="full-width q-mt-sm"
      color="grey-5"
      :label="`Mostra altri (${results.length - visible.length})`"
      @click="limit += 60"
    />
  </q-page>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useQuasar } from 'quasar';
import { useRouter } from 'vue-router';
import ExerciseImage from '@/components/ExerciseImage.vue';
import { useLiveQuery } from '@/composables/useLiveQuery';
import { db } from '@/db';
import type { Exercise } from '@/db/types';
import { MUSCLES, equipmentLabel, muscleLabel } from '@/domain/labels';
import { useExercisesStore } from '@/stores/exercises';

const $q = useQuasar();
const router = useRouter();
const store = useExercisesStore();
const query = ref('');
const muscle = ref('');
const onlyMine = ref(true);
const limit = ref(60);

const { data: usedIds } = useLiveQuery(
  async () => {
    const ids = new Set<string>();
    await db.sessions.each((s) => s.exerciseIds.forEach((id) => ids.add(id)));
    await db.programs.each((p) =>
      p.days.forEach((d) => d.blocks.forEach((b) => b.items.forEach((i) => ids.add(i.exerciseId)))),
    );
    return ids;
  },
  [],
  new Set<string>(),
);

const results = computed(() =>
  store
    .search(query.value ?? '', { muscle: muscle.value })
    .filter((e) => !onlyMine.value || e.source === 'custom' || usedIds.value?.has(e.id)),
);
const visible = computed(() => results.value.slice(0, limit.value));
watch([query, muscle, onlyMine], () => (limit.value = 60));

function create() {
  $q.dialog({
    title: 'Nuovo esercizio',
    message: 'Nome (in inglese, come in palestra)',
    prompt: { model: query.value ?? '', type: 'text' },
    cancel: { flat: true, label: 'Annulla' },
    ok: { label: 'Crea', color: 'primary', unelevated: true },
  }).onOk((name: string) => void createNamed(name));
}

async function createNamed(name: string) {
  const clean = name.trim();
  if (!clean) return;
  const base =
    clean
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'esercizio';
  const id = store.get(base) ? `${base}-${Date.now().toString(36)}` : base;
  const ex: Exercise = {
    id,
    name: clean,
    aliases: [],
    category: 'strength',
    equipment: 'body only',
    primaryMuscles: muscle.value ? [muscle.value] : [],
    secondaryMuscles: [],
    instructions: [],
    images: [],
    measure: 'weight_reps',
    loadMode: 'per_implement',
    perSide: false,
    implements: 1,
    source: 'custom',
    updatedAt: 0,
  };
  await store.save(ex);
  void router.push({ name: 'exercise', params: { id } });
}
</script>

<style scoped lang="scss">
.filters {
  display: flex;
  overflow-x: auto;
  scrollbar-width: none;
  margin: 0 -16px;
  padding: 0 12px;
  .q-chip {
    flex: none;
  }
}
</style>
