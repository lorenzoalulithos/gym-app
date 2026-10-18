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
      .map(({ e }) => e);
  }

  const get = (id: string) => byId.value.get(id);
  const nameOf = (id: string) => byId.value.get(id)?.name ?? id;

  async function save(ex: Exercise) {
    await db.exercises.put({ ...ex, updatedAt: Date.now() });
  }

  return { list, byId, search, get, nameOf, save };
});
