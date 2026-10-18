/** Quali valori si registrano per ogni serie. */
export type Measure = 'reps' | 'weight_reps' | 'time' | 'weight_time' | 'time_reps';

/**
 * Convenzione sul carico:
 * - per_implement: kg di UN manubrio/kettlebell (il numero che leggi sul peso)
 * - total: bilanciere, carico totale compreso il bilanciere
 * - stack: valore della pila su macchine e cavi
 * - added: corpo libero, solo la zavorra aggiunta
 * - none: nessun carico (elastici, cardio)
 */
export type LoadMode = 'per_implement' | 'total' | 'stack' | 'added' | 'none';

export interface Exercise {
  id: string;
  name: string;
  /** Nome italiano facoltativo, usato anche nella ricerca. */
  nameIt?: string;
  /** Altri nomi (es. quelli "coloriti" del coach) per ricerca e import. */
  aliases: string[];
  category: string;
  equipment: string;
  primaryMuscles: string[];
  secondaryMuscles: string[];
  instructions: string[];
  /** Percorsi relativi in /public. */
  images: string[];
  measure: Measure;
  loadMode: LoadMode;
  /** Ripetizioni/tempo si intendono per lato. */
  perSide: boolean;
  /** Numero di attrezzi usati insieme (2 manubri), per calcolare il volume. */
  implements: 1 | 2;
  videoUrl?: string;
  notes?: string;
  source: 'library' | 'custom';
  updatedAt: number;
}

export type RepTarget = number | { min: number; max: number };

export interface SetTarget {
  reps?: RepTarget;
  durationSec?: number;
  weightKg?: number;
  percent1RM?: number;
  rpe?: number;
  /** Es. '3-1-1-0' (eccentrica-pausa-concentrica-pausa). */
  tempo?: string;
  kind?: 'normal' | 'warmup' | 'drop';
  /** Sovrascrive il recupero del blocco per questa serie. */
  restSec?: number;
}

export type BlockType = 'single' | 'superset' | 'circuit';

export interface BlockItem {
  id: string;
  exerciseId: string;
  sets: SetTarget[];
  /** Recupero dopo ogni serie di questo esercizio; se assente vale quello del blocco (vedi restAfter). */
  restSec?: number;
  notes?: string;
}

export interface Block {
  id: string;
  type: BlockType;
  /** Recupero dopo ogni serie (single) o dopo ogni giro (superset/circuito). */
  restSec: number;
  items: BlockItem[];
}

export interface ProgramDay {
  id: string;
  name: string;
  /** 1 = lunedì … 7 = domenica, solo indicativo. */
  weekday?: number;
  blocks: Block[];
}

export interface Program {
  id: string;
  name: string;
  startDate: string;
  endDate?: string;
  notes?: string;
  source: 'seed' | 'user';
  /** In preparazione: non compare nel calendario finché non viene attivata. */
  draft?: boolean;
  /** Pianificare uno scarico nell'ultima settimana all'attivazione. */
  deloadLastWeek?: boolean;
  days: ProgramDay[];
  updatedAt: number;
}

export interface LoggedSet {
  target?: SetTarget;
  reps?: number;
  weightKg?: number;
  durationSec?: number;
  rpe?: number;
  done: boolean;
  completedAt?: number;
}

export interface SessionItem {
  id: string;
  exerciseId: string;
  restSec?: number;
  notes?: string;
  sets: LoggedSet[];
}

export interface SessionBlock {
  id: string;
  type: BlockType;
  restSec: number;
  items: SessionItem[];
}

export interface Session {
  id: string;
  /** YYYY-MM-DD */
  date: string;
  status: 'active' | 'done';
  startedAt?: number;
  endedAt?: number;
  programId?: string;
  dayId?: string;
  title: string;
  /** 1 = facile … 5 = durissimo */
  difficulty?: number;
  notes?: string;
  blocks: SessionBlock[];
  /** Derivato da blocks (vedi touchSession), indicizzato per lo storico per esercizio. */
  exerciseIds: string[];
  /** Allenamento della settimana di scarico: esce da stalli, confronti e precompilazione. */
  deload?: boolean;
  updatedAt: number;
}

/** Settimana (o periodo) di scarico pianificata. */
export interface DeloadWindow {
  /** YYYY-MM-DD, inclusi */
  from: string;
  to: string;
}

export type Pose = 'front' | 'side' | 'back';

export interface ProgressPhoto {
  id: string;
  /** YYYY-MM */
  month: string;
  pose: Pose;
  takenAt: number;
  blob: Blob;
}

export interface BodyMetric {
  id: string;
  /** YYYY-MM-DD */
  date: string;
  weightKg?: number;
  /** Circonferenze in cm, misurate sempre nello stesso punto. */
  waistCm?: number;
  chestCm?: number;
  armCm?: number;
  thighCm?: number;
  hipsCm?: number;
  notes?: string;
}

export type BodyField = 'weightKg' | 'waistCm' | 'chestCm' | 'armCm' | 'thighCm' | 'hipsCm';

/**
 * Eccezione al calendario settimanale della scheda per una data:
 * dayId = giorno da fare quel giorno, null = riposo/saltato.
 */
export interface ScheduleOverride {
  /** YYYY-MM-DD */
  date: string;
  programId: string;
  dayId: string | null;
  /** Spostato da / verso un'altra data (YYYY-MM-DD). */
  movedFrom?: string;
  movedTo?: string;
  /** Allenamento saltato di proposito: non genera più promemoria. */
  skipped?: boolean;
}

export interface MetaEntry {
  key: string;
  value: unknown;
}
