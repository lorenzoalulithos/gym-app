import type { Program, ProgramDay, ScheduleOverride, Session } from '@/db/types';
import { todayIso } from './format';
import { activeProgram } from './session';

export type DayStatus = 'done' | 'missed' | 'today' | 'planned' | 'skipped' | 'rest';

export interface CalendarDay {
  date: string;
  program?: Program | undefined;
  /** Allenamento previsto (dallo schema settimanale o da uno spostamento). */
  planned?: ProgramDay | undefined;
  override?: ScheduleOverride | undefined;
  sessions: Session[];
  status: DayStatus;
}

/** 1 = lunedì … 7 = domenica */
export function isoWeekday(date: string): number {
  const d = new Date(`${date}T12:00:00`).getDay();
  return d === 0 ? 7 : d;
}

export function addDays(date: string, n: number): string {
  const d = new Date(`${date}T12:00:00`);
  d.setDate(d.getDate() + n);
  return todayIso(d);
}

/** Lettera del giorno nella scheda (A, B, C…) per le celle del calendario. */
export function dayLetter(program: Program | undefined, dayId: string | undefined): string {
  const i = program?.days.findIndex((d) => d.id === dayId) ?? -1;
  return i >= 0 ? String.fromCharCode(65 + i) : '';
}

export interface CalendarInput {
  programs: Program[];
  overrides: Map<string, ScheduleOverride>;
  sessionsByDate: Map<string, Session[]>;
  today?: string;
  /** Prima data tracciata: prima di questa i giorni senza sessione non contano come saltati. */
  since?: string;
}

export function plannedFor(date: string, input: CalendarInput) {
  const program = activeProgram(input.programs, date);
  const override = input.overrides.get(date);
  let planned: ProgramDay | undefined;
  if (override) {
    const p = input.programs.find((x) => x.id === override.programId) ?? program;
    planned = override.dayId ? p?.days.find((d) => d.id === override.dayId) : undefined;
    return { program: p, planned, override };
  }
  planned = program?.days.find((d) => d.weekday === isoWeekday(date));
  return { program, planned, override };
}

export function calendarDay(date: string, input: CalendarInput): CalendarDay {
  const today = input.today ?? todayIso();
  const { program, planned, override } = plannedFor(date, input);
  const sessions = (input.sessionsByDate.get(date) ?? []).filter((s) => s.status === 'done');
  let status: DayStatus;
  if (sessions.length) status = 'done';
  else if (override?.skipped) status = 'skipped';
  else if (!planned || (input.since && date < input.since)) status = 'rest';
  else if (date < today) status = 'missed';
  else if (date === today) status = 'today';
  else status = 'planned';
  return { date, program, planned, override, sessions, status };
}

/** Le 6 settimane (lun-dom) che coprono il mese, come in un calendario da parete. */
export function monthGrid(month: string, input: CalendarInput): CalendarDay[] {
  const first = `${month}-01`;
  const start = addDays(first, -(isoWeekday(first) - 1));
  return Array.from({ length: 42 }, (_, i) => calendarDay(addDays(start, i), input));
}

/** Allenamenti saltati negli ultimi `days` giorni, dal più recente. */
export function recentMissed(input: CalendarInput, days = 7): CalendarDay[] {
  const today = input.today ?? todayIso();
  const out: CalendarDay[] = [];
  for (let i = 1; i <= days; i++) {
    const d = calendarDay(addDays(today, -i), input);
    if (d.status === 'missed') out.push(d);
  }
  return out;
}

/** Prossimo giorno con un allenamento previsto (oggi compreso). */
export function nextPlanned(
  input: CalendarInput,
  from?: string,
  horizon = 14,
): CalendarDay | undefined {
  const start = from ?? input.today ?? todayIso();
  for (let i = 0; i <= horizon; i++) {
    const d = calendarDay(addDays(start, i), input);
    if (d.planned && (d.status === 'today' || d.status === 'planned')) return d;
  }
  return undefined;
}

export interface ScheduleChanges {
  put: ScheduleOverride[];
  del: string[];
}

/**
 * Spostamento di un allenamento a un'altra data.
 * Gli spostamenti non fanno catene: si riparte sempre dalla data originale, così
 * "Ripristina" su qualunque estremo rimette tutto com'era.
 */
export function moveOverrides(
  from: CalendarDay,
  to: string,
  input: CalendarInput,
): ScheduleChanges | null {
  if (!from.planned || !from.program || to === from.date) return null;
  const programId = from.program.id;
  const dayId = from.planned.id;
  const origin = from.override?.movedFrom ?? from.date;
  const changes: ScheduleChanges = { put: [], del: [] };

  // la data intermedia di uno spostamento precedente torna allo schema settimanale
  if (from.override?.movedFrom) changes.del.push(from.date);

  // se la destinazione ospitava già un allenamento spostato, la sua origine resta vuota
  const target = input.overrides.get(to);
  if (target?.movedFrom && target.movedFrom !== origin) {
    changes.put.push({ date: target.movedFrom, programId: target.programId, dayId: null });
  }

  if (to === origin) {
    // riportato al suo giorno: basta togliere le eccezioni
    changes.del.push(origin);
    if (!changes.del.includes(to)) changes.del.push(to);
    return changes;
  }
  changes.put.push(
    { date: origin, programId, dayId: null, movedTo: to },
    { date: to, programId, dayId, movedFrom: origin },
  );
  return changes;
}

export function groupByDate(sessions: Session[]): Map<string, Session[]> {
  const map = new Map<string, Session[]>();
  for (const s of sessions) {
    if (!map.has(s.date)) map.set(s.date, []);
    map.get(s.date)!.push(s);
  }
  return map;
}
