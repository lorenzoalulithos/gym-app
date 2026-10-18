import { describe, expect, it } from 'vitest';
import type { BlockItem } from '@/db/types';
import library from '@/seed/library.json';
import {
  CUSTOM_EXERCISES,
  LIBRARY_OVERRIDES,
  fromLibrary,
  type LibraryEntry,
} from '@/seed/exercises';
import {
  buildIndex,
  matchExercise,
  parseBlocks,
  parseProgramText,
  programToText,
  resolveBlocks,
} from '@/domain/textImport';
import { program } from '@/seed/programs/2026-09-coach';
import {
  applyRepsText,
  applyWeight,
  isUniform,
  linkWithNext,
  repsText,
  setCount,
  unlink,
} from '@/domain/programEdit';

const exercises = [
  ...(library as LibraryEntry[]).map((e) => ({ ...fromLibrary(e), ...LIBRARY_OVERRIDES[e.id] })),
  ...CUSTOM_EXERCISES,
];
const index = buildIndex(exercises);
const nameOf = (id: string) => exercises.find((e) => e.id === id)?.name ?? id;

describe('testo → scheda', () => {
  it('serie, ripetizioni, carico, recupero, note', () => {
    const [b] = parseBlocks('Panca piana 4x8-10 @60 r2:00 (fermo al petto)');
    expect(b!.restSec).toBe(120);
    expect(b!.items[0]).toMatchObject({ raw: 'Panca piana', notes: 'fermo al petto' });
    expect(b!.items[0]!.sets).toHaveLength(4);
    expect(b!.items[0]!.sets[0]).toEqual({ reps: { min: 8, max: 10 }, weightKg: 60 });
  });

  it('superset, piramidi, tempo, numerazione', () => {
    const blocks = parseBlocks(
      [
        '1. SS Croci ai cavi 3x12 + Push-down 3x12 r60',
        'Squat 12/10/8/6 @80kg',
        '- Plank 3x45s',
        '+ Crunch 3x20',
      ].join('\n'),
    );
    expect(blocks[0]).toMatchObject({ type: 'superset', restSec: 60 });
    expect(blocks[0]!.items.map((i) => i.raw)).toEqual(['Croci ai cavi', 'Push-down']);
    expect(blocks[1]!.items[0]!.sets.map((s) => s.reps)).toEqual([12, 10, 8, 6]);
    expect(blocks[2]!.type).toBe('superset'); // la riga "+ Crunch" si unisce al plank
    expect(blocks[2]!.items[0]!.sets[0]).toEqual({ durationSec: 45 });
  });

  it('scheda intera con giorni e giorno della settimana', () => {
    const days = parseProgramText(
      '# A Push (lunedì)\nPanca piana 4x8\n\nGiorno B - Pull mer\nTrazioni 4x6',
    );
    expect(days.map((d) => [d.name, d.weekday])).toEqual([
      ['A Push', 1],
      ['B - Pull', 3],
    ]);
  });

  it('riconosce nomi italiani, inglesi e del coach', () => {
    expect(matchExercise('Hip Trust', index).id).toBe('barbell-hip-thrust');
    expect(matchExercise('Alzate laterali', index).id).toBe('side-lateral-raise');
    expect(matchExercise('Barbell bench press medium grip', index).id).toBe(
      'barbell-bench-press-medium-grip',
    );
    expect(matchExercise('Panca piana', index).candidates).toContain(
      'barbell-bench-press-medium-grip',
    );
    expect(matchExercise('Lat machine', index).candidates.some((c) => c.includes('pulldown'))).toBe(
      true,
    );
    expect(matchExercise('Esercizio inventato xyz', index).id).toBeUndefined();
  });

  it('scheda → testo → scheda conserva esercizi e serie', () => {
    const text = programToText(program, nameOf);
    const days = parseProgramText(text);
    expect(days).toHaveLength(program.days.length);
    days.forEach((d) => resolveBlocks(d.blocks, index));
    const original = program.days[0]!.blocks.flatMap((b) =>
      b.items.map((it) => [it.exerciseId, it.sets.length]),
    );
    const roundTrip = days[0]!.blocks.flatMap((b) =>
      b.items.map((it) => [it.exerciseId, it.sets.length]),
    );
    expect(roundTrip).toEqual(original);
    expect(days[0]!.weekday).toBe(1);
  });
});

describe('modifica rapida delle serie', () => {
  const item = (): BlockItem => ({
    id: 'i',
    exerciseId: 'x',
    sets: [{ reps: 10 }, { reps: 10 }, { reps: 10 }],
  });
  it('numero di serie, ripetizioni, tempo, carico', () => {
    const it = item();
    setCount(it, 5);
    expect(it.sets).toHaveLength(5);
    expect(applyRepsText(it, '8-12')).toBe(true);
    expect(it.sets[4]!.reps).toEqual({ min: 8, max: 12 });
    applyWeight(it, 22.5);
    expect(it.sets.every((s) => s.weightKg === 22.5)).toBe(true);
    applyRepsText(it, '45s');
    expect(it.sets[0]).toEqual({ durationSec: 45, weightKg: 22.5 });
    expect(repsText(it.sets)).toBe('45s');
    applyRepsText(it, "2'");
    expect(it.sets[0]!.durationSec).toBe(120);
    expect(applyRepsText(it, 'boh')).toBe(false);
  });
  it('superset: collega e separa', () => {
    const day = {
      id: 'd',
      name: 'A',
      blocks: [
        { id: 'b1', type: 'single' as const, restSec: 90, items: [item()] },
        { id: 'b2', type: 'single' as const, restSec: 60, items: [{ ...item(), id: 'j' }] },
      ],
    };
    linkWithNext(day, 0);
    expect(day.blocks).toHaveLength(1);
    expect(day.blocks[0]!.type).toBe('superset');
    unlink(day, 0, 1);
    expect(day.blocks.map((b) => b.type)).toEqual(['single', 'single']);
    expect(isUniform(day.blocks[0]!.items[0]!.sets)).toBe(true);
  });
});
