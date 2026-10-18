import type { Exercise, Session, SetTarget } from '@/db/types';

// Riscaldamento a rampa prima del primo esercizio pesante di un gruppo muscolare:
// poche ripetizioni che salgono di carico, senza stancare prima delle serie di lavoro.

interface Step {
  pct: number;
  reps: number;
  restSec: number;
}

const BAR_KG = 20;

/** Carico minimo di lavoro sotto cui il riscaldamento non serve. */
const MIN_WORK_KG: Partial<Record<Exercise['loadMode'], number>> = {
  total: 40,
  per_implement: 12,
  stack: 30,
};

function roundTo(kg: number, ex: Pick<Exercise, 'loadMode'>): number {
  if (ex.loadMode === 'per_implement') return kg < 10 ? Math.round(kg) : Math.round(kg / 2) * 2;
  if (ex.loadMode === 'stack') return Math.round(kg / 5) * 5;
  return Math.round(kg / 2.5) * 2.5;
}

/** Serie di riscaldamento suggerite per un carico di lavoro (vuoto se non servono). */
export function warmupSets(
  ex: Pick<Exercise, 'measure' | 'loadMode'>,
  workKg: number | undefined,
): SetTarget[] {
  const min = MIN_WORK_KG[ex.loadMode];
  if (ex.measure !== 'weight_reps' || !workKg || min === undefined || workKg < min) return [];

  const steps: Step[] =
    ex.loadMode === 'total'
      ? [
          { pct: 0.5, reps: 8, restSec: 45 },
          { pct: 0.7, reps: 5, restSec: 60 },
          ...(workKg >= 60 ? [{ pct: 0.85, reps: 2, restSec: 90 }] : []),
        ]
      : [
          { pct: 0.5, reps: 10, restSec: 45 },
          { pct: 0.75, reps: 5, restSec: 60 },
          ...(workKg >= 24 ? [{ pct: 0.85, reps: 2, restSec: 75 }] : []),
        ];

  const out: SetTarget[] = [];
  // bilanciere: si parte sempre dal bilanciere scarico
  if (ex.loadMode === 'total')
    out.push({ weightKg: BAR_KG, reps: 10, kind: 'warmup', restSec: 30 });
  for (const s of steps) {
    let kg = roundTo(workKg * s.pct, ex);
    if (ex.loadMode === 'total') kg = Math.max(BAR_KG, kg);
    const prev = out.at(-1)?.weightKg ?? 0;
    if (kg <= prev || kg >= workKg * 0.95) continue;
    out.push({ weightKg: kg, reps: s.reps, kind: 'warmup', restSec: s.restSec });
  }
  return out;
}

const isHeavy = (ex: Exercise | undefined, kg: number | undefined) =>
  !!ex && warmupSets(ex, kg).length > 0;

/** Carico della prima serie di lavoro di un esercizio. */
function workKg(session: Session, bi: number, ii: number) {
  return session.blocks[bi]!.items[ii]!.sets.find((s) => s.target?.kind !== 'warmup')?.weightKg;
}

/**
 * Il riscaldamento si propone al primo esercizio pesante di ogni gruppo muscolare:
 * se un esercizio pesante precedente ha già scaldato gli stessi muscoli, non serve.
 */
export function suggestWarmupFor(
  session: Session,
  bi: number,
  ii: number,
  exercises: Map<string, Exercise>,
): SetTarget[] {
  const item = session.blocks[bi]?.items[ii];
  if (!item) return [];
  if (item.sets.some((s) => s.target?.kind === 'warmup' || s.done)) return [];
  const ex = exercises.get(item.exerciseId);
  const kg = workKg(session, bi, ii);
  if (!ex || !isHeavy(ex, kg)) return [];
  const muscles = new Set(ex.primaryMuscles);
  for (let b = 0; b <= bi; b++) {
    const items = session.blocks[b]!.items;
    for (let i = 0; i < (b === bi ? ii : items.length); i++) {
      const prev = exercises.get(items[i]!.exerciseId);
      if (isHeavy(prev, workKg(session, b, i)) && prev!.primaryMuscles.some((m) => muscles.has(m)))
        return [];
    }
  }
  return warmupSets(ex, kg);
}
