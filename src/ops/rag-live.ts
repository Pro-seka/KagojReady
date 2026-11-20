import type { LlmClient } from '../extract/types';
import type { Retriever } from '../kb/load';
import { answerQuestion, hasBangla, type ChatMode } from '../assistant/answer';

export interface RagLiveInput { llm: LlmClient; retriever: Retriever; services: Array<{ id: string }>; inScope: string[]; outOfScope: string[] }
export interface RagLiveResult {
  inScope: number; outOfScope: number; outOfScopeAnswered: number; inScopeRefused: number;
  modes: Record<ChatMode, number>; rejected: Record<string, number>; groundedRate: number; llmFailures: number; questionsWithNumbersHidden: number;
}

/** Runs real questions through the whole answering step and reports how often the model's answer passed the checks. */
export async function runRagLive(i: RagLiveInput): Promise<RagLiveResult> {
  const modes: Record<ChatMode, number> = { grounded: 0, extractive: 0, abstained: 0, action: 0 }; const rejected: Record<string, number> = {};
  let llmFailures = 0, outAnswered = 0, refused = 0, redacted = 0;
  for (const q of i.inScope) {
    const r = await answerQuestion({ question: q, uiLang: hasBangla(q) ? 'bn' : 'en', retriever: i.retriever, llm: i.llm, services: i.services });
    modes[r.mode]++; if (r.mode === 'abstained') refused++; if (r.redactions.length) redacted++;
    for (const s of r.steps) { if (s.startsWith('rejected:')) rejected[s.slice(9)] = (rejected[s.slice(9)] ?? 0) + 1; if (s === 'llm_failed') llmFailures++; }
  }
  for (const q of i.outOfScope) { const r = await answerQuestion({ question: q, uiLang: hasBangla(q) ? 'bn' : 'en', retriever: i.retriever, llm: i.llm, services: i.services }); if (r.mode !== 'abstained') outAnswered++; }
  const answered = modes.grounded + modes.extractive;
  return { inScope: i.inScope.length, outOfScope: i.outOfScope.length, outOfScopeAnswered: outAnswered, inScopeRefused: refused, modes, rejected, groundedRate: answered ? modes.grounded / answered : 0, llmFailures, questionsWithNumbersHidden: redacted };
}
