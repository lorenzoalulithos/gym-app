// Genera tutte le icone dell'app (PWA, Apple, favicon) dal disegno SVG qui sotto.
// Uso: node scripts/build-icons.mjs
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ICONS = join(ROOT, 'public/icons');
const LIME = '#c6ff3d';
const BG = '#0b0c0f';

// Manubrio dentro un cronometro (il timer di recupero) (spazio 512×512, centro 256,256).
const mark = (color) => `
  <circle cx="256" cy="256" r="178" fill="none" stroke="${color}" stroke-width="34"
          stroke-linecap="round" stroke-dasharray="930 1200" transform="rotate(-60 256 256)"/>
  <rect x="226" y="46" width="60" height="34" rx="12" fill="${color}"/>
  <rect x="190" y="243" width="132" height="26" rx="13" fill="${color}"/>
  <rect x="150" y="181" width="44" height="150" rx="18" fill="${color}"/>
  <rect x="318" y="181" width="44" height="150" rx="18" fill="${color}"/>
  <rect x="118" y="211" width="34" height="90" rx="14" fill="${color}"/>
  <rect x="360" y="211" width="34" height="90" rx="14" fill="${color}"/>`;

const svg = ({ rounded = true, scale = 1, color = LIME, bg = BG } = {}) => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <radialGradient id="g" cx="50%" cy="38%" r="70%">
      <stop offset="0" stop-color="#1b2112"/><stop offset="1" stop-color="${bg}"/>
    </radialGradient>
  </defs>
  ${bg === 'none' ? '' : `<rect width="512" height="512" rx="${rounded ? 112 : 0}" fill="url(#g)"/>`}
  <g transform="translate(256 256) scale(${scale}) translate(-256 -256)">${mark(color)}</g>
</svg>`;

const png = (s, size, out) =>
  sharp(Buffer.from(s)).resize(size, size).png({ compressionLevel: 9 }).toFile(join(ICONS, out));

/** ICO con dentro i PNG (formato accettato da tutti i browser moderni). */
async function ico(sizes, out) {
  const images = await Promise.all(
    sizes.map((s) =>
      sharp(Buffer.from(svg({ rounded: true })))
        .resize(s, s)
        .png()
        .toBuffer(),
    ),
  );
  const header = Buffer.alloc(6 + 16 * images.length);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  let offset = header.length;
  images.forEach((img, i) => {
    const e = 6 + 16 * i;
    header.writeUInt8(sizes[i] >= 256 ? 0 : sizes[i], e);
    header.writeUInt8(sizes[i] >= 256 ? 0 : sizes[i], e + 1);
    header.writeUInt16LE(1, e + 4);
    header.writeUInt16LE(32, e + 6);
    header.writeUInt32LE(img.length, e + 8);
    header.writeUInt32LE(offset, e + 12);
    offset += img.length;
  });
  await writeFile(out, Buffer.concat([header, ...images]));
}

await mkdir(ICONS, { recursive: true });
const base = svg();
await writeFile(join(ROOT, 'branding/logo.svg'), base.trim());
for (const s of [128, 192, 256, 384, 512]) await png(base, s, `icon-${s}x${s}.png`);
// maskable: sfondo pieno e simbolo dentro la zona sicura (80%)
await png(svg({ rounded: false, scale: 0.78 }), 512, 'icon-maskable-512x512.png');
// monocromatica: solo la sagoma, il sistema la colora
await png(svg({ bg: 'none', color: '#ffffff' }), 512, 'icon-monochrome-512x512.png');
// Apple: niente trasparenza, gli angoli li arrotonda iOS
for (const s of [120, 152, 167, 180])
  await png(svg({ rounded: false }), s, `apple-icon-${s}x${s}.png`);
for (const s of [16, 32, 96, 128]) await png(base, s, `favicon-${s}x${s}.png`);
await writeFile(join(ICONS, 'safari-pinned-tab.svg'), svg({ bg: 'none', color: '#000000' }).trim());
await ico([16, 32, 48], join(ROOT, 'public/favicon.ico'));
console.log('icone generate');
