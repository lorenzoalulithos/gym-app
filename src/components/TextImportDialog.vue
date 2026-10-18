<template>
  <q-dialog
    ref="dialogRef"
    maximized
    transition-show="slide-up"
    transition-hide="slide-down"
    @hide="onDialogHide"
  >
    <q-card class="column no-wrap import-card">
      <div class="row items-center q-pa-md head">
        <q-btn flat round icon="close" @click="onDialogCancel" />
        <div class="text-h6 col q-ml-sm">
          {{ mode === 'program' ? 'Incolla una scheda' : 'Incolla esercizi' }}
        </div>
      </div>

      <!-- 1. testo -->
      <div v-if="!parsed" class="col column q-pa-md">
        <div class="text-caption text-muted q-mb-sm">
          Una riga per esercizio, come la scriveresti su un foglio.
          <template v-if="mode === 'program'">
            Ogni giorno inizia con <b>#</b> e il nome (il giorno della settimana tra parentesi).
          </template>
        </div>
        <q-input
          v-model="text"
          type="textarea"
          outlined
          autogrow
          autofocus
          class="text-area"
          :placeholder="placeholder"
          input-style="min-height: 220px; font-family: ui-monospace, monospace; font-size: 14px"
        />
        <q-expansion-item dense icon="help_outline" label="Come si scrive" class="q-mt-sm help">
          <ul class="text-caption help-list">
            <li>
              <b>4x8-10</b> 4 serie da 8-10 · <b>12/10/8/6</b> piramide · <b>3x45s</b> a tempo
            </li>
            <li><b>@60</b> carico in kg · <b>@75%</b> del massimale</li>
            <li><b>r90</b> o <b>r2:00</b> recupero</li>
            <li><b>SS</b> A 3x12 <b>+</b> B 3x12 superset (o una riga che inizia con <b>+</b>)</li>
            <li><b>(note)</b> tra parentesi</li>
            <li>Nomi in italiano o inglese: «panca piana», «lat machine», «alzate laterali»…</li>
          </ul>
        </q-expansion-item>
        <q-space />
        <q-btn
          unelevated
          no-caps
          size="lg"
          color="primary"
          text-color="dark"
          label="Leggi la scheda"
          class="full-width text-weight-bold q-mt-md"
          :disable="!text.trim()"
          @click="analyze"
        />
      </div>

      <!-- 2. anteprima -->
      <template v-else>
        <div class="col scroll q-pa-md">
          <div v-if="!totalItems" class="text-muted text-center q-pa-lg">
            Non ho trovato esercizi in questo testo.
          </div>
          <div v-for="(d, di) in parsed" :key="di" class="q-mb-md">
            <div v-if="mode === 'program'" class="section-label q-mb-xs">
              {{ String.fromCharCode(65 + di) }} · {{ d.name }}
              <template v-if="d.weekday"> · {{ WEEKDAYS[d.weekday - 1] }}</template>
            </div>
            <div v-for="(b, bi) in d.blocks" :key="bi" class="card q-pa-sm q-mb-sm">
              <div
                v-if="b.type !== 'single'"
                class="text-caption text-primary text-weight-bold q-px-xs"
              >
                {{ b.type === 'superset' ? 'SUPERSET' : 'CIRCUITO' }}
              </div>
              <div v-for="(it, ii) in b.items" :key="ii" class="row items-center no-wrap q-py-xs">
                <q-icon
                  :name="it.exerciseId ? 'check_circle' : 'help'"
                  :color="it.exerciseId ? 'primary' : 'warning'"
                  size="22px"
                  class="q-mr-sm"
                />
                <div class="col" style="min-width: 0">
                  <div class="ellipsis text-weight-medium">
                    {{ it.exerciseId ? exercises.nameOf(it.exerciseId) : it.raw }}
                  </div>
                  <div class="text-caption text-muted ellipsis">
                    <template
                      v-if="
                        it.exerciseId &&
                        normalizeName(it.raw) !== normalizeName(exercises.nameOf(it.exerciseId))
                      "
                    >
                      «{{ it.raw }}» ·
                    </template>
                    <template v-if="!it.exerciseId">non trovato · </template>
                    {{
                      summarizeTargets(
                        it.sets,
                        it.exerciseId ? exercises.get(it.exerciseId) : undefined,
                      )
                    }}
                    <template v-if="b.restSec && ii === b.items.length - 1">
                      · rec. {{ formatClock(b.restSec) }}</template
                    >
                  </div>
                </div>
                <q-btn
                  flat
                  dense
                  no-caps
                  :color="it.exerciseId ? 'grey-5' : 'warning'"
                  :label="it.exerciseId ? 'Cambia' : 'Scegli'"
                  @click="choose(it)"
                />
              </div>
            </div>
          </div>
        </div>
        <div class="q-pa-md foot">
          <div v-if="unresolved" class="text-caption text-warning q-mb-sm">
            {{ unresolved }}
            {{
              unresolved === 1
                ? 'esercizio non riconosciuto verrà saltato'
                : 'esercizi non riconosciuti verranno saltati'
            }}: toccane uno per sceglierlo o crearlo.
          </div>
          <div class="row q-gutter-sm">
            <q-btn outline no-caps label="Modifica testo" class="col" @click="parsed = null" />
            <q-btn
              unelevated
              no-caps
              color="primary"
              text-color="dark"
              class="col text-weight-bold"
              :disable="!resolvedItems"
              :label="mode === 'program' ? 'Usa questa scheda' : `Aggiungi ${resolvedItems}`"
              @click="confirm"
            />
          </div>
        </div>
      </template>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useDialogPluginComponent, useQuasar } from 'quasar';
import ExercisePicker from './ExercisePicker.vue';
import { formatClock, summarizeTargets } from '@/domain/format';
import {
  buildIndex,
  normalizeName,
  parseBlocks,
  parseProgramText,
  resolveBlocks,
  type ParsedDay,
  type ParsedExercise,
} from '@/domain/textImport';
import { useExercisesStore } from '@/stores/exercises';

const props = withDefaults(defineProps<{ mode?: 'day' | 'program'; initialText?: string }>(), {
  mode: 'day',
  initialText: '',
});
defineEmits([...useDialogPluginComponent.emits]);
const { dialogRef, onDialogHide, onDialogOK, onDialogCancel } = useDialogPluginComponent();
const $q = useQuasar();
const exercises = useExercisesStore();

const WEEKDAYS = ['lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato', 'domenica'];

const text = ref(props.initialText);
const parsed = ref<ParsedDay[] | null>(null);

const placeholder = computed(() =>
  props.mode === 'program'
    ? '# A Push (lunedì)\nPanca piana 4x8-10 @60 r2:00\nMilitary press 3x8-10 r90\nSS Croci ai cavi 3x12 + Push-down 3x12 r60\n\n# B Pull (mercoledì)\nTrazioni 4x6-8 r2:00\nRematore con manubri 3x10 @24'
    : 'Panca piana 4x8-10 @60 r2:00\nMilitary press 3x8-10 r90\nSS Croci ai cavi 3x12 + Push-down 3x12 r60\nPlank 3x45s',
);

function analyze() {
  const index = buildIndex(exercises.list);
  const days: ParsedDay[] =
    props.mode === 'program'
      ? parseProgramText(text.value)
      : [{ name: '', blocks: parseBlocks(text.value) }];
  for (const d of days) resolveBlocks(d.blocks, index, exercises.usage);
  parsed.value = days;
}

const allItems = computed(() =>
  (parsed.value ?? []).flatMap((d) => d.blocks.flatMap((b) => b.items)),
);
const totalItems = computed(() => allItems.value.length);
const resolvedItems = computed(() => allItems.value.filter((i) => i.exerciseId).length);
const unresolved = computed(() => totalItems.value - resolvedItems.value);

function choose(it: ParsedExercise) {
  $q.dialog({
    component: ExercisePicker,
    componentProps: { title: `«${it.raw}»`, initialQuery: it.raw },
  }).onOk((id: string) => {
    it.exerciseId = id;
    // forza l'aggiornamento della lista
    parsed.value = [...parsed.value!];
  });
}

function confirm() {
  // copia semplice: i proxy reattivi di Vue non si possono salvare in IndexedDB
  const out = JSON.parse(JSON.stringify(parsed.value)) as ParsedDay[];
  onDialogOK(props.mode === 'program' ? out : out[0]!.blocks);
}
</script>

<style scoped lang="scss">
.import-card {
  background: $dark-page;
}
.head {
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}
.foot {
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  padding-bottom: calc(16px + env(safe-area-inset-bottom));
}
.help-list {
  padding-left: 18px;
  margin: 4px 0 0;
  line-height: 1.7;
  color: rgba(255, 255, 255, 0.75);
}
</style>
