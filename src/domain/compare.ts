import type { Exercise, Session } from '@/db/types';
import { sessionValue } from './analysis';
import { itemVolume } from './records';

export interface ExerciseProgress {
  exerciseId: string;
  name: string;
  /** Metrica principale: massimale stimato, ripetizioni o secondi della serie migliore. */
  metric: 'e1rm' | 'reps' | 'time';
  now: number;
  before: number | null;
  /** Variazione percentuale della metrica principale (null alla prima volta). */
  deltaPct: number | null;
  volumeNow: number;
  volumeBefore: number | null;
  topSet: string;
}

const metricOf = (ex: Exercise): ExerciseProgress['metric'] =>
  ex.measure === 'weight_reps' ? 'e1rm' : ex.measure === 'reps' ? 'reps' : 'time';

function volumeOf(s: Session, ex: Exercise) {
  return s.blocks
    .flatMap((b) => b.items)
    .filter((i) => i.exerciseId === ex.id)
    .reduce((v, i) => v + itemVolume(i.sets, ex), 0);
}

/**
 * Confronto di ogni esercizio della sessione con l'ultima volta che è stato fatto,
 * ordinato da dove hai spinto di più a dove hai spinto di meno.
 * `history` = sessioni concluse precedenti, dalla più recente.
 */
export function compareWithLast(
  session: Session,
  history: Session[],
  exercises: Map<string, Exercise>,
): ExerciseProgress[] {
  const out: ExerciseProgress[] = [];
  for (const id of session.exerciseIds) {
    const ex = exercises.get(id);
    if (!ex) continue;
    const cur = sessionValue(session, ex);
    if (!cur) continue;
    const prevSession = history.find(
      (h) => !h.deload && h.exerciseIds.includes(id) && sessionValue(h, ex),
    );
    const prev = prevSession ? sessionValue(prevSession, ex) : null;
    const volumeNow = volumeOf(session, ex);
    const volumeBefore = prevSession ? volumeOf(prevSession, ex) : null;
    const deltaPct =
      prev && prev.value > 0
        ? Math.round(((cur.value - prev.value) / prev.value) * 1000) / 10
        : null;
    out.push({
      exerciseId: id,
      name: ex.name,
      metric: metricOf(ex),
      now: cur.value,
      before: prev?.value ?? null,
      deltaPct,
      volumeNow,
      volumeBefore,
      topSet: cur.topSet,
    });
  }
  const volDelta = (p: ExerciseProgress) =>
    p.volumeBefore ? (p.volumeNow - p.volumeBefore) / p.volumeBefore : 0;
  return out.sort(
    (a, b) => (b.deltaPct ?? -Infinity) - (a.deltaPct ?? -Infinity) || volDelta(b) - volDelta(a),
  );
}
