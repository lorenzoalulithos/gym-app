import type { Block, BlockItem, Exercise, ProgramDay, SetTarget } from '@/db/types';
import { formatReps } from './format';

// Modifiche "a riga intera" usate dall'editor delle schede: le serie di un esercizio si
// trattano come un tutt'uno finché sono uguali (3×10 @ 20 kg); se diverse (piramidi) si
// modificano una per una.

const uid = () => crypto.randomUUID();
const workSets = (sets: SetTarget[]) => sets.filter((s) => s.kind !== 'warmup');

export function isUniform(sets: SetTarget[]): boolean {
  const w = workSets(sets);
  return w.every((s) => JSON.stringify(s) === JSON.stringify(w[0]));
}

export function defaultSets(ex: Pick<Exercise, 'measure'> | undefined): SetTarget[] {
  const t: SetTarget =
    ex?.measure === 'time' || ex?.measure === 'weight_time' ? { durationSec: 30 } : { reps: 10 };
  return [{ ...t }, { ...t }, { ...t }];
}

export function setCount(item: BlockItem, n: number) {
  const count = Math.max(1, Math.min(12, n));
  const warm = item.sets.filter((s) => s.kind === 'warmup');
  const work = workSets(item.sets);
  const last = work.at(-1) ?? {};
  while (work.length < count) work.push({ ...last });
  work.length = count;
  item.sets = [...warm, ...work];
}

/** Testo del campo ripetizioni: "8-10", "12", "45s", "1:30". */
export function repsText(sets: SetTarget[]): string {
  const s = workSets(sets)[0];
  if (!s) return '';
  if (s.durationSec) {
    const d = s.durationSec;
    return d >= 60 && d % 60 === 0
      ? `${d / 60}'`
      : d > 60
        ? `${Math.floor(d / 60)}:${String(d % 60).padStart(2, '0')}`
        : `${d}s`;
  }
  return s.reps !== undefined ? formatReps(s.reps) : '';
}

/** Applica "8-10" / "12" / "45s" / "1:30" / "2'" a tutte le serie di lavoro. */
export function applyRepsText(item: BlockItem, text: string): boolean {
  const t = text.trim().toLowerCase().replace(',', '.');
  let reps: SetTarget['reps'] | undefined;
  let duration: number | undefined;
  let m: RegExpMatchArray | null;
  if ((m = t.match(/^(\d+)\s*[-–]\s*(\d+)$/))) reps = { min: Number(m[1]), max: Number(m[2]) };
  else if ((m = t.match(/^(\d+)$/))) reps = Number(m[1]);
  else if ((m = t.match(/^(\d+)\s*(?:s|sec|")$/))) duration = Number(m[1]);
  else if ((m = t.match(/^(\d+):(\d{2})$/))) duration = Number(m[1]) * 60 + Number(m[2]);
  else if ((m = t.match(/^(\d+(?:\.\d+)?)\s*(?:'|min)$/))) duration = Math.round(Number(m[1]) * 60);
  else return false;
  for (const s of workSets(item.sets)) {
    if (reps !== undefined) {
      s.reps = reps;
      delete s.durationSec;
    } else {
      s.durationSec = duration!;
      delete s.reps;
    }
  }
  return true;
}

export function applyWeight(item: BlockItem, kg: number | undefined) {
  for (const s of workSets(item.sets)) {
    if (kg && kg > 0) s.weightKg = kg;
    else delete s.weightKg;
  }
}

export const PRESETS: { label: string; count: number; reps: string }[] = [
  { label: '3 × 10', count: 3, reps: '10' },
  { label: '3 × 12', count: 3, reps: '12' },
  { label: '3 × 15', count: 3, reps: '15' },
  { label: '4 × 8-12', count: 4, reps: '8-12' },
  { label: '4 × 6-8', count: 4, reps: '6-8' },
  { label: '5 × 5', count: 5, reps: '5' },
  { label: '3 × 30s', count: 3, reps: '30s' },
  { label: '3 × 45s', count: 3, reps: '45s' },
];

export function applyPreset(item: BlockItem, preset: { count: number; reps: string }) {
  setCount(item, preset.count);
  applyRepsText(item, preset.reps);
}

/** Collega l'esercizio successivo in superset (unisce il blocco dopo a questo). */
export function linkWithNext(day: ProgramDay, bi: number) {
  const a = day.blocks[bi];
  const b = day.blocks[bi + 1];
  if (!a || !b) return;
  a.items.push(...b.items);
  if (a.type === 'single') a.type = 'superset';
  day.blocks.splice(bi + 1, 1);
}

/** Toglie un esercizio dal superset: diventa un blocco singolo subito dopo. */
export function unlink(day: ProgramDay, bi: number, ii: number) {
  const block = day.blocks[bi];
  if (!block || block.items.length < 2) return;
  const [item] = block.items.splice(ii, 1);
  if (block.items.length === 1) block.type = 'single';
  const single: Block = { id: uid(), type: 'single', restSec: block.restSec, items: [item!] };
  day.blocks.splice(bi + 1, 0, single);
}

export function newBlock(
  exerciseId: string,
  ex: Pick<Exercise, 'measure'> | undefined,
  restSec: number,
): Block {
  return {
    id: uid(),
    type: 'single',
    restSec,
    items: [{ id: uid(), exerciseId, sets: defaultSets(ex) }],
  };
}

export function duplicateItem(day: ProgramDay, bi: number, ii: number) {
  const item = day.blocks[bi]!.items[ii]!;
  const copy: BlockItem = { ...JSON.parse(JSON.stringify(item)), id: uid() } as BlockItem;
  day.blocks.splice(bi + 1, 0, {
    id: uid(),
    type: 'single',
    restSec: day.blocks[bi]!.restSec,
    items: [copy],
  });
}

export function removeItem(day: ProgramDay, bi: number, ii: number) {
  const block = day.blocks[bi]!;
  block.items.splice(ii, 1);
  if (!block.items.length) day.blocks.splice(bi, 1);
  else if (block.items.length === 1) block.type = 'single';
}

/** Serie di lavoro a settimana per muscolo principale (ogni giorno una volta a settimana). */
export function weeklyMuscleSets(days: ProgramDay[], exercises: Map<string, Exercise>) {
  const m = new Map<string, number>();
  for (const d of days)
    for (const b of d.blocks)
      for (const it of b.items) {
        const n = workSets(it.sets).length;
        for (const mu of exercises.get(it.exerciseId)?.primaryMuscles ?? [])
          m.set(mu, (m.get(mu) ?? 0) + n);
      }
  return [...m].map(([muscle, sets]) => ({ muscle, sets })).sort((a, b) => b.sets - a.sets);
}
