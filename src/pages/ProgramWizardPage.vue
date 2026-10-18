<template>
  <q-page v-if="program" class="wizard">
    <div class="wizard-head">
      <div class="row items-center no-wrap q-px-sm q-pt-sm">
        <q-btn flat round icon="arrow_back" aria-label="Schede" @click="router.push('/schede')" />
        <div class="col ellipsis text-weight-bold q-ml-xs">
          {{ program.name || 'Nuova scheda' }}
        </div>
        <q-badge v-if="program.draft" color="grey-8" label="bozza" class="q-mr-sm" />
        <div class="text-caption text-muted q-mr-sm">salvataggio automatico</div>
      </div>
      <!-- passi: si può saltare a qualunque passo -->
      <div class="steps q-px-md q-pb-sm">
        <button
          v-for="(s, i) in STEPS"
          :key="s"
          type="button"
          class="step"
          :class="{ on: i === step, done: i < step }"
          @click="go(i)"
        >
          <span class="n">{{ i + 1 }}</span>
          <span class="t">{{ s }}</span>
        </button>
      </div>
    </div>

    <div class="page-pad wizard-body">
      <transition :name="dir" mode="out-in">
        <WizardInfo v-if="step === 0" key="0" />
        <WizardDays v-else-if="step === 1" key="1" />
        <WizardExercises v-else-if="step === 2" key="2" v-model:current="dayIndex" />
        <WizardSummary v-else key="3" @edit-day="editDay" />
      </transition>
    </div>

    <div class="wizard-foot row no-wrap">
      <q-btn v-if="step > 0" outline no-caps label="Indietro" class="col-4" @click="go(step - 1)" />
      <q-btn
        v-if="step < 3"
        unelevated
        no-caps
        color="primary"
        text-color="dark"
        class="col text-weight-bold"
        :label="nextLabel"
        :disable="step === 0 && !program.name.trim()"
        @click="next"
      />
      <q-btn
        v-else
        unelevated
        no-caps
        color="primary"
        text-color="dark"
        icon="check"
        class="col text-weight-bold"
        :label="program.draft ? `Attiva dal ${shortDate(program.startDate)}` : 'Fatto'"
        :disable="!program.days.some((d) => d.blocks.length)"
        @click="finish"
      />
    </div>
  </q-page>
</template>

<script setup lang="ts">
import { computed, provide, ref, toRef, watch } from 'vue';
import { useQuasar } from 'quasar';
import { useRoute, useRouter } from 'vue-router';
import WizardDays from '@/components/wizard/WizardDays.vue';
import WizardExercises from '@/components/wizard/WizardExercises.vue';
import WizardInfo from '@/components/wizard/WizardInfo.vue';
import WizardSummary from '@/components/wizard/WizardSummary.vue';
import { PROGRAM_KEY } from '@/components/wizard/context';
import { planDeload } from '@/composables/useDeload';
import { useEditableProgram } from '@/composables/useEditableProgram';
import { db } from '@/db';
import { addDays } from '@/domain/calendar';
import { todayIso } from '@/domain/format';
import { activeProgram } from '@/domain/session';

const STEPS = ['Scheda', 'Giorni', 'Esercizi', 'Riepilogo'];

const props = defineProps<{ id: string }>();
const $q = useQuasar();
const route = useRoute();
const router = useRouter();
const program = useEditableProgram(toRef(props, 'id'));
provide(PROGRAM_KEY, program);

const step = ref(Number(route.query.passo ?? (route.query.nuova ? 0 : 3)));
const dayIndex = ref(Number(route.query.giorno ?? 0));
const dir = ref('set-next');

watch(step, (now, before) => {
  dir.value = now < before ? 'set-prev' : 'set-next';
  window.scrollTo({ top: 0 });
  void router.replace({ query: { ...route.query, passo: String(now) } });
});

function go(i: number) {
  step.value = Math.max(0, Math.min(3, i));
}

const nextLabel = computed(() => {
  const p = program.value!;
  if (step.value === 2 && dayIndex.value < p.days.length - 1)
    return `Avanti: ${String.fromCharCode(66 + dayIndex.value)} · ${p.days[dayIndex.value + 1]!.name}`;
  return `Avanti: ${STEPS[step.value + 1]}`;
});

/** Nel passo esercizi "Avanti" scorre i giorni uno per uno prima del riepilogo. */
function next() {
  if (step.value === 2 && dayIndex.value < program.value!.days.length - 1) {
    dayIndex.value++;
    window.scrollTo({ top: 0, behavior: 'smooth' });
    return;
  }
  go(step.value + 1);
}

function editDay(di: number) {
  dayIndex.value = di;
  go(2);
}

const shortDate = (iso: string) =>
  new Date(`${iso}T12:00`).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });

async function finish() {
  const p = program.value!;
  const wasDraft = !!p.draft;
  const today = todayIso();
  // una scheda con inizio nel passato (es. importata) parte da oggi, con la stessa durata:
  // altrimenti i giorni passati risulterebbero saltati, o la scheda già finita
  if (wasDraft && p.startDate < today) {
    if (p.endDate) {
      const span =
        (new Date(`${p.endDate}T12:00`).getTime() - new Date(`${p.startDate}T12:00`).getTime()) /
        86400000;
      p.endDate = addDays(today, Math.round(span));
    }
    p.startDate = today;
  }
  delete p.draft;
  // la scheda attiva fino a ora si chiude il giorno prima dell'inizio della nuova
  if (wasDraft) {
    const others = (await db.programs.toArray()).filter((o) => o.id !== p.id && !o.draft);
    const prev = activeProgram(others, p.startDate);
    if (prev && prev.startDate < p.startDate) {
      await db.programs.update(prev.id, { endDate: addDays(p.startDate, -1) });
    }
  }
  if (wasDraft && p.deloadLastWeek && p.endDate) {
    await planDeload({ from: addDays(p.endDate, -6), to: p.endDate });
  }
  $q.notify({
    message: wasDraft ? `${p.name} attiva dal ${shortDate(p.startDate)}` : 'Scheda salvata',
    color: 'positive',
    textColor: 'dark',
    icon: 'check_circle',
  });
  void router.push('/schede');
}
</script>

<style scoped lang="scss">
.wizard-head {
  position: sticky;
  top: 0;
  z-index: 10;
  background: rgba(11, 12, 15, 0.94);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}
.steps {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 6px;
}
.step {
  border: 0;
  background: none;
  color: rgba(255, 255, 255, 0.45);
  font: inherit;
  padding: 6px 0 0;
  border-top: 3px solid rgba(255, 255, 255, 0.1);
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  cursor: pointer;
  .n {
    font-size: 11px;
    font-weight: 800;
  }
  .t {
    font-size: 13px;
    font-weight: 700;
  }
  &.done {
    border-top-color: rgba(198, 255, 61, 0.5);
    color: rgba(255, 255, 255, 0.7);
  }
  &.on {
    border-top-color: $primary;
    color: #fff;
  }
}
.wizard-body {
  padding-bottom: 150px;
}
.wizard-foot {
  position: fixed;
  left: 0;
  right: 0;
  bottom: calc(60px + env(safe-area-inset-bottom));
  padding: 10px 16px;
  margin: 0;
  background: rgba(11, 12, 15, 0.94);
  backdrop-filter: blur(12px);
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  z-index: 10;
  gap: 8px;
  > .q-btn {
    min-height: 50px;
    border-radius: 14px;
  }
}
:deep(.step-title) {
  font-size: 20px;
  font-weight: 800;
  margin-bottom: 10px;
}
:deep(.big-input input) {
  font-size: 20px;
  font-weight: 700;
}
</style>
