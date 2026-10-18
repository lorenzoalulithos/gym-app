<template>
  <div v-if="p">
    <div v-if="!p.days.length" class="text-muted text-center q-pa-lg">
      Aggiungi prima almeno un giorno.
    </div>
    <template v-else>
      <!-- scelta del giorno -->
      <div class="day-tabs q-mb-md">
        <button
          v-for="(d, di) in p.days"
          :key="d.id"
          type="button"
          class="day-tab"
          :class="{ on: di === current }"
          @click="emit('update:current', di)"
        >
          <span class="l">{{ String.fromCharCode(65 + di) }}</span>
          <span class="n ellipsis">{{ d.name }}</span>
          <span class="c">{{ d.blocks.reduce((n, b) => n + b.items.length, 0) }}</span>
        </button>
      </div>

      <div v-if="day">
        <div v-if="!day.blocks.length" class="card q-pa-lg text-center q-mb-md">
          <q-icon name="fitness_center" size="36px" color="grey-6" />
          <div class="text-weight-bold q-mt-sm">{{ day.name }} è vuoto</div>
          <div class="text-caption text-muted">
            Aggiungi gli esercizi dalla lista o incollali come testo.
          </div>
        </div>

        <div ref="listEl">
          <div
            v-for="(b, bi) in day.blocks"
            :key="b.id"
            class="card block q-mb-sm"
            :class="{ ss: b.items.length > 1 }"
          >
            <div class="row items-center no-wrap block-head">
              <q-icon name="drag_indicator" size="22px" color="grey-6" class="drag-handle" />
              <div class="col section-label q-ml-xs">
                {{
                  b.items.length > 1
                    ? b.type === 'circuit'
                      ? 'Circuito'
                      : 'Superset'
                    : `${bi + 1}`
                }}
              </div>
              <q-btn
                v-if="b.items.length > 1"
                flat
                dense
                no-caps
                size="sm"
                color="grey-5"
                :label="b.type === 'circuit' ? 'circuito' : 'superset'"
                icon-right="swap_vert"
                @click="b.type = b.type === 'circuit' ? 'superset' : 'circuit'"
              />
            </div>
            <ItemRow
              v-for="(it, ii) in b.items"
              :key="it.id"
              :block="b"
              :ii="ii"
              :can-link="ii === b.items.length - 1 && bi < day.blocks.length - 1"
              :class="{ 'item-sep': ii > 0 }"
              @link="linkWithNext(day, bi)"
              @unlink="unlink(day, bi, ii)"
              @replace="replace(bi, ii)"
              @duplicate="duplicateItem(day, bi, ii)"
              @remove="removeItem(day, bi, ii)"
              @rest="editRest(bi, ii)"
            />
          </div>
        </div>

        <div class="row q-gutter-sm q-mt-xs">
          <q-btn
            unelevated
            no-caps
            color="primary"
            text-color="dark"
            icon="add"
            label="Esercizi"
            class="col text-weight-bold"
            style="border-radius: 14px; min-height: 48px"
            @click="addExercises"
          />
          <q-btn
            outline
            no-caps
            icon="content_paste"
            label="Incolla testo"
            class="col"
            style="border-radius: 14px; min-height: 48px"
            @click="paste"
          />
        </div>
        <q-btn
          flat
          no-caps
          icon="add_circle_outline"
          label="Crea un esercizio tuo (non in lista)"
          color="primary"
          class="full-width q-mt-sm"
          @click="createCustom"
        />
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useQuasar } from 'quasar';
import ExerciseFormDialog from '../ExerciseFormDialog.vue';
import ExercisePicker from '../ExercisePicker.vue';
import TextImportDialog from '../TextImportDialog.vue';
import ItemRow from './ItemRow.vue';
import { useWizardProgram } from './context';
import { useRestPicker } from '@/composables/useRestPicker';
import { useSortable } from '@/composables/useSortable';
import {
  defaultSets,
  duplicateItem,
  linkWithNext,
  newBlock,
  removeItem,
  unlink,
} from '@/domain/programEdit';
import { restAfter } from '@/domain/session';
import { toProgramBlocks, type ParsedBlock } from '@/domain/textImport';
import { useExercisesStore } from '@/stores/exercises';
import { useSettingsStore } from '@/stores/settings';

const props = defineProps<{ current: number }>();
const emit = defineEmits<{ 'update:current': [number] }>();

const p = useWizardProgram();
const $q = useQuasar();
const exercises = useExercisesStore();
const settings = useSettingsStore();
const { pickRest } = useRestPicker();

const day = computed(() => p.value?.days[Math.min(props.current, (p.value?.days.length ?? 1) - 1)]);

const listEl = ref<HTMLElement>();
useSortable(listEl, () => day.value?.blocks);

function addExercises() {
  $q.dialog({
    component: ExercisePicker,
    componentProps: { multiple: true, title: `Aggiungi a ${day.value!.name}` },
  }).onOk((ids: string[]) => {
    for (const id of ids)
      day.value!.blocks.push(newBlock(id, exercises.get(id), settings.defaultRestSec));
  });
}

/** Esercizio personalizzato creato al volo e aggiunto subito al giorno. */
function createCustom() {
  $q.dialog({ component: ExerciseFormDialog }).onOk((id: string) => {
    day.value!.blocks.push(newBlock(id, exercises.get(id), settings.defaultRestSec));
  });
}

function paste() {
  $q.dialog({ component: TextImportDialog, componentProps: { mode: 'day' } }).onOk(
    (blocks: ParsedBlock[]) => {
      day.value!.blocks.push(...toProgramBlocks(blocks, settings.defaultRestSec));
    },
  );
}

function replace(bi: number, ii: number) {
  const it = day.value!.blocks[bi]!.items[ii]!;
  $q.dialog({ component: ExercisePicker, componentProps: { title: 'Sostituisci con…' } }).onOk(
    (id: string) => {
      const old = exercises.get(it.exerciseId);
      const next = exercises.get(id);
      it.exerciseId = id;
      // se cambia il tipo di misura (ripetizioni ↔ tempo) le serie ripartono dai valori predefiniti
      const timed = (m?: string) => m === 'time' || m === 'weight_time';
      if (timed(old?.measure) !== timed(next?.measure)) {
        const n = it.sets.filter((s) => s.kind !== 'warmup').length || 3;
        const base = defaultSets(next)[0]!;
        it.sets = Array.from({ length: n }, () => ({ ...base }));
      }
    },
  );
}

async function editRest(bi: number, ii: number) {
  const b = day.value!.blocks[bi]!;
  const it = b.items[ii]!;
  const lastOfRound = b.items.length === 1 || ii === b.items.length - 1;
  const v = await pickRest(
    lastOfRound && b.items.length > 1 ? 'Recupero a fine giro' : 'Recupero tra le serie',
    restAfter(b, ii),
    it.restSec !== undefined,
  );
  if (v === undefined) return;
  if (v === null) delete it.restSec;
  else if (lastOfRound) {
    // per l'ultimo esercizio (o l'unico) il recupero è quello del blocco
    b.restSec = v;
    delete it.restSec;
  } else it.restSec = v;
}
</script>

<style scoped lang="scss">
.day-tabs {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  scrollbar-width: none;
  margin: 0 -16px 16px;
  padding: 0 16px;
}
.day-tab {
  flex: none;
  max-width: 180px;
  display: flex;
  align-items: center;
  gap: 8px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  background: $dark;
  color: rgba(255, 255, 255, 0.75);
  padding: 8px 12px;
  font: inherit;
  cursor: pointer;
  .l {
    font-weight: 900;
    color: $primary;
  }
  .n {
    font-weight: 600;
  }
  .c {
    font-size: 12px;
    color: rgba(255, 255, 255, 0.45);
  }
  &.on {
    border-color: $primary;
    background: rgba(198, 255, 61, 0.1);
    color: #fff;
  }
}
.block {
  padding: 8px 12px 6px;
  &.ss {
    border-left: 3px solid rgba(198, 255, 61, 0.6);
  }
}
.block-head {
  min-height: 28px;
}
.item-sep {
  border-top: 1px dashed rgba(255, 255, 255, 0.1);
}
.drag-handle {
  cursor: grab;
  touch-action: none;
}
</style>
