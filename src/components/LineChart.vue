<template>
  <div class="chart" @pointerleave="active = null">
    <svg
      :viewBox="`0 0 ${W} ${H}`"
      class="chart-svg"
      role="img"
      :aria-label="ariaLabel"
      @pointermove="onMove"
      @pointerdown="onMove"
    >
      <!-- griglia recessiva: solo min e max -->
      <g class="grid">
        <line :x1="PAD_L" :x2="W - PAD_R" :y1="y(yMax)" :y2="y(yMax)" />
        <line :x1="PAD_L" :x2="W - PAD_R" :y1="y(yMin)" :y2="y(yMin)" />
        <text :x="PAD_L - 6" :y="y(yMax) + 4" text-anchor="end">{{ fmt(yMax) }}</text>
        <text :x="PAD_L - 6" :y="y(yMin) + 4" text-anchor="end">{{ fmt(yMin) }}</text>
      </g>
      <path v-if="points.length > 1" :d="path" class="line" />
      <line
        v-if="active !== null"
        class="crosshair"
        :x1="pts[active]!.x"
        :x2="pts[active]!.x"
        :y1="PAD_T"
        :y2="H - PAD_B"
      />
      <circle
        v-for="(p, i) in pts"
        :key="i"
        :cx="p.x"
        :cy="p.y"
        :r="active === i ? 6 : 4"
        class="dot"
      />
      <text :x="PAD_L" :y="H - 4" class="axis">{{ shortDate(points[0]?.date) }}</text>
      <text :x="W - PAD_R" :y="H - 4" text-anchor="end" class="axis">
        {{ shortDate(points.at(-1)?.date) }}
      </text>
    </svg>
    <div v-if="active !== null" class="tip" :style="{ left: `${(pts[active]!.x / W) * 100}%` }">
      <div class="text-weight-bold tabular">{{ fmt(points[active]!.value) }} {{ unit }}</div>
      <div class="text-caption">
        {{ shortDate(points[active]!.date) }} · {{ points[active]!.label }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';

const props = withDefaults(
  defineProps<{
    points: { date: string; value: number; label: string }[];
    unit?: string;
    ariaLabel?: string;
  }>(),
  { unit: '', ariaLabel: 'Andamento' },
);

const W = 340;
const H = 150;
const PAD_L = 40;
const PAD_R = 12;
const PAD_T = 14;
const PAD_B = 22;

const active = ref<number | null>(null);

const yMin = computed(() => Math.min(...props.points.map((p) => p.value)));
const yMax = computed(() => Math.max(...props.points.map((p) => p.value)));

const y = (v: number) => {
  const span = yMax.value - yMin.value || 1;
  return H - PAD_B - ((v - yMin.value) / span) * (H - PAD_T - PAD_B);
};

const pts = computed(() => {
  const n = props.points.length;
  return props.points.map((p, i) => ({
    x: n === 1 ? (W + PAD_L - PAD_R) / 2 : PAD_L + (i / (n - 1)) * (W - PAD_L - PAD_R),
    y: n === 1 ? (H - PAD_B + PAD_T) / 2 : y(p.value),
  }));
});

const path = computed(() => pts.value.map((p, i) => `${i ? 'L' : 'M'}${p.x},${p.y}`).join(' '));

const fmt = (v: number) => new Intl.NumberFormat('it-IT', { maximumFractionDigits: 1 }).format(v);
const shortDate = (iso?: string) =>
  iso
    ? new Date(`${iso}T12:00`).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })
    : '';

function onMove(e: PointerEvent) {
  const svg = e.currentTarget as SVGSVGElement;
  const rect = svg.getBoundingClientRect();
  const x = ((e.clientX - rect.left) / rect.width) * W;
  let best = 0;
  pts.value.forEach((p, i) => {
    if (Math.abs(p.x - x) < Math.abs(pts.value[best]!.x - x)) best = i;
  });
  active.value = pts.value.length ? best : null;
}
</script>

<style scoped lang="scss">
.chart {
  position: relative;
  touch-action: pan-y;
}
.chart-svg {
  width: 100%;
  height: auto;
  display: block;
}
.grid line {
  stroke: rgba(255, 255, 255, 0.08);
  stroke-width: 1;
}
.grid text,
.axis {
  fill: rgba(255, 255, 255, 0.5);
  font-size: 10px;
}
.line {
  fill: none;
  stroke: $primary;
  stroke-width: 2;
  stroke-linejoin: round;
  stroke-linecap: round;
}
.dot {
  fill: $primary;
  stroke: $dark;
  stroke-width: 2;
}
.crosshair {
  stroke: rgba(255, 255, 255, 0.3);
  stroke-width: 1;
}
.tip {
  position: absolute;
  top: -8px;
  transform: translate(-50%, -100%);
  background: #2a2d35;
  border-radius: 8px;
  padding: 4px 8px;
  white-space: nowrap;
  pointer-events: none;
  font-size: 13px;
}
</style>
