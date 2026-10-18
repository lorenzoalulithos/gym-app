import { describe, expect, it } from 'vitest';
import type { Exercise, Program, Session } from '@/db/types';
import { epley } from '@/domain/e1rm';
import { formatDuration, formatSet, summarizeTargets } from '@/domain/format';
import { bestsFor, sessionRecords } from '@/domain/records';
import {
  lastPerformance,
  nextDay,
  prefillSet,
  restAfter,
  sessionFromDay,
  suggestIncrease,
} from '@/domain/session';
import { compareWithLast } from '@/domain/compare';
import { firstUndone, setOrder } from '@/domain/focus';
import { exerciseTrends } from '@/domain/analysis';

const ex = (over: Partial<Exercise> = {}): Exercise => ({
  id: 'x',
  name: 'X',
  aliases: [],
  category: 'strength',
  equipment: 'dumbbell',
  primaryMuscles: [],
  secondaryMuscles: [],
  instructions: [],
  images: [],
  measure: 'weight_reps',
  loadMode: 'per_implement',
  perSide: false,
  implements: 2,
  source: 'custom',
  updatedAt: 0,
  ...over,
});

const session = (
  date: string,
  sets: { reps?: number; weightKg?: number; durationSec?: number }[],
  id = date,
): Session => ({
  id,
  date,
  status: 'done',
  title: 't',
  programId: 'p',
  dayId: 'd1',
  blocks: [
    {
      id: 'b',
      type: 'single',
      restSec: 60,
      items: [{ id: `i-${id}`, exerciseId: 'x', sets: sets.map((s) => ({ ...s, done: true })) }],
    },
  ],
  exerciseIds: ['x'],
  updatedAt: 0,
});

describe('epley', () => {
  // valori della colonna 1RM negli screenshot Everfit
  it.each([
    [12.5, 10, 17],
    [34, 6, 41],
    [34, 4, 39],
    [61, 10, 81],
    [45, 8, 57],
    [8, 11, 11],
    [10, 8, 13],
    [55, 6, 66],
    [18, 8, 23],
  ])('%s kg × %s ≈ %s', (w, r, expected) => expect(Math.round(epley(w, r))).toBe(expected));
});

describe('format', () => {
  it('durate come Everfit', () => {
    expect(formatDuration(45)).toBe('45 sec');
    expect(formatDuration(60)).toBe('1 min');
    expect(formatDuration(65)).toBe('1:05 min');
  });
  it('serie', () => {
    expect(formatSet({ weightKg: 34, reps: 6, done: true })).toBe('34 kg × 6 rip');
    expect(formatSet({ durationSec: 30, reps: 10, done: true })).toBe('30 sec × 10 rip');
    expect(formatSet({ reps: 8, done: true }, { perSide: true })).toBe('8 rip /lato');
  });
  it('riassunto target', () => {
    expect(summarizeTargets([{ reps: 10 }, { reps: 10 }, { reps: 10 }])).toBe('3 × 10 rip');
    expect(summarizeTargets([{ reps: { min: 8, max: 10 }, weightKg: 20 }])).toBe(
      '1 × 20 kg × 8-10 rip',
    );
  });
});

describe('record', () => {
  const e = ex();
  const prev = [session('2026-10-01', [{ weightKg: 18, reps: 8 }])];
  it('nessun record alla prima volta', () => {
    const r = sessionRecords(prev[0]!, [], new Map([['x', e]]));
    expect(r.count).toBe(0);
  });
  it('record su carico e massimale, una sola volta per valore', () => {
    const s = session('2026-10-17', [
      { weightKg: 18, reps: 8 },
      { weightKg: 19, reps: 8 },
      { weightKg: 19, reps: 8 },
    ]);
    const r = sessionRecords(s, prev, new Map([['x', e]]));
    expect(r.sets.get('i-2026-10-17:1')).toEqual(['e1rm', 'weight']);
    expect(r.sets.has('i-2026-10-17:2')).toBe(false);
    expect(r.volume.has('i-2026-10-17')).toBe(true);
  });
  it('bests', () => {
    expect(bestsFor(prev, 'x', e).weight).toBe(18);
  });
});

describe('sessione', () => {
  const program: Program = {
    id: 'p',
    name: 'P',
    startDate: '2026-09-01',
    source: 'user',
    updatedAt: 0,
    days: [
      {
        id: 'd1',
        name: 'A',
        blocks: [
          {
            id: 'b',
            type: 'single',
            restSec: 60,
            items: [
              {
                id: 'i',
                exerciseId: 'x',
                sets: [{ reps: { min: 8, max: 10 } }, { reps: { min: 8, max: 10 } }],
              },
            ],
          },
        ],
      },
      { id: 'd2', name: 'B', blocks: [] },
    ],
  };
  const history = [
    session('2026-10-10', [
      { weightKg: 20, reps: 10 },
      { weightKg: 20, reps: 10 },
    ]),
  ];

  it('rotazione dei giorni', () => {
    expect(nextDay(program, history)?.id).toBe('d2');
    expect(nextDay(program, [])?.id).toBe('d1');
  });
  it("precompila carico dall'ultima volta e ripetizioni dalla scheda", () => {
    expect(
      prefillSet({ reps: { min: 8, max: 10 } }, { weightKg: 20, reps: 7, done: true }),
    ).toMatchObject({ weightKg: 20, reps: 10 });
    const s = sessionFromDay(program, program.days[0]!, history, '2026-10-18');
    expect(s.blocks[0]!.items[0]!.sets.map((x) => x.weightKg)).toEqual([20, 20]);
    expect(s.exerciseIds).toEqual(['x']);
  });
  it('suggerisce aumento se il tetto è raggiunto', () => {
    const last = lastPerformance(history, 'x');
    expect(suggestIncrease(ex(), program.days[0]!.blocks[0]!.items[0]!.sets, last)).toBe(1);
    expect(
      suggestIncrease(ex({ loadMode: 'total' }), [{ reps: 12 }, { reps: 12 }], last),
    ).toBeUndefined();
  });
  it("trend per l'export", () => {
    const t = exerciseTrends(
      [...history, session('2026-10-17', [{ weightKg: 22, reps: 10 }], 's2')],
      new Map([['x', ex()]]),
    );
    expect(t[0]!.trend).toBe('progress');
    expect(t[0]!.series).toHaveLength(2);
  });
});

describe('recupero per esercizio', () => {
  const block = (type: 'single' | 'superset', items: { restSec?: number }[]) => ({
    type,
    restSec: 90,
    items,
  });
  it('singolo: vale il blocco, salvo recupero proprio', () => {
    expect(restAfter(block('single', [{}]), 0)).toBe(90);
    expect(restAfter(block('single', [{ restSec: 45 }]), 0)).toBe(45);
  });
  it('superset: nessun recupero tra gli esercizi, quello del blocco a fine giro', () => {
    const b = block('superset', [{}, {}]);
    expect(restAfter(b, 0)).toBe(0);
    expect(restAfter(b, 1)).toBe(90);
    expect(restAfter(block('superset', [{ restSec: 20 }, {}]), 0)).toBe(20);
  });
  it('il recupero della serie vince su tutto', () => {
    expect(restAfter(block('single', [{ restSec: 45 }]), 0, 150)).toBe(150);
  });
});

describe("confronto con l'ultima volta", () => {
  it('ordina da dove hai spinto di più', () => {
    const a = ex({ id: 'x' });
    const b = ex({ id: 'y', name: 'Y' });
    const mk = (date: string, xw: number, yw: number): Session => ({
      ...session(date, []),
      id: date,
      blocks: [
        {
          id: 'b1',
          type: 'single',
          restSec: 60,
          items: [
            { id: `x${date}`, exerciseId: 'x', sets: [{ weightKg: xw, reps: 8, done: true }] },
          ],
        },
        {
          id: 'b2',
          type: 'single',
          restSec: 60,
          items: [
            { id: `y${date}`, exerciseId: 'y', sets: [{ weightKg: yw, reps: 8, done: true }] },
          ],
        },
      ],
      exerciseIds: ['x', 'y'],
    });
    const r = compareWithLast(
      mk('2026-10-20', 20, 30),
      [mk('2026-10-13', 20, 25)],
      new Map([
        ['x', a],
        ['y', b],
      ]),
    );
    expect(r.map((p) => p.exerciseId)).toEqual(['y', 'x']);
    expect(r[0]!.deltaPct).toBeCloseTo(20, 0);
    expect(r[1]!.deltaPct).toBe(0);
  });
});

describe('modalità focus', () => {
  it('ordine delle serie: superset a giri, singoli in fila', () => {
    const s: Session = {
      ...session('2026-10-20', []),
      blocks: [
        {
          id: 'b1',
          type: 'superset',
          restSec: 90,
          items: [
            { id: 'a', exerciseId: 'x', sets: [{ done: true }, { done: false }] },
            { id: 'b', exerciseId: 'y', sets: [{ done: true }, { done: false }, { done: false }] },
          ],
        },
        {
          id: 'b2',
          type: 'single',
          restSec: 60,
          items: [{ id: 'c', exerciseId: 'z', sets: [{ done: false }] }],
        },
      ],
    };
    const order = setOrder(s).map((p) => `${p.bi}${p.ii}${p.si}`);
    expect(order).toEqual(['000', '010', '001', '011', '012', '100']);
    expect(firstUndone(s)).toBe(2);
  });
});
