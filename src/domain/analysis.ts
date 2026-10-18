import type { Exercise, Session } from '@/db/types';
import { formatSet } from './format';
import { isWorkSet, setMetrics } from './records';

export interface ExerciseTrend {
  exerciseId: string;
  name: string;
  sessions: number;
  measure: Exercise['measure'];
  loadMode: Exercise['loadMode'];
  perSide: boolean;
  /** Valore principale per sessione: e1RM, carico, ripetizioni o secondi. */
  series: { date: string; value: number; topSet: string }[];
  changePct: number | null;
  trend: 'progress' | 'stable' | 'regress' | 'n/a';
}

/** Metrica principale di una sessione per un esercizio (la serie migliore). */
export function sessionValue(s: Session, ex: Exercise): { value: number; topSet: string } | null {
  let best: { value: number; topSet: string } | null = null;
  for (const b of s.blocks)
    for (const i of b.items) {
      if (i.exerciseId !== ex.id) continue;
      for (const set of i.sets) {
        if (!isWorkSet(set)) continue;
        const m = setMetrics(set, ex);
        const value =
          m.e1rm || (ex.measure === 'reps' ? m.reps + m.weight / 100 : 0) || m.duration || m.weight;
        const topSet = formatSet(set, ex);
        if (!best || value > best.value) best = { value: Math.round(value * 10) / 10, topSet };
      }
    }
  return best;
}

export function exerciseTrends(
  sessions: Session[],
  exercises: Map<string, Exercise>,
): ExerciseTrend[] {
  const done = sessions
    .filter((s) => s.status === 'done')
    .sort((a, b) => a.date.localeCompare(b.date));
  const ids = [...new Set(done.flatMap((s) => s.exerciseIds))];
  return ids.flatMap((id) => {
    const ex = exercises.get(id);
    if (!ex) return [];
    const series = done
      .filter((s) => s.exerciseIds.includes(id))
      .map((s) => ({ date: s.date, ...sessionValue(s, ex) }))
      .filter((x): x is { date: string; value: number; topSet: string } => x.value !== undefined);
    const first = series[0]?.value;
    const last = series.at(-1)?.value;
    const changePct =
      series.length >= 2 && first ? Math.round(((last! - first) / first) * 1000) / 10 : null;
    const trend: ExerciseTrend['trend'] =
      changePct === null
        ? 'n/a'
        : changePct > 2
          ? 'progress'
          : changePct < -2
            ? 'regress'
            : 'stable';
    return [
      {
        exerciseId: id,
        name: ex.name,
        sessions: series.length,
        measure: ex.measure,
        loadMode: ex.loadMode,
        perSide: ex.perSide,
        series,
        changePct,
        trend,
      },
    ];
  });
}
