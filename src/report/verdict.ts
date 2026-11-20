import type { Pack } from '../pack/schema';
import type { Report, RuleResult, Submission, Verdict } from '../types';
import { evaluateRules, type EvalOptions } from '../rules/engine';

/** info-level rules are shown but never change the verdict. An UNSURE can never produce READY. */
export function computeVerdict(results: RuleResult[]): Verdict {
  const counting = results.filter((r) => r.severity !== 'info');
  if (counting.some((r) => r.outcome === 'FAIL' && r.severity === 'blocker')) return 'NOT_READY';
  if (counting.some((r) => r.outcome !== 'PASS')) return 'ALMOST_READY';
  return 'READY';
}

const rank = (r: RuleResult) => {
  if (r.outcome === 'FAIL') return r.severity === 'blocker' ? 0 : 1;
  if (r.outcome === 'UNSURE') return 2;
  return 3;
};

export function buildReport(pack: Pack, sub: Submission, opts: EvalOptions): Report {
  const results = evaluateRules(pack, sub, opts).sort((a, b) => rank(a) - rank(b));
  return {
    packId: pack.pack_id,
    packVersion: pack.version,
    packStatus: pack.status,
    stale: pack.review_by !== null && pack.review_by < opts.today,
    verdict: computeVerdict(results),
    results,
    disclaimer_en: 'This is a pre-check, not an official approval. The office makes the final decision.',
    disclaimer_bn: 'এটি একটি প্রাথমিক যাচাই, সরকারি অনুমোদন নয়। চূড়ান্ত সিদ্ধান্ত অফিস নেবে।',
  };
}

/** The only shape of a result that may be written to logs. No evidence, no values. */
export function toLogSafe(r: RuleResult) {
  return { ruleId: r.ruleId, outcome: r.outcome, reason: r.reason, severity: r.severity };
}
