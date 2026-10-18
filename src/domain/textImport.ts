import type { Block, BlockType, Exercise, Program, ProgramDay, SetTarget } from '@/db/types';
import { formatDuration, formatReps } from './format';

// Scrivere una scheda come su un foglio, una riga per esercizio:
//
//   Panca piana 4x8-10 @60 r2:00
//   Military press 3x8-10 r90 (gomiti stretti)
//   SS Croci ai cavi 3x12 + Push-down 3x12 r60
//   Squat 12/10/8/6 @80
//   Plank 3x45s
//
// e, per una scheda intera, i giorni introdotti da "#" o "Giorno":
//
//   # A Push (lunedì)

export interface ParsedExercise {
  /** Nome come scritto nel testo. */
  raw: string;
  sets: SetTarget[];
  notes?: string;
  /** Esercizio riconosciuto nella libreria (o scelto dall'utente). */
  exerciseId?: string;
  /** Alternative possibili, dalla più probabile. */
  candidates: string[];
}

export interface ParsedBlock {
  type: BlockType;
  restSec?: number;
  items: ParsedExercise[];
}

export interface ParsedDay {
  name: string;
  weekday?: number;
  blocks: ParsedBlock[];
}

const WEEKDAYS: Record<string, number> = {
  lun: 1,
  lunedi: 1,
  lunedì: 1,
  mar: 2,
  martedi: 2,
  martedì: 2,
  mer: 3,
  mercoledi: 3,
  mercoledì: 3,
  gio: 4,
  giovedi: 4,
  giovedì: 4,
  ven: 5,
  venerdi: 5,
  venerdì: 5,
  sab: 6,
  sabato: 6,
  dom: 7,
  domenica: 7,
};

const num = (s: string) => Number(s.replace(',', '.'));

/** "90", "1:30", "2'", "2min", "90s" → secondi */
function parseSeconds(s: string): number | undefined {
  const t = s.trim().toLowerCase();
  let m = t.match(/^(\d+):(\d{2})$/);
  if (m) return Number(m[1]) * 60 + Number(m[2]);
  m = t.match(/^(\d+(?:[.,]\d+)?)\s*(?:'|min|m)$/);
  if (m) return Math.round(num(m[1]!) * 60);
  m = t.match(/^(\d+)\s*(?:"|''|s|sec)?$/);
  if (m) return Number(m[1]);
  return undefined;
}

/** Riconosce le specifiche di un esercizio; restituisce il nome (testo prima delle specifiche). */
function parseSegment(text: string): {
  name: string;
  sets: SetTarget[];
  restSec?: number;
  notes?: string;
} {
  let s = ` ${text.trim()} `;
  let notes: string | undefined;
  const paren = s.match(/\(([^)]*)\)/);
  if (paren) {
    notes = paren[1]!.trim() || undefined;
    s = s.replace(paren[0], ' ');
  }

  let restSec: number | undefined;
  const rest = s.match(
    /\s(?:r|rec|recupero|riposo|rest)\s*[:=]?\s*(\d+(?::\d{2})?\s*(?:'|"|min|s|sec)?)(?=\s)/i,
  );
  if (rest) {
    restSec = parseSeconds(rest[1]!);
    s = s.replace(rest[0], ' ');
  }

  let weightKg: number | undefined;
  let percent1RM: number | undefined;
  const pct = s.match(/@\s*(\d+(?:[.,]\d+)?)\s*%/);
  if (pct) {
    percent1RM = num(pct[1]!);
    s = s.replace(pct[0], ' ');
  }
  const kg = s.match(/@\s*(\d+(?:[.,]\d+)?)\s*(?:kg)?|\s(\d+(?:[.,]\d+)?)\s*kg(?=\s)/i);
  if (kg) {
    weightKg = num(kg[1] ?? kg[2]!);
    s = s.replace(kg[0], ' ');
  }

  const base = (): SetTarget => {
    const t: SetTarget = {};
    if (weightKg !== undefined) t.weightKg = weightKg;
    if (percent1RM !== undefined) t.percent1RM = percent1RM;
    return t;
  };

  let sets: SetTarget[] = [];
  let specStart = -1;
  // 3x45s, 3x1', 3x1:30
  const timed = s.match(/\s(\d+)\s*[x×]\s*(\d+:\d{2}|\d+\s*(?:'|"|min|s|sec))(?=\s)/i);
  // 4x8-10, 4x8
  const sr = s.match(/\s(\d+)\s*[x×]\s*(\d+)(?:\s*[-–]\s*(\d+))?(?=\s)/i);
  // piramide 12/10/8/6
  const pyr = s.match(/\s(\d+(?:\s*\/\s*\d+)+)(?=\s)/);
  if (timed) {
    const sec = parseSeconds(timed[2]!);
    sets = Array.from({ length: Number(timed[1]) }, () => ({ ...base(), durationSec: sec ?? 30 }));
    specStart = timed.index!;
  } else if (sr) {
    const reps: SetTarget['reps'] = sr[3]
      ? { min: Number(sr[2]), max: Number(sr[3]) }
      : Number(sr[2]);
    sets = Array.from({ length: Number(sr[1]) }, () => ({ ...base(), reps }));
    specStart = sr.index!;
  } else if (pyr) {
    sets = pyr[1]!.split('/').map((r) => ({ ...base(), reps: Number(r.trim()) }));
    specStart = pyr.index!;
  }

  // il nome è ciò che precede la prima specifica trovata
  let name = specStart >= 0 ? s.slice(0, specStart) : s;
  name = name
    .replace(/@.*$/, '')
    .replace(/^\s*(?:[-•*]|\d+[.)]|[a-z]\d?[.)]|\d+[a-z][.)]?)\s+/i, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!sets.length) sets = [base(), base(), base()];
  const out: { name: string; sets: SetTarget[]; restSec?: number; notes?: string } = { name, sets };
  if (restSec !== undefined) out.restSec = restSec;
  if (notes) out.notes = notes;
  return out;
}

function parseDayHeader(line: string): { name: string; weekday?: number } | null {
  const m = line.match(/^\s*(?:#+|giorno\b|day\b)\s*(.*)$/i);
  if (!m) return null;
  let name = m[1]!.replace(/[:\-–]\s*$/, '').trim();
  let weekday: number | undefined;
  const wd = name.match(
    /(?:^|[\s(·,\-–])\(?(lun(?:edì|edi)?|mar(?:tedì|tedi)?|mer(?:coledì|coledi)?|gio(?:vedì|vedi)?|ven(?:erdì|erdi)?|sab(?:ato)?|dom(?:enica)?)\)?(?=$|[\s),.])/i,
  );
  if (wd) {
    weekday = WEEKDAYS[wd[1]!.toLowerCase()];
    name = name
      .replace(wd[0], '')
      .replace(/[()·,\-–]\s*$/, '')
      .trim();
  }
  name = name.replace(/^[:\-–·]\s*/, '').trim();
  const out: { name: string; weekday?: number } = { name: name || 'Giorno' };
  if (weekday) out.weekday = weekday;
  return out;
}

/** Testo → blocchi di un giorno (le righe "SS ... + ..." o che iniziano con "+" sono superset). */
export function parseBlocks(text: string): ParsedBlock[] {
  const blocks: ParsedBlock[] = [];
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || parseDayHeader(line)) continue;
    const joinPrev = line.startsWith('+');
    const body = line
      .replace(/^\+\s*/, '')
      .replace(/^(?:[-•*]|\d+[.)])\s+/, '')
      .replace(/^(?:ss|superset|circuito|circuit)\s*[:-]?\s*/i, '');
    const isCircuit = /^(?:circuito|circuit)\b/i.test(line);
    const parts = body
      .split(/\s\+\s/)
      .map(parseSegment)
      .filter((p) => p.name);
    if (!parts.length) continue;
    const items = parts.map((p) => {
      const it: ParsedExercise = { raw: p.name, sets: p.sets, candidates: [] };
      if (p.notes) it.notes = p.notes;
      return it;
    });
    const restSec = parts.map((p) => p.restSec).find((r) => r !== undefined);
    const prev = blocks.at(-1);
    if (joinPrev && prev) {
      prev.items.push(...items);
      if (prev.type === 'single') prev.type = 'superset';
      if (restSec !== undefined) prev.restSec = restSec;
      continue;
    }
    const b: ParsedBlock = {
      type: isCircuit ? 'circuit' : items.length > 1 ? 'superset' : 'single',
      items,
    };
    if (restSec !== undefined) b.restSec = restSec;
    blocks.push(b);
  }
  return blocks;
}

/** Testo di una scheda intera: giorni introdotti da "#", "Giorno" o "Day". */
export function parseProgramText(text: string): ParsedDay[] {
  const days: ParsedDay[] = [];
  let current: { header: { name: string; weekday?: number }; lines: string[] } | null = null;
  const flush = () => {
    if (!current) return;
    const d: ParsedDay = {
      name: current.header.name,
      blocks: parseBlocks(current.lines.join('\n')),
    };
    if (current.header.weekday) d.weekday = current.header.weekday;
    days.push(d);
  };
  for (const line of text.split(/\r?\n/)) {
    const h = parseDayHeader(line);
    if (h) {
      flush();
      current = { header: h, lines: [] };
    } else {
      current ??= { header: { name: 'Giorno A' }, lines: [] };
      current.lines.push(line);
    }
  }
  flush();
  return days.filter((d) => d.blocks.length);
}

// --- riconoscimento degli esercizi -------------------------------------------

/** Parole italiane (e gergo da palestra) → inglese della libreria. */
const IT_EN: [RegExp, string][] = [
  [/\bpanca piana (?:con )?manubri\b/g, 'dumbbell bench press'],
  [/\bpanca inclinata (?:con )?manubri\b/g, 'incline dumbbell press'],
  [/\bpanca piana\b/g, 'barbell bench press'],
  [/\bpanca inclinata\b/g, 'barbell incline bench press'],
  [/\bpanca declinata\b/g, 'decline bench press'],
  [/\bpanca\b/g, 'bench'],
  [/\bmilitary( press)?\b/g, 'military press'],
  [/\blento avanti\b/g, 'military press'],
  [/\blat ?machine\b/g, 'lat pulldown'],
  [/\bpulley\b/g, 'seated cable rows'],
  [/\btrazioni( prone)?\b/g, 'pullups'],
  [/\btrazioni supine\b/g, 'chin up'],
  [/\brematore\b/g, 'row'],
  [/\bcroci ai cavi\b|\bcroci al cavo\b|\bcroce ai cavi\b/g, 'cable crossover'],
  [/\bcroci\b/g, 'flyes'],
  [/\bcavi\b/g, 'cable'],
  [/\bmanubri[o]?\b/g, 'dumbbell'],
  [/\bbilanciere\b/g, 'barbell'],
  [/\balzate laterali\b/g, 'side lateral raise'],
  [/\balzate frontali\b/g, 'front raise'],
  [/\balzate posteriori\b/g, 'rear delt raise'],
  [/\bstacco rumeno\b/g, 'romanian deadlift'],
  [/\bstacco\b/g, 'deadlift'],
  [/\baffondi\b/g, 'lunges'],
  [/\bpiegamenti\b/g, 'push up'],
  [/\bpush ?down\b/g, 'triceps pushdown'],
  [/\bfrench press\b/g, 'lying triceps press'],
  [/\bspinte\b/g, 'press'],
  [/\bpolpacci\b/g, 'calf raise'],
  [/\bstrette\b/g, 'close grip'],
  [/\bpresa stretta\b/g, 'close grip'],
  [/\bpresa larga\b/g, 'wide grip'],
  [/\bin piedi\b/g, 'standing'],
  [/\bseduto\b/g, 'seated'],
  [/\bsquat bulgaro\b|\baffondi bulgari\b/g, 'bulgarian split squat'],
  [/\bplank laterale\b/g, 'side bridge'],
];

/** Esercizi "classici": a parità di somiglianza vengono preferiti. */
const COMMON = new Set([
  'barbell-bench-press-medium-grip',
  'barbell-squat',
  'barbell-deadlift',
  'wide-grip-lat-pulldown',
  'seated-cable-rows',
  'standing-military-press',
  'dumbbell-shoulder-press',
  'side-lateral-raise',
  'barbell-curl',
  'triceps-pushdown',
  'leg-press',
  'leg-extensions',
  'lying-leg-curls',
  'pullups',
  'dumbbell-flyes',
  'incline-dumbbell-press',
  'bent-over-barbell-row',
  'romanian-deadlift',
  'dumbbell-lunges',
  'standing-calf-raises',
  'plank',
  'crunches',
  'dips-triceps-version',
  'chin-up',
  'face-pull',
  'dumbbell-bench-press',
  'barbell-incline-bench-press-medium-grip',
  'hammer-curls',
  'one-arm-dumbbell-row',
  'goblet-squat',
  'barbell-hip-thrust',
  'cable-crossover',
  'pushups',
  'hanging-leg-raise',
  'seated-leg-curl',
  'lying-triceps-press',
  'incline-dumbbell-flyes',
  'reverse-flyes',
  'barbell-shrug',
  'dumbbell-bicep-curl',
  'close-grip-barbell-bench-press',
]);

/** Nomi italiani "da palestra" degli esercizi più comuni → esercizio della libreria. */
const CLASSICS: Record<string, string> = {
  'panca piana': 'barbell-bench-press-medium-grip',
  'panca piana bilanciere': 'barbell-bench-press-medium-grip',
  'panca piana manubri': 'dumbbell-bench-press',
  'panca inclinata': 'barbell-incline-bench-press-medium-grip',
  'panca inclinata bilanciere': 'barbell-incline-bench-press-medium-grip',
  'panca inclinata manubri': 'incline-dumbbell-press',
  'panca stretta': 'close-grip-barbell-bench-press',
  squat: 'barbell-squat',
  'squat bilanciere': 'barbell-squat',
  stacco: 'barbell-deadlift',
  'stacco terra': 'barbell-deadlift',
  'stacco rumeno': 'romanian-deadlift',
  'lat machine': 'wide-grip-lat-pulldown',
  lat: 'wide-grip-lat-pulldown',
  pulley: 'seated-cable-rows',
  trazioni: 'pullups',
  'trazioni prone': 'pullups',
  'trazioni supine': 'chin-up',
  military: 'standing-military-press',
  'military press': 'standing-military-press',
  'lento avanti': 'standing-military-press',
  'shoulder press': 'dumbbell-shoulder-press',
  'spinte manubri': 'dumbbell-shoulder-press',
  'alzate laterali': 'side-lateral-raise',
  'curl bilanciere': 'barbell-curl',
  curl: 'barbell-curl',
  'curl manubri': 'dumbbell-bicep-curl',
  'curl martello': 'hammer-curls',
  'hammer curl': 'hammer-curls',
  'push down': 'triceps-pushdown',
  pushdown: 'triceps-pushdown',
  'french press': 'lying-triceps-press',
  'leg press': 'leg-press',
  'leg extension': 'leg-extensions',
  'leg curl': 'lying-leg-curls',
  polpacci: 'standing-calf-raises',
  calf: 'standing-calf-raises',
  dip: 'dips-triceps-version',
  dips: 'dips-triceps-version',
  'croci manubri': 'dumbbell-flyes',
  'croci cavi': 'cable-crossover',
  'croci panca inclinata': 'incline-dumbbell-flyes',
  'rematore bilanciere': 'bent-over-barbell-row',
  'rematore manubrio': 'one-arm-dumbbell-row',
  affondi: 'dumbbell-lunges',
  'hip thrust': 'barbell-hip-thrust',
  'face pull': 'face-pull',
  plank: 'plank',
  crunch: 'crunches',
  piegamenti: 'pushups',
  'push up': 'pushups',
  scrollate: 'barbell-shrug',
};

export const normalizeName = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const STOP = new Set([
  'the',
  'a',
  'with',
  'on',
  'of',
  'to',
  'di',
  'con',
  'al',
  'alla',
  'il',
  'la',
  'e',
]);

const tokens = (s: string) =>
  normalizeName(s)
    .split(' ')
    .filter((t) => t && !STOP.has(t))
    .map((t) => t.replace(/s$/, ''));

function translate(s: string): string {
  let t = normalizeName(s);
  for (const [re, en] of IT_EN) t = t.replace(re, en);
  return t;
}

export interface ExerciseIndex {
  ex: Exercise;
  exact: Set<string>;
  tokens: Set<string>;
}

export function buildIndex(exercises: Exercise[]): ExerciseIndex[] {
  return exercises.map((ex) => ({
    ex,
    exact: new Set([ex.name, ex.nameIt ?? '', ...ex.aliases].filter(Boolean).map(normalizeName)),
    tokens: new Set(tokens([ex.name, ...ex.aliases].join(' '))),
  }));
}

/**
 * Esercizi più simili al nome scritto: prima il nome esatto (anche italiano o alias),
 * poi per parole in comune dopo la traduzione dal gergo italiano.
 */
export function matchExercise(
  name: string,
  index: ExerciseIndex[],
  usage: Map<string, number> = new Map(),
): { id?: string; candidates: string[] } {
  const n = normalizeName(name);
  if (!n) return { candidates: [] };
  const exact = index.find((e) => e.exact.has(n));
  const phrase =
    CLASSICS[
      n
        .replace(/\b(?:con|col|al|ai|alla|il|la|da)\b/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
    ];
  if (!exact && phrase && index.some((e) => e.ex.id === phrase))
    return { id: phrase, candidates: [phrase] };
  if (exact) return { id: exact.ex.id, candidates: [exact.ex.id] };

  const q = new Set(tokens(translate(name)));
  const itTokens = new Set(tokens(name));
  const scored = index
    .map((e) => {
      let common = 0;
      for (const t of q) if (e.tokens.has(t)) common++;
      // anche le parole del nome italiano dell'esercizio contano
      const it = tokens(e.ex.nameIt ?? '');
      let itCommon = 0;
      for (const t of it) if (itTokens.has(t)) itCommon++;
      const score =
        Math.max(
          common / (q.size + e.tokens.size - common || 1),
          it.length ? itCommon / it.length : 0,
        ) +
        Math.min(usage.get(e.ex.id) ?? 0, 5) * 0.01 +
        (e.ex.source === 'custom' ? 0.02 : 0) +
        (COMMON.has(e.ex.id) ? 0.1 : 0);
      return { id: e.ex.id, score };
    })
    .filter((x) => x.score > 0.15)
    .sort((a, b) => b.score - a.score);
  const best = scored[0];
  const out: { id?: string; candidates: string[] } = {
    candidates: scored.slice(0, 5).map((x) => x.id),
  };
  if (best && best.score >= 0.45) out.id = best.id;
  return out;
}

export function resolveBlocks(
  blocks: ParsedBlock[],
  index: ExerciseIndex[],
  usage?: Map<string, number>,
): ParsedBlock[] {
  for (const b of blocks)
    for (const it of b.items) {
      const m = matchExercise(it.raw, index, usage);
      it.candidates = m.candidates;
      if (m.id) it.exerciseId = m.id;
      else delete it.exerciseId;
    }
  return blocks;
}

const uid = () => crypto.randomUUID();

/** Blocchi riconosciuti → blocchi della scheda (gli esercizi non risolti vengono saltati). */
export function toProgramBlocks(blocks: ParsedBlock[], defaultRestSec: number): Block[] {
  return blocks
    .map((b) => ({
      id: uid(),
      type: b.type,
      restSec: b.restSec ?? defaultRestSec,
      items: b.items
        .filter((it) => it.exerciseId)
        .map((it) => {
          const item: Block['items'][number] = {
            id: uid(),
            exerciseId: it.exerciseId!,
            sets: it.sets,
          };
          if (it.notes) item.notes = it.notes;
          return item;
        }),
    }))
    .filter((b) => b.items.length)
    .map((b) =>
      b.items.length === 1 && b.type === 'superset' ? { ...b, type: 'single' as const } : b,
    );
}

// --- e ritorno: scheda → testo (per condividerla o modificarla a mano) ---------

const DAY_NAMES = [
  '',
  'lunedì',
  'martedì',
  'mercoledì',
  'giovedì',
  'venerdì',
  'sabato',
  'domenica',
];

function setsToText(sets: SetTarget[]): string {
  const work = sets.filter((s) => s.kind !== 'warmup');
  if (!work.length) return '';
  const first = work[0]!;
  const same = work.every((s) => JSON.stringify(s) === JSON.stringify(first));
  const load = first.weightKg
    ? ` @${first.weightKg}`
    : first.percent1RM
      ? ` @${first.percent1RM}%`
      : '';
  if (same && first.durationSec) {
    const d = first.durationSec;
    return `${work.length}x${d % 60 === 0 && d >= 60 ? `${d / 60}'` : `${d}s`}${load}`;
  }
  if (same && first.reps !== undefined) return `${work.length}x${formatReps(first.reps)}${load}`;
  if (work.every((s) => typeof s.reps === 'number'))
    return `${work.map((s) => formatReps(s.reps!)).join('/')}${load}`;
  return work
    .map((s) => (s.durationSec ? formatDuration(s.durationSec) : formatReps(s.reps ?? 0)))
    .join('/');
}

const restText = (sec: number) =>
  sec % 60 === 0
    ? `${sec / 60}:00`
    : sec > 60
      ? `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`
      : `${sec}`;

export function dayToText(day: ProgramDay, nameOf: (id: string) => string): string {
  return day.blocks
    .map((b) => {
      const parts = b.items.map((it) => {
        const notes = it.notes ? ` (${it.notes})` : '';
        return `${nameOf(it.exerciseId)} ${setsToText(it.sets)}${notes}`.trim();
      });
      const rest = b.restSec ? ` r${restText(b.restSec)}` : '';
      return b.items.length > 1 ? `SS ${parts.join(' + ')}${rest}` : `${parts[0]}${rest}`;
    })
    .join('\n');
}

export function programToText(p: Program, nameOf: (id: string) => string): string {
  return p.days
    .map((d, i) => {
      const wd = d.weekday ? ` (${DAY_NAMES[d.weekday]})` : '';
      return `# ${String.fromCharCode(65 + i)} ${d.name}${wd}\n${dayToText(d, nameOf)}`;
    })
    .join('\n\n');
}
