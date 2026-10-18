import Dexie, { type EntityTable } from 'dexie';
import type {
  BodyMetric,
  Exercise,
  MetaEntry,
  Program,
  ProgressPhoto,
  ScheduleOverride,
  Session,
} from './types';

export class GymDb extends Dexie {
  exercises!: EntityTable<Exercise, 'id'>;
  programs!: EntityTable<Program, 'id'>;
  sessions!: EntityTable<Session, 'id'>;
  photos!: EntityTable<ProgressPhoto, 'id'>;
  bodyMetrics!: EntityTable<BodyMetric, 'id'>;
  meta!: EntityTable<MetaEntry, 'key'>;
  schedule!: EntityTable<ScheduleOverride, 'date'>;

  constructor(name = 'gym') {
    super(name);
    this.version(1).stores({
      exercises: 'id, name, source',
      programs: 'id, startDate',
      sessions: 'id, date, status, programId, *exerciseIds',
      photos: 'id, month, [month+pose]',
      bodyMetrics: 'id, date',
      meta: 'key',
    });
    this.version(2).stores({ schedule: 'date' });
  }
}

export const db = new GymDb();

export const newId = () => crypto.randomUUID();

export async function getMeta<T>(key: string): Promise<T | undefined> {
  return (await db.meta.get(key))?.value as T | undefined;
}

export async function setMeta(key: string, value: unknown) {
  await db.meta.put({ key, value });
}
