import { db, newId } from '@/db';
import type { Exercise, Program } from '@/db/types';
import { todayIso } from '@/domain/format';
import { programToText, toProgramBlocks, type ParsedDay } from '@/domain/textImport';
import { shareOrDownload } from './backup';

// Schede come file da scambiare: quelle che ti prepara Claude a fine mese, quelle del coach
// trascritte, o le tue da passare a un amico. Si importano senza ripubblicare l'app.

export interface ProgramFile {
  app: 'gym-app';
  kind: 'program';
  version: 1;
  program: Program;
  /** Esercizi personalizzati usati dalla scheda (quelli di libreria ci sono già). */
  exercises: Exercise[];
}

/** Copia con id nuovi, così non si sovrascrive mai una scheda esistente. */
export function cloneProgram(p: Program, patch: Partial<Program> = {}): Program {
  const copy = JSON.parse(JSON.stringify(p)) as Program;
  copy.id = newId();
  for (const d of copy.days) {
    d.id = newId();
    for (const b of d.blocks) {
      b.id = newId();
      for (const i of b.items) i.id = newId();
    }
  }
  return { ...copy, source: 'user', updatedAt: Date.now(), ...patch };
}

export async function exportProgramFile(p: Program) {
  const ids = new Set(
    p.days.flatMap((d) => d.blocks.flatMap((b) => b.items.map((i) => i.exerciseId))),
  );
  const custom = (await db.exercises.bulkGet([...ids])).filter(
    (e): e is Exercise => !!e && e.source === 'custom',
  );
  const file: ProgramFile = {
    app: 'gym-app',
    kind: 'program',
    version: 1,
    program: p,
    exercises: custom,
  };
  const slug =
    p.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'scheda';
  await shareOrDownload(
    new Blob([JSON.stringify(file, null, 1)], { type: 'application/json' }),
    `scheda-${slug}.json`,
  );
}

/** Testo leggibile della scheda: si condivide (WhatsApp, note…) o si copia. */
export async function shareProgramText(
  p: Program,
  nameOf: (id: string) => string,
): Promise<'shared' | 'copied'> {
  const text = `${p.name}\n\n${programToText(p, nameOf)}`;
  if (navigator.share) {
    try {
      await navigator.share({ title: p.name, text });
      return 'shared';
    } catch (e) {
      if ((e as Error).name === 'AbortError') return 'shared';
    }
  }
  await navigator.clipboard.writeText(text);
  return 'copied';
}

export type ReadResult = { kind: 'program'; file: ProgramFile } | { kind: 'text'; text: string };

/** Legge un file di scheda: JSON (di questa app) oppure testo da interpretare. */
export async function readProgramFile(file: File): Promise<ReadResult> {
  const raw = await file.text();
  if (!file.name.endsWith('.json') && !raw.trim().startsWith('{'))
    return { kind: 'text', text: raw };
  const data = JSON.parse(raw) as Partial<ProgramFile> &
    Partial<Program> & { programs?: Program[] };
  if (data.kind === 'program' && data.program) {
    return { kind: 'program', file: { ...(data as ProgramFile), exercises: data.exercises ?? [] } };
  }
  if (Array.isArray(data.days)) {
    return {
      kind: 'program',
      file: {
        app: 'gym-app',
        kind: 'program',
        version: 1,
        program: data as Program,
        exercises: [],
      },
    };
  }
  if (Array.isArray(data.programs) && data.programs[0]) {
    return {
      kind: 'program',
      file: {
        app: 'gym-app',
        kind: 'program',
        version: 1,
        program: [...data.programs].sort((a, b) => a.startDate.localeCompare(b.startDate)).at(-1)!,
        exercises: (data as { exercises?: Exercise[] }).exercises ?? [],
      },
    };
  }
  throw new Error('Il file non contiene una scheda.');
}

/** Importa come bozza: si controlla nel percorso guidato e poi si attiva. */
export async function importProgramFile(f: ProgramFile): Promise<string> {
  const existing = new Set(await db.exercises.toCollection().primaryKeys());
  const missing = f.exercises.filter((e) => !existing.has(e.id));
  const p = cloneProgram(f.program, { draft: true, startDate: f.program.startDate || todayIso() });
  const known = new Set([...existing, ...missing.map((e) => e.id)]);
  // esercizi sconosciuti (es. personalizzati non inclusi nel file) vengono tolti
  for (const d of p.days) {
    for (const b of d.blocks) b.items = b.items.filter((i) => known.has(i.exerciseId));
    d.blocks = d.blocks.filter((b) => b.items.length);
  }
  await db.transaction('rw', db.exercises, db.programs, async () => {
    await db.exercises.bulkAdd(missing);
    await db.programs.add(p);
  });
  return p.id;
}

/** Nuova bozza dai giorni letti da un testo. */
export async function programFromParsed(
  days: ParsedDay[],
  name: string,
  restSec: number,
  exercises?: Map<string, Exercise>,
): Promise<string> {
  const p: Program = {
    id: newId(),
    name,
    startDate: todayIso(),
    source: 'user',
    draft: true,
    updatedAt: Date.now(),
    days: days.map((d) => {
      const day: Program['days'][number] = {
        id: newId(),
        name: d.name,
        blocks: toProgramBlocks(d.blocks, restSec, exercises),
      };
      if (d.weekday) day.weekday = d.weekday;
      return day;
    }),
  };
  await db.programs.add(p);
  return p.id;
}
