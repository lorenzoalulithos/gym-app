import type { BlockType, Program, SetTarget } from '@/db/types';

// Scheda del coach seguita da inizio settembre 2026, ricostruita dagli screenshot.
// Resta attiva finché non arriva la scheda successiva del coach.
// Gli screenshot sono log, non la scheda: i target sono quelli effettivamente fatti
// nella settimana 12-17 ottobre, i recuperi sono stimati.

type ItemDef = [exerciseId: string, sets: SetTarget[]];

const sets = (n: number, t: SetTarget): SetTarget[] => Array.from({ length: n }, () => ({ ...t }));

const block = (dayId: string, i: number, type: BlockType, restSec: number, items: ItemDef[]) => ({
  id: `${dayId}-b${i}`,
  type,
  restSec,
  items: items.map(([exerciseId, s], j) => ({ id: `${dayId}-b${i}-i${j}`, exerciseId, sets: s })),
});

const A = 'coach-2609-a';
const B = 'coach-2609-b';
const C = 'coach-2609-c';
const D = 'coach-2609-d';

export const program: Program = {
  id: 'coach-2026-09',
  name: 'Coach · settembre-ottobre',
  startDate: '2026-09-01',
  notes: 'Ricostruita dagli screenshot Everfit. Recuperi stimati.',
  source: 'seed',
  updatedAt: 0,
  days: [
    {
      id: A,
      name: 'Spinta/Tirata/ABS (sbarra)',
      weekday: 1,
      blocks: [
        block(A, 0, 'superset', 90, [
          ['plyo-push-up', sets(3, { reps: 9 })],
          ['pullups', [{ reps: 9 }, { reps: 8 }, { reps: 8 }]],
        ]),
        block(A, 1, 'superset', 90, [
          ['push-up-wide', sets(3, { reps: 10, weightKg: 12.5 })],
          ['chin-up', [{ reps: 9 }, { reps: 8 }, { reps: 8 }]],
        ]),
        block(A, 2, 'superset', 60, [
          ['plank-arm-leg-raise', sets(4, { durationSec: 60 })],
          ['lying-leg-raise', sets(4, { reps: 20 })],
        ]),
        block(A, 3, 'superset', 60, [
          ['kneeling-one-arm-triceps-extension', [{ reps: 30 }, { reps: 30 }, { reps: 25 }]],
          ['hanging-leg-raise', sets(3, { reps: 12 })],
        ]),
        block(A, 4, 'single', 45, [
          ['hollow-body-hold', sets(3, { durationSec: 45, weightKg: 4 })],
        ]),
        block(A, 5, 'single', 45, [['lying-windshield-wipers', sets(3, { durationSec: 45 })]]),
      ],
    },
    {
      id: B,
      name: 'Addome e gambe',
      weekday: 3,
      blocks: [
        block(B, 0, 'single', 30, [['flutter-kicks', sets(3, { durationSec: 30 })]]),
        block(B, 1, 'single', 45, [['v-sit-hold', sets(3, { durationSec: 45 })]]),
        block(B, 2, 'single', 45, [
          ['weighted-side-plank', sets(3, { durationSec: 50, weightKg: 17 })],
        ]),
        block(B, 3, 'single', 45, [
          [
            'forearm-plank-arm-leg-raise',
            [{ durationSec: 65 }, { durationSec: 75 }, { durationSec: 75 }],
          ],
        ]),
        block(B, 4, 'single', 30, [['side-lying-leg-raise', sets(3, { durationSec: 30 })]]),
        block(B, 5, 'single', 90, [['bulgarian-split-squat', sets(3, { reps: 8 })]]),
        block(B, 6, 'single', 90, [
          [
            'dumbbell-jump-squat',
            [
              { reps: 6, weightKg: 17 },
              { reps: 4, weightKg: 17 },
              { reps: 5, weightKg: 17 },
            ],
          ],
        ]),
        block(B, 7, 'single', 90, [['barbell-hip-thrust', sets(4, { reps: 10, weightKg: 61 })]]),
      ],
    },
    {
      id: C,
      name: 'Spinta/Tirata/ABS',
      weekday: 4,
      blocks: [
        block(C, 0, 'superset', 90, [
          ['pushups', sets(4, { reps: 12, weightKg: 12.5 })],
          ['pullups', [{ reps: 10 }, { reps: 10 }, { reps: 8 }, { reps: 8 }]],
        ]),
        block(C, 1, 'superset', 90, [
          ['push-ups-close-triceps-position', sets(5, { reps: 10 })],
          ['dumbbell-incline-row', sets(5, { reps: 8, weightKg: 22.5 })],
        ]),
        block(C, 2, 'superset', 60, [
          ['lying-windshield-wipers', sets(4, { durationSec: 45 })],
          ['double-crunch', sets(4, { reps: 20 })],
        ]),
        block(C, 3, 'superset', 75, [
          ['dive-bomber-push-up', [{ reps: 10 }, { reps: 10 }, { reps: 10 }, { reps: 8 }]],
          [
            'side-lateral-raise',
            [
              { reps: 11, weightKg: 8 },
              { reps: 10, weightKg: 8 },
              { reps: 10, weightKg: 8 },
              { reps: 8, weightKg: 10 },
            ],
          ],
        ]),
        block(C, 4, 'single', 0, [['fit-boxing', [{ durationSec: 420 }]]]),
      ],
    },
    {
      id: D,
      name: 'Gambe e schiena con pesi',
      weekday: 6,
      blocks: [
        block(D, 0, 'single', 90, [['stiff-legged-dumbbell-deadlift', sets(4, { reps: 10 })]]),
        block(D, 1, 'single', 120, [['sumo-deadlift', sets(4, { reps: 6, weightKg: 55 })]]),
        block(D, 2, 'single', 90, [['goblet-squat', sets(3, { reps: 10, weightKg: 30 })]]),
        block(D, 3, 'single', 45, [
          ['feet-elevated-hamstring-bridge', sets(3, { durationSec: 30 })],
        ]),
        block(D, 4, 'single', 90, [['bent-over-barbell-row', sets(4, { reps: 10 })]]),
        block(D, 5, 'single', 60, [['ab-roller', [{ reps: 15 }, { reps: 12 }, { reps: 12 }]]]),
        block(D, 6, 'single', 45, [['superman', sets(3, { durationSec: 45 })]]),
        block(D, 7, 'single', 75, [
          [
            'dumbbell-rear-delt-row',
            [
              { reps: 8, weightKg: 18 },
              { reps: 8, weightKg: 19 },
              { reps: 8, weightKg: 19 },
              { reps: 8, weightKg: 19 },
            ],
          ],
        ]),
        block(D, 8, 'single', 45, [['seated-leg-tucks', sets(4, { durationSec: 30, reps: 10 })]]),
        block(D, 9, 'single', 30, [['rope-jumping', sets(5, { durationSec: 120 })]]),
      ],
    },
  ],
};
