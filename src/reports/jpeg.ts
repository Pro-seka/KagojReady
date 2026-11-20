/** True when the bytes begin like a JPEG image. */
export const isJpeg = (b: Buffer) => b.length > 4 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;

/**
 * Removes every metadata segment (EXIF with GPS, XMP, comments, vendor blocks) from a JPEG and keeps only what is needed to draw it.
 * The browser already re-encodes photos, so this is a second line of defence: a client that skips that step still cannot leave a location in a stored photo.
 * Returns null when the data is not a well-formed JPEG.
 */
export function stripJpegMetadata(b: Buffer): Buffer | null {
  if (!isJpeg(b)) return null;
  const out: Buffer[] = [b.subarray(0, 2)]; let i = 2;
  while (i < b.length) {
    if (b[i] !== 0xff) return null;
    let marker = b[i + 1]; while (marker === 0xff) { i++; marker = b[i + 1]; }   // fill bytes
    if (marker === 0xd9) { out.push(b.subarray(i, i + 2)); return Buffer.concat(out); }
    if (marker === 0xda) { out.push(b.subarray(i)); return Buffer.concat(out); }   // start of scan: the rest is image data, copy as is
    if ((marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) { out.push(b.subarray(i, i + 2)); i += 2; continue; }
    if (i + 3 >= b.length) return null;
    const len = b.readUInt16BE(i + 2); if (len < 2 || i + 2 + len > b.length) return null;
    const keep = !((marker >= 0xe1 && marker <= 0xef) || marker === 0xfe);   // drop APP1..APP15 and COM, keep APP0 (JFIF) and all structure
    if (keep) out.push(b.subarray(i, i + 2 + len));
    i += 2 + len;
  }
  return null;
}
export const hasMetadata = (b: Buffer): boolean => { const s = stripJpegMetadata(b); return !!s && s.length !== b.length; };
