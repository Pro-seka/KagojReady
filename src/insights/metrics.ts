import type { Verdict } from '../types';
import type { ChatMode, Lang } from '../assistant/answer';

export type MetricEvent =
  | { type: 'chat'; topic: string; mode: ChatMode; lang: Lang; usedLlm: boolean; latencyMs: number; redacted: boolean }
  | { type: 'check'; service: string; verdict: Verdict; failedRules: string[]; latencyMs: number; issues: number }
  | { type: 'feedback'; kind: 'answer' | 'check'; helpful: boolean; topic: string }
  | { type: 'plain'; mode: 'ai_grounded' | 'extractive'; lang: Lang; usedLlm: boolean; level: 'plain' | 'moderate' | 'dense'; latencyMs: number }
  | { type: 'report'; action: 'created' | 'support' | 'similar_shown' | 'classified'; category: string; aiSuggested?: boolean; aiAccepted?: boolean }
  | { type: 'unmet'; service: string };

const bump = (m: Map<string, number>, k: string, n = 1) => m.set(k, (m.get(k) ?? 0) + n);
const pct = (xs: number[], p: number) => { if (!xs.length) return null; const s = [...xs].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };

/** Counters only: no questions, no text, no identifiers. Held in memory and reset on restart. */
export class Metrics {
  private c = new Map<string, number>(); private topics = new Map<string, number>(); private rules = new Map<string, number>();
  private verdicts = new Map<string, number>(); private langs = new Map<string, number>(); private modes = new Map<string, number>();
  private chatLat: number[] = []; private checkLat: number[] = [];
  private unmet = new Map<string, number>(); private plainLevels = new Map<string, number>(); private reportCats = new Map<string, number>();
  readonly since = new Date().toISOString(); demo = false;
  record(e: MetricEvent) {
    if (e.type === 'chat') { bump(this.c, 'questions'); bump(this.topics, e.topic); bump(this.langs, e.lang); bump(this.modes, e.mode); if (e.usedLlm) bump(this.c, 'llmAnswers'); if (e.redacted) bump(this.c, 'redactedQuestions'); this.chatLat.push(e.latencyMs); if (this.chatLat.length > 2000) this.chatLat.shift(); }
    else if (e.type === 'check') { bump(this.c, 'checks'); bump(this.verdicts, e.verdict); for (const r of e.failedRules) bump(this.rules, r); if (e.issues) bump(this.c, 'checksWithPhotoIssues'); this.checkLat.push(e.latencyMs); if (this.checkLat.length > 2000) this.checkLat.shift(); }
    else if (e.type === 'plain') { bump(this.c, 'plainRequests'); bump(this.plainLevels, e.level); if (e.mode === 'ai_grounded') bump(this.c, 'plainAiGrounded'); }
    else if (e.type === 'report') { if (e.action === 'created') { bump(this.c, 'reportsCreated'); bump(this.reportCats, e.category); if (e.aiSuggested) { bump(this.c, 'reportsWithAiSuggestion'); if (e.aiAccepted) bump(this.c, 'reportsAiAccepted'); } } else if (e.action === 'support') bump(this.c, 'reportSupports'); else if (e.action === 'similar_shown') bump(this.c, 'reportSimilarShown'); }
    else if (e.type === 'unmet') bump(this.unmet, e.service);
    else { bump(this.c, e.helpful ? 'helpful' : 'notHelpful'); bump(this.c, `fb:${e.kind}:${e.helpful ? 'up' : 'down'}`); }
  }
  /** Categories with fewer than `minCount` events are folded into "other" so a rare case cannot point to one person. */
  snapshot(minCount = 5) {
    const fold = (m: Map<string, number>) => { const out: Array<{ label: string; count: number }> = []; let other = 0;
      for (const [label, count] of [...m].sort((a, b) => b[1] - a[1])) count >= minCount ? out.push({ label, count }) : (other += count);
      if (other) out.push({ label: 'other (small counts hidden)', count: other }); return out; };
    const g = (k: string) => this.c.get(k) ?? 0; const q = g('questions'), up = g('helpful'), down = g('notHelpful');
    return {
      since: this.since, demo: this.demo, minCount,
      totals: { questions: q, checks: g('checks'), feedback: up + down, plainRequests: g('plainRequests'), reports: g('reportsCreated') },
      answerRate: q ? 1 - (this.modes.get('abstained') ?? 0) / q : null,
      groundedByAiRate: q ? g('llmAnswers') / q : null,
      satisfaction: up + down >= minCount ? up / (up + down) : null,
      questionsWithPersonalNumbersRemoved: g('redactedQuestions'),
      topics: fold(this.topics), languages: fold(this.langs), answerModes: fold(this.modes), topFailedRules: fold(this.rules).slice(0, 8), verdicts: fold(this.verdicts),
      unmetDemand: fold(this.unmet),
      plain: { requests: g('plainRequests'), aiGroundedRate: g('plainRequests') ? g('plainAiGrounded') / g('plainRequests') : null, levels: fold(this.plainLevels) },
      reports: { created: g('reportsCreated'), supports: g('reportSupports'), duplicatesPrevented: g('reportSimilarShown'), byCategory: fold(this.reportCats), aiSuggestionAcceptRate: g('reportsWithAiSuggestion') >= minCount ? g('reportsAiAccepted') / g('reportsWithAiSuggestion') : null },
      latencyMs: { chatP50: pct(this.chatLat, 0.5), chatP95: pct(this.chatLat, 0.95), checkP50: pct(this.checkLat, 0.5), checkP95: pct(this.checkLat, 0.95) },
    };
  }
}

/** Clearly flagged synthetic numbers so the dashboard can be shown before there is real usage. Never used in production. */
export function seedDemo(m: Metrics): void {
  m.demo = true; let s = 7; const rnd = () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  const topics = ['bd-passport-adult-renewal', 'bd-passport-adult-renewal', 'bd-passport-adult-renewal', 'bd-nid-correction', 'bd-nid-correction', 'general', 'none'];
  for (let i = 0; i < 240; i++) { const t = topics[Math.floor(rnd() * topics.length)];
    m.record({ type: 'chat', topic: t, mode: t === 'none' ? 'abstained' : rnd() < 0.7 ? 'grounded' : 'extractive', lang: rnd() < 0.62 ? 'bn' : 'en', usedLlm: t !== 'none' && rnd() < 0.7, latencyMs: 700 + Math.floor(rnd() * 1800), redacted: rnd() < 0.08 }); }
  const rules = ['RN-010', 'RN-011', 'RN-002', 'RN-012', 'RN-020'];
  for (let i = 0; i < 90; i++) { const v = rnd() < 0.45 ? 'NOT_READY' : rnd() < 0.5 ? 'ALMOST_READY' : 'READY';
    m.record({ type: 'check', service: 'bd-passport-adult-renewal', verdict: v, failedRules: v === 'READY' ? [] : [rules[Math.floor(rnd() * rules.length * rnd())]], latencyMs: 4000 + Math.floor(rnd() * 9000), issues: rnd() < 0.12 ? 1 : 0 }); }
  const unmet = ['driving-licence', 'driving-licence', 'driving-licence', 'trade-licence', 'trade-licence', 'tax', 'land', 'newborn-birth-registration', 'visa'];
  for (let i = 0; i < 60; i++) m.record({ type: 'unmet', service: unmet[Math.floor(rnd() * unmet.length)] });
  for (let i = 0; i < 40; i++) m.record({ type: 'plain', mode: rnd() < 0.6 ? 'ai_grounded' : 'extractive', lang: rnd() < 0.6 ? 'bn' : 'en', usedLlm: true, level: rnd() < 0.15 ? 'plain' : rnd() < 0.5 ? 'moderate' : 'dense', latencyMs: 1500 });
  const cats = ['road_damage', 'road_damage', 'garbage', 'garbage', 'drain_waterlogging', 'streetlight', 'open_manhole'];
  for (let i = 0; i < 55; i++) { const c = cats[Math.floor(rnd() * cats.length)]; m.record({ type: 'report', action: 'created', category: c, aiSuggested: rnd() < 0.7, aiAccepted: rnd() < 0.8 }); }
  for (let i = 0; i < 18; i++) m.record({ type: 'report', action: 'support', category: 'road_damage' });
  for (let i = 0; i < 12; i++) m.record({ type: 'report', action: 'similar_shown', category: 'road_damage' });
  for (let i = 0; i < 150; i++) m.record({ type: 'feedback', kind: rnd() < 0.7 ? 'answer' : 'check', helpful: rnd() < 0.86, topic: 'general' });
}
