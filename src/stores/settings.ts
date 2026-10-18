import { defineStore } from 'pinia';
import { reactive, toRefs, watch } from 'vue';

const KEY = 'gym:settings';

const defaults = {
  sound: true,
  vibration: true,
  keepAwake: true,
  /** Allenamento un esercizio alla volta, a tutto schermo. */
  focusMode: true,
  /** Recupero proposto per esercizi aggiunti al volo. */
  defaultRestSec: 90,
  /** Conto alla rovescia prima delle serie a tempo. */
  countdownSec: 3,
  /** Mese (YYYY-MM) in cui l'utente ha rimandato la foto. */
  photoSnoozedMonth: '',
};

export type Settings = typeof defaults;

function load(): Settings {
  try {
    return { ...defaults, ...(JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<Settings>) };
  } catch {
    return { ...defaults };
  }
}

export const useSettingsStore = defineStore('settings', () => {
  const state = reactive(load());
  watch(state, (v) => {
    try {
      localStorage.setItem(KEY, JSON.stringify(v));
    } catch {
      /* storage non disponibile: le impostazioni restano in memoria */
    }
  });
  return { ...toRefs(state) };
});
