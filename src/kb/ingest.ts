import type { Card, CardStatus, Source } from './types';

const hasBangla = (s: string) => (s.match(/[\u0980-\u09FF]/g) ?? []).length > s.length * 0.3;
export const slug = (s: string) => s.toLowerCase().replace(/\.[a-z0-9]+$/, '').replace(/[^a-z0-9\u0980-\u09FF]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'doc';

/** Splits a long document into overlapping passages of about `words` words, breaking at paragraph edges where it can. */
export function chunkText(text: string, o: { words?: number; overlap?: number } = {}): string[] {
  const size = o.words ?? 120, overlap = o.overlap ?? 20;
  const words = text.replace(/\r/g, '').split(/\s+/).filter(Boolean);
  const out: string[] = [];
  for (let i = 0; i < words.length; i += Math.max(1, size - overlap)) { out.push(words.slice(i, i + size).join(' ')); if (i + size >= words.length) break; }
  return out;
}

export function cardsFromDocument(name: string, text: string, o: { source: Source; status?: CardStatus; service?: string | null; words?: number }): Card[] {
  const title = (/^#\s+(.+)$/m.exec(text)?.[1] ?? name).trim();
  return chunkText(text.replace(/^#\s+.+$/m, ''), { words: o.words }).map((chunk, n) => {
    const bangla = hasBangla(chunk);
    return {
      id: `${slug(name)}-${n + 1}`, service: o.service ?? null, kind: 'ingested' as const,
      title_en: bangla ? '' : `${title} (part ${n + 1})`, title_bn: bangla ? `${title} (অংশ ${n + 1})` : '',
      text_en: bangla ? '' : chunk, text_bn: bangla ? chunk : '', source: o.source, status: o.status ?? 'unconfirmed', tags: [],
    };
  });
}
