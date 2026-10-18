import type { Block, BlockType, Exercise, Program, ProgramDay, SetTarget } from '@/db/types';
import { formatReps } from './format';
import { defaultSets } from './programEdit';

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
  /** Recupero proprio (esercizi non ultimi di un superset). */
  restSec?: number;
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

/** "90", "1:30", "1'30", "2'", "2min", "90s" → secondi */
function parseSeconds(s: string): number | undefined {
  const t = s.trim().toLowerCase();
  let m = t.match(/^(\d+)[:'](\d{2})"?$/);
  if (m) return Number(m[1]) * 60 + Number(m[2]);
  m = t.match(/^(\d+(?:[.,]\d+)?)\s*(?:'|min|m)$/);
  if (m) return Math.round(num(m[1]!) * 60);
  m = t.match(/^(\d+)\s*(?:"|''|s|sec)?$/);
  if (m) return Number(m[1]);
  return undefined;
}

const TIME = String.raw`\d+:\d{2}|\d+'\d{2}"?|\d+\s*(?:'|"|min|s|sec)`;
const W = String.raw`(?:@\s*\d+(?:[.,]\d+)?)`;
/** fine di una specifica: spazio, punteggiatura o fine riga */
const END = String.raw`(?=[\s,;.)]|$)`;

/** Una parte di piramide: "12", "12@60", "45s", "1:00@10" */
function parsePyramidPart(part: string, base: () => SetTarget): SetTarget {
  const [v, w] = part.split('@').map((x) => x.trim());
  const t = base();
  if (w) t.weightKg = num(w);
  if (/[:'"sm]/i.test(v!)) {
    const sec = parseSeconds(v!);
    if (sec !== undefined) t.durationSec = sec;
  } else t.reps = Number(v);
  return t;
}

/** Riconosce le specifiche di un esercizio; restituisce il nome (testo prima delle specifiche). */
function parseSegment(text: string): {
  name: string;
  sets: SetTarget[];
  restSec?: number;
  notes?: string;
} {
  // virgole e punto e virgola separano (es. "Panca 4x8, rec 90"), tranne le virgole decimali
  let s = ` ${text.trim()} `
    .replace(/(\d),(\d)/g, '$1§$2')
    .replace(/[,;]/g, ' ')
    .replace(/§/g, ',');

  // posizione della prima specifica (serie, piramide o carico): il testo prima è il nome
  const specRe = new RegExp(
    String.raw`\s(?:\d+\s*[x×]\s*(?:\d|max|amrap|cedimento)|\d+(?:${W})?(?:\s*\/\s*\d)|${W}|r\s*\d|rec\b)`,
    'i',
  );
  const specAt = s.search(specRe);

  // note: tra parentesi, dopo la prima specifica ("Front Squat (Clean Grip) 3x5 (pausa)")
  let notes: string | undefined;
  const open = specAt >= 0 ? s.indexOf('(', specAt) : -1;
  if (open >= 0) {
    const close = s.lastIndexOf(')');
    notes = s.slice(open + 1, close > open ? close : undefined).trim() || undefined;
    s = `${s.slice(0, open)} ${close > open ? s.slice(close + 1) : ''} `;
  }

  let restSec: number | undefined;
  const rest =
    s.match(
      new RegExp(String.raw`\s(?:r|rec|recupero|riposo|rest)\s*[:=]?\s*(${TIME}|\d+)${END}`, 'i'),
    ) ?? s.match(new RegExp(String.raw`\s(${TIME}|\d+)\s*(?:rec|recupero|riposo|rest)\b`, 'i'));
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
  // il carico unico vale solo se non c'è una piramide con carichi per serie
  const pyrWithKg = new RegExp(String.raw`\d${W}\s*\/`).test(s);
  if (!pyrWithKg) {
    const kg = s.match(
      new RegExp(String.raw`@\s*(\d+(?:[.,]\d+)?)\s*(?:kg)?|\s(\d+(?:[.,]\d+)?)\s*kg${END}`, 'i'),
    );
    if (kg) {
      weightKg = num(kg[1] ?? kg[2]!);
      s = s.replace(kg[0], ' ');
    }
  }

  const base = (): SetTarget => {
    const t: SetTarget = {};
    if (weightKg !== undefined) t.weightKg = weightKg;
    if (percent1RM !== undefined) t.percent1RM = percent1RM;
    return t;
  };

  const sets: SetTarget[] = [];
  let firstSpec = -1;
  const mark = (i: number) => (firstSpec = firstSpec < 0 ? i : Math.min(firstSpec, i));
  // più gruppi sulla stessa riga si sommano: "Stacco 1x5, 2x3"
  const groupRe = new RegExp(
    String.raw`\s(\d+)\s*[x×]\s*(?:(${TIME})|(\d+)(?:\s*[-–]\s*(\d+))?|(max|amrap|cedimento))${END}`,
    'gi',
  );
  for (const g of s.matchAll(groupRe)) {
    mark(g.index);
    const n = Number(g[1]);
    for (let i = 0; i < n; i++) {
      const t = base();
      if (g[2]) t.durationSec = parseSeconds(g[2]) ?? 30;
      else if (g[3]) t.reps = g[4] ? { min: Number(g[3]), max: Number(g[4]) } : Number(g[3]);
      sets.push(t);
    }
    if (g[5]) notes = notes ? `${notes} · massime ripetizioni` : 'massime ripetizioni';
  }
  if (!sets.length) {
    // piramide: 12/10/8/6, 12@60/10@70, 45s/30s
    const part = String.raw`(?:${TIME}|\d+)(?:\s*${W})?`;
    const pyr = s.match(new RegExp(String.raw`\s(${part}(?:\s*\/\s*${part})+)${END}`, 'i'));
    if (pyr) {
      mark(pyr.index!);
      sets.push(...pyr[1]!.split('/').map((x) => parsePyramidPart(x, base)));
    }
  }

  // il nome è ciò che precede la prima specifica trovata
  let name = firstSpec >= 0 ? s.slice(0, firstSpec) : s;
  name = name
    .replace(/@.*$/, '')
    .replace(/^\s*(?:[-•*]|\d+[.)]|[a-z]\d?[.)]|\d+[a-z][.)]?)\s+/i, '')
    .replace(/[.:]\s*$/, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!sets.length) sets.push(base(), base(), base());
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
      .replace(/[(·,\-–]\s*$/, '')
      .trim();
  }
  // la lettera del giorno ("# A Push", "Giorno B - Pull") la mette già l'app
  name = name
    .replace(/^[A-Z](?:\s*[-–·:]\s*|\s+)(?=\S)/, '')
    .replace(/^[:\-–·]\s*/, '')
    .trim();
  const out: { name: string; weekday?: number } = { name: name || 'Giorno' };
  if (weekday) out.weekday = weekday;
  return out;
}

/** Divide "A 3x12 + B 3x12" sui "+" che non sono dentro le parentesi delle note. */
function splitSuperset(body: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let cur = '';
  for (let i = 0; i < body.length; i++) {
    const c = body[i]!;
    if (c === '(') depth++;
    if (c === ')') depth = Math.max(0, depth - 1);
    if (
      c === '+' &&
      depth === 0 &&
      /\s/.test(body[i - 1] ?? ' ') &&
      /\s/.test(body[i + 1] ?? ' ')
    ) {
      parts.push(cur);
      cur = '';
    } else cur += c;
  }
  parts.push(cur);
  return parts.map((x) => x.trim()).filter(Boolean);
}

/** Testo → blocchi di un giorno (le righe "SS ... + ..." o che iniziano con "+" sono superset). */
export function parseBlocks(text: string): ParsedBlock[] {
  const blocks: ParsedBlock[] = [];
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || parseDayHeader(line)) continue;
    const joinPrev = line.startsWith('+');
    const stripped = line.replace(/^\+\s*/, '').replace(/^(?:[-•*]|\d+[.)])\s+/, '');
    const isCircuit = /^(?:circuito|circuit)\b/i.test(stripped);
    const body = stripped.replace(/^(?:ss|superset|circuito|circuit)\s*[:-]?\s*/i, '');
    const parts = splitSuperset(body)
      .map(parseSegment)
      .filter((p) => p.name);
    if (!parts.length) continue;
    // il recupero dell'ultimo esercizio è quello di fine giro; gli altri restano dell'esercizio
    const items = parts.map((p, i) => {
      const it: ParsedExercise = { raw: p.name, sets: p.sets, candidates: [] };
      if (p.notes) it.notes = p.notes;
      if (p.restSec !== undefined && i < parts.length - 1) it.restSec = p.restSec;
      return it;
    });
    const restSec = parts.at(-1)!.restSec;
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
  panca: 'barbell-bench-press-medium-grip',
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
  const second = scored[1];
  const out: { id?: string; candidates: string[] } = {
    candidates: scored.slice(0, 5).map((x) => x.id),
  };
  // scelta automatica solo con un vincitore chiaro: nel dubbio decide l'utente
  if (
    best &&
    best.score >= 0.45 &&
    (!second || best.score >= 0.6 || best.score - second.score >= 0.05)
  )
    out.id = best.id;
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
export function toProgramBlocks(
  blocks: ParsedBlock[],
  defaultRestSec: number,
  exercises?: Map<string, Exercise>,
): Block[] {
  return blocks
    .map((b) => ({
      id: uid(),
      type: b.type,
      restSec: b.restSec ?? defaultRestSec,
      items: b.items
        .filter((it) => it.exerciseId)
        .map((it) => {
          // righe con solo il nome: serie predefinite (3×10 o 3×30s a seconda dell'esercizio)
          const empty = it.sets.every((t) => t.reps === undefined && t.durationSec === undefined);
          const isMax = it.notes?.includes('massime ripetizioni');
          const sets =
            empty && !isMax
              ? it.sets.map((t) => ({ ...defaultSets(exercises?.get(it.exerciseId!))[0]!, ...t }))
              : it.sets;
          const item: Block['items'][number] = { id: uid(), exerciseId: it.exerciseId!, sets };
          if (it.notes) item.notes = it.notes;
          if (it.restSec !== undefined) item.restSec = it.restSec;
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
    return `${work.length}x${timeText(d)}${load}`;
  }
  if (same && first.reps !== undefined) return `${work.length}x${formatReps(first.reps)}${load}`;
  // serie diverse: una per una, ognuna col suo carico ("12@60/10@70/8@80", "45s/30s")
  const sameLoad = work.every(
    (s) => s.weightKg === first.weightKg && s.percent1RM === first.percent1RM,
  );
  const one = (s: SetTarget) => {
    const v = s.durationSec ? timeText(s.durationSec) : formatReps(s.reps ?? 0);
    return sameLoad || !s.weightKg ? v : `${v}@${s.weightKg}`;
  };
  return `${work.map(one).join('/')}${sameLoad ? load : ''}`;
}

const timeText = (d: number) =>
  d >= 60 ? `${Math.floor(d / 60)}:${String(d % 60).padStart(2, '0')}` : `${d}s`;

const restText = (sec: number) =>
  sec === 0
    ? '0'
    : sec % 60 === 0
      ? `${sec / 60}:00`
      : sec > 60
        ? `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`
        : `${sec}`;

export function dayToText(day: ProgramDay, nameOf: (id: string) => string): string {
  return day.blocks
    .map((b) => {
      const parts = b.items.map((it, ii) => {
        const notes = it.notes ? ` (${it.notes})` : '';
        // recupero proprio degli esercizi non ultimi di un superset
        const own =
          it.restSec !== undefined && ii < b.items.length - 1 ? ` r${restText(it.restSec)}` : '';
        return `${nameOf(it.exerciseId)} ${setsToText(it.sets)}${own}${notes}`.trim();
      });
      const lastOwn = b.items.at(-1)?.restSec;
      const rest = ` r${restText(lastOwn ?? b.restSec)}`;
      if (b.items.length === 1) return `${parts[0]}${rest}`;
      return `${b.type === 'circuit' ? 'CIRCUITO' : 'SS'} ${parts.join(' + ')}${rest}`;
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
