import { describe, expect, it } from 'vitest';
import library from '@/seed/library.json';
import {
  CUSTOM_EXERCISES,
  LIBRARY_OVERRIDES,
  fromLibrary,
  type LibraryEntry,
} from '@/seed/exercises';
import type { Session } from '@/db/types';
import { calendarDay, groupByDate } from '@/domain/calendar';
import { conditioningSec } from '@/domain/report';
import {
  canRunAsRounds,
  roundStats,
  roundSteps,
  roundsSession,
  suggestThemes,
  totalSec,
} from '@/domain/rounds';
import { buildIndex, matchExercise, parseBlocks } from '@/domain/textImport';
import { sessionFromDay } from '@/domain/session';

const exercises = [
  ...(library as LibraryEntry[]).map((e) => ({ ...fromLibrary(e), ...LIBRARY_OVERRIDES[e.id] })),
  ...CUSTOM_EXERCISES,
];
const byId = new Map(exercises.map((e) => [e.id, e]));

describe('allenamento a round', () => {
  it('un esercizio: round in fila, pausa tranne dopo l’ultimo, temi', () => {
    const s = roundsSession(
      {
        exerciseIds: ['heavy-bag'],
        rounds: 3,
        workSec: 180,
        restSec: 60,
        themes: ['Jab', '', 'Ganci'],
      },
      '2026-10-27',
      'Sacco',
    );
    expect(s.mode).toBe('rounds');
    const steps = roundSteps(s);
    expect(steps.map((x) => [x.workSec, x.restSec, x.theme])).toEqual([
      [180, 60, 'Jab'],
      [180, 60, undefined],
      [180, 0, 'Ganci'],
    ]);
    expect(totalSec({ rounds: 3, workSec: 180, restSec: 60 })).toBe(660);
    expect(canRunAsRounds(s)).toBe(true);
  });

  it('più esercizi si alternano round dopo round', () => {
    const s = roundsSession(
      {
        exerciseIds: ['rope-jumping', 'heavy-bag'],
        rounds: 5,
        workSec: 60,
        restSec: 30,
        themes: suggestThemes(5, ['rope-jumping', 'heavy-bag']),
      },
      '2026-10-27',
      'Corda + Sacco',
    );
    const steps = roundSteps(s);
    expect(steps.map((x) => x.exerciseId)).toEqual([
      'rope-jumping',
      'heavy-bag',
      'rope-jumping',
      'heavy-bag',
      'rope-jumping',
    ]);
    expect(steps.map((x) => x.restSec)).toEqual([30, 30, 30, 30, 0]);
    // temi solo nei round al sacco
    expect(steps.map((x) => x.theme)).toEqual([
      undefined,
      'Jab-diretto, sciolto',
      undefined,
      'Ganci',
      undefined,
    ]);
    expect(suggestThemes(4)).toEqual([
      'Jab-diretto, sciolto',
      'Ganci',
      'Montanti',
      'Ultimo round a tutta',
    ]);
  });

  it('statistiche e minuti di condizionamento contano solo i round fatti', () => {
    const s = roundsSession(
      { exerciseIds: ['heavy-bag'], rounds: 4, workSec: 120, restSec: 60, themes: [] },
      '2026-10-27',
      'Sacco',
    );
    const sets = s.blocks[0]!.items[0]!.sets;
    sets[0]!.done = true;
    sets[1]!.done = true;
    sets[1]!.durationSec = 90; // round interrotto prima
    expect(roundStats(s)).toEqual({ done: 2, total: 4, workSec: 210 });
    expect(conditioningSec(s, byId)).toEqual({ sec: 210, rounds: 2 });
  });

  it('scheda scritta a testo: tempi, pausa e temi dalle note', () => {
    const [b] = parseBlocks('Sacco 3x3:00 r60 (R1 jab-diretto; R2 ganci; R3 a tutta)');
    const index = buildIndex(exercises);
    expect(matchExercise(b!.items[0]!.raw, index).id).toBe('heavy-bag');
    const s = sessionFromDay(
      { id: 'p', name: 'p', startDate: '2026-10-01', source: 'user', days: [], updatedAt: 0 },
      {
        id: 'd',
        name: 'Boxe',
        blocks: [
          {
            id: 'b',
            type: 'single',
            restSec: b!.restSec ?? 60,
            items: [
              {
                id: 'i',
                exerciseId: 'heavy-bag',
                sets: b!.items[0]!.sets,
                ...(b!.items[0]!.notes ? { notes: b!.items[0]!.notes } : {}),
              },
            ],
          },
        ],
      },
      [],
      '2026-10-27',
    );
    expect(canRunAsRounds(s)).toBe(true);
    expect(roundSteps(s).map((x) => [x.workSec, x.restSec, x.theme])).toEqual([
      [180, 60, 'jab-diretto'],
      [180, 60, 'ganci'],
      [180, 0, 'a tutta'],
    ]);
  });

  it('una scheda coi pesi non va a round', () => {
    const s = roundsSession(
      { exerciseIds: ['heavy-bag'], rounds: 1, workSec: 60, restSec: 0, themes: [] },
      '2026-10-27',
      'x',
    );
    s.blocks[0]!.items.push({ id: 'w', exerciseId: 'pushups', sets: [{ reps: 10, done: false }] });
    expect(canRunAsRounds(s)).toBe(false);
  });

  it('sacco fuori scheda non segna come fatto l’allenamento previsto', () => {
    const s: Session = {
      ...roundsSession(
        { exerciseIds: ['heavy-bag'], rounds: 1, workSec: 60, restSec: 0, themes: [] },
        '2026-10-27',
        'Sacco',
      ),
      status: 'done',
    };
    const program = {
      id: 'p',
      name: 'p',
      startDate: '2026-10-01',
      source: 'user' as const,
      updatedAt: 0,
      days: [{ id: 'd', name: 'Push', weekday: 2, blocks: [] }],
    };
    const input = {
      programs: [program],
      overrides: new Map(),
      sessionsByDate: groupByDate([s]),
      today: '2026-10-28',
    };
    // martedì 27: previsto Push, fatto solo il sacco
    expect(calendarDay('2026-10-27', input).status).toBe('missed');
    // in un giorno di riposo invece conta
    const rest = { ...input, sessionsByDate: groupByDate([{ ...s, date: '2026-10-26' }]) };
    expect(calendarDay('2026-10-26', rest).status).toBe('done');
  });
});
