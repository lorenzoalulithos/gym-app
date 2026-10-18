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

      <q-item clickable class="q-py-sm create-row" @click="create">
        <q-item-section avatar
          ><q-icon name="add_circle" color="primary" size="32px"
        /></q-item-section>
        <q-item-section>
          <q-item-label class="text-weight-bold">
            {{ query?.trim() ? `Crea «${query.trim()}»` : 'Crea un esercizio nuovo' }}
          </q-item-label>
          <q-item-label caption
            >Un esercizio tuo, che non è nella lista (anche con foto)</q-item-label
          >
        </q-item-section>
      </q-item>

      <q-virtual-scroll class="col" :items="results" :virtual-scroll-item-size="72" separator>
        <template #default="{ item: ex }">
          <q-item
            :key="ex.id"
            clickable
            class="q-py-sm"
            :active="selected.includes(ex.id)"
            active-class="picked"
            @click="pick(ex.id)"
          >
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
            <q-item-section side>
              <div class="row items-center q-gutter-x-sm no-wrap">
                <q-badge v-if="ex.source === 'custom'" color="secondary" label="mio" />
                <q-icon
                  v-if="multiple"
                  :name="selected.includes(ex.id) ? 'check_circle' : 'radio_button_unchecked'"
                  :color="selected.includes(ex.id) ? 'primary' : 'grey-7'"
                  size="26px"
                />
              </div>
            </q-item-section>
          </q-item>
        </template>
      </q-virtual-scroll>
      <div v-if="!results.length" class="q-pa-lg text-center text-muted">
        Nessun esercizio trovato: crealo con il tasto qui sopra.
      </div>
      <div v-if="multiple" class="picker-foot q-pa-md">
        <q-btn
          unelevated
          no-caps
          size="lg"
          color="primary"
          text-color="dark"
          class="full-width text-weight-bold"
          :disable="!selected.length"
          :label="
            selected.length
              ? `Aggiungi ${selected.length} ${selected.length === 1 ? 'esercizio' : 'esercizi'}`
              : 'Scegli uno o più esercizi'
          "
          @click="onDialogOK(selected)"
        />
      </div>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useDialogPluginComponent, useQuasar } from 'quasar';
import ExerciseFormDialog from './ExerciseFormDialog.vue';
import ExerciseImage from './ExerciseImage.vue';
import { EQUIPMENT, MUSCLES, equipmentLabel, muscleLabel } from '@/domain/labels';
import { useExercisesStore } from '@/stores/exercises';

const props = withDefaults(
  defineProps<{ title?: string; multiple?: boolean; initialQuery?: string }>(),
  { title: 'Scegli esercizio', multiple: false, initialQuery: '' },
);
defineEmits([...useDialogPluginComponent.emits]);

const { dialogRef, onDialogHide, onDialogOK, onDialogCancel } = useDialogPluginComponent();
const store = useExercisesStore();
const $q = useQuasar();
const query = ref(props.initialQuery);
/** Selezione multipla, nell'ordine in cui si toccano. */
const selected = ref<string[]>([]);

function pick(id: string) {
  if (!props.multiple) return onDialogOK(id);
  const i = selected.value.indexOf(id);
  if (i >= 0) selected.value.splice(i, 1);
  else selected.value.push(id);
}

function create() {
  $q.dialog({
    component: ExerciseFormDialog,
    componentProps: { name: (query.value ?? '').trim(), muscle: muscle.value || undefined },
  }).onOk((id: string) => {
    if (props.multiple) {
      selected.value.push(id);
      query.value = '';
    } else onDialogOK(id);
  });
}
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
.picker-foot {
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  padding-bottom: calc(16px + env(safe-area-inset-bottom));
}
.create-row {
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}
.picked {
  background: rgba(198, 255, 61, 0.08);
  color: inherit;
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
