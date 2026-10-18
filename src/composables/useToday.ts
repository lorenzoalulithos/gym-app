import { computed, ref } from 'vue';
import { currentMonth, todayIso } from '@/domain/format';

// Data di oggi condivisa e reattiva: l'app può restare aperta in background per giorni,
// quindi si aggiorna al ritorno in primo piano e ogni minuto.
const today = ref(todayIso());

function refresh() {
  const t = todayIso();
  if (t !== today.value) today.value = t;
}

if (typeof window !== 'undefined') {
  setInterval(refresh, 60_000);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') refresh();
  });
}

export function useToday() {
  return { today, month: computed(() => currentMonth(new Date(`${today.value}T12:00:00`))) };
}
