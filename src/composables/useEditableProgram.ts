import { ref, watch, type Ref } from 'vue';
import { db } from '@/db';
import type { Program } from '@/db/types';

/** Copia modificabile di una scheda, salvata automaticamente a ogni cambiamento. */
export function useEditableProgram(id: Ref<string>) {
  const program = ref<Program | null>(null);
  let timer: ReturnType<typeof setTimeout> | undefined;
  let skipNext = false;

  watch(
    id,
    async (v) => {
      skipNext = true;
      program.value = (await db.programs.get(v)) ?? null;
    },
    { immediate: true },
  );

  watch(
    program,
    (p) => {
      if (!p) return;
      if (skipNext) {
        skipNext = false;
        return;
      }
      clearTimeout(timer);
      timer = setTimeout(() => {
        p.updatedAt = Date.now();
        void db.programs.put(JSON.parse(JSON.stringify(p)) as Program);
      }, 300);
    },
    { deep: true },
  );

  return program;
}
