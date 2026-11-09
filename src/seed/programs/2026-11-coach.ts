import type { BlockType, Program, SetTarget } from '@/db/types';

// Primo mese delle schede del coach (PDF di novembre 2026), 4 allenamenti a settimana.
// Arriva come bozza: si controlla e si attiva dal percorso guidato, che chiude la scheda precedente.
// Senza rack: back squat → squat con manubri ai fianchi, front squat → goblet squat.

type ItemDef = [
  exerciseId: string,
  sets: SetTarget[],
  extra?: { restSec?: number; notes?: string },
];

const sets = (n: number, t: SetTarget): SetTarget[] => Array.from({ length: n }, () => ({ ...t }));
const pyramid = (...reps: number[]): SetTarget[] => reps.map((r) => ({ reps: r }));

const block = (dayId: string, i: number, type: BlockType, restSec: number, items: ItemDef[]) => ({
  id: `${dayId}-b${i}`,
  type,
  restSec,
  items: items.map(([exerciseId, s, extra], j) => ({
    id: `${dayId}-b${i}-i${j}`,
    exerciseId,
    sets: s,
    ...extra,
  })),
});

const A = 'coach-2611-a';
const B = 'coach-2611-b';
const C = 'coach-2611-c';
const D = 'coach-2611-d';

export const program: Program = {
  id: 'coach-2026-11',
  name: 'Coach · mese 1',
  startDate: '2026-11-09',
  endDate: '2026-12-06',
  notes: 'Dai PDF del coach. Squat col bilanciere sostituiti con i manubri (niente rack).',
  source: 'seed',
  draft: true,
  updatedAt: 0,
  days: [
    {
      id: A,
      name: 'Dorso spalle core',
      weekday: 7,
      blocks: [
        block(A, 0, 'single', 90, [['pullups', sets(4, { reps: { min: 6, max: 8 } })]]),
        block(A, 1, 'single', 90, [['chin-up', sets(4, { reps: { min: 6, max: 8 } })]]),
        block(A, 2, 'single', 90, [['one-arm-dumbbell-row', pyramid(14, 12, 10, 8)]]),
        block(A, 3, 'single', 90, [
          ['dumbbell-shoulder-press', sets(4, { reps: 12 }), { notes: 'Da seduto' }],
        ]),
        block(A, 4, 'single', 45, [['side-lateral-raise', sets(4, { reps: 8 })]]),
        block(A, 5, 'superset', 60, [
          ['hollow-body-hold', sets(4, { durationSec: 30 }), { restSec: 15 }],
          ['lying-windshield-wipers', sets(4, { durationSec: 30 }), { restSec: 15 }],
          ['rotational-side-plank', sets(4, { durationSec: 30 })],
        ]),
        block(A, 6, 'single', 60, [['standing-dumbbell-triceps-extension', sets(3, { reps: 20 })]]),
        block(A, 7, 'single', 60, [
          [
            'bench-dips',
            sets(3, { reps: 8 }),
            { notes: 'Piedi rialzati, appoggia peso sulle gambe' },
          ],
        ]),
        block(A, 8, 'single', 90, [
          [
            'diamond-push-up',
            [{}],
            {
              notes:
                'Massime ripetizioni. In alternativa: push up, decline, presa larga, dive bomber, pike',
            },
          ],
        ]),
      ],
    },
    {
      id: B,
      name: 'Petto bicipiti core',
      weekday: 2,
      blocks: [
        block(B, 0, 'single', 90, [['dive-bomber-push-up', pyramid(14, 12, 10, 8)]]),
        block(B, 1, 'single', 90, [['decline-push-up', pyramid(14, 12, 10, 8)]]),
        block(B, 2, 'single', 60, [
          [
            'pushups',
            sets(5, { reps: 20 }),
            { notes: '100 push up facili, se serve sulle ginocchia' },
          ],
        ]),
        block(B, 3, 'single', 90, [['hammer-curls', sets(4, { reps: 14 })]]),
        block(B, 4, 'single', 90, [['dumbbell-bicep-curl', sets(4, { reps: 10 })]]),
        block(B, 5, 'superset', 60, [
          ['seated-leg-tucks', sets(3, { reps: 15 }), { restSec: 15 }],
          ['scissor-kicks', sets(3, { reps: 20 })],
        ]),
        block(B, 6, 'superset', 60, [
          ['knee-hip-raise-on-parallel-bars', sets(3, { reps: 15 }), { restSec: 0 }],
          ['russian-twist', sets(3, { reps: 20 }), { notes: 'Col disco' }],
        ]),
        block(B, 7, 'single', 120, [
          ['wide-grip-pull-up', [{}, {}, {}], { notes: 'A sfinimento' }],
        ]),
      ],
    },
    {
      id: C,
      name: 'Gambe + AMRAP',
      weekday: 4,
      blocks: [
        block(C, 0, 'single', 120, [
          [
            'dumbbell-squat',
            sets(5, { reps: 5 }),
            { notes: 'Al posto del back squat: manubri lungo i fianchi' },
          ],
        ]),
        block(C, 1, 'single', 120, [
          ['goblet-squat', sets(5, { reps: 5 }), { notes: 'Al posto del front squat' }],
        ]),
        block(C, 2, 'single', 120, [
          ['dumbbell-lunges', sets(4, { reps: 10 }), { notes: 'Camminando' }],
        ]),
        block(C, 3, 'single', 60, [['single-leg-hip-thrust', sets(4, { reps: 10 })]]),
        block(C, 4, 'single', 60, [['leg-extensions', sets(3, { reps: 15 })]]),
        block(C, 5, 'circuit', 0, [
          ['barbell-curl', sets(4, { reps: 8 })],
          ['dips-triceps-version', sets(4, { reps: 8 })],
          ['mountain-climbers', sets(4, { reps: 20 }), { notes: 'Incrociati' }],
          [
            'flutter-kicks',
            sets(4, { reps: 20 }),
            { notes: 'AMRAP 10 minuti senza pause: più giri possibile, segna quelli fatti' },
          ],
        ]),
      ],
    },
    {
      id: D,
      name: 'Corsa a intervalli',
      weekday: 5,
      blocks: [
        block(D, 0, 'circuit', 30, [
          ['skip-running', sets(3, { durationSec: 30 }), { restSec: 30 }],
          ['back-walk', sets(3, { durationSec: 10 }), { restSec: 20 }],
          ['glute-bridge-hamstring-walkout', sets(3, { durationSec: 30 })],
        ]),
        block(D, 1, 'single', 50, [
          ['running', sets(6, { durationSec: 60 }), { notes: '1 minuto di corsa, poi camminata' }],
        ]),
        block(D, 2, 'single', 60, [['running', sets(3, { durationSec: 120 })]]),
        block(D, 3, 'single', 120, [['running', sets(2, { durationSec: 120 })]]),
        block(D, 4, 'single', 0, [['stretching-full-body', [{ durationSec: 300 }]]]),
      ],
    },
  ],
};
