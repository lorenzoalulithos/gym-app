import type { GymDb } from '@/db';
import type { Exercise, Program } from '@/db/types';
import { CUSTOM_EXERCISES, LIBRARY_OVERRIDES, fromLibrary, type LibraryEntry } from './exercises';
import { seedHistory } from './history';
import { program as coach202609 } from './programs/2026-09-coach';

/**
 * Schede incluse nella build. Per aggiungere la scheda del mese:
 * creare src/seed/programs/AAAA-MM-*.ts e aggiungerla qui.
 */
export const SEED_PROGRAMS: Program[] = [coach202609];

/** Aumentare quando cambia la libreria esercizi, per reimportarla. */
const LIBRARY_VERSION = 1;

async function applied(db: GymDb, key: string) {
  return (await db.meta.get(`seed:${key}`)) !== undefined;
}

async function mark(db: GymDb, key: string) {
  await db.meta.put({ key: `seed:${key}`, value: Date.now() });
}

/**
 * Import idempotente dei dati inclusi nella build.
 * Non sovrascrive mai ciò che è già nel database (modifiche manuali, sessioni).
 */
export async function applySeeds(db: GymDb) {
  const libKey = `library-v${LIBRARY_VERSION}`;
  if (!(await applied(db, libKey))) {
    const { default: library } = (await import('./library.json')) as { default: LibraryEntry[] };
    const exercises: Exercise[] = [
      ...library.map((e) => ({ ...fromLibrary(e), ...LIBRARY_OVERRIDES[e.id] })),
      ...CUSTOM_EXERCISES,
    ];
    await db.transaction('rw', db.exercises, db.meta, async () => {
      const existing = new Set(await db.exercises.toCollection().primaryKeys());
      await db.exercises.bulkAdd(exercises.filter((e) => !existing.has(e.id)));
      await mark(db, libKey);
    });
  }

  for (const p of SEED_PROGRAMS) {
    if (await applied(db, `program:${p.id}`)) continue;
    await db.transaction('rw', db.programs, db.meta, async () => {
      if (!(await db.programs.get(p.id))) await db.programs.add(structuredClone(p));
      await mark(db, `program:${p.id}`);
    });
  }

  if (!(await applied(db, 'history:everfit-2026-10'))) {
    await db.transaction('rw', db.sessions, db.meta, async () => {
      for (const s of seedHistory()) if (!(await db.sessions.get(s.id))) await db.sessions.add(s);
      await mark(db, 'history:everfit-2026-10');
    });
  }
}
