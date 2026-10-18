import type { Exercise, LoggedSet, Session } from '@/db/types';
import { epley } from './e1rm';

export type PbKind = 'e1rm' | 'weight' | 'reps' | 'duration' | 'volume';

export const PB_LABELS: Record<PbKind, string> = {
  e1rm: 'Massimale stimato',
  weight: 'Carico più alto',
  reps: 'Più ripetizioni',
  duration: 'Tempo più lungo',
  volume: 'Volume più alto',
};

export interface Bests {
  e1rm: number;
  weight: number;
  reps: number;
  duration: number;
  volume: number;
}

const emptyBests = (): Bests => ({ e1rm: 0, weight: 0, reps: 0, duration: 0, volume: 0 });

type ExLike = Pick<Exercise, 'measure' | 'implements'>;

/** Metriche confrontabili di una serie, in base a cosa misura l'esercizio. */
export function setMetrics(set: LoggedSet, ex: ExLike): Omit<Bests, 'volume'> {
  const w = set.weightKg ?? 0;
  const r = set.reps ?? 0;
  const d = set.durationSec ?? 0;
  switch (ex.measure) {
    case 'weight_reps':
      return { e1rm: epley(w, r), weight: w, reps: w === 0 ? r : 0, duration: 0 };
    case 'reps':
      return { e1rm: 0, weight: w, reps: r, duration: 0 };
    case 'time':
    case 'weight_time':
    case 'time_reps':
      return { e1rm: 0, weight: w, reps: 0, duration: d };
  }
}

export function itemVolume(sets: LoggedSet[], ex: ExLike): number {
  return sets
    .filter((s) => s.done)
    .reduce((sum, s) => sum + (s.weightKg ?? 0) * (s.reps ?? 0) * ex.implements, 0);
}

function setsOf(session: Session, exerciseId: string) {
  return session.blocks.flatMap((b) => b.items.filter((i) => i.exerciseId === exerciseId));
}

/** Migliori valori di un esercizio sulle sessioni date. */
export function bestsFor(sessions: Session[], exerciseId: string, ex: ExLike): Bests {
  const b = emptyBests();
  for (const s of sessions) {
    for (const item of setsOf(s, exerciseId)) {
      for (const set of item.sets) {
        if (!set.done) continue;
        const m = setMetrics(set, ex);
        b.e1rm = Math.max(b.e1rm, m.e1rm);
        b.weight = Math.max(b.weight, m.weight);
        b.reps = Math.max(b.reps, m.reps);
        b.duration = Math.max(b.duration, m.duration);
      }
      b.volume = Math.max(b.volume, itemVolume(item.sets, ex));
    }
  }
  return b;
}

export interface SessionRecords {
  /** chiave `${itemId}:${setIndex}` */
  sets: Map<string, PbKind[]>;
  /** itemId con record di volume */
  volume: Set<string>;
  count: number;
}

/**
 * Record battuti in una sessione rispetto allo storico precedente.
 * Un esercizio mai fatto prima non genera record: la prima volta è solo il punto di partenza.
 */
export function sessionRecords(
  session: Session,
  previous: Session[],
  exercises: Map<string, ExLike>,
): SessionRecords {
  const result: SessionRecords = { sets: new Map(), volume: new Set(), count: 0 };
  const running = new Map<string, Bests>();

  for (const block of session.blocks) {
    for (const item of block.items) {
      const ex = exercises.get(item.exerciseId);
      if (!ex) continue;
      let best = running.get(item.exerciseId);
      if (!best) {
        const prior = previous.filter((p) => p.exerciseIds.includes(item.exerciseId));
        if (prior.length === 0) continue;
        best = bestsFor(prior, item.exerciseId, ex);
        running.set(item.exerciseId, best);
      }
      item.sets.forEach((set, idx) => {
        if (!set.done) return;
        const m = setMetrics(set, ex);
        const kinds = (['e1rm', 'weight', 'reps', 'duration'] as const).filter(
          (k) => m[k] > 0 && m[k] > best[k],
        );
        for (const k of kinds) best[k] = m[k];
        if (kinds.length) {
          result.sets.set(`${item.id}:${idx}`, kinds);
          result.count += kinds.length;
        }
      });
      const vol = itemVolume(item.sets, ex);
      if (vol > 0 && vol > best.volume) {
        best.volume = vol;
        result.volume.add(item.id);
        result.count++;
      }
    }
  }
  return result;
}
