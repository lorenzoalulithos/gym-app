import { useQuasar } from 'quasar';
import { formatClock } from '@/domain/format';

const PRESETS = [0, 30, 45, 60, 75, 90, 120, 150, 180];

/** Scelta rapida del recupero: griglia di valori comuni + valore personalizzato. */
export function useRestPicker() {
  const $q = useQuasar();

  function custom(current: number): Promise<number | undefined> {
    return new Promise((resolve) => {
      $q.dialog({
        title: 'Recupero (secondi)',
        prompt: { model: String(current), type: 'number', inputmode: 'numeric' },
        cancel: { flat: true, label: 'Annulla' },
        ok: { label: 'OK', color: 'primary', unelevated: true },
      })
        .onOk((v: string) => resolve(Math.max(0, Number(v) || 0)))
        .onCancel(() => resolve(undefined));
    });
  }

  /** Restituisce i secondi scelti, `null` per "usa quello del blocco", undefined se annullato. */
  function pickRest(
    title: string,
    current: number,
    allowInherit = false,
  ): Promise<number | null | undefined> {
    return new Promise((resolve) => {
      $q.bottomSheet({
        title,
        dark: true,
        grid: true,
        actions: [
          ...PRESETS.map((s) => ({
            label: s === 0 ? 'Nessuno' : formatClock(s),
            icon: s === current ? 'check_circle' : 'timer',
            id: String(s),
          })),
          { label: 'Altro…', icon: 'edit', id: 'custom' },
          ...(allowInherit ? [{ label: 'Come il blocco', icon: 'undo', id: 'inherit' }] : []),
        ],
      })
        .onOk((a: { id: string }) => {
          if (a.id === 'inherit') resolve(null);
          else if (a.id === 'custom') void custom(current).then(resolve);
          else resolve(Number(a.id));
        })
        .onCancel(() => resolve(undefined));
    });
  }

  return { pickRest };
}
