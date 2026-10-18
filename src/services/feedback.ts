// Segnali di fine timer: suono, vibrazione e, a schermo bloccato, notifica.
import { useSettingsStore } from '@/stores/settings';

let ctx: AudioContext | undefined;

/** Va chiamata da un gesto dell'utente (tap) perché Android permetta l'audio. */
export function unlockAudio() {
  ctx ??= new AudioContext();
  if (ctx.state === 'suspended') void ctx.resume();
}

function tone(freq: number, startAt: number, dur: number) {
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.frequency.value = freq;
  osc.type = 'sine';
  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.exponentialRampToValueAtTime(0.5, startAt + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + dur);
  osc.connect(gain).connect(ctx.destination);
  osc.start(startAt);
  osc.stop(startAt + dur + 0.02);
}

export function beep(kind: 'tick' | 'end') {
  const s = useSettingsStore();
  if (s.sound && ctx) {
    const t = ctx.currentTime;
    if (kind === 'tick') tone(880, t, 0.12);
    else {
      tone(880, t, 0.15);
      tone(880, t + 0.22, 0.15);
      tone(1320, t + 0.44, 0.35);
    }
  }
  if (s.vibration && 'vibrate' in navigator) {
    navigator.vibrate(kind === 'tick' ? 60 : [200, 100, 200, 100, 400]);
  }
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
