import { describe, expect, it } from 'vitest';
import type { Program, ScheduleOverride, Session } from '@/db/types';
import {
  calendarDay,
  groupByDate,
  isoWeekday,
  monthGrid,
  moveOverrides,
  nextPlanned,
  recentMissed,
  type CalendarInput,
} from '@/domain/calendar';
import { reminderFor } from '@/domain/reminder';

// Settimana tipo: A lunedì, B mercoledì
const program: Program = {
  id: 'p',
  name: 'P',
  startDate: '2026-10-01',
  source: 'user',
  updatedAt: 0,
  days: [
    { id: 'a', name: 'A', weekday: 1, blocks: [] },
    { id: 'b', name: 'B', weekday: 3, blocks: [] },
  ],
};

const done = (date: string, dayId: string): Session => ({
  id: date,
  date,
  status: 'done',
  title: dayId,
  programId: 'p',
  dayId,
  blocks: [],
  exerciseIds: [],
  updatedAt: 0,
});

const input = (
  sessions: Session[],
  overrides: ScheduleOverride[] = [],
  today = '2026-10-21',
): CalendarInput => ({
  programs: [program],
  overrides: new Map(overrides.map((o) => [o.date, o])),
  sessionsByDate: groupByDate(sessions),
  today,
  since: '2026-10-12',
});

function applyMove(i: CalendarInput, from: string, to: string): CalendarInput {
  const c = moveOverrides(calendarDay(from, i), to, i)!;
  const overrides = new Map(i.overrides);
  for (const d of c.del) overrides.delete(d);
  for (const o of c.put) overrides.set(o.date, o);
  return { ...i, overrides };
}

describe('calendario', () => {
  it('giorno della settimana ISO', () => {
    expect(isoWeekday('2026-10-19')).toBe(1); // lunedì
    expect(isoWeekday('2026-10-25')).toBe(7); // domenica
  });

  it('stati: fatto, saltato, oggi, previsto, riposo', () => {
    const i = input([done('2026-10-12', 'a')]);
    expect(calendarDay('2026-10-12', i).status).toBe('done');
    expect(calendarDay('2026-10-14', i).status).toBe('missed');
    expect(calendarDay('2026-10-21', i).status).toBe('today');
    expect(calendarDay('2026-10-26', i).status).toBe('planned');
    expect(calendarDay('2026-10-22', i).status).toBe('rest');
    // prima dell'inizio del tracciamento non si segna nulla come saltato
    expect(calendarDay('2026-10-05', i).status).toBe('rest');
  });

  it('griglia di 6 settimane che parte di lunedì', () => {
    const g = monthGrid('2026-10', input([]));
    expect(g).toHaveLength(42);
    expect(g[0]!.date).toBe('2026-09-28');
  });

  it('spostare un allenamento saltato a oggi', () => {
    const i = input([], [], '2026-10-20');
    const missed = recentMissed(i);
    expect(missed.map((d) => d.date)).toEqual(['2026-10-19', '2026-10-14']);
    const after = applyMove(i, '2026-10-19', '2026-10-20');
    expect(calendarDay('2026-10-19', after).status).toBe('rest');
    expect(calendarDay('2026-10-20', after)).toMatchObject({
      status: 'today',
      planned: { id: 'a' },
    });
    expect(recentMissed(after).map((d) => d.date)).toEqual(['2026-10-14']);
  });

  it("spostare due volte e ripristinare non duplica né perde l'allenamento", () => {
    const today = '2026-10-18';
    let i = input([], [], today);
    i = applyMove(i, '2026-10-19', '2026-10-21'); // A lun → mer (B di mercoledì viene sostituito)
    i = applyMove(i, '2026-10-21', '2026-10-23'); // A mer → ven
    expect(calendarDay('2026-10-19', i).planned).toBeUndefined();
    expect(calendarDay('2026-10-21', i).planned?.id).toBe('b'); // mercoledì torna B
    expect(calendarDay('2026-10-23', i).planned?.id).toBe('a');
    expect(i.overrides.get('2026-10-19')?.movedTo).toBe('2026-10-23');
    // riportato al giorno originale: nessuna eccezione rimasta
    i = applyMove(i, '2026-10-23', '2026-10-19');
    expect(i.overrides.size).toBe(0);
  });

  it('saltare di proposito non genera promemoria', () => {
    const i = input(
      [],
      [{ date: '2026-10-19', programId: 'p', dayId: null, skipped: true }],
      '2026-10-20',
    );
    expect(calendarDay('2026-10-19', i).status).toBe('skipped');
  });

  it('prossimo allenamento previsto', () => {
    expect(nextPlanned(input([], [], '2026-10-22'))?.date).toBe('2026-10-26');
  });

  it('promemoria', () => {
    expect(reminderFor(input([]), '2026-10-21')?.title).toBe('Oggi: B');
    expect(reminderFor(input([], [], '2026-10-20'), '2026-10-20')?.title).toBe('Hai saltato A');
    expect(reminderFor(input([done('2026-10-21', 'b')]), '2026-10-21')).toBeNull();
  });
});
