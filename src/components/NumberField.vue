<template>
  <div class="number-field" :class="{ disabled }">
    <q-btn
      flat
      round
      dense
      size="md"
      icon="remove"
      class="nf-btn"
      :disable="disabled"
      @click="bump(-1)"
    />
    <button class="nf-value tabular" type="button" :disabled="disabled" @click="edit">
      <span class="nf-num">{{ display }}</span>
      <span class="nf-unit">{{ unit }}</span>
    </button>
    <q-btn
      flat
      round
      dense
      size="md"
      icon="add"
      class="nf-btn"
      :disable="disabled"
      @click="bump(1)"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useQuasar } from 'quasar';
import { formatClock } from '@/domain/format';

const props = withDefaults(
  defineProps<{
    modelValue: number | undefined;
    step?: number;
    min?: number;
    unit?: string;
    /** 'time' mostra e accetta m:ss */
    kind?: 'number' | 'time';
    label?: string;
    disabled?: boolean;
  }>(),
  { step: 1, min: 0, unit: '', kind: 'number', label: 'Valore', disabled: false },
);
const emit = defineEmits<{ 'update:modelValue': [number | undefined] }>();
const $q = useQuasar();

const display = computed(() => {
  const v = props.modelValue;
  if (v === undefined) return '–';
  if (props.kind === 'time') return formatClock(v);
  return new Intl.NumberFormat('it-IT', { maximumFractionDigits: 2 }).format(v);
});

function bump(dir: 1 | -1) {
  const base = props.modelValue ?? 0;
  const next = Math.max(props.min, Math.round((base + dir * props.step) * 100) / 100);
  emit('update:modelValue', next);
}

function parse(raw: string): number | undefined {
  const s = raw.trim().replace(',', '.');
  if (!s) return undefined;
  if (props.kind === 'time' && s.includes(':')) {
    const [m, sec] = s.split(':').map(Number);
    return (m ?? 0) * 60 + (sec ?? 0);
  }
  const n = Number(s);
  return Number.isFinite(n) ? Math.max(props.min, n) : props.modelValue;
}

function edit() {
  $q.dialog({
    title: props.label,
    message: props.kind === 'time' ? 'Secondi oppure m:ss' : '',
    prompt: {
      model:
        props.modelValue === undefined
          ? ''
          : props.kind === 'time'
            ? formatClock(props.modelValue)
            : String(props.modelValue),
      type: props.kind === 'time' ? 'text' : 'number',
      inputmode: props.kind === 'time' ? 'text' : 'decimal',
      autofocus: true,
      isValid: (v: string) => v === '' || parse(v) !== undefined,
    },
    cancel: { flat: true, label: 'Annulla' },
    ok: { label: 'OK', color: 'primary', unelevated: true },
  }).onOk((v: string) => emit('update:modelValue', parse(v)));
}
</script>

<style scoped lang="scss">
.number-field {
  display: flex;
  align-items: center;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 12px;
  min-width: 0;
  &.disabled {
    opacity: 0.6;
  }
}
.nf-btn {
  color: rgba(255, 255, 255, 0.6);
  flex: none;
}
.nf-value {
  flex: 1;
  min-width: 0;
  background: none;
  border: 0;
  color: inherit;
  padding: 6px 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  line-height: 1.1;
  cursor: pointer;
}
.nf-num {
  font-size: 20px;
  font-weight: 700;
}
.nf-unit {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.5);
  white-space: nowrap;
}
</style>
