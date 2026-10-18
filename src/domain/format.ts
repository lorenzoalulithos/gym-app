import type { Exercise, LoggedSet, RepTarget, SetTarget } from '@/db/types';

const kgFmt = new Intl.NumberFormat('it-IT', { maximumFractionDigits: 2 });

export const formatKg = (kg: number) => `${kgFmt.format(kg)} kg`;

/** 45 → "45 sec", 60 → "1 min", 65 → "1:05 min" */
export function formatDuration(sec: number): string {
  if (sec < 60) return `${sec} sec`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return s === 0 ? `${m} min` : `${m}:${String(s).padStart(2, '0')} min`;
}

/** Cronometro: 75 → "1:15", 3725 → "1:02:05" */
export function formatClock(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = String(s % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${r}` : `${m}:${r}`;
}

export function formatReps(r: RepTarget): string {
  return typeof r === 'number' ? String(r) : `${r.min}-${r.max}`;
}

export const repsMax = (r: RepTarget | undefined) =>
  r === undefined ? undefined : typeof r === 'number' ? r : r.max;

export const repsMin = (r: RepTarget | undefined) =>
  r === undefined ? undefined : typeof r === 'number' ? r : r.min;

function joinParts(parts: (string | undefined)[], side: boolean) {
  const s = parts.filter(Boolean).join(' × ');
  return side && s ? `${s} /lato` : s;
}

/** Una serie svolta, nello stile "34 kg × 6", "45 sec", "30 sec × 10". */
export function formatSet(set: LoggedSet, ex?: Pick<Exercise, 'perSide'>): string {
  return joinParts(
    [
      set.weightKg ? formatKg(set.weightKg) : undefined,
      set.durationSec ? formatDuration(set.durationSec) : undefined,
      set.reps !== undefined ? `${set.reps} rip` : undefined,
    ],
    !!ex?.perSide,
  );
}

export function formatTarget(t: SetTarget, ex?: Pick<Exercise, 'perSide'>): string {
  return joinParts(
    [
      t.weightKg ? formatKg(t.weightKg) : t.percent1RM ? `${t.percent1RM}% 1RM` : undefined,
      t.durationSec ? formatDuration(t.durationSec) : undefined,
      t.reps !== undefined ? `${formatReps(t.reps)} rip` : undefined,
    ],
    !!ex?.perSide,
  );
}

/** Riassunto compatto di una lista di target: "4 × 10", "3 × 8-10 @ 20 kg", oppure elenco. */
export function summarizeTargets(sets: SetTarget[], ex?: Pick<Exercise, 'perSide'>): string {
  if (sets.length === 0) return '—';
  const labels = sets.map((s) => formatTarget(s, ex));
  if (labels.every((l) => l === labels[0])) return `${sets.length} × ${labels[0]}`;
  return labels.join(' · ');
}

const dateFmt = new Intl.DateTimeFormat('it-IT', {
  weekday: 'long',
  day: 'numeric',
  month: 'short',
});
const monthFmt = new Intl.DateTimeFormat('it-IT', { month: 'long', year: 'numeric' });

export const formatDate = (iso: string) => dateFmt.format(new Date(`${iso}T12:00:00`));
export const formatMonth = (yyyyMm: string) => monthFmt.format(new Date(`${yyyyMm}-15T12:00:00`));

export function todayIso(d = new Date()): string {
  const z = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
}

export const currentMonth = (d = new Date()) => todayIso(d).slice(0, 7);
