<template>
  <div class="timer-bar">
    <div class="rest-track" :style="{ transform: `scaleX(${timer.restProgress})` }" />
    <div class="row items-center no-wrap q-px-md q-py-sm q-gutter-x-sm">
      <div class="clock tabular">
        <div class="text-caption text-muted">Durata</div>
        <div class="text-weight-bold">{{ formatClock(elapsed) }}</div>
      </div>

      <div v-if="hideRest" class="col" />
      <template v-else-if="timer.rest">
        <q-btn
          flat
          round
          dense
          no-caps
          label="-15"
          aria-label="-15 secondi"
          @click="timer.addRest(-15)"
        />
        <div class="col text-center">
          <div class="rest-num tabular">{{ formatClock(timer.restLeft) }}</div>
          <div class="text-caption text-muted ellipsis">{{ timer.rest.label }}</div>
        </div>
        <q-btn
          flat
          round
          dense
          no-caps
          label="+15"
          aria-label="+15 secondi"
          @click="timer.addRest(15)"
        />
        <q-btn
          flat
          round
          dense
          icon="skip_next"
          aria-label="Salta recupero"
          @click="timer.stopRest()"
        />
      </template>
      <template v-else>
        <div class="col text-center">
          <q-btn
            flat
            no-caps
            dense
            icon="timer"
            color="grey-5"
            label="Recupero"
            @click="manualRest"
          />
        </div>
      </template>

      <q-btn
        unelevated
        color="primary"
        text-color="dark"
        no-caps
        label="Fine"
        class="text-weight-bold"
        @click="emit('finish')"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useQuasar } from 'quasar';
import { formatClock } from '@/domain/format';
import { useSettingsStore } from '@/stores/settings';
import { useTimerStore } from '@/stores/timer';
import { unlockAudio } from '@/services/feedback';

const props = defineProps<{
  startedAt: number | undefined;
  /** In modalità focus il recupero è già mostrato in grande nella pagina. */
  hideRest?: boolean;
}>();
const emit = defineEmits<{ finish: [] }>();

const $q = useQuasar();
const timer = useTimerStore();
const settings = useSettingsStore();
const elapsed = computed(() => (props.startedAt ? (timer.now - props.startedAt) / 1000 : 0));

function manualRest() {
  unlockAudio();
  $q.bottomSheet({
    title: 'Avvia recupero',
    dark: true,
    grid: true,
    actions: [30, 45, 60, 90, 120, 180].map((s) => ({
      label: formatClock(s),
      icon: s === settings.defaultRestSec ? 'star' : 'timer',
      id: String(s),
    })),
  }).onOk((a: { id: string }) => timer.startRest(Number(a.id)));
}
</script>

<style scoped lang="scss">
.timer-bar {
  position: relative;
  background: rgba(22, 24, 29, 0.96);
  backdrop-filter: blur(12px);
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  padding-bottom: env(safe-area-inset-bottom);
  overflow: hidden;
}
.rest-track {
  position: absolute;
  inset: 0 0 auto 0;
  height: 3px;
  background: $primary;
  transform-origin: left;
  transition: transform 0.2s linear;
}
.clock {
  min-width: 64px;
  line-height: 1.2;
}
.rest-num {
  font-size: 28px;
  font-weight: 800;
  line-height: 1;
  color: $primary;
}
</style>
