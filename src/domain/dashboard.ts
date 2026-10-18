import type { BodyMetric, Exercise, ProgramDay, Session } from '@/db/types';
import { sessionValue } from './analysis';
import { addDays, calendarDay, isoWeekday, type CalendarInput } from './calendar';
import { sessionRecords, type PbKind } from './records';
import { restAfter, sessionStats } from './session';

/** Secondi stimati di lavoro per una serie senza durata indicata. */
const SET_WORK_SEC = 40;

/**
 * Durata prevista di un giorno della scheda: la durata reale dell'ultima volta,
 * altrimenti una stima da serie e recuperi.
 */
export function estimateMinutes(day: ProgramDay, history: Session[]): number {
  const last = history.find(
    (s) => s.status === 'done' && s.dayId === day.id && s.startedAt && s.endedAt,
  );
  if (last) return Math.round((last.endedAt! - last.startedAt!) / 60000);
  let sec = 0;
  for (const b of day.blocks)
    b.items.forEach((it, ii) => {
      for (const t of it.sets) sec += (t.durationSec ?? SET_WORK_SEC) + restAfter(b, ii, t.restSec);
    });
  return Math.round(sec / 60);
}

/** Muscoli principali del giorno, dal più allenato (per numero di serie). */
export function focusMuscles(day: ProgramDay, exercises: Map<string, Exercise>, max = 3): string[] {
  const count = new Map<string, number>();
  for (const b of day.blocks)
    for (const it of b.items)
      for (const m of exercises.get(it.exerciseId)?.primaryMuscles ?? [])
        count.set(m, (count.get(m) ?? 0) + it.sets.length);
  return [...count]
    .sort((a, b) => b[1] - a[1])
    .slice(0, max)
    .map(([m]) => m);
}

/**
 * Settimane consecutive (lun-dom) senza allenamenti saltati e con almeno uno fatto.
 * La settimana in corso conta solo se ha già un allenamento; altrimenti non interrompe la serie.
 */
export function weekStreak(input: CalendarInput, today: string, maxWeeks = 52): number {
  let streak = 0;
  let monday = addDays(today, -(isoWeekday(today) - 1));
  for (let w = 0; w < maxWeeks; w++) {
    const days = Array.from({ length: 7 }, (_, i) => calendarDay(addDays(monday, i), input));
    const done = days.some((d) => d.status === 'done');
    const missed = days.some((d) => d.status === 'missed');
    if (missed) break;
    if (done) streak++;
    else if (w > 0) break;
    monday = addDays(monday, -7);
    if (input.since && addDays(monday, 6) < input.since) break;
  }
  return streak;
}

export interface MonthStats {
  done: number;
  /** Allenamenti previsti nel mese (fatti + saltati + ancora da fare). */
  planned: number;
  volume: number;
  /** Variazione % del volume rispetto agli stessi giorni del mese precedente. */
  volumeDeltaPct: number | null;
}

export function monthStats(
  input: CalendarInput,
  sessions: Session[],
  exercises: Map<string, Exercise>,
  today: string,
): MonthStats {
  const month = today.slice(0, 7);
  const first = `${month}-01`;
  let planned = 0;
  for (let d = first; d.startsWith(month); d = addDays(d, 1)) {
    const c = calendarDay(d, input);
    if (
      c.status === 'done' ||
      c.status === 'missed' ||
      c.status === 'today' ||
      c.status === 'planned'
    )
      planned++;
  }
  const done = sessions.filter((s) => s.status === 'done');
  const inRange = (from: string, to: string) =>
    done
      .filter((s) => s.date >= from && s.date <= to)
      .reduce((v, s) => v + sessionStats(s, exercises).volume, 0);
  const volume = inRange(first, today);
  // stessi giorni del mese scorso (1 → giorno di oggi)
  const prevFirst = addDays(first, -1).slice(0, 7) + '-01';
  const prevTo = addDays(prevFirst, Number(today.slice(8)) - 1);
  const prevVolume = inRange(prevFirst, prevTo);
  return {
    done: done.filter((s) => s.date.startsWith(month)).length,
    planned: Math.max(planned, done.filter((s) => s.date.startsWith(month)).length),
    volume,
    volumeDeltaPct: prevVolume > 0 ? Math.round(((volume - prevVolume) / prevVolume) * 100) : null,
  };
}

export interface RecentRecord {
  date: string;
  sessionId: string;
  exerciseId: string;
  kinds: PbKind[];
  label: string;
}

/** Record battuti negli ultimi `days` giorni, dal più recente (uno per esercizio). */
export function recentRecords(
  sessions: Session[],
  exercises: Map<string, Exercise>,
  today: string,
  days = 21,
): RecentRecord[] {
  const done = sessions
    .filter((s) => s.status === 'done')
    .sort((a, b) => a.date.localeCompare(b.date) || (a.startedAt ?? 0) - (b.startedAt ?? 0));
  const from = addDays(today, -days);
  const out: RecentRecord[] = [];
  done.forEach((s, i) => {
    if (s.date < from) return;
    const r = sessionRecords(s, done.slice(0, i), exercises);
    for (const b of s.blocks)
      for (const it of b.items) {
        const kinds = new Set<PbKind>();
        it.sets.forEach((_, si) => r.sets.get(`${it.id}:${si}`)?.forEach((k) => kinds.add(k)));
        if (r.volume.has(it.id)) kinds.add('volume');
        if (!kinds.size) continue;
        const ex = exercises.get(it.exerciseId);
        const best = ex ? sessionValue(s, ex) : null;
        out.push({
          date: s.date,
          sessionId: s.id,
          exerciseId: it.exerciseId,
          kinds: [...kinds],
          label: best?.topSet ?? '',
        });
      }
  });
  const seen = new Set<string>();
  return out.reverse().filter((r) => !seen.has(r.exerciseId) && seen.add(r.exerciseId));
}

/**
 * Esercizi fermi: nelle ultime `n` sessioni la serie migliore non ha superato
 * quella di `n` sessioni fa, su un arco di almeno due settimane.
 */
export function stalledExercises(
  sessions: Session[],
  exercises: Map<string, Exercise>,
  n = 3,
): { exerciseId: string; since: string }[] {
  const done = sessions
    .filter((s) => s.status === 'done')
    .sort((a, b) => a.date.localeCompare(b.date));
  const ids = new Set(done.flatMap((s) => s.exerciseIds));
  const out: { exerciseId: string; since: string }[] = [];
  for (const id of ids) {
    const ex = exercises.get(id);
    if (!ex) continue;
    const series = done
      .filter((s) => s.exerciseIds.includes(id))
      .map((s) => ({ date: s.date, value: sessionValue(s, ex)?.value ?? 0 }))
      .filter((x) => x.value > 0);
    if (series.length < n + 1) continue;
    const ref = series[series.length - n - 1]!;
    const recent = series.slice(-n);
    const spanDays =
      (new Date(`${recent.at(-1)!.date}T12:00`).getTime() -
        new Date(`${ref.date}T12:00`).getTime()) /
      86400000;
    if (spanDays >= 14 && recent.every((x) => x.value <= ref.value))
      out.push({ exerciseId: id, since: ref.date });
  }
  return out;
}

/** Ultimo peso registrato e variazione rispetto a circa un mese prima. */
export function weightTrend(metrics: BodyMetric[], today: string) {
  const withWeight = metrics.filter((m) => m.weightKg).sort((a, b) => a.date.localeCompare(b.date));
  const last = withWeight.at(-1);
  if (!last) return null;
  const monthAgo = addDays(today, -30);
  const ref = [...withWeight].reverse().find((m) => m.date <= monthAgo);
  return {
    weightKg: last.weightKg!,
    date: last.date,
    deltaKg: ref ? Math.round((last.weightKg! - ref.weightKg!) * 10) / 10 : null,
  };
}
