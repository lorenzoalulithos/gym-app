import type { BodyField, LoadMode, Measure, Pose } from '@/db/types';

export const MUSCLES: Record<string, string> = {
  abdominals: 'Addome',
  abductors: 'Abduttori',
  adductors: 'Adduttori',
  biceps: 'Bicipiti',
  calves: 'Polpacci',
  chest: 'Petto',
  forearms: 'Avambracci',
  glutes: 'Glutei',
  hamstrings: 'Femorali',
  lats: 'Dorsali',
  'lower back': 'Lombari',
  'middle back': 'Dorso medio',
  neck: 'Collo',
  quadriceps: 'Quadricipiti',
  shoulders: 'Spalle',
  traps: 'Trapezi',
  triceps: 'Tricipiti',
};

export const EQUIPMENT: Record<string, string> = {
  'body only': 'Corpo libero',
  dumbbell: 'Manubri',
  barbell: 'Bilanciere',
  'e-z curl bar': 'Bilanciere EZ',
  cable: 'Cavi',
  machine: 'Macchina',
  kettlebells: 'Kettlebell',
  bands: 'Elastici',
  'medicine ball': 'Palla medica',
  'exercise ball': 'Fitball',
  other: 'Altro',
};

export const MEASURES: Record<Measure, string> = {
  reps: 'Ripetizioni',
  weight_reps: 'Carico × ripetizioni',
  time: 'Tempo',
  weight_time: 'Carico × tempo',
  time_reps: 'Tempo × ripetizioni',
};

export const LOAD_MODES: Record<LoadMode, string> = {
  per_implement: 'kg per manubrio',
  total: 'kg totali',
  stack: 'kg pila',
  added: 'kg zavorra',
  none: 'senza carico',
};

export const POSES: Record<Pose, string> = {
  front: 'Fronte',
  side: 'Lato',
  back: 'Schiena',
};

export const DIFFICULTY = ['', 'Facile', 'Moderato', 'Impegnativo', 'Difficile', 'Al limite'];

export const muscleLabel = (m: string) => MUSCLES[m] ?? m;
export const equipmentLabel = (e: string) => EQUIPMENT[e] ?? e;

export const BODY_FIELDS: Record<BodyField, { label: string; unit: string; hint: string }> = {
  weightKg: { label: 'Peso', unit: 'kg', hint: 'al mattino, a digiuno' },
  waistCm: { label: 'Vita', unit: 'cm', hint: "all'altezza dell'ombelico" },
  chestCm: { label: 'Petto', unit: 'cm', hint: "all'altezza dei capezzoli" },
  armCm: { label: 'Braccio', unit: 'cm', hint: 'bicipite contratto, punto più largo' },
  thighCm: { label: 'Coscia', unit: 'cm', hint: 'punto più largo' },
  hipsCm: { label: 'Fianchi', unit: 'cm', hint: 'punto più largo dei glutei' },
};
