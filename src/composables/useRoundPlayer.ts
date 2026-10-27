import { computed, onBeforeUnmount, ref, watch, type Ref } from 'vue';
import type { Session } from '@/db/types';
import { roundSteps, type RoundStep } from '@/domain/rounds';
import { beep, notify } from '@/services/feedback';
import { useWorkoutStore } from '@/stores/workout';

export type RoundPhase = 'idle' | 'ready' | 'work' | 'rest' | 'done';

interface State {
  idx: number;
  phase: RoundPhase;
  /** Fine della fase in corso (timestamp): il conto resta giusto anche a schermo spento. */
  endsAt: number;
  /** In pausa: millisecondi rimasti nella fase. */
  pausedLeft: number | null;
}

/** Secondi per mettersi i guantoni prima del primo round. */
export const READY_SEC = 10;
/** Avviso prima della fine del round (solo round di almeno 30 secondi). */
const WARN_SEC = 10;

const storageKey = (id: string) => `gym:rounds:${id}`;

/**
 * Motore della modalità round: pronti → lavoro → pausa → lavoro … → fine.
 * Segna da solo i round fatti nella sessione e suona campana e avvisi.
 */
export function useRoundPlayer(session: Ref<Session | null>) {
  const workout = useWorkoutStore();
  const steps = computed<RoundStep[]>(() => (session.value ? roundSteps(session.value) : []));
  const now = ref(Date.now());
  const state = ref<State>({ idx: 0, phase: 'idle', endsAt: 0, pausedLeft: null });

  function firstUndone() {
    const s = session.value;
    if (!s) return 0;
    const i = steps.value.findIndex((p) => !s.blocks[p.bi]!.items[p.ii]!.sets[p.si]!.done);
    return i === -1 ? steps.value.length : i;
  }

  // riprende da dove si era rimasti (app chiusa o ricaricata)
  watch(
    () => session.value?.id,
    (id) => {
      if (!id) return;
      let saved: State | null = null;
      try {
        saved = JSON.parse(localStorage.getItem(storageKey(id)) ?? 'null') as State | null;
      } catch {
        /* niente da riprendere */
      }
      const idx = firstUndone();
      state.value =
        saved && saved.phase !== 'idle' && saved.phase !== 'done' && saved.idx <= idx
          ? saved
          : {
              idx,
              phase: idx >= steps.value.length ? 'done' : 'idle',
              endsAt: 0,
              pausedLeft: null,
            };
      catchUp();
    },
    { immediate: true },
  );

  watch(
    state,
    (st) => {
      const id = session.value?.id;
      if (!id) return;
      try {
        if (st.phase === 'done') localStorage.removeItem(storageKey(id));
        else localStorage.setItem(storageKey(id), JSON.stringify(st));
      } catch {
        /* ignorato */
      }
    },
    { deep: true },
  );

  const step = computed(() => steps.value[state.value.idx]);
  const nextStep = computed(() => steps.value[state.value.idx + 1]);
  const paused = computed(() => state.value.pausedLeft !== null);
  const left = computed(() => {
    const st = state.value;
    if (st.phase === 'idle' || st.phase === 'done') return 0;
    const ms = st.pausedLeft ?? st.endsAt - now.value;
    return Math.max(0, ms / 1000);
  });
  const phaseTotal = computed(() => {
    const st = state.value;
    if (st.phase === 'ready') return READY_SEC;
    if (st.phase === 'work') return step.value?.workSec ?? 1;
    if (st.phase === 'rest') return step.value?.restSec ?? 1;
    return 1;
  });
  const progress = computed(() => 1 - left.value / Math.max(1, phaseTotal.value));

  function markCurrent(sec: number) {
    const p = step.value;
    if (p) workout.markRound(p.bi, p.ii, p.si, Math.round(sec));
  }

  /** Passa alla fase successiva; `from` è l'istante in cui finisce quella attuale. */
  function advance(from: number, silent = false) {
    const st = state.value;
    const cur = step.value;
    if (st.phase === 'work' && cur) {
      markCurrent(cur.workSec);
      const last = st.idx >= steps.value.length - 1;
      if (last) {
        state.value = { ...st, phase: 'done', pausedLeft: null };
        if (!silent) {
          beep('bells');
          void notify('Allenamento finito', 'Grande! Tutti i round fatti');
        }
        return;
      }
      if (cur.restSec > 0) {
        state.value = { ...st, phase: 'rest', endsAt: from + cur.restSec * 1000 };
        if (!silent) {
          beep('bells');
          void notify(`Fine round ${st.idx + 1}`, `Pausa ${cur.restSec}s`);
        }
        return;
      }
      state.value = { ...st, idx: st.idx + 1 };
      return startWork(from, silent);
    }
    if (st.phase === 'rest') state.value = { ...st, idx: st.idx + 1 };
    if (st.phase === 'rest' || st.phase === 'ready') startWork(from, silent);
  }

  function startWork(from: number, silent: boolean) {
    const s = step.value;
    if (!s) return;
    state.value = {
      ...state.value,
      phase: 'work',
      endsAt: from + s.workSec * 1000,
      pausedLeft: null,
    };
    if (!silent) {
      beep('bell');
      void notify(`Round ${state.value.idx + 1}`, s.theme ?? 'Via!');
    }
  }

  /** Recupera le fasi passate mentre l'app era chiusa o in background. */
  function catchUp() {
    const t = Date.now();
    let guard = 1000;
    while (
      guard-- > 0 &&
      state.value.pausedLeft === null &&
      ['ready', 'work', 'rest'].includes(state.value.phase) &&
      state.value.endsAt <= t
    ) {
      const nextEnd = state.value.endsAt;
      const silentNow = nextEnd < t - 1500;
      advance(nextEnd, silentNow);
    }
  }

  let lastSec = -1;
  const interval = setInterval(() => {
    now.value = Date.now();
    const st = state.value;
    if (st.pausedLeft !== null || !['ready', 'work', 'rest'].includes(st.phase)) return;
    const sec = Math.ceil((st.endsAt - now.value) / 1000);
    if (sec !== lastSec) {
      if (st.phase === 'work' && sec === WARN_SEC && (step.value?.workSec ?? 0) >= 30) beep('warn');
      if (st.phase !== 'work' && sec > 0 && sec <= 3) beep('tick');
      lastSec = sec;
    }
    if (now.value >= st.endsAt) catchUp();
  }, 200);
  onBeforeUnmount(() => clearInterval(interval));

  function start() {
    if (!step.value) return;
    state.value = {
      idx: state.value.idx,
      phase: 'ready',
      endsAt: Date.now() + READY_SEC * 1000,
      pausedLeft: null,
    };
  }

  function togglePause() {
    const st = state.value;
    if (!['ready', 'work', 'rest'].includes(st.phase)) return;
    if (st.pausedLeft === null)
      state.value = { ...st, pausedLeft: Math.max(0, st.endsAt - Date.now()) };
    else state.value = { ...st, endsAt: Date.now() + st.pausedLeft, pausedLeft: null };
  }

  /** Avanti: chiude il round adesso (con i secondi fatti) o salta la pausa. */
  function skip() {
    const st = state.value;
    const cur = step.value;
    if (st.phase === 'work' && cur) {
      const done = cur.workSec - left.value;
      markCurrent(done);
      // il round è già segnato: advance non deve sovrascriverlo col tempo pieno
      const last = st.idx >= steps.value.length - 1;
      if (last) state.value = { ...st, phase: 'done', pausedLeft: null };
      else if (cur.restSec > 0)
        state.value = {
          ...st,
          phase: 'rest',
          endsAt: Date.now() + cur.restSec * 1000,
          pausedLeft: null,
        };
      else {
        state.value = { ...st, idx: st.idx + 1 };
        startWork(Date.now(), false);
      }
      return;
    }
    if (st.phase === 'rest' || st.phase === 'ready') {
      state.value = { ...st, pausedLeft: null };
      advance(Date.now());
    }
  }

  /** Ricomincia da capo il round in corso. */
  function restartRound() {
    const cur = step.value;
    if (state.value.phase !== 'work' || !cur) return;
    state.value = { ...state.value, endsAt: Date.now() + cur.workSec * 1000, pausedLeft: null };
    beep('bell');
  }

  /** Termina prima: il round in corso conta per i secondi fatti (se almeno 10). */
  function stop() {
    const st = state.value;
    const cur = step.value;
    if (st.phase === 'work' && cur) {
      const done = cur.workSec - left.value;
      if (done >= 10) markCurrent(done);
    }
    state.value = { ...st, phase: 'done', pausedLeft: null };
  }

  return {
    steps,
    state,
    step,
    nextStep,
    paused,
    left,
    progress,
    start,
    togglePause,
    skip,
    restartRound,
    stop,
  };
}
