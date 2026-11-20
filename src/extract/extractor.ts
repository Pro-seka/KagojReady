import { z } from 'zod';
import type { ExtractedDoc } from '../types';
import type { LlmClient } from './types';
import { ExtractionError } from './types';
import { decodeImage } from './image';
import { buildUserText, SYSTEM_PROMPT } from './prompt';

const FieldOut = z.object({
  value: z.string().nullable().optional(),
  romanized: z.string().nullable().optional(),
  confidence: z.number().optional(),
  legible: z.boolean().optional(),
});
const Out = z.object({ is_expected_document: z.boolean().optional(), fields: z.record(z.string(), FieldOut) });

const MAX_LEN = 200;
const clean = (s: string | null | undefined) => (s == null ? null : s.normalize('NFC').replace(/\s+/g, ' ').trim().slice(0, MAX_LEN) || null);

/** Pull the first JSON object out of a model reply, tolerating code fences or stray prose. */
export function extractJson(text: string): unknown {
  const t = text.replace(/```(?:json)?/gi, '').trim();
  const start = t.indexOf('{'), end = t.lastIndexOf('}');
  if (start < 0 || end <= start) throw new ExtractionError('invalid_output');
  try { return JSON.parse(t.slice(start, end + 1)); } catch { throw new ExtractionError('invalid_output'); }
}

/** Validate and sanitize a model reply. Only requested fields are kept (data minimization). */
export function parseExtraction(text: string, wanted: string[]): { doc: ExtractedDoc; isExpected: boolean } {
  const parsed = Out.safeParse(extractJson(text));
  if (!parsed.success) throw new ExtractionError('invalid_output');
  const doc: ExtractedDoc = {};
  for (const name of wanted) {
    const f = parsed.data.fields[name];
    if (!f) continue;                                    // missing -> engine treats as not_extracted -> UNSURE
    const value = clean(f.value);
    const legible = f.legible !== false;
    const confidence = Math.min(1, Math.max(0, Number.isFinite(f.confidence) ? (f.confidence as number) : 0));
    doc[name] = { value, romanized: clean(f.romanized), confidence, legible: legible && !(value === null && confidence < 0.5) };
  }
  return { doc, isExpected: parsed.data.is_expected_document !== false };
}

export interface DocDef { id: string; name_en: string; fields: string[] }
export interface ExtractionResult { doc: ExtractedDoc | undefined; issue?: 'wrong_document' | 'invalid_output' | 'service_error' | 'bad_image'; detail?: string }

export async function extractDocument(llm: LlmClient, def: DocDef, imageInput: unknown): Promise<ExtractionResult> {
  let img;
  try { img = decodeImage(imageInput); } catch { return { doc: undefined, issue: 'bad_image' }; }
  const req = {
    system: SYSTEM_PROMPT, userText: buildUserText(def.name_en, def.fields),
    image: { base64: img.bytes.toString('base64'), mediaType: img.mediaType }, maxTokens: 1000, expectJson: true,
  };
  for (let attempt = 0; attempt < 2; attempt++) {          // one retry on malformed output
    try {
      const { doc, isExpected } = parseExtraction(await llm.complete(req), def.fields);
      if (!isExpected) return { doc: undefined, issue: 'wrong_document' };
      return { doc };
    } catch (e) {
      if (e instanceof ExtractionError && e.code === 'invalid_output' && attempt === 0) continue;
      const code = e instanceof ExtractionError ? e.code : 'service_error';
      return { doc: undefined, issue: code, detail: e instanceof ExtractionError ? `${e.message}${e.detail ? ': ' + e.detail : ''}` : 'unexpected error' };
    }
  }
  return { doc: undefined, issue: 'invalid_output' };
}
