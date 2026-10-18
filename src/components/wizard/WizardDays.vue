<template>
  <div v-if="p">
    <div class="step-title">Quali giorni ti alleni?</div>
    <div class="text-caption text-muted q-mb-md">
      Dai un nome a ogni giorno e scegli quando lo fai: è quello che vedrai nel calendario. Trascina
      <q-icon name="drag_indicator" /> per cambiare l'ordine.
    </div>

    <div ref="listEl">
      <div v-for="(d, di) in p.days" :key="d.id" class="card day-row q-mb-sm">
        <div class="row items-center no-wrap">
          <q-icon name="drag_indicator" size="24px" color="grey-6" class="drag-handle q-mr-xs" />
          <div class="letter">{{ String.fromCharCode(65 + di) }}</div>
          <q-input
            v-model="d.name"
            dense
            borderless
            class="col name-input"
            placeholder="Nome del giorno"
          />
          <q-btn flat round dense icon="more_vert" color="grey-6">
            <q-menu auto-close>
              <q-list style="min-width: 180px">
                <q-item clickable @click="duplicate(di)">
                  <q-item-section avatar><q-icon name="content_copy" /></q-item-section>
                  <q-item-section>Duplica</q-item-section>
                </q-item>
                <q-item clickable class="text-negative" @click="remove(di)">
                  <q-item-section avatar><q-icon name="delete" /></q-item-section>
                  <q-item-section>Elimina</q-item-section>
                </q-item>
              </q-list>
            </q-menu>
          </q-btn>
        </div>
        <div class="weekdays">
          <button
            v-for="(w, wi) in WEEKDAY_SHORT"
            :key="wi"
            type="button"
            class="wd"
            :class="{ on: d.weekday === wi + 1, taken: takenBy(wi + 1, di) }"
            :aria-label="WEEKDAY_LONG[wi]"
            @click="toggleWeekday(d, wi + 1)"
          >
            {{ w }}
          </button>
        </div>
        <div class="text-caption text-muted q-mt-xs">
          {{ d.blocks.reduce((n, b) => n + b.items.length, 0) }} esercizi
          <template v-if="!d.weekday"> · nessun giorno fisso</template>
        </div>
      </div>
    </div>

    <q-btn
      outline
      no-caps
      icon="add"
      label="Aggiungi giorno"
      color="grey-5"
      class="full-width q-py-sm q-mt-xs"
      style="border-radius: 14px"
      @click="add"
    />
    <q-btn
      flat
      no-caps
      icon="content_paste"
      label="Incolla una scheda intera come testo"
      color="primary"
      class="full-width q-mt-sm"
      @click="pasteProgram"
    />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useQuasar } from 'quasar';
import TextImportDialog from '../TextImportDialog.vue';
import { WEEKDAY_LONG, WEEKDAY_SHORT, useWizardProgram } from './context';
import { useSortable } from '@/composables/useSortable';
import { newId } from '@/db';
import type { ProgramDay } from '@/db/types';
import { toProgramBlocks, type ParsedDay } from '@/domain/textImport';
import { useExercisesStore } from '@/stores/exercises';
import { useSettingsStore } from '@/stores/settings';

const p = useWizardProgram();
const $q = useQuasar();
const settings = useSettingsStore();
const exercises = useExercisesStore();

const listEl = ref<HTMLElement>();
useSortable(listEl, () => p.value?.days);

const takenBy = (weekday: number, di: number) =>
  p.value!.days.some((d, i) => i !== di && d.weekday === weekday);

function toggleWeekday(d: ProgramDay, w: number) {
  if (d.weekday === w) delete d.weekday;
  else d.weekday = w;
}

function add() {
  const days = p.value!.days;
  const used = new Set(days.map((d) => d.weekday));
  // propone un giorno libero lasciandone uno di riposo dopo l'ultimo usato (il primo: lunedì)
  const last = Math.max(-1, ...days.map((d) => d.weekday ?? 0));
  const free =
    [1, 2, 3, 4, 5, 6, 7].find((w) => w > last + 1 && !used.has(w)) ??
    [1, 2, 3, 4, 5, 6, 7].find((w) => !used.has(w));
  const day: ProgramDay = {
    id: newId(),
    name: `Giorno ${String.fromCharCode(65 + days.length)}`,
    blocks: [],
  };
  if (free) day.weekday = free;
  days.push(day);
}

function duplicate(di: number) {
  const copy = JSON.parse(JSON.stringify(p.value!.days[di])) as ProgramDay;
  copy.id = newId();
  copy.name += ' (copia)';
  delete copy.weekday;
  for (const b of copy.blocks) {
    b.id = newId();
    for (const i of b.items) i.id = newId();
  }
  p.value!.days.splice(di + 1, 0, copy);
}

function remove(di: number) {
  const d = p.value!.days[di]!;
  const n = d.blocks.reduce((k, b) => k + b.items.length, 0);
  if (!n) return void p.value!.days.splice(di, 1);
  $q.dialog({
    title: `Eliminare "${d.name}"?`,
    message: `Contiene ${n} esercizi.`,
    cancel: { flat: true, label: 'Annulla' },
    ok: { label: 'Elimina', color: 'negative', unelevated: true },
  }).onOk(() => p.value!.days.splice(di, 1));
}

function pasteProgram() {
  $q.dialog({ component: TextImportDialog, componentProps: { mode: 'program' } }).onOk(
    (days: ParsedDay[]) => {
      const toDays = (): ProgramDay[] =>
        days.map((d) => {
          const day: ProgramDay = {
            id: newId(),
            name: d.name,
            blocks: toProgramBlocks(d.blocks, settings.defaultRestSec, exercises.byId),
          };
          if (d.weekday) day.weekday = d.weekday;
          return day;
        });
      const hasContent = p.value!.days.some((d) => d.blocks.length);
      if (!hasContent) return void (p.value!.days = toDays());
      $q.dialog({
        title: 'Cosa faccio con i giorni che ci sono già?',
        options: {
          type: 'radio',
          model: 'replace',
          items: [
            { label: 'Sostituiscili', value: 'replace' },
            { label: 'Aggiungi i nuovi in fondo', value: 'append' },
          ],
        },
        cancel: { flat: true, label: 'Annulla' },
        ok: { label: 'OK', color: 'primary', textColor: 'dark', unelevated: true },
      }).onOk((choice: string) => {
        if (choice === 'replace') p.value!.days = toDays();
        else p.value!.days.push(...toDays());
      });
    },
  );
}
</script>

<style scoped lang="scss">
.day-row {
  padding: 10px 12px 12px;
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
.name-input :deep(input) {
  font-size: 17px;
  font-weight: 700;
}
.drag-handle {
  cursor: grab;
  touch-action: none;
}
.weekdays {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 6px;
  margin-top: 8px;
}
.wd {
  border: 0;
  border-radius: 10px;
  padding: 9px 0;
  font: inherit;
  font-weight: 800;
  background: rgba(255, 255, 255, 0.06);
  color: rgba(255, 255, 255, 0.6);
  cursor: pointer;
  &.taken {
    color: rgba(255, 255, 255, 0.25);
  }
  &.on {
    background: $primary;
    color: $dark-page;
  }
}
</style>
