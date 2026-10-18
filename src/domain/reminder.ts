import { calendarDay, recentMissed, type CalendarInput } from './calendar';

export interface Reminder {
  title: string;
  body: string;
}

/**
 * Promemoria del giorno: l'allenamento previsto oggi oppure, se oggi è riposo,
 * l'ultimo allenamento saltato negli ultimi 3 giorni.
 */
export function reminderFor(input: CalendarInput, today: string): Reminder | null {
  const day = calendarDay(today, { ...input, today });
  if (day.status === 'today' && day.planned) {
    return { title: `Oggi: ${day.planned.name}`, body: 'Si va? Tocca per aprire la scheda 💪' };
  }
  if (day.status === 'done') return null;
  const missed = recentMissed({ ...input, today }, 3)[0];
  if (missed?.planned) {
    return {
      title: `Hai saltato ${missed.planned.name}`,
      body: 'Spostalo a oggi o a un altro giorno dal calendario.',
    };
  }
  return null;
}
