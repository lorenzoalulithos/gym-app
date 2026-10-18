import 'fake-indexeddb/auto';
import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { GymDb } from '@/db';
import { applySeeds, SEED_PROGRAMS } from '@/seed';

describe('seed', () => {
  it('importa libreria, scheda e storico senza duplicare', async () => {
    const db = new GymDb('test-seed');
    await applySeeds(db);
    await applySeeds(db);
    expect(await db.programs.count()).toBe(1);
    expect(await db.sessions.count()).toBe(4);
    expect(await db.exercises.count()).toBeGreaterThan(600);
  });

  it('ogni esercizio della scheda esiste e ha immagini valide', async () => {
    const db = new GymDb('test-seed-2');
    await applySeeds(db);
    const ids = SEED_PROGRAMS.flatMap((p) =>
      p.days.flatMap((d) => d.blocks.flatMap((b) => b.items.map((i) => i.exerciseId))),
    );
    for (const id of ids) {
      const ex = await db.exercises.get(id);
      expect(ex, id).toBeDefined();
      for (const img of ex!.images) expect(existsSync(`public/${img}`), img).toBe(true);
    }
  });

  it('non sovrascrive una scheda modificata', async () => {
    const db = new GymDb('test-seed-3');
    await applySeeds(db);
    await db.programs.update('coach-2026-09', { name: 'Modificata' });
    await db.meta.delete('seed:program:coach-2026-09');
    await applySeeds(db);
    expect((await db.programs.get('coach-2026-09'))?.name).toBe('Modificata');
  });
});
