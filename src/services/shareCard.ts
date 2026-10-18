// Immagine di riepilogo dell'allenamento (1080×1350, formato post verticale), disegnata su canvas.

export interface ShareCardData {
  title: string;
  /** es. "sabato 24 ottobre" */
  dateLabel: string;
  minutes: number | undefined;
  sets: number;
  volumeKg: number;
  records: number;
  deload: boolean;
  highlights: { name: string; detail: string; deltaPct: number | null }[];
}

const W = 1080;
const H = 1350;
const PAD = 72;
const LIME = '#c6ff3d';
const BG = '#0b0c0f';
const CARD = '#16181d';
const MUTED = 'rgba(255,255,255,0.55)';
const RED = '#ff5252';
const FONT = 'Roboto, system-ui, sans-serif';

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/** Tronca il testo con "…" per stare nella larghezza data. */
function fit(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(`${t}…`).width > maxWidth) t = t.slice(0, -1);
  return `${t.trimEnd()}…`;
}

/** Va a capo su più righe (al massimo `maxLines`). */
function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number) {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (ctx.measureText(next).width <= maxWidth) line = next;
    else {
      lines.push(line);
      line = w;
    }
  }
  if (line) lines.push(line);
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    kept[maxLines - 1] = fit(ctx, lines.slice(maxLines - 1).join(' '), maxWidth);
    return kept;
  }
  return lines;
}

const fmtNum = (n: number) => n.toLocaleString('it-IT', { maximumFractionDigits: 1 });
const fmtVolume = (kg: number) =>
  kg >= 1000
    ? { value: fmtNum(kg / 1000), unit: 't' }
    : { value: String(Math.round(kg)), unit: 'kg' };

export async function renderShareCard(d: ShareCardData): Promise<Blob> {
  await document.fonts?.ready;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  // sfondo con un alone lime in alto
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(W * 0.2, 0, 0, W * 0.2, 0, W * 0.9);
  glow.addColorStop(0, 'rgba(198,255,61,0.16)');
  glow.addColorStop(1, 'rgba(198,255,61,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  // intestazione: logo + data
  const logo = await loadImage(`${import.meta.env.BASE_URL ?? '/'}icons/icon-192x192.png`);
  if (logo) ctx.drawImage(logo, PAD, PAD, 88, 88);
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#fff';
  ctx.font = `900 44px ${FONT}`;
  ctx.fillText('GYM', PAD + 108, PAD + 44);
  ctx.textAlign = 'right';
  ctx.fillStyle = MUTED;
  ctx.font = `500 32px ${FONT}`;
  ctx.fillText(d.dateLabel, W - PAD, PAD + 44);
  ctx.textAlign = 'left';

  // titolo
  let y = PAD + 88 + 70;
  ctx.textBaseline = 'alphabetic';
  if (d.deload) {
    ctx.fillStyle = '#4fc3f7';
    ctx.font = `700 30px ${FONT}`;
    ctx.fillText('SETTIMANA DI SCARICO', PAD, y);
    y += 56;
  } else {
    ctx.fillStyle = LIME;
    ctx.font = `700 30px ${FONT}`;
    ctx.fillText('ALLENAMENTO COMPLETATO', PAD, y);
    y += 56;
  }
  ctx.fillStyle = '#fff';
  ctx.font = `900 76px ${FONT}`;
  for (const line of wrap(ctx, d.title, W - PAD * 2, 2)) {
    y += 8;
    ctx.fillText(line, PAD, y + 56);
    y += 84;
  }
  y += 30;

  // quattro numeri
  const vol = fmtVolume(d.volumeKg);
  const tiles = [
    { value: d.minutes !== undefined ? String(d.minutes) : '–', unit: 'min', label: 'durata' },
    { value: String(d.sets), unit: '', label: 'serie' },
    { value: vol.value, unit: vol.unit, label: 'volume' },
    { value: String(d.records), unit: '', label: 'record', accent: d.records > 0 },
  ];
  const gap = 24;
  const tw = (W - PAD * 2 - gap) / 2;
  const th = 170;
  tiles.forEach((t, i) => {
    const x = PAD + (i % 2) * (tw + gap);
    const ty = y + Math.floor(i / 2) * (th + gap);
    ctx.fillStyle = CARD;
    ctx.beginPath();
    ctx.roundRect(x, ty, tw, th, 28);
    ctx.fill();
    ctx.fillStyle = t.accent ? '#ffb74d' : '#fff';
    ctx.font = `900 80px ${FONT}`;
    ctx.fillText(t.value, x + 32, ty + 96);
    const vw = ctx.measureText(t.value).width;
    if (t.unit) {
      ctx.fillStyle = MUTED;
      ctx.font = `600 34px ${FONT}`;
      ctx.fillText(t.unit, x + 32 + vw + 10, ty + 96);
    }
    ctx.fillStyle = MUTED;
    ctx.font = `500 30px ${FONT}`;
    ctx.fillText(t.label, x + 32, ty + 142);
  });
  y += th * 2 + gap + 64;

  // dove hai spinto di più
  const rows = d.highlights.slice(0, 3);
  if (rows.length) {
    ctx.fillStyle = MUTED;
    ctx.font = `700 28px ${FONT}`;
    ctx.fillText("RISPETTO ALL'ULTIMA VOLTA", PAD, y);
    y += 28;
    for (const r of rows) {
      y += 26;
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      ctx.fillRect(PAD, y, W - PAD * 2, 2);
      y += 56;
      const delta =
        r.deltaPct === null ? 'nuovo' : `${r.deltaPct > 0 ? '+' : ''}${fmtNum(r.deltaPct)}%`;
      ctx.font = `900 46px ${FONT}`;
      const dw = ctx.measureText(delta).width;
      ctx.fillStyle =
        r.deltaPct === null ? MUTED : r.deltaPct > 2 ? LIME : r.deltaPct < -2 ? RED : MUTED;
      ctx.textAlign = 'right';
      ctx.fillText(delta, W - PAD, y + 12);
      ctx.textAlign = 'left';
      ctx.fillStyle = '#fff';
      ctx.font = `700 40px ${FONT}`;
      ctx.fillText(fit(ctx, r.name, W - PAD * 2 - dw - 32), PAD, y);
      ctx.fillStyle = MUTED;
      ctx.font = `500 30px ${FONT}`;
      ctx.fillText(fit(ctx, r.detail, W - PAD * 2 - dw - 32), PAD, y + 42);
      y += 46;
    }
  }

  // piede
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.font = `500 26px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.fillText('Fatto con Gym', W / 2, H - PAD + 10);

  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Immagine non creata'))), 'image/png'),
  );
}
