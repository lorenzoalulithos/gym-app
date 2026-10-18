import JSZip from 'jszip';
import { db, getMeta } from '@/db';
import type {
  BodyMetric,
  Exercise,
  Program,
  ProgressPhoto,
  ScheduleOverride,
  DeloadWindow,
  Session,
} from '@/db/types';
import { exerciseTrends } from '@/domain/analysis';
import { todayIso } from '@/domain/format';

export const SCHEMA_VERSION = 1;

export interface BackupData {
  app: 'gym-app';
  schemaVersion: number;
  exportedAt: string;
  conventions: Record<string, string>;
  /** Solo esercizi personalizzati o modificati: la libreria arriva con la build. */
  exercises: Exercise[];
  programs: Program[];
  sessions: Session[];
  bodyMetrics: BodyMetric[];
  /** Spostamenti e allenamenti saltati nel calendario. */
  schedule?: ScheduleOverride[];
  /** Settimane di scarico pianificate o fatte. */
  deloads?: DeloadWindow[];
  /** Riepilogo per esercizio, pensato per farsi proporre la scheda successiva. */
  analysis?: ReturnType<typeof exerciseTrends>;
}

const CONVENTIONS = {
  weight:
    'per_implement = kg di un manubrio/kettlebell; total = carico totale (bilanciere compreso); stack = valore della pila; added = zavorra sul corpo libero',
  perSide: 'ripetizioni e tempo degli esercizi perSide sono per lato',
  e1rm: 'Epley: kg × (1 + rip/30)',
};

export async function collectData(withAnalysis = true): Promise<BackupData> {
  const [allExercises, programs, sessions, bodyMetrics, schedule] = await Promise.all([
    db.exercises.toArray(),
    db.programs.toArray(),
    db.sessions.orderBy('date').toArray(),
    db.bodyMetrics.orderBy('date').toArray(),
    db.schedule.toArray(),
  ]);
  const used = new Set(sessions.flatMap((s) => s.exerciseIds));
  for (const p of programs)
    for (const d of p.days)
      for (const b of d.blocks) for (const i of b.items) used.add(i.exerciseId);
  const exercises = allExercises.filter(
    (e) => e.source === 'custom' || e.updatedAt > 0 || used.has(e.id),
  );
  const data: BackupData = {
    app: 'gym-app',
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    conventions: CONVENTIONS,
    exercises,
    programs,
    sessions,
    bodyMetrics,
    schedule,
    deloads: (await getMeta<DeloadWindow[]>('deload:windows')) ?? [],
  };
  if (withAnalysis)
    data.analysis = exerciseTrends(data.sessions, new Map(allExercises.map((e) => [e.id, e])));
  return data;
}

/** Condivide il file (menu di Android) o, in mancanza, lo scarica. */
export async function shareOrDownload(blob: Blob, filename: string) {
  const file = new File([blob], filename, { type: blob.type });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: filename });
      return;
    } catch (e) {
      if ((e as Error).name === 'AbortError') return;
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export async function exportJson() {
  const data = await collectData();
  const blob = new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' });
  await shareOrDownload(blob, `gym-dati-${todayIso()}.json`);
}

export async function exportFullZip() {
  const zip = new JSZip();
  zip.file('data.json', JSON.stringify(await collectData(false)));
  const photos = await db.photos.toArray();
  zip.file(
    'photos.json',
    JSON.stringify(
      photos.map((p) => ({ id: p.id, month: p.month, pose: p.pose, takenAt: p.takenAt })),
    ),
  );
  for (const p of photos) zip.file(`photos/${p.id}.jpg`, p.blob);
  const blob = await zip.generateAsync({ type: 'blob' });
  await shareOrDownload(
    new Blob([blob], { type: 'application/zip' }),
    `gym-backup-${todayIso()}.zip`,
  );
}

function validate(data: unknown): BackupData {
  const d = data as Partial<BackupData>;
  if (d?.app !== 'gym-app') throw new Error('Il file non è un backup di questa app.');
  if ((d.schemaVersion ?? 0) > SCHEMA_VERSION)
    throw new Error("Backup creato da una versione più recente dell'app: aggiorna prima l'app.");
  if (!Array.isArray(d.sessions) || !Array.isArray(d.programs) || !Array.isArray(d.exercises))
    throw new Error('Backup incompleto.');
  return d as BackupData;
}

export interface ImportSummary {
  sessions: number;
  programs: number;
  exercises: number;
  photos: number;
}

/** Legge il file senza toccare il database, per mostrare un riepilogo prima di confermare. */
export async function readBackup(file: File) {
  let data: BackupData;
  let photos: ProgressPhoto[] | null = null;
  if (file.name.endsWith('.zip') || file.type === 'application/zip') {
    const zip = await JSZip.loadAsync(file);
    data = validate(JSON.parse(await zip.file('data.json')!.async('string')));
    const meta = JSON.parse((await zip.file('photos.json')?.async('string')) ?? '[]') as Omit<
      ProgressPhoto,
      'blob'
    >[];
    photos = await Promise.all(
      meta.map(async (m) => ({
        ...m,
        blob: new Blob([await zip.file(`photos/${m.id}.jpg`)!.async('arraybuffer')], {
          type: 'image/jpeg',
        }),
      })),
    );
  } else {
    data = validate(JSON.parse(await file.text()));
  }
  const summary: ImportSummary = {
    sessions: data.sessions.length,
    programs: data.programs.length,
    exercises: data.exercises.length,
    photos: photos?.length ?? 0,
  };
  return { data, photos, summary };
}

/**
 * Sostituisce sessioni, schede e misure con quelle del backup.
 * Gli esercizi vengono aggiornati/aggiunti; le foto sostituite solo se il backup le contiene.
 */
export async function applyBackup(data: BackupData, photos: ProgressPhoto[] | null) {
  await db.transaction(
    'rw',
    [db.exercises, db.programs, db.sessions, db.bodyMetrics, db.schedule, db.photos, db.meta],
    async () => {
      await db.exercises.bulkPut(data.exercises);
      await db.programs.clear();
      await db.programs.bulkAdd(data.programs);
      await db.sessions.clear();
      await db.sessions.bulkAdd(data.sessions);
      await db.bodyMetrics.clear();
      await db.bodyMetrics.bulkAdd(data.bodyMetrics ?? []);
      await db.schedule.clear();
      await db.schedule.bulkAdd(data.schedule ?? []);
      if (data.deloads) await db.meta.put({ key: 'deload:windows', value: data.deloads });
      if (photos) {
        await db.photos.clear();
        await db.photos.bulkAdd(photos);
      }
    },
  );
}
