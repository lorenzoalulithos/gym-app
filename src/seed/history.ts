import type { Session } from '@/db/types';
import { touchSession } from '@/domain/session';
import { program } from './programs/2026-09-coach';

// Settimana 12-17 ottobre 2026 dagli screenshot Everfit.
// I target della scheda sono stati ricavati proprio da questi log, quindi le serie coincidono.
const LOGS: { dayIdx: number; date: string; start: string; end: string; difficulty?: number }[] = [
  { dayIdx: 0, date: '2026-10-12', start: '18:32', end: '19:33' },
  { dayIdx: 1, date: '2026-10-14', start: '18:34', end: '19:29', difficulty: 4 },
  { dayIdx: 2, date: '2026-10-15', start: '18:08', end: '19:20' },
  { dayIdx: 3, date: '2026-10-17', start: '17:38', end: '18:39' },
];

const at = (date: string, hhmm: string) => new Date(`${date}T${hhmm}:00`).getTime();

export function seedHistory(): Session[] {
  return LOGS.map(({ dayIdx, date, start, end, difficulty }) => {
    const day = program.days[dayIdx]!;
    const s: Session = {
      id: `everfit-${date}`,
      date,
      status: 'done',
      startedAt: at(date, start),
      endedAt: at(date, end),
      programId: program.id,
      dayId: day.id,
      title: day.name,
      notes: 'Importato da Everfit',
      blocks: day.blocks.map((b) => ({
        id: `${date}-${b.id}`,
        type: b.type,
        restSec: b.restSec,
        items: b.items.map((it) => ({
          id: `${date}-${it.id}`,
          exerciseId: it.exerciseId,
          sets: it.sets.map((t) => ({
            target: t,
            ...(typeof t.reps === 'number' ? { reps: t.reps } : {}),
            ...(t.weightKg !== undefined ? { weightKg: t.weightKg } : {}),
            ...(t.durationSec !== undefined ? { durationSec: t.durationSec } : {}),
            done: true,
          })),
        })),
      })),
      exerciseIds: [],
      updatedAt: 0,
    };
    if (difficulty) s.difficulty = difficulty;
    return touchSession(s);
  });
}
