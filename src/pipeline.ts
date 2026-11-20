import type { Pack } from './pack/schema';
import type { Report, Submission } from './types';
import type { LlmClient } from './extract/types';
import { extractDocument, type ExtractionResult } from './extract/extractor';
import { buildReport } from './report/verdict';

export interface CheckInput { pack: Pack; applicantType: string; images: Record<string, unknown>; llm: LlmClient; today: string }
export interface CheckOutput { report: Report; docs: Submission['docs']; issues: Record<string, NonNullable<ExtractionResult['issue']>> }

/** images -> extraction -> rules -> report. Stateless: nothing is written anywhere. */
export async function runCheck(i: CheckInput): Promise<CheckOutput> {
  const entries = await Promise.all(i.pack.documents.map(async (d) => {
    const raw = i.images[d.id];
    if (raw === undefined || raw === null || raw === '') return [d.id, { doc: undefined } as ExtractionResult] as const;
    return [d.id, await extractDocument(i.llm, d, raw)] as const;
  }));
  const sub: Submission = { applicantType: i.applicantType, docs: {} };
  const issues: CheckOutput['issues'] = {};
  for (const [id, r] of entries) {
    sub.docs[id] = r.doc;
    if (r.issue) issues[id] = r.issue;
  }
  return { report: buildReport(i.pack, sub, { today: i.today }), docs: sub.docs, issues };
}
