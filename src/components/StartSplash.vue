<template>
  <transition name="splash">
    <div v-if="show" class="splash" @click="show = false">
      <svg class="ring" viewBox="0 0 120 120" aria-hidden="true">
        <circle cx="60" cy="60" r="52" class="track" />
        <circle cx="60" cy="60" r="52" class="bar" />
      </svg>
      <div class="go">Si parte!</div>
      <div class="title">{{ title }}</div>
      <div v-if="subtitle" class="sub">{{ subtitle }}</div>
    </div>
  </transition>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useSettingsStore } from '@/stores/settings';

// Breve schermata di partenza quando si avvia un allenamento: si chiude da sola o con un tocco.
defineProps<{ title: string; subtitle?: string }>();
const show = ref(true);

onMounted(() => {
  if (useSettingsStore().vibration && 'vibrate' in navigator) navigator.vibrate([40, 60, 40]);
  setTimeout(() => (show.value = false), 1500);
});
</script>

<style scoped lang="scss">
.splash {
  position: fixed;
  inset: 0;
  z-index: 4000;
  background: radial-gradient(circle at 50% 40%, #1c2114 0%, $dark-page 65%);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 24px;
}
.ring {
  width: 132px;
  height: 132px;
  transform: rotate(-90deg);
  circle {
    fill: none;
    stroke-width: 8;
  }
  .track {
    stroke: rgba(255, 255, 255, 0.08);
  }
  .bar {
    stroke: $primary;
    stroke-linecap: round;
    stroke-dasharray: 327;
    stroke-dashoffset: 327;
    animation: draw 1.1s cubic-bezier(0.65, 0, 0.35, 1) forwards;
  }
}
.go {
  margin-top: 22px;
  font-size: 40px;
  font-weight: 900;
  color: $primary;
  animation: rise 0.45s 0.15s cubic-bezier(0.22, 1, 0.36, 1) both;
}
.title {
  margin-top: 6px;
  font-size: 22px;
  font-weight: 800;
  animation: rise 0.45s 0.25s cubic-bezier(0.22, 1, 0.36, 1) both;
}
.sub {
  margin-top: 4px;
  color: rgba(255, 255, 255, 0.55);
  animation: rise 0.45s 0.35s cubic-bezier(0.22, 1, 0.36, 1) both;
}
@keyframes draw {
  to {
    stroke-dashoffset: 0;
  }
}
.splash-leave-active {
  transition:
    opacity 0.25s ease,
    transform 0.25s ease;
}
.splash-leave-to {
  opacity: 0;
  transform: scale(1.04);
}
</style>
