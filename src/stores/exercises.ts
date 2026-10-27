import { defineStore } from 'pinia';
import { computed, shallowRef } from 'vue';
import { liveQuery } from 'dexie';
import { db } from '@/db';
import type { Exercise } from '@/db/types';

const normalize = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

/** Tutti gli esercizi in memoria (sono poche centinaia), sempre allineati al database. */
export const useExercisesStore = defineStore('exercises', () => {
  const list = shallowRef<Exercise[]>([]);
  liveQuery(() => db.exercises.toArray()).subscribe((v) => {
    list.value = v.sort((a, b) => a.name.localeCompare(b.name));
  });

  const byId = computed(() => new Map(list.value.map((e) => [e.id, e])));

  /** Quante volte un esercizio compare in allenamenti e schede: i più usati vanno in cima. */
  const usage = shallowRef(new Map<string, number>());
  liveQuery(async () => {
    const m = new Map<string, number>();
    const add = (id: string) => m.set(id, (m.get(id) ?? 0) + 1);
    await db.sessions.each((s) => s.exerciseIds.forEach(add));
    await db.programs.each((p) =>
      p.days.forEach((d) => d.blocks.forEach((b) => b.items.forEach((i) => add(i.exerciseId)))),
    );
    return m;
  }).subscribe((m) => (usage.value = m));

  const index = computed(() =>
    list.value.map((e) => ({
      e,
      text: normalize([e.name, e.nameIt ?? '', ...e.aliases].join(' ')),
    })),
  );

  function search(query: string, filter?: { muscle?: string; equipment?: string }) {
    const words = normalize(query).split(' ').filter(Boolean);
    return index.value
      .filter(
        ({ e, text }) =>
          words.every((w) => text.includes(w)) &&
          (!filter?.muscle || e.primaryMuscles.includes(filter.muscle)) &&
          (!filter?.equipment || e.equipment === filter.equipment),
      )
      .map(({ e }) => e)
      .sort((a, b) => (usage.value.get(b.id) ?? 0) - (usage.value.get(a.id) ?? 0));
  }

  const get = (id: string) => byId.value.get(id);
  const nameOf = (id: string) => byId.value.get(id)?.name ?? id;
  /** Nome italiano se c'è (usato dove si legge a colpo d'occhio, es. modalità round). */
  const nameItOf = (id: string) => byId.value.get(id)?.nameIt ?? nameOf(id);

  async function save(ex: Exercise) {
    await db.exercises.put({ ...ex, updatedAt: Date.now() });
  }

  /** Id libero ricavato dal nome ("Panca Smith" → "panca-smith"). */
  function newIdFor(name: string) {
    const base = normalize(name).replace(/\s+/g, '-') || 'esercizio';
    return byId.value.has(base) ? `${base}-${Date.now().toString(36)}` : base;
  }

  return { list, byId, usage, search, get, nameOf, nameItOf, save, newIdFor };
});
