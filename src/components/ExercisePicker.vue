<template>
  <q-dialog
    ref="dialogRef"
    maximized
    transition-show="slide-up"
    transition-hide="slide-down"
    @hide="onDialogHide"
  >
    <q-card class="column no-wrap bg-dark-page">
      <div class="picker-head q-pa-md">
        <div class="row items-center q-mb-sm">
          <div class="text-h6 col">{{ title }}</div>
          <q-btn flat round icon="close" @click="onDialogCancel" />
        </div>
        <q-input
          v-model="query"
          dense
          outlined
          autofocus
          clearable
          placeholder="Cerca (anche in italiano o col nome del coach)"
        >
          <template #prepend><q-icon name="search" /></template>
        </q-input>
        <div class="filters q-mt-sm">
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
        <div class="filters">
          <q-chip
            v-for="(label, key) in EQUIPMENT"
            :key="key"
            clickable
            dense
            :outline="equipment !== key"
            :color="equipment === key ? 'secondary' : 'grey-7'"
            @click="equipment = equipment === key ? '' : key"
          >
            {{ label }}
          </q-chip>
        </div>
      </div>

      <q-virtual-scroll class="col" :items="results" :virtual-scroll-item-size="72" separator>
        <template #default="{ item: ex }">
          <q-item :key="ex.id" clickable class="q-py-sm" @click="onDialogOK(ex.id)">
            <q-item-section avatar>
              <ExerciseImage :src="ex.images" :alt="ex.name" size="48px" />
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
            <q-item-section v-if="ex.source === 'custom'" side>
              <q-badge color="secondary" label="mio" />
            </q-item-section>
          </q-item>
        </template>
      </q-virtual-scroll>
      <div v-if="!results.length" class="q-pa-lg text-center text-muted">
        Nessun esercizio trovato. Puoi crearlo dalla sezione Esercizi.
      </div>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useDialogPluginComponent } from 'quasar';
import ExerciseImage from './ExerciseImage.vue';
import { EQUIPMENT, MUSCLES, equipmentLabel, muscleLabel } from '@/domain/labels';
import { useExercisesStore } from '@/stores/exercises';

withDefaults(defineProps<{ title?: string }>(), { title: 'Scegli esercizio' });
defineEmits([...useDialogPluginComponent.emits]);

const { dialogRef, onDialogHide, onDialogOK, onDialogCancel } = useDialogPluginComponent();
const store = useExercisesStore();
const query = ref('');
const muscle = ref('');
const equipment = ref('');

const results = computed(() =>
  store.search(query.value ?? '', { muscle: muscle.value, equipment: equipment.value }),
);
</script>

<style scoped lang="scss">
.bg-dark-page {
  background: $dark-page;
}
.picker-head {
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}
.filters {
  display: flex;
  overflow-x: auto;
  flex-wrap: nowrap;
  scrollbar-width: none;
  margin: 0 -16px;
  padding: 0 12px;
  .q-chip {
    flex: none;
  }
}
</style>
