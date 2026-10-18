import type { BodyField, BodyMetric, Exercise, Session } from '@/db/types';
import { sessionValue } from './analysis';
import { addDays, calendarDay, isoWeekday, type CalendarInput } from './calendar';
import { isWorkSet, sessionRecords } from './records';
import { sessionStats } from './session';

export interface ExerciseMonthTrend {
  exerciseId: string;
  sessions: number;
  metric: 'e1rm' | 'reps' | 'time';
  first: number;
  last: number;
  /** Variazione % dal primo all'ultimo allenamento considerato. */
  deltaPct: number | null;
  /** Se nel mese c'è una sola sessione, il confronto è con l'ultima del mese prima. */
  comparedWithPrevious: boolean;
}

export interface WeekRow {
  monday: string;
  done: number;
  planned: number;
  missed: number;
}

export interface MonthReport {
  month: string;
  done: number;
  planned: number;
  missed: number;
  adherencePct: number | null;
  minutes: number;
  sets: number;
  volume: number;
  prevVolume: number;
  records: number;
  weeks: WeekRow[];
  /** Serie a settimana per gruppo muscolare (muscoli principali), dal più allenato. */
  muscleSets: { muscle: string; perWeek: number }[];
  exercises: ExerciseMonthTrend[];
  body: { field: BodyField; first: number; last: number; delta: number }[];
}

const metricOf = (ex: Exercise): ExerciseMonthTrend['metric'] =>
  ex.measure === 'weight_reps' ? 'e1rm' : ex.measure === 'reps' ? 'reps' : 'time';

const lastDayOf = (month: string) => addDays(`${addDays(`${month}-28`, 7).slice(0, 7)}-01`, -1);

export function monthReport(
  month: string,
  input: CalendarInput,
  sessions: Session[],
  exercises: Map<string, Exercise>,
  metrics: BodyMetric[],
  today: string,
): MonthReport {
  const first = `${month}-01`;
  const last = lastDayOf(month);
  const end = last < today ? last : today;
  const done = sessions
    .filter((s) => s.status === 'done')
    .sort((a, b) => a.date.localeCompare(b.date) || (a.startedAt ?? 0) - (b.startedAt ?? 0));
  const inMonth = done.filter((s) => s.date >= first && s.date <= last);

  // costanza, settimana per settimana (lun-dom) dentro il mese
  let planned = 0;
  let missed = 0;
  const weeks = new Map<string, WeekRow>();
  for (let d = first; d <= last; d = addDays(d, 1)) {
    const c = calendarDay(d, input);
    const monday = addDays(d, -(isoWeekday(d) - 1));
    if (!weeks.has(monday)) weeks.set(monday, { monday, done: 0, planned: 0, missed: 0 });
    const w = weeks.get(monday)!;
    if (c.status === 'done') w.done++;
    if (['done', 'missed', 'today', 'planned'].includes(c.status)) {
      w.planned++;
      planned++;
    }
    if (c.status === 'missed') {
      w.missed++;
      missed++;
    }
  }
  const pastPlanned = [...weeks.values()].reduce((n, w) => n + w.done + w.missed, 0);

  let minutes = 0;
  let sets = 0;
  let volume = 0;
  let records = 0;
  const muscle = new Map<string, number>();
  for (const s of inMonth) {
    const st = sessionStats(s, exercises);
    minutes += st.minutes ?? 0;
    sets += st.sets;
    volume += st.volume;
    records += sessionRecords(
      s,
      done.filter((x) => x.date < s.date),
      exercises,
    ).count;
    for (const b of s.blocks)
      for (const it of b.items) {
        const n = it.sets.filter(isWorkSet).length;
        for (const m of exercises.get(it.exerciseId)?.primaryMuscles ?? [])
          muscle.set(m, (muscle.get(m) ?? 0) + n);
      }
  }
  const weeksElapsed = Math.max(
    1,
    ((new Date(`${end}T12:00`).getTime() - new Date(`${first}T12:00`).getTime()) / 86400000 + 1) /
      7,
  );

  const prevFirst = `${addDays(first, -1).slice(0, 7)}-01`;
  const prevVolume = done
    .filter((s) => s.date >= prevFirst && s.date < first)
    .reduce((v, s) => v + sessionStats(s, exercises).volume, 0);

  // andamento esercizi
  const ids = [...new Set(inMonth.flatMap((s) => s.exerciseIds))];
  const trends: ExerciseMonthTrend[] = [];
  for (const id of ids) {
    const ex = exercises.get(id);
    if (!ex) continue;
    const series = inMonth
      .filter((s) => s.exerciseIds.includes(id))
      .map((s) => sessionValue(s, ex)?.value ?? 0)
      .filter((v) => v > 0);
    if (!series.length) continue;
    let base = series[0]!;
    let comparedWithPrevious = false;
    if (series.length === 1) {
      const prev = [...done]
        .reverse()
        .find((s) => s.date < first && s.exerciseIds.includes(id) && sessionValue(s, ex));
      if (prev) {
        base = sessionValue(prev, ex)!.value;
        comparedWithPrevious = true;
      }
    }
    const lastV = series.at(-1)!;
    trends.push({
      exerciseId: id,
      sessions: series.length,
      metric: metricOf(ex),
      first: base,
      last: lastV,
      deltaPct:
        series.length > 1 || comparedWithPrevious
          ? Math.round(((lastV - base) / base) * 1000) / 10
          : null,
      comparedWithPrevious,
    });
  }
  trends.sort((a, b) => (b.deltaPct ?? -Infinity) - (a.deltaPct ?? -Infinity));

  // corpo: primo e ultimo valore del mese per ogni misura
  const fields: BodyField[] = ['weightKg', 'waistCm', 'chestCm', 'armCm', 'thighCm', 'hipsCm'];
  const monthMetrics = metrics
    .filter((m) => m.date >= first && m.date <= last)
    .sort((a, b) => a.date.localeCompare(b.date));
  const body = fields.flatMap((field) => {
    const vals = monthMetrics.map((m) => m[field]).filter((v): v is number => v !== undefined);
    if (!vals.length) return [];
    const f = vals[0]!;
    const l = vals.at(-1)!;
    return [{ field, first: f, last: l, delta: Math.round((l - f) * 10) / 10 }];
  });

  return {
    month,
    done: inMonth.length,
    planned: Math.max(planned, inMonth.length),
    missed,
    adherencePct: pastPlanned
      ? Math.round(([...weeks.values()].reduce((n, w) => n + w.done, 0) / pastPlanned) * 100)
      : null,
    minutes,
    sets,
    volume,
    prevVolume,
    records,
    weeks: [...weeks.values()],
    muscleSets: [...muscle]
      .map(([m, n]) => ({ muscle: m, perWeek: Math.round((n / weeksElapsed) * 10) / 10 }))
      .sort((a, b) => b.perWeek - a.perWeek),
    exercises: trends,
    body,
  };
}
