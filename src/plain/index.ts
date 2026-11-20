import type { LlmClient } from '../extract/types';
import { redactPii, type Redaction } from '../privacy/redact';
import { analyze, MAX_CHARS, type Analysis, type Lang } from './analyze';
import { groundedRewrite, type PlainPoint } from './grounded';
import type { GlossEntry } from './glossary';

export interface PlainResult {
  analysis: Analysis; points: PlainPoint[]; mode: 'ai_grounded' | 'extractive'; usedLlm: boolean;
  steps: string[]; redactions: Redaction[]; truncated: boolean; droppedPoints: number;
}

/**
 * Plain-language lane. Always returns the deterministic analysis (glossary, facts, readability, extractive summary).
 * When a model is available it adds a rewrite in which every point cites its source sentence and has passed the number check.
 */
export async function plainLanguage(input: { text: string; lang?: Lang; glossary: GlossEntry[]; llm: LlmClient | null }): Promise<PlainResult> {
  const truncated = input.text.length > MAX_CHARS;
  const { text, redactions } = redactPii(input.text.slice(0, MAX_CHARS));
  const analysis = analyze(text, input.glossary, input.lang);
  const steps = redactions.map((r) => `redacted:${r.type}`); steps.push(`sentences:${analysis.sentences.length}`);
  const fallback = (why: string, usedLlm = false): PlainResult => ({ analysis, mode: 'extractive', usedLlm, steps: [...steps, why], redactions, truncated, droppedPoints: 0,
    points: analysis.summary.map((i) => ({ text: analysis.sentences[i], sentence: i })) });
  if (!input.llm) return fallback('no_llm');
  const r = await groundedRewrite(input.llm, analysis.sentences, input.lang ?? analysis.lang);
  if (!r.ok) return fallback(`rejected:${r.reason}`, true);
  return { analysis, mode: 'ai_grounded', usedLlm: true, points: r.points, droppedPoints: r.dropped, steps: [...steps, 'llm', 'validated'], redactions, truncated };
}
