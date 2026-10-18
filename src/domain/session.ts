import type {
  Block,
  Exercise,
  LoggedSet,
  Program,
  ProgramDay,
  Session,
  SessionItem,
  SetTarget,
} from '@/db/types';
import { repsMax } from './format';
import { isWorkSet } from './records';

const uid = () => crypto.randomUUID();

/** Aggiorna i campi derivati prima del salvataggio. */
export function touchSession(s: Session): Session {
  s.exerciseIds = [...new Set(s.blocks.flatMap((b) => b.items.map((i) => i.exerciseId)))];
  s.updatedAt = Date.now();
  return s;
}

/** Le serie dell'ultima volta che l'esercizio è stato fatto (history in ordine dal più recente). */
export function lastPerformance(history: Session[], exerciseId: string): SessionItem | undefined {
  for (const s of history) {
    // dopo lo scarico si riparte dai carichi normali, non da quelli ridotti
    if (s.status !== 'done' || s.deload) continue;
    for (const b of s.blocks) {
      const item = b.items.find((i) => i.exerciseId === exerciseId && i.sets.some(isWorkSet));
      if (item) return { ...item, sets: item.sets.filter(isWorkSet) };
    }
  }
  return undefined;
}

/**
 * Valori proposti per una serie: il carico arriva dall'ultima volta,
 * ripetizioni e tempo dalla scheda (se indicati), altrimenti dall'ultima volta.
 */
export function prefillSet(target: SetTarget | undefined, last: LoggedSet | undefined): LoggedSet {
  const set: LoggedSet = { done: false };
  if (target) set.target = target;
  const weight = last?.weightKg ?? target?.weightKg;
  const reps = repsMax(target?.reps) ?? last?.reps;
  const duration = target?.durationSec ?? last?.durationSec;
  if (weight !== undefined) set.weightKg = weight;
  if (reps !== undefined) set.reps = reps;
  if (duration !== undefined) set.durationSec = duration;
  return set;
}

/**
 * Recupero dopo una serie dell'esercizio `ii` del blocco:
 * prima quello della serie, poi quello dell'esercizio, poi quello del blocco.
 * In superset/circuito, senza un recupero proprio, si passa subito all'esercizio successivo
 * e si recupera solo a fine giro.
 */
export function restAfter(
  block: { type: Block['type']; restSec: number; items: { restSec?: number }[] },
  ii: number,
  setRest?: number,
): number {
  if (setRest !== undefined) return setRest;
  const own = block.items[ii]?.restSec;
  if (own !== undefined) return own;
  const lastOfRound = block.type === 'single' || ii === block.items.length - 1;
  return lastOfRound ? block.restSec : 0;
}

export function buildItem(
  exerciseId: string,
  targets: SetTarget[],
  history: Session[],
  notes?: string,
  restSec?: number,
): SessionItem {
  const last = lastPerformance(history, exerciseId);
  const sets = targets.length ? targets : (last?.sets.map(() => ({})) ?? [{}, {}, {}]);
  const item: SessionItem = {
    id: uid(),
    exerciseId,
    sets: sets.map((t, i) =>
      prefillSet(targets.length ? t : undefined, last?.sets[i] ?? last?.sets.at(-1)),
    ),
  };
  if (notes) item.notes = notes;
  if (restSec !== undefined) item.restSec = restSec;
  return item;
}

export function sessionFromDay(
  program: Program,
  day: ProgramDay,
  history: Session[],
  date: string,
): Session {
  return touchSession({
    id: uid(),
    date,
    status: 'active',
    startedAt: Date.now(),
    programId: program.id,
    dayId: day.id,
    title: day.name,
    blocks: day.blocks.map((b) => ({
      id: uid(),
      type: b.type,
      restSec: b.restSec,
      items: b.items.map((it) => buildItem(it.exerciseId, it.sets, history, it.notes, it.restSec)),
    })),
    exerciseIds: [],
    updatedAt: 0,
  });
}

export function emptySession(date: string, title = 'Allenamento libero'): Session {
  return touchSession({
    id: uid(),
    date,
    status: 'active',
    startedAt: Date.now(),
    title,
    blocks: [],
    exerciseIds: [],
    updatedAt: 0,
  });
}

/** Giorno successivo nella rotazione della scheda, in base all'ultima sessione fatta. */
export function nextDay(program: Program, history: Session[]): ProgramDay | undefined {
  if (program.days.length === 0) return undefined;
  const last = history.find((s) => s.status === 'done' && s.programId === program.id);
  const idx = last ? program.days.findIndex((d) => d.id === last.dayId) : -1;
  return program.days[(idx + 1) % program.days.length];
}

/** Programma attivo: il più recente già iniziato e non ancora concluso. */
export function activeProgram(programs: Program[], today: string): Program | undefined {
  return [...programs]
    .filter((p) => !p.draft && p.startDate <= today && (!p.endDate || p.endDate >= today))
    .sort((a, b) => b.startDate.localeCompare(a.startDate))[0];
}

/**
 * Suggerisce un aumento di carico se l'ultima volta tutte le serie
 * hanno raggiunto il tetto di ripetizioni previsto.
 */
export function suggestIncrease(
  ex: Pick<Exercise, 'measure' | 'loadMode'>,
  targets: SetTarget[],
  last: SessionItem | undefined,
): number | undefined {
  if (ex.measure !== 'weight_reps' || !last || last.sets.length === 0) return undefined;
  const top = targets.map((t) => repsMax(t.reps));
  if (top.some((t) => t === undefined)) return undefined;
  const allHit = last.sets.every((s, i) => (s.reps ?? 0) >= (top[i] ?? top.at(-1)!));
  if (!allHit) return undefined;
  return ex.loadMode === 'per_implement' ? 1 : 2.5;
}

export function sessionStats(s: Session, exercises: Map<string, Pick<Exercise, 'implements'>>) {
  let sets = 0;
  let volume = 0;
  for (const b of s.blocks)
    for (const i of b.items)
      for (const set of i.sets) {
        if (!isWorkSet(set)) continue;
        sets++;
        volume +=
          (set.weightKg ?? 0) * (set.reps ?? 0) * (exercises.get(i.exerciseId)?.implements ?? 1);
      }
  const minutes =
    s.startedAt && s.endedAt ? Math.round((s.endedAt - s.startedAt) / 60000) : undefined;
  return { sets, volume, minutes };
}
