import { defineStore } from 'pinia';
import { Notify } from 'quasar';
import { ref, watch } from 'vue';
import { db } from '@/db';
import type { LoggedSet, Program, ProgramDay, Session, SetTarget } from '@/db/types';
import { todayIso } from '@/domain/format';
import { buildItem, emptySession, restAfter, sessionFromDay, touchSession } from '@/domain/session';
import { deloadWindows } from '@/composables/useDeload';
import { deloadSession, isDeloadDate } from '@/domain/deload';
import { useExercisesStore } from './exercises';
import { useSettingsStore } from './settings';
import { useTimerStore } from './timer';

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

async function doneHistory() {
  const all = await db.sessions.orderBy('date').reverse().toArray();
  return all.filter((s) => s.status === 'done');
}

/** Sessione aperta (in corso o in modifica), salvata a ogni cambiamento. */
export const useWorkoutStore = defineStore('workout', () => {
  const session = ref<Session | null>(null);
  let saveTimer: ReturnType<typeof setTimeout> | undefined;
  let loading = false;
  /** Ci sono modifiche non ancora scritte: solo allora flush() scrive. */
  let dirty = false;
  let starting: Promise<string> | null = null;

  async function save() {
    clearTimeout(saveTimer);
    if (!dirty || !session.value) return;
    dirty = false;
    await db.sessions.put(touchSession(clone(session.value)));
  }

  watch(
    session,
    (s) => {
      if (!s || loading) return;
      dirty = true;
      clearTimeout(saveTimer);
      saveTimer = setTimeout(() => void save(), 200);
    },
    { deep: true },
  );

  const flush = save;

  /** Dimentica la sessione in memoria (es. dopo il ripristino di un backup). */
  function reset() {
    clearTimeout(saveTimer);
    dirty = false;
    session.value = null;
    const timer = useTimerStore();
    timer.stopRest();
    timer.stopWork();
  }

  async function activeId() {
    return (await db.sessions.where('status').equals('active').first())?.id;
  }

  /**
   * Un solo allenamento in corso alla volta: se ce n'è già uno si riapre quello.
   * Protegge anche dal doppio tap sul bottone.
   */
  function startOnce(create: () => Promise<Session>): Promise<string> {
    starting ??= (async () => {
      try {
        const existing = await activeId();
        if (existing) {
          Notify.create({ message: 'Hai già un allenamento in corso: lo riapro', icon: 'info' });
          return existing;
        }
        const s = await create();
        await db.sessions.add(s);
        return s.id;
      } finally {
        starting = null;
      }
    })();
    return starting;
  }

  async function load(id: string) {
    if (session.value?.id === id) return session.value;
    await flush();
    loading = true;
    session.value = (await db.sessions.get(id)) ?? null;
    await Promise.resolve();
    loading = false;
    return session.value;
  }

  function startFromDay(program: Program, day: ProgramDay) {
    return startOnce(async () => {
      const date = todayIso();
      const s = sessionFromDay(program, day, await doneHistory(), date);
      // durante la settimana di scarico: meno serie e carichi più bassi
      if (isDeloadDate(date, await deloadWindows())) deloadSession(s, useExercisesStore().byId);
      return s;
    });
  }

  function startEmpty() {
    return startOnce(() => Promise.resolve(emptySession(todayIso())));
  }

  /** Toglie serie non spuntate ed esercizi rimasti vuoti. */
  function pruneUndone() {
    const s = session.value;
    if (!s) return;
    for (const b of s.blocks) for (const i of b.items) i.sets = i.sets.filter((x) => x.done);
    for (const b of s.blocks) b.items = b.items.filter((i) => i.sets.length > 0);
    s.blocks = s.blocks.filter((b) => b.items.length > 0);
    dirty = true;
  }

  const item = (bi: number, ii: number) => session.value!.blocks[bi]!.items[ii]!;

  function completeSet(bi: number, ii: number, si: number) {
    const s = session.value;
    if (!s) return;
    const block = s.blocks[bi]!;
    const it = block.items[ii]!;
    const set = it.sets[si]!;
    set.done = true;
    set.completedAt = Date.now();
    if (s.status !== 'active') return;

    const restSec = restAfter(block, ii, set.target?.restSec);
    if (restSec > 0) useTimerStore().startRest(restSec, nextSetLabel(bi, ii, si));
  }

  /** Recupero proprio di un esercizio; undefined = torna a quello del blocco. */
  function setItemRest(bi: number, ii: number, sec: number | undefined) {
    const it = item(bi, ii);
    if (sec === undefined) delete it.restSec;
    else it.restSec = sec;
  }

  function nextSetLabel(bi: number, ii: number, si: number) {
    const ex = useExercisesStore();
    const block = session.value!.blocks[bi]!;
    const firstItem = block.items[0]!;
    const nextInRound = block.items[ii + 1];
    if (block.type !== 'single' && nextInRound)
      return `Prossimo: ${ex.nameOf(nextInRound.exerciseId)}`;
    if (block.type !== 'single' && firstItem.sets.length > si + 1)
      return `Prossimo: ${ex.nameOf(firstItem.exerciseId)}`;
    if (block.type === 'single' && item(bi, ii).sets.length > si + 1)
      return `Prossima serie ${si + 2}`;
    const next = session.value!.blocks[bi + 1]?.items[0];
    return next ? `Prossimo: ${ex.nameOf(next.exerciseId)}` : 'Ultimo esercizio';
  }

  function uncompleteSet(bi: number, ii: number, si: number) {
    const set = item(bi, ii).sets[si]!;
    set.done = false;
    delete set.completedAt;
  }

  function addSet(bi: number, ii: number) {
    const sets = item(bi, ii).sets;
    const last = sets.at(-1);
    const copy: LoggedSet = { ...(last ? clone(last) : {}), done: false };
    delete copy.completedAt;
    sets.push(copy);
  }

  function duplicateSet(bi: number, ii: number, si: number) {
    const sets = item(bi, ii).sets;
    const copy: LoggedSet = { ...clone(sets[si]!), done: false };
    delete copy.completedAt;
    sets.splice(si + 1, 0, copy);
  }

  /** Esercizi per cui il riscaldamento suggerito è stato rifiutato (solo per questa sessione). */
  const warmupDismissed = ref(new Set<string>());

  function addWarmup(bi: number, ii: number, targets: SetTarget[]) {
    const sets = targets.map((t): LoggedSet => {
      const s: LoggedSet = { target: t, done: false };
      if (t.weightKg !== undefined) s.weightKg = t.weightKg;
      if (typeof t.reps === 'number') s.reps = t.reps;
      return s;
    });
    item(bi, ii).sets.unshift(...sets);
  }

  function dismissWarmup(itemId: string) {
    warmupDismissed.value = new Set(warmupDismissed.value).add(itemId);
  }

  function removeSet(bi: number, ii: number, si: number) {
    item(bi, ii).sets.splice(si, 1);
  }

  /** Aggiunge un esercizio come nuovo blocco, oppure in superset con il blocco `joinBlock`. */
  async function addExercise(exerciseId: string, joinBlock?: number) {
    const s = session.value;
    if (!s) return;
    const newItem = buildItem(exerciseId, [], await doneHistory());
    if (joinBlock !== undefined && s.blocks[joinBlock]) {
      const b = s.blocks[joinBlock];
      b.items.push(newItem);
      if (b.type === 'single') b.type = 'superset';
    } else {
      s.blocks.push({
        id: crypto.randomUUID(),
        type: 'single',
        restSec: useSettingsStore().defaultRestSec,
        items: [newItem],
      });
    }
  }

  function removeItem(bi: number, ii: number) {
    const b = session.value!.blocks[bi]!;
    b.items.splice(ii, 1);
    if (b.items.length === 0) session.value!.blocks.splice(bi, 1);
    else if (b.items.length === 1) b.type = 'single';
  }

  function moveBlock(bi: number, dir: -1 | 1) {
    const blocks = session.value!.blocks;
    const to = bi + dir;
    if (to < 0 || to >= blocks.length) return;
    [blocks[bi], blocks[to]] = [blocks[to]!, blocks[bi]!];
  }

  /** Chiude la sessione: scarta le serie non fatte e gli esercizi saltati. */
  async function finish(data: { difficulty?: number; notes?: string }) {
    const s = session.value;
    if (!s) return;
    s.status = 'done';
    s.endedAt = Date.now();
    if (data.difficulty) s.difficulty = data.difficulty;
    if (data.notes) s.notes = data.notes;
    pruneUndone();
    const timer = useTimerStore();
    timer.stopRest();
    timer.stopWork();
    await flush();
  }

  async function discard() {
    const s = session.value;
    if (!s) return;
    clearTimeout(saveTimer);
    dirty = false;
    session.value = null;
    useTimerStore().stopRest();
    await db.sessions.delete(s.id);
  }

  return {
    session,
    load,
    flush,
    reset,
    activeId,
    pruneUndone,
    startFromDay,
    startEmpty,
    completeSet,
    uncompleteSet,
    addSet,
    duplicateSet,
    addWarmup,
    dismissWarmup,
    warmupDismissed,
    setItemRest,
    removeSet,
    addExercise,
    removeItem,
    moveBlock,
    finish,
    discard,
  };
});
