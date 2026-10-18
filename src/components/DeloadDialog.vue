<template>
  <q-dialog ref="dialogRef" position="bottom" @hide="onDialogHide">
    <q-card class="deload-card">
      <q-card-section>
        <div class="row items-center no-wrap">
          <q-icon name="battery_charging_full" color="info" size="28px" class="q-mr-sm" />
          <div class="text-h6 col">Settimana di scarico</div>
          <q-btn flat round icon="close" @click="onDialogCancel" />
        </div>
        <div v-if="advice.reasons.length" class="q-mt-sm">
          <div class="text-weight-bold q-mb-xs">
            {{ advice.level === 'now' ? 'È il momento giusto:' : 'Ci sei quasi:' }}
          </div>
          <ul class="reasons">
            <li v-for="r in advice.reasons" :key="r">{{ r }}</li>
          </ul>
        </div>
        <div class="text-muted q-mt-sm">
          Per una settimana fai gli stessi allenamenti ma con
          <b class="text-white">circa il 60% delle serie</b> e
          <b class="text-white">carichi al 90%</b>: l'app li prepara già ridotti. Serve a smaltire
          la fatica accumulata e a ripartire più forte. Gli allenamenti di scarico non contano per
          stalli e confronti, e la settimana dopo i carichi ripartono da quelli normali.
        </div>
      </q-card-section>
      <q-card-actions class="column items-stretch q-pa-md q-gutter-y-sm">
        <q-btn
          unelevated
          no-caps
          color="primary"
          text-color="dark"
          class="text-weight-bold"
          :label="`La prossima settimana (${range(next)})`"
          @click="plan(next)"
        />
        <q-btn
          outline
          no-caps
          :label="`Da oggi per 7 giorni (${range(fromToday)})`"
          @click="plan(fromToday)"
        />
        <q-btn
          flat
          no-caps
          color="grey-5"
          label="Non ora, ricordamelo tra una settimana"
          @click="snooze"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { useDialogPluginComponent, useQuasar } from 'quasar';
import { planDeload } from '@/composables/useDeload';
import { useToday } from '@/composables/useToday';
import type { DeloadWindow } from '@/db/types';
import { addDays } from '@/domain/calendar';
import { fromTodayWindow, nextWeekWindow, type DeloadAdvice } from '@/domain/deload';
import { useSettingsStore } from '@/stores/settings';

defineProps<{ advice: DeloadAdvice }>();
defineEmits([...useDialogPluginComponent.emits]);
const { dialogRef, onDialogHide, onDialogOK, onDialogCancel } = useDialogPluginComponent();

const $q = useQuasar();
const settings = useSettingsStore();
const today = useToday().today.value;
const next = nextWeekWindow(today);
const fromToday = fromTodayWindow(today);

const short = (iso: string) =>
  new Date(`${iso}T12:00`).toLocaleDateString('it-IT', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
const range = (w: DeloadWindow) => `${short(w.from)} – ${short(w.to)}`;

async function plan(w: DeloadWindow) {
  await planDeload(w);
  onDialogOK();
  $q.notify({
    message: `Scarico pianificato: ${range(w)}`,
    color: 'positive',
    textColor: 'dark',
    icon: 'battery_charging_full',
  });
}

function snooze() {
  settings.deloadSnoozedUntil = addDays(today, 7);
  onDialogCancel();
}
</script>

<style scoped lang="scss">
.deload-card {
  width: 100%;
  max-width: 640px;
  border-radius: 20px 20px 0 0;
  padding-bottom: env(safe-area-inset-bottom);
}
.reasons {
  margin: 0;
  padding-left: 20px;
  line-height: 1.6;
}
</style>
