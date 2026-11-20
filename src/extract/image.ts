import type { MediaType } from './types';
import { ExtractionError } from './types';

export const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

/** Identify the real image type from its first bytes (never trust the declared type). */
export function sniffMediaType(b: Buffer): MediaType | null {
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b.length > 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (b.length > 12 && b.subarray(0, 4).toString('latin1') === 'RIFF' && b.subarray(8, 12).toString('latin1') === 'WEBP') return 'image/webp';
  return null;
}

/** Accepts a data URL or bare base64. Returns validated bytes + the sniffed type. */
export function decodeImage(input: unknown): { bytes: Buffer; mediaType: MediaType } {
  if (typeof input !== 'string' || input.length === 0) throw new ExtractionError('bad_image');
  const m = /^data:[^;,]+;base64,(.*)$/s.exec(input);
  const b64 = (m ? m[1] : input).replace(/\s+/g, '');
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(b64) || b64.length % 4 === 1) throw new ExtractionError('bad_image');
  const bytes = Buffer.from(b64, 'base64');
  if (bytes.length === 0 || bytes.length > MAX_IMAGE_BYTES) throw new ExtractionError('bad_image');
  const mediaType = sniffMediaType(bytes);
  if (!mediaType) throw new ExtractionError('bad_image');
  return { bytes, mediaType };
}
