// Scarica free-exercise-db (Unlicense) e genera:
//   src/seed/library.json        → metadati degli esercizi (filtrati)
//   public/exercises/<id>/N.webp → immagini ridimensionate
//
// Uso: node scripts/build-library.mjs [--skip-images]
import { mkdir, writeFile, access } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main';
const SKIP_IMAGES = process.argv.includes('--skip-images');

// Categorie fuori tema per l'uso in palestra (stretching, sollevamento olimpico, strongman).
const EXCLUDED_CATEGORIES = new Set(['stretching', 'olympic weightlifting', 'strongman']);
const EXCLUDED_EQUIPMENT = new Set(['foam roll']);
// Esercizi usati nelle schede che altrimenti verrebbero esclusi dai filtri.
const ALWAYS_INCLUDE = new Set(['Superman']);

export const slug = (id) =>
  id
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function convertImage(srcPath, outPath) {
  if (await exists(outPath)) return;
  const res = await fetch(`${SRC}/exercises/${srcPath}`);
  if (!res.ok) throw new Error(`${res.status} ${srcPath}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await mkdir(dirname(outPath), { recursive: true });
  await sharp(buf)
    .resize({ width: 480, withoutEnlargement: true })
    .webp({ quality: 70 })
    .toFile(outPath);
}

async function pool(items, size, fn) {
  let i = 0;
  let done = 0;
  const workers = Array.from({ length: size }, async () => {
    while (i < items.length) {
      const item = items[i++];
      try {
        await fn(item);
      } catch (e) {
        console.warn('  ! ', e.message);
      }
      if (++done % 100 === 0) console.log(`  ${done}/${items.length}`);
    }
  });
  await Promise.all(workers);
}

const all = await (await fetch(`${SRC}/dist/exercises.json`)).json();
const kept = all.filter(
  (e) =>
    ALWAYS_INCLUDE.has(e.id) ||
    (!EXCLUDED_CATEGORIES.has(e.category) && !EXCLUDED_EQUIPMENT.has(e.equipment)),
);

const library = kept.map((e) => ({
  id: slug(e.id),
  name: e.name,
  category: e.category,
  equipment: e.equipment ?? 'body only',
  level: e.level,
  primaryMuscles: e.primaryMuscles,
  secondaryMuscles: e.secondaryMuscles,
  instructions: e.instructions,
  images: e.images.map((_, i) => `exercises/${slug(e.id)}/${i}.webp`),
}));

await writeFile(join(ROOT, 'src/seed/library.json'), JSON.stringify(library));
console.log(`library.json: ${library.length} esercizi su ${all.length}`);

if (!SKIP_IMAGES) {
  const jobs = kept.flatMap((e) =>
    e.images.map((img, i) => ({
      img,
      out: join(ROOT, 'public/exercises', slug(e.id), `${i}.webp`),
    })),
  );
  console.log(`immagini: ${jobs.length}`);
  await pool(jobs, 16, (j) => convertImage(j.img, j.out));
}
