import { defineBoot } from '#q-app';
import { db } from '@/db';
import { todayIso } from '@/domain/format';
import { activeProgram } from '@/domain/session';
import { applySeeds } from '@/seed';
import { restoreReminders } from '@/services/reminders';

/** Scarica le immagini degli esercizi della scheda attiva, così sono disponibili offline. */
async function warmProgramImages() {
  const program = activeProgram(await db.programs.toArray(), todayIso());
  if (!program) return;
  const ids = new Set(
    program.days.flatMap((d) => d.blocks.flatMap((b) => b.items.map((i) => i.exerciseId))),
  );
  const exercises = await db.exercises.bulkGet([...ids]);
  const base = import.meta.env.BASE_URL ?? '/';
  for (const src of exercises.flatMap((e) => e?.images ?? [])) {
    void fetch(`${base}${src}`).catch(() => undefined);
  }
}

export default defineBoot(async () => {
  await db.open();
  await applySeeds(db);
  // Chiede ad Android di non cancellare IndexedDB quando lo spazio scarseggia.
  if (navigator.storage?.persist) void navigator.storage.persist();
  if (import.meta.env.PROD && 'serviceWorker' in navigator) {
    void navigator.serviceWorker.ready.then(() => {
      void warmProgramImages();
      void restoreReminders();
    });
  }
});
