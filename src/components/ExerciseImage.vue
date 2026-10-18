<template>
  <div class="ex-img" :style="{ width: size, height: size }">
    <img
      v-if="images.length && !failed"
      :src="images[frame]"
      :alt="alt"
      loading="lazy"
      @error="failed = true"
    />
    <q-icon v-else name="fitness_center" size="22px" color="grey-7" />
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';

// Le immagini della libreria sono due fotogrammi (inizio/fine movimento):
// alternandoli si ottiene un'animazione del gesto.
const props = withDefaults(
  defineProps<{ src: string[]; alt?: string | undefined; size?: string; animate?: boolean }>(),
  { alt: '', size: '56px', animate: false },
);

// le foto scattate dall'utente sono salvate come data URL
const images = computed(() =>
  props.src.map((s) =>
    s.startsWith('data:') ? s : `${import.meta.env.BASE_URL ?? '/'}${s}`.replace(/\/{2,}/g, '/'),
  ),
);
const frame = ref(0);
const failed = ref(false);
let timer: ReturnType<typeof setInterval> | undefined;

watch(
  () => [props.animate, images.value.length] as const,
  ([animate, n]) => {
    clearInterval(timer);
    frame.value = 0;
    if (animate && n > 1) timer = setInterval(() => (frame.value = (frame.value + 1) % n), 900);
  },
  { immediate: true },
);
onBeforeUnmount(() => clearInterval(timer));
</script>

<style scoped lang="scss">
.ex-img {
  flex: none;
  border-radius: 12px;
  overflow: hidden;
  background: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  &:has(.q-icon) {
    background: rgba(255, 255, 255, 0.06);
  }
}
</style>
