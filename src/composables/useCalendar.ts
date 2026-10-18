import { computed } from 'vue';
import { db } from '@/db';
import type { ScheduleOverride } from '@/db/types';
import {
  groupByDate,
  moveOverrides,
  type CalendarDay,
  type CalendarInput,
} from '@/domain/calendar';
import { useToday } from './useToday';
import { useLiveQuery } from './useLiveQuery';

/** Dati del calendario sempre aggiornati, più le azioni per spostare/saltare allenamenti. */
export function useCalendar() {
  const { today } = useToday();
  const { data: programs } = useLiveQuery(() => db.programs.toArray(), [], []);
  const { data: overrides } = useLiveQuery(() => db.schedule.toArray(), [], []);
  const { data: sessions } = useLiveQuery(() => db.sessions.toArray(), [], []);

  const input = computed<CalendarInput>(() => {
    const done = (sessions.value ?? []).filter((s) => s.status === 'done');
    const since = done.reduce<string | undefined>(
      (m, s) => (!m || s.date < m ? s.date : m),
      undefined,
    );
    const out: CalendarInput = {
      programs: programs.value ?? [],
      overrides: new Map((overrides.value ?? []).map((o) => [o.date, o])),
      sessionsByDate: groupByDate(sessions.value ?? []),
      today: today.value,
    };
    if (since) out.since = since;
    return out;
  });

  return { input, sessions, programs };
}

export async function moveWorkout(day: CalendarDay, to: string, input: CalendarInput) {
  const changes = moveOverrides(day, to, input);
  if (!changes) return;
  await db.transaction('rw', db.schedule, async () => {
    await db.schedule.bulkDelete(changes.del);
    await db.schedule.bulkPut(changes.put);
  });
}

export async function skipWorkout(day: CalendarDay) {
  if (!day.program) return;
  const o: ScheduleOverride = {
    date: day.date,
    programId: day.program.id,
    dayId: null,
    skipped: true,
  };
  await db.schedule.put(o);
}

/** Pianifica un giorno della scheda in una data (anche in un giorno di riposo). */
export async function planWorkout(date: string, programId: string, dayId: string) {
  await db.schedule.put({ date, programId, dayId });
}

/** Torna allo schema settimanale per quella data (e annulla l'eventuale spostamento collegato). */
export async function resetDay(day: CalendarDay) {
  const o = day.override;
  if (!o) return;
  await db.transaction('rw', db.schedule, async () => {
    await db.schedule.delete(o.date);
    const linked = o.movedTo ?? o.movedFrom;
    if (linked) await db.schedule.delete(linked);
  });
}
