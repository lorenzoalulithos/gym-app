// Segnali di fine timer: suono, vibrazione e, a schermo bloccato, notifica.
import { useSettingsStore } from '@/stores/settings';

let ctx: AudioContext | undefined;

/** Va chiamata da un gesto dell'utente (tap) perché Android permetta l'audio. */
export function unlockAudio() {
  ctx ??= new AudioContext();
  if (ctx.state === 'suspended') void ctx.resume();
}

function tone(
  freq: number,
  startAt: number,
  dur: number,
  type: OscillatorType = 'sine',
  vol = 0.5,
) {
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.frequency.value = freq;
  osc.type = type;
  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.exponentialRampToValueAtTime(vol, startAt + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + dur);
  osc.connect(gain).connect(ctx.destination);
  osc.start(startAt);
  osc.stop(startAt + dur + 0.02);
}

/** Colpo di campana da ring: parziali non armoniche che si spengono lentamente. */
function bell(t: number) {
  tone(1180, t, 1.4, 'sine', 0.45);
  tone(2950, t, 0.9, 'sine', 0.2);
  tone(4300, t, 0.5, 'sine', 0.08);
}

const VIBRATION: Record<BeepKind, number | number[]> = {
  tick: 60,
  end: [200, 100, 200, 100, 400],
  bell: 500,
  bells: [300, 150, 300, 150, 300],
  warn: [80, 80, 80],
};

/**
 * tick: ultimi secondi · end: fine timer · bell: inizio round ·
 * bells: fine round (tre colpi) · warn: 10 secondi alla fine (doppio colpo secco).
 */
export type BeepKind = 'tick' | 'end' | 'bell' | 'bells' | 'warn';

export function beep(kind: BeepKind) {
  const s = useSettingsStore();
  if (s.sound && ctx) {
    const t = ctx.currentTime;
    if (kind === 'tick') tone(880, t, 0.12);
    else if (kind === 'end') {
      tone(880, t, 0.15);
      tone(880, t + 0.22, 0.15);
      tone(1320, t + 0.44, 0.35);
    } else if (kind === 'bell') bell(t);
    else if (kind === 'bells') [0, 0.35, 0.7].forEach((d) => bell(t + d));
    else {
      tone(1600, t, 0.05, 'square', 0.25);
      tone(1600, t + 0.14, 0.05, 'square', 0.25);
    }
  }
  if (s.vibration && 'vibrate' in navigator) navigator.vibrate(VIBRATION[kind]);
}

export async function notify(title: string, body: string) {
  if (document.visibilityState === 'visible') return;
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  const reg = await navigator.serviceWorker?.getRegistration();
  if (reg) await reg.showNotification(title, { body, tag: 'gym-timer', silent: false });
  else new Notification(title, { body, tag: 'gym-timer' });
}

export async function askNotificationPermission() {
  if ('Notification' in window && Notification.permission === 'default') {
    await Notification.requestPermission();
  }
}
