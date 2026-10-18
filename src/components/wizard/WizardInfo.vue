<template>
  <div v-if="p" class="q-gutter-y-lg">
    <div>
      <div class="step-title">Come si chiama?</div>
      <q-input
        v-model="p.name"
        outlined
        class="big-input"
        placeholder="Es. Massa inverno, Scheda coach novembre…"
        :autofocus="!p.name || p.name === 'Nuova scheda'"
        @focus="clearDefault"
      />
    </div>

    <div>
      <div class="step-title">Quando inizi?</div>
      <div class="row q-gutter-sm q-mb-sm">
        <q-btn
          v-for="o in startOptions"
          :key="o.date"
          unelevated
          no-caps
          :color="p.startDate === o.date ? 'primary' : 'grey-9'"
          :text-color="p.startDate === o.date ? 'dark' : 'grey-4'"
          :label="o.label"
          @click="p.startDate = o.date"
        />
      </div>
      <q-input
        :model-value="p.startDate"
        @update:model-value="(v) => v && (p!.startDate = String(v))"
        outlined
        dense
        type="date"
        label="Oppure scegli la data"
        stack-label
      />
    </div>

    <div>
      <div class="step-title">Per quanto tempo?</div>
      <div class="row q-gutter-sm">
        <q-btn
          v-for="w in [4, 5, 6, 8]"
          :key="w"
          unelevated
          no-caps
          :color="weeks === w ? 'primary' : 'grey-9'"
          :text-color="weeks === w ? 'dark' : 'grey-4'"
          :label="`${w} settimane`"
          @click="setWeeks(w)"
        />
        <q-btn
          unelevated
          no-caps
          :color="weeks === null ? 'primary' : 'grey-9'"
          :text-color="weeks === null ? 'dark' : 'grey-4'"
          label="Senza fine"
          @click="setWeeks(null)"
        />
      </div>
      <div class="text-caption text-muted q-mt-sm">
        <template v-if="p.endDate"
          >Dal {{ formatDate(p.startDate) }} al {{ formatDate(p.endDate) }}.</template
        >
        <template v-else>Resta attiva finché non ne attivi un'altra.</template>
      </div>
      <q-toggle
        v-if="p.endDate"
        :model-value="!!p.deloadLastWeek"
        label="Ultima settimana di scarico (serie ridotte e carichi al 90%)"
        class="q-mt-sm"
        @update:model-value="(v: boolean) => setDeload(v)"
      />
    </div>

    <div>
      <div class="step-title">Note</div>
      <q-input
        v-model="p.notes"
        outlined
        autogrow
        placeholder="Obiettivo, indicazioni del coach… (facoltativo)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, watch } from 'vue';
import { useWizardProgram } from './context';
import { useToday } from '@/composables/useToday';
import { addDays, isoWeekday } from '@/domain/calendar';
import { formatDate } from '@/domain/format';

const p = useWizardProgram();
const { today } = useToday();

const nextMonday = computed(() => addDays(today.value, 8 - isoWeekday(today.value)));
const startOptions = computed(() => [
  { date: today.value, label: 'Oggi' },
  { date: nextMonday.value, label: 'Lunedì prossimo' },
]);

const weeks = computed(() => {
  const x = p.value;
  if (!x?.endDate) return null;
  const days =
    (new Date(`${x.endDate}T12:00`).getTime() - new Date(`${x.startDate}T12:00`).getTime()) /
      86400000 +
    1;
  return Math.round(days / 7);
});

function setWeeks(w: number | null) {
  const x = p.value!;
  if (w === null) {
    delete x.endDate;
    delete x.deloadLastWeek;
  } else x.endDate = addDays(x.startDate, w * 7 - 1);
}

function setDeload(v: boolean) {
  if (v) p.value!.deloadLastWeek = true;
  else delete p.value!.deloadLastWeek;
}

// cambiando la data di inizio la durata resta la stessa
watch(
  () => p.value?.startDate,
  (now, before) => {
    const x = p.value;
    if (!x?.endDate || !now || !before || now === before) return;
    const span =
      (new Date(`${x.endDate}T12:00`).getTime() - new Date(`${before}T12:00`).getTime()) / 86400000;
    x.endDate = addDays(now, Math.round(span));
  },
);

function clearDefault() {
  if (p.value?.name === 'Nuova scheda') p.value.name = '';
}
</script>
