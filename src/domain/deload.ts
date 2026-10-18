import type { DeloadWindow, Exercise, Session } from '@/db/types';
import { sessionValue } from './analysis';
import { addDays, isoWeekday } from './calendar';
import { stalledExercises } from './dashboard';
import { roundTo } from './warmup';

// Settimana di scarico: dopo diverse settimane di carichi, o quando compaiono segnali di
// fatica (esercizi fermi o in calo, allenamenti percepiti molto duri), una settimana con
// meno serie e carichi un po' più bassi aiuta a recuperare e a ripartire più forti.

export const DELOAD_SETS = 0.6;
export const DELOAD_LOAD = 0.9;

export const isDeloadDate = (date: string, windows: DeloadWindow[]) =>
  windows.some((w) => date >= w.from && date <= w.to);

const mondayOf = (date: string) => addDays(date, -(isoWeekday(date) - 1));

/**
 * Settimane consecutive di allenamento senza pause né scarichi, contando a ritroso.
 * La settimana in corso conta solo se ha già un allenamento.
 */
export function trainingWeeks(sessions: Session[], windows: DeloadWindow[], today: string): number {
  const done = sessions.filter((s) => s.status === 'done');
  let weeks = 0;
  let monday = mondayOf(today);
  for (let w = 0; w < 104; w++) {
    const sunday = addDays(monday, 6);
    const inWeek = done.filter((s) => s.date >= monday && s.date <= sunday);
    const deload =
      inWeek.some((s) => s.deload) ||
      windows.some((x) => x.from <= sunday && x.to >= monday && x.from <= today);
    if (deload) break;
    if (inWeek.length) weeks++;
    else if (w > 0) break; // una settimana senza allenamenti è già una pausa
    monday = addDays(monday, -7);
  }
  return weeks;
}

/** Esercizi in calo: l'ultima volta sotto del 5% rispetto al meglio delle 4 precedenti. */
export function regressedExercises(
  sessions: Session[],
  exercises: Map<string, Exercise>,
): string[] {
  const done = sessions
    .filter((s) => s.status === 'done' && !s.deload)
    .sort((a, b) => a.date.localeCompare(b.date));
  const out: string[] = [];
  for (const id of new Set(done.flatMap((s) => s.exerciseIds))) {
    const ex = exercises.get(id);
    if (!ex) continue;
    const values = done
      .filter((s) => s.exerciseIds.includes(id))
      .map((s) => sessionValue(s, ex)?.value ?? 0)
      .filter((v) => v > 0);
    if (values.length < 3) continue;
    const last = values.at(-1)!;
    const best = Math.max(...values.slice(-5, -1));
    if (last < best * 0.95) out.push(id);
  }
  return out;
}

export interface DeloadAdvice {
  level: 'none' | 'soon' | 'now';
  weeks: number;
  stalled: number;
  regressed: number;
  avgDifficulty: number | null;
  reasons: string[];
}

export function deloadAdvice(
  sessions: Session[],
  exercises: Map<string, Exercise>,
  windows: DeloadWindow[],
  today: string,
): DeloadAdvice {
  const regular = sessions.filter((s) => !s.deload);
  const weeks = trainingWeeks(sessions, windows, today);
  const stalled = stalledExercises(regular, exercises).length;
  const regressed = regressedExercises(regular, exercises).length;
  const rated = regular
    .filter((s) => s.status === 'done' && s.difficulty)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 4);
  const avgDifficulty =
    rated.length >= 3
      ? Math.round((rated.reduce((n, s) => n + s.difficulty!, 0) / rated.length) * 10) / 10
      : null;

  const reasons: string[] = [];
  if (weeks >= 4) reasons.push(`${weeks} settimane di fila senza scarico`);
  if (stalled >= 2) reasons.push(`${stalled} esercizi fermi da almeno due settimane`);
  if (regressed >= 2) reasons.push(`${regressed} esercizi in calo rispetto alle ultime volte`);
  if (avgDifficulty !== null && avgDifficulty >= 4)
    reasons.push(
      `allenamenti molto duri ultimamente (media ${avgDifficulty.toLocaleString('it-IT')}/5)`,
    );
  const signals =
    (stalled >= 2 ? 1 : 0) +
    (regressed >= 2 ? 1 : 0) +
    (avgDifficulty !== null && avgDifficulty >= 4 ? 1 : 0);

  const level: DeloadAdvice['level'] =
    weeks >= 6 || (weeks >= 4 && signals >= 1) || (weeks >= 3 && signals >= 2)
      ? 'now'
      : weeks >= 4 || (weeks >= 3 && signals >= 1)
        ? 'soon'
        : 'none';
  return { level, weeks, stalled, regressed, avgDifficulty, reasons };
}

/** Prossima settimana intera (lunedì-domenica) a partire da domani. */
export function nextWeekWindow(today: string): DeloadWindow {
  const from = addDays(mondayOf(today), 7);
  return { from, to: addDays(from, 6) };
}

/** Da oggi per 7 giorni. */
export const fromTodayWindow = (today: string): DeloadWindow => ({
  from: today,
  to: addDays(today, 6),
});

/**
 * Versione "scarico" di un allenamento appena creato: circa il 60% delle serie di lavoro
 * e carichi al 90%, arrotondati ai pesi disponibili. Il riscaldamento resta com'è.
 */
export function deloadSession(session: Session, exercises: Map<string, Exercise>): Session {
  session.deload = true;
  for (const b of session.blocks)
    for (const it of b.items) {
      const ex = exercises.get(it.exerciseId);
      const work = it.sets.filter((s) => s.target?.kind !== 'warmup');
      const keep = Math.max(1, Math.round(work.length * DELOAD_SETS));
      const warm = it.sets.filter((s) => s.target?.kind === 'warmup');
      it.sets = [...warm, ...work.slice(0, keep)];
      if (!ex) continue;
      for (const s of work.slice(0, keep)) {
        if (s.weightKg) s.weightKg = Math.max(0, roundTo(s.weightKg * DELOAD_LOAD, ex));
        if (s.target?.weightKg)
          s.target = { ...s.target, weightKg: roundTo(s.target.weightKg * DELOAD_LOAD, ex) };
      }
    }
  return session;
}
