<template>
  <transition name="fade">
    <div v-if="timer.work" class="work-overlay" :class="timer.workPhase">
      <div class="text-h6 text-center q-px-lg">{{ timer.work.label }}</div>
      <div class="ring">
        <svg viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="45" class="track" />
          <circle
            cx="50"
            cy="50"
            r="45"
            class="bar"
            :style="{ strokeDashoffset: `${283 * (1 - progress)}` }"
          />
        </svg>
        <div class="num tabular">
          {{
            timer.workPhase === 'countdown'
              ? Math.ceil(timer.workLeft)
              : formatClock(Math.ceil(timer.workLeft))
          }}
        </div>
      </div>
      <div class="text-muted">{{ timer.workPhase === 'countdown' ? 'Preparati…' : 'Vai!' }}</div>
      <q-btn
        outline
        rounded
        no-caps
        size="lg"
        color="white"
        icon="stop"
        label="Interrompi"
        class="q-mt-xl"
        @click="emit('stop', timer.stopWork())"
      />
    </div>
  </transition>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { formatClock } from '@/domain/format';
import { useTimerStore } from '@/stores/timer';

const emit = defineEmits<{ stop: [result: { setKey: string; elapsedSec: number } | null] }>();
const timer = useTimerStore();

const progress = computed(() => {
  const w = timer.work;
  if (!w || timer.workPhase === 'countdown') return 0;
  return 1 - timer.workLeft / Math.max(1, w.totalSec);
});
</script>

<style scoped lang="scss">
.work-overlay {
  position: fixed;
  inset: 0;
  z-index: 3000;
  background: rgba(11, 12, 15, 0.97);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
}
.ring {
  position: relative;
  width: min(72vw, 320px);
  aspect-ratio: 1;
  svg {
    width: 100%;
    height: 100%;
    transform: rotate(-90deg);
  }
  circle {
    fill: none;
    stroke-width: 6;
  }
  .track {
    stroke: rgba(255, 255, 255, 0.08);
  }
  .bar {
    stroke: $primary;
    stroke-linecap: round;
    stroke-dasharray: 283;
    transition: stroke-dashoffset 0.2s linear;
  }
}
.countdown .bar {
  stroke: $secondary;
}
.num {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: clamp(56px, 18vw, 96px);
  font-weight: 800;
}
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
