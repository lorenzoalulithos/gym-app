import { inject, type InjectionKey, type Ref } from 'vue';
import type { Program } from '@/db/types';

/** La scheda in modifica, condivisa tra i passi del percorso guidato (salvataggio automatico). */
export const PROGRAM_KEY: InjectionKey<Ref<Program | null>> = Symbol('wizard-program');

export function useWizardProgram() {
  const p = inject(PROGRAM_KEY);
  if (!p) throw new Error('useWizardProgram fuori dal percorso guidato');
  return p;
}

export const WEEKDAY_SHORT = ['L', 'M', 'M', 'G', 'V', 'S', 'D'];
export const WEEKDAY_LONG = [
  'lunedì',
  'martedì',
  'mercoledì',
  'giovedì',
  'venerdì',
  'sabato',
  'domenica',
];
