import { describe, expect, it } from 'vitest';
import { Metrics, seedDemo } from '../src/insights/metrics';

const chat = (o: object = {}) => ({ type: 'chat' as const, topic: 'bd-passport-adult-renewal', mode: 'grounded' as const, lang: 'bn' as const, usedLlm: true, latencyMs: 800, redacted: false, ...o });

describe('insights metrics', () => {
  it('counts questions, abstentions, languages and satisfaction', () => {
    const m = new Metrics();
    for (let i = 0; i < 8; i++) m.record(chat()); for (let i = 0; i < 2; i++) m.record(chat({ mode: 'abstained', topic: 'none', usedLlm: false, lang: 'en' }));
    for (let i = 0; i < 6; i++) m.record({ type: 'feedback', kind: 'answer', helpful: i < 5, topic: 'general' });
    const s = m.snapshot();
    expect(s.totals).toMatchObject({ questions: 10, feedback: 6 }); expect(s.answerRate).toBeCloseTo(0.8); expect(s.satisfaction).toBeCloseTo(5 / 6);
    expect(s.languages.find((x) => x.label === 'bn')!.count).toBe(8); expect(s.latencyMs.chatP50).toBe(800);
  });
  it('hides small categories so one rare case cannot point at a person, and withholds satisfaction on tiny samples', () => {
    const m = new Metrics();
    for (let i = 0; i < 7; i++) m.record(chat()); m.record(chat({ topic: 'bd-nid-correction' })); m.record(chat({ topic: 'rare-topic' }));
    m.record({ type: 'feedback', kind: 'answer', helpful: true, topic: 'general' });
    const s = m.snapshot();
    expect(s.topics.map((t) => t.label)).toEqual(['bd-passport-adult-renewal', 'other (small counts hidden)']); expect(s.topics[1].count).toBe(2);
    expect(s.satisfaction).toBeNull();
  });
  it('tracks document checks: verdicts, the rules that fail most, photo problems', () => {
    const m = new Metrics();
    for (let i = 0; i < 6; i++) m.record({ type: 'check', service: 'p', verdict: 'NOT_READY', failedRules: ['RN-010'], latencyMs: 5000, issues: 0 });
    for (let i = 0; i < 5; i++) m.record({ type: 'check', service: 'p', verdict: 'READY', failedRules: [], latencyMs: 4000, issues: 1 });
    const s = m.snapshot(); expect(s.verdicts[0]).toEqual({ label: 'NOT_READY', count: 6 }); expect(s.topFailedRules[0]).toEqual({ label: 'RN-010', count: 6 }); expect(s.totals.checks).toBe(11);
  });
  it('holds nothing that could identify anyone: every string in the snapshot is a short label or a date, and there are no long digit runs', () => {
    const m = new Metrics(); m.record(chat({ redacted: true })); m.record({ type: 'check', service: 'p', verdict: 'READY', failedRules: ['RN-010'], latencyMs: 1, issues: 0 });
    const strings: string[] = []; const walk = (v: unknown): void => { if (typeof v === 'string') strings.push(v); else if (Array.isArray(v)) v.forEach(walk); else if (v && typeof v === 'object') Object.values(v).forEach(walk); };
    walk(m.snapshot(1));
    for (const s of strings) { expect(s.length, s).toBeLessThanOrEqual(60); expect(s, s).not.toMatch(/\d{6,}|@/); }
    expect(m.snapshot(1).questionsWithPersonalNumbersRemoved).toBe(1);
  });
  it('synthetic demo numbers are clearly flagged', () => { const m = new Metrics(); seedDemo(m); const s = m.snapshot(); expect(s.demo).toBe(true); expect(s.totals.questions).toBe(240); expect(new Metrics().snapshot().demo).toBe(false); });
});
