import { computed } from 'vue';
import { db, getMeta, setMeta } from '@/db';
import type { DeloadWindow, Session } from '@/db/types';
import { deloadAdvice, isDeloadDate } from '@/domain/deload';
import { useExercisesStore } from '@/stores/exercises';
import { useSettingsStore } from '@/stores/settings';
import { useLiveQuery } from './useLiveQuery';
import { useToday } from './useToday';

const KEY = 'deload:windows';

export async function deloadWindows(): Promise<DeloadWindow[]> {
  return (await getMeta<DeloadWindow[]>(KEY)) ?? [];
}

export async function planDeload(w: DeloadWindow) {
  // un nuovo scarico sostituisce quelli futuri non ancora iniziati
  const all = (await deloadWindows()).filter((x) => x.to < w.from);
  await setMeta(KEY, [...all, w]);
}

/** Termina lo scarico in corso (resta nello storico fino a ieri). */
export async function endDeload(today: string) {
  const all = await deloadWindows();
  const yesterday = new Date(`${today}T12:00:00`);
  yesterday.setDate(yesterday.getDate() - 1);
  const y = yesterday.toISOString().slice(0, 10);
  await setMeta(
    KEY,
    all
      .map((w) => (w.from <= today && w.to >= today ? { ...w, to: y } : w))
      .filter((w) => w.to >= w.from),
  );
}

export function useDeload(sessions: () => Session[] | undefined) {
  const { today } = useToday();
  const exercises = useExercisesStore();
  const settings = useSettingsStore();
  const { data: windows } = useLiveQuery(
    async () => ((await db.meta.get(KEY))?.value as DeloadWindow[] | undefined) ?? [],
    [],
    [],
  );

  const current = computed(() =>
    (windows.value ?? []).find((w) => today.value >= w.from && today.value <= w.to),
  );
  const upcoming = computed(() => (windows.value ?? []).find((w) => w.from > today.value));
  const active = computed(() => isDeloadDate(today.value, windows.value ?? []));
  const advice = computed(() =>
    deloadAdvice(sessions() ?? [], exercises.byId, windows.value ?? [], today.value),
  );
  const showAdvice = computed(
    () =>
      advice.value.level !== 'none' &&
      !current.value &&
      !upcoming.value &&
      settings.deloadSnoozedUntil < today.value,
  );

  return { windows, current, upcoming, active, advice, showAdvice };
}
