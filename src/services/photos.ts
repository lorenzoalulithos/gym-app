import { db } from '@/db';
import type { Pose } from '@/db/types';

/** Ridimensiona a max 1600px e comprime in JPEG: una foto del telefono passa da ~4MB a ~300KB. */
export async function compressImage(file: Blob, maxSide = 1600, quality = 0.85): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Compressione fallita'))),
      'image/jpeg',
      quality,
    ),
  );
}

/** Una foto per posa per mese: una nuova sostituisce la precedente. */
export async function savePhoto(month: string, pose: Pose, file: File) {
  const blob = await compressImage(file);
  await db.photos.put({ id: `${month}-${pose}`, month, pose, takenAt: Date.now(), blob });
}
