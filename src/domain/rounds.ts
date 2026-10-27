import type { Session, SessionBlock, SessionItem } from '@/db/types';
import { setOrder, type SetPos } from './focus';
import { emptySession, restAfter } from './session';

// Allenamenti a round (sacco, corda, tabata): lavoro e pausa si alternano da soli,
// senza toccare il telefono. Ogni round è una serie a tempo della sessione.

export interface RoundPlan {
  /** Esercizi in rotazione: con più esercizi si alternano round dopo round. */
  exerciseIds: string[];
  rounds: number;
  workSec: number;
  restSec: number;
  /** Tema di ogni round (vuoto = nessun tema). */
  themes: string[];
}

export interface RoundPreset {
  key: string;
  label: string;
  hint: string;
  plan: Omit<RoundPlan, 'themes'>;
}

export const ROUND_PRESETS: RoundPreset[] = [
  {
    key: 'boxe',
    label: 'Boxe',
    hint: "3' · 1' · 6 round",
    plan: { exerciseIds: ['heavy-bag'], rounds: 6, workSec: 180, restSec: 60 },
  },
  {
    key: 'corda',
    label: 'Corda',
    hint: '1\' · 30" · 10 round',
    plan: { exerciseIds: ['rope-jumping'], rounds: 10, workSec: 60, restSec: 30 },
  },
  {
    key: 'tabata',
    label: 'Tabata',
    hint: '20" · 10" · 8 round',
    plan: { exerciseIds: ['heavy-bag'], rounds: 8, workSec: 20, restSec: 10 },
  },
  {
    key: 'misto',
    label: 'Corda + sacco',
    hint: "alternati · 3' · 1' · 6",
    plan: { exerciseIds: ['rope-jumping', 'heavy-bag'], rounds: 6, workSec: 180, restSec: 60 },
  },
];

/** Esercizi proposti per primi nella scelta. */
export const ROUND_EXERCISES = ['heavy-bag', 'rope-jumping', 'shadow-boxing', 'battling-ropes'];

const BOXING_IDS = ['heavy-bag', 'shadow-boxing'];

/** Temi classici per il sacco, in ordine di difficoltà. */
export const BOXING_THEMES = [
  'Jab-diretto, sciolto',
  'Ganci',
  'Montanti',
  'Schivate + contro',
  'Combinazioni libere',
  'Tutto quello che hai',
  'Lavoro al corpo',
  'Velocità: colpi brevi',
  'Potenza: colpi singoli',
  'Ultimo round a tutta',
];

/** Temi proposti: solo nei round di boxe (sacco, shadow), non in quelli di corda. */
export function suggestThemes(rounds: number, exerciseIds: string[] = ['heavy-bag']): string[] {
  const ids = exerciseIds.length ? exerciseIds : ['heavy-bag'];
  const boxing = (r: number) => BOXING_IDS.includes(ids[r % ids.length]!);
  const lastBoxing = Array.from({ length: rounds }, (_, r) => r)
    .filter(boxing)
    .at(-1);
  let k = 0;
  return Array.from({ length: rounds }, (_, r) => {
    if (!boxing(r)) return '';
    if (r === lastBoxing && k >= 2) return 'Ultimo round a tutta';
    return BOXING_THEMES[k++] ?? '';
  });
}

export const totalSec = (p: Pick<RoundPlan, 'rounds' | 'workSec' | 'restSec'>) =>
  p.rounds * p.workSec + Math.max(0, p.rounds - 1) * p.restSec;

/** Nuova sessione a round: con più esercizi un circuito, così si alternano (A1, B1, A2…). */
export function roundsSession(plan: RoundPlan, date: string, title: string): Session {
  const s = emptySession(date, title);
  s.mode = 'rounds';
  const ids = plan.exerciseIds.length ? plan.exerciseIds : ['heavy-bag'];
  const items: SessionItem[] = ids.map((exerciseId) => ({
    id: crypto.randomUUID(),
    exerciseId,
    sets: [],
  }));
  for (let r = 0; r < plan.rounds; r++) {
    const theme = plan.themes[r]?.trim();
    const last = r === plan.rounds - 1;
    items[r % ids.length]!.sets.push({
      target: {
        durationSec: plan.workSec,
        restSec: last ? 0 : plan.restSec,
        ...(theme ? { note: theme } : {}),
      },
      durationSec: plan.workSec,
      done: false,
    });
  }
  const block: SessionBlock = {
    id: crypto.randomUUID(),
    type: ids.length > 1 ? 'circuit' : 'single',
    restSec: plan.restSec,
    items: items.filter((i) => i.sets.length),
  };
  s.blocks = [block];
  return s;
}

export interface RoundStep extends SetPos {
  exerciseId: string;
  workSec: number;
  /** Pausa dopo questo round (0 per l'ultimo). */
  restSec: number;
  theme?: string;
}

/**
 * Tema di una serie: quello della serie oppure, dalle note dell'esercizio,
 * "R1 jab; R2 ganci" (scritto anche nel testo della scheda).
 */
export function themeOf(item: SessionItem, si: number): string | undefined {
  const own = item.sets[si]?.target?.note;
  if (own) return own;
  const n = si + 1;
  // il testo della scheda può perdere i ";": il tema finisce dove inizia "R<numero>"
  const m = item.notes?.match(
    new RegExp(
      `(?:^|[\\s;|,])R\\s*${n}\\b\\s*[:.\\-–]?\\s*(.+?)\\s*(?=[;|,\\n]|\\sR\\s*\\d+\\b|$)`,
      'i',
    ),
  );
  return m?.[1]?.trim() || undefined;
}

/** Serie a tempo della sessione, nell'ordine in cui si fanno. */
export function roundSteps(s: Session): RoundStep[] {
  const steps: RoundStep[] = [];
  for (const p of setOrder(s)) {
    const block = s.blocks[p.bi]!;
    const item = block.items[p.ii]!;
    const set = item.sets[p.si]!;
    const workSec = set.target?.durationSec ?? set.durationSec;
    if (!workSec) continue;
    const theme = themeOf(item, p.si);
    steps.push({
      ...p,
      exerciseId: item.exerciseId,
      workSec,
      restSec: restAfter(block, p.ii, set.target?.restSec),
      ...(theme ? { theme } : {}),
    });
  }
  if (steps.length) steps[steps.length - 1]!.restSec = 0;
  return steps;
}

/** Si può fare a round: tutte le serie (escluso il riscaldamento) sono a tempo. */
export function canRunAsRounds(s: Session): boolean {
  let timed = 0;
  for (const b of s.blocks)
    for (const it of b.items)
      for (const set of it.sets) {
        if (set.target?.kind === 'warmup') continue;
        if (!(set.target?.durationSec ?? set.durationSec)) return false;
        timed++;
      }
  return timed > 0;
}

/** Round fatti e secondi di lavoro effettivo. */
export function roundStats(s: Session) {
  let done = 0;
  let total = 0;
  let workSec = 0;
  for (const b of s.blocks)
    for (const it of b.items)
      for (const set of it.sets) {
        if (set.target?.kind === 'warmup') continue;
        total++;
        if (!set.done) continue;
        done++;
        workSec += set.durationSec ?? 0;
      }
  return { done, total, workSec };
}
