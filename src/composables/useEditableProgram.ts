import { onBeforeUnmount, ref, watch, type Ref } from 'vue';
import { db } from '@/db';
import type { Program } from '@/db/types';

/** Copia modificabile di una scheda, salvata automaticamente a ogni cambiamento. */
export function useEditableProgram(id: Ref<string>) {
  const program = ref<Program | null>(null);
  let timer: ReturnType<typeof setTimeout> | undefined;
  let skipNext = false;
  let pending = false;

  function save() {
    clearTimeout(timer);
    const p = program.value;
    if (!pending || !p) return;
    pending = false;
    // updatedAt solo sulla copia: modificarlo qui riattiverebbe il watcher all'infinito
    const copy = JSON.parse(JSON.stringify(p)) as Program;
    copy.updatedAt = Date.now();
    void db.programs.put(copy);
  }

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
      pending = true;
      clearTimeout(timer);
      timer = setTimeout(save, 300);
    },
    { deep: true },
  );

  // Uscendo dalla pagina si scrive subito: la pagina successiva legge la scheda aggiornata
  // (le transazioni IndexedDB vengono eseguite nell'ordine in cui partono).
  onBeforeUnmount(save);

  return program;
}
