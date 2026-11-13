// Upload seguro de imagens: valida bytes mágicos + decodificação e regrava em WebP sem metadados.
import { randomBytes } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import multer from 'multer';
import sharp from 'sharp';
import { HttpError } from './security.ts';

export const MAX_IMAGES = 8;
export const MAX_IMAGE_BYTES = 6 * 1024 * 1024;
const MAX_PIXELS = 50_000_000;

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_BYTES, files: MAX_IMAGES, fields: 10, parts: MAX_IMAGES + 10 },
}).array('images', MAX_IMAGES);

type Kind = 'jpeg' | 'png' | 'webp';

/** Identifica o formato pelos primeiros bytes (ignora nome e Content-Type informados). */
export function sniffImage(buf: Buffer): Kind | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpeg';
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (buf.toString('latin1', 0, 4) === 'RIFF' && buf.toString('latin1', 8, 12) === 'WEBP') return 'webp';
  return null;
}

const INVALID = 'Envie apenas fotos em JPEG, PNG ou WebP.';

export interface StoredImage {
  file: string;
  thumbFile: string;
}

/**
 * Decodifica e regrava a imagem. `.rotate()` aplica a orientação EXIF antes de
 * descartar todos os metadados (EXIF/GPS/ICC) — o sharp não os preserva por padrão.
 */
export async function processImage(buf: Buffer, uploadsDir: string): Promise<StoredImage> {
  const kind = sniffImage(buf);
  if (!kind) throw new HttpError(400, INVALID);
  let full: Buffer;
  let thumb: Buffer;
  try {
    const meta = await sharp(buf, { limitInputPixels: MAX_PIXELS, failOn: 'error' }).metadata();
    if (meta.format !== kind || !meta.width || !meta.height) throw new Error('formato divergente');
    const base = () => sharp(buf, { limitInputPixels: MAX_PIXELS, failOn: 'error' }).rotate();
    full = await base().resize({ width: 1280, withoutEnlargement: true }).webp({ quality: 80 }).toBuffer();
    thumb = await base().resize({ width: 640, withoutEnlargement: true }).webp({ quality: 74 }).toBuffer();
  } catch {
    throw new HttpError(400, 'Não foi possível ler uma das imagens. ' + INVALID);
  }
  const name = randomBytes(16).toString('hex');
  const stored = { file: `${name}.webp`, thumbFile: `${name}-640.webp` };
  await fs.writeFile(path.join(uploadsDir, stored.file), full, { mode: 0o644, flag: 'wx' });
  await fs.writeFile(path.join(uploadsDir, stored.thumbFile), thumb, { mode: 0o644, flag: 'wx' });
  return stored;
}
