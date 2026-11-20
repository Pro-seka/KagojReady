export type Severity = 'blocker' | 'warning' | 'info';
export type RuleStatus = 'official' | 'operator_reported' | 'unconfirmed';
export type Outcome = 'PASS' | 'FAIL' | 'UNSURE';
export type MatchLevel = 'exact' | 'equivalent' | 'close' | 'different';
export type Verdict = 'READY' | 'ALMOST_READY' | 'NOT_READY';

/** One field as returned by the extraction step (vision LLM). */
export interface ExtractedField {
  value: string | null;       // as printed on the document
  romanized?: string | null;  // Latin form, for names printed in Bangla
  confidence: number;         // 0..1
  legible: boolean;           // false = could not be read at all
}
export type ExtractedDoc = Record<string, ExtractedField | undefined>;

/** Everything the rules engine needs. A missing docId means "not uploaded". */
export interface Submission {
  applicantType: string;
  docs: Record<string, ExtractedDoc | undefined>;
}

export interface RuleResult {
  ruleId: string;
  type: string;
  docs: string[];            // documents this rule looks at
  outcome: Outcome;
  reason: string;             // machine-readable, e.g. 'mismatch', 'document_missing'
  severity: Severity;
  ruleStatus: RuleStatus;
  message_en: string;
  message_bn: string;
  fix_en: string[];
  fix_bn: string[];
  fixService?: string;
  source: { label: string; url: string; retrieved: string } | null;
  /** Contains personal data. Never log this. Use toLogSafe(). */
  evidence: Record<string, unknown>;
}

export interface Report {
  packId: string;
  packVersion: string;
  packStatus: 'DRAFT_UNVERIFIED' | 'VERIFIED';
  stale: boolean;
  verdict: Verdict;
  results: RuleResult[];      // sorted: blockers first, then warnings, unsure, pass
  disclaimer_en: string;
  disclaimer_bn: string;
}
