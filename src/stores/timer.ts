import { defineStore } from 'pinia';
import { computed, ref, watch } from 'vue';
import { beep, notify } from '@/services/feedback';

interface RunningTimer {
  /** Timestamp di fine: il conteggio resta corretto anche con l'app in background. */
  endsAt: number;
  totalSec: number;
  label: string;
}

interface WorkTimer extends RunningTimer {
  /** Serie a cui appartiene, `${itemId}:${setIndex}` */
  setKey: string;
  /** Fine del conto alla rovescia iniziale. */
  startsAt: number;
}

const KEY = 'gym:timers';

export const useTimerStore = defineStore('timer', () => {
  const now = ref(Date.now());
  const rest = ref<RunningTimer | null>(null);
  const work = ref<WorkTimer | null>(null);
  let onWorkDone: ((setKey: string) => void) | undefined;
  let lastTick = -1;

  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? 'null') as {
      rest: RunningTimer | null;
    } | null;
    if (saved?.rest && saved.rest.endsAt > Date.now()) rest.value = saved.rest;
  } catch {
    /* niente da ripristinare */
  }

  watch(rest, (r) => {
    try {
      localStorage.setItem(KEY, JSON.stringify({ rest: r }));
    } catch {
      /* ignorato */
    }
  });

  setInterval(() => {
    now.value = Date.now();
    if (rest.value && now.value >= rest.value.endsAt) {
      rest.value = null;
      beep('end');
      void notify('Recupero finito', 'Prossima serie!');
    }
    const w = work.value;
    if (w) {
      // bip negli ultimi 3 secondi del conto alla rovescia e del lavoro
      const toStart = Math.ceil((w.startsAt - now.value) / 1000);
      const toEnd = Math.ceil((w.endsAt - now.value) / 1000);
      const marker = toStart > 0 ? toStart + 10_000 : toEnd;
      if (
        marker !== lastTick &&
        ((toStart > 0 && toStart <= 3) || (toStart <= 0 && toEnd <= 3 && toEnd > 0))
      ) {
        beep('tick');
      }
      lastTick = marker;
      if (now.value >= w.endsAt) {
        work.value = null;
        beep('end');
        void notify('Serie completata', w.label);
        onWorkDone?.(w.setKey);
      }
    }
  }, 200);

  const restLeft = computed(() =>
    rest.value ? Math.max(0, (rest.value.endsAt - now.value) / 1000) : 0,
  );
  const restProgress = computed(() =>
    rest.value ? 1 - restLeft.value / Math.max(1, rest.value.totalSec) : 0,
  );

  const workPhase = computed<'countdown' | 'work' | null>(() => {
    if (!work.value) return null;
    return now.value < work.value.startsAt ? 'countdown' : 'work';
  });
  const workLeft = computed(() => {
    const w = work.value;
    if (!w) return 0;
    return workPhase.value === 'countdown'
      ? (w.startsAt - now.value) / 1000
      : Math.max(0, (w.endsAt - now.value) / 1000);
  });

  function startRest(sec: number, label = 'Recupero') {
    if (sec <= 0) return;
    rest.value = { endsAt: Date.now() + sec * 1000, totalSec: sec, label };
  }

  function addRest(sec: number) {
    if (!rest.value) return startRest(sec);
    const endsAt = rest.value.endsAt + sec * 1000;
    if (endsAt <= Date.now()) return stopRest();
    rest.value = { ...rest.value, endsAt, totalSec: Math.max(1, rest.value.totalSec + sec) };
  }

  const stopRest = () => (rest.value = null);

  function startWork(setKey: string, sec: number, label: string, countdownSec: number) {
    rest.value = null;
    const startsAt = Date.now() + countdownSec * 1000;
    work.value = { setKey, label, totalSec: sec, startsAt, endsAt: startsAt + sec * 1000 };
  }

  /** Interrompe la serie a tempo; restituisce la serie e i secondi effettivamente svolti. */
  function stopWork(): { setKey: string; elapsedSec: number } | null {
    const w = work.value;
    work.value = null;
    if (!w) return null;
    const elapsedSec = Math.max(
      0,
      Math.round((Math.min(Date.now(), w.endsAt) - w.startsAt) / 1000),
    );
    return { setKey: w.setKey, elapsedSec };
  }

  const setWorkDoneHandler = (fn: (setKey: string) => void) => (onWorkDone = fn);

  return {
    now,
    rest,
    work,
    restLeft,
    restProgress,
    workPhase,
    workLeft,
    startRest,
    addRest,
    stopRest,
    startWork,
    stopWork,
    setWorkDoneHandler,
  };
});
