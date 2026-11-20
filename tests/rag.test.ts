import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { tokenize } from '../src/rag/tokenize';
import { Bm25Index } from '../src/rag/bm25';
import { expandTerm } from '../src/rag/synonyms';
import { parsePack } from '../src/pack/load';
import { buildKb, Retriever } from '../src/kb/load';
import { cardsFromDocument, chunkText } from '../src/kb/ingest';
import { evaluate } from '../eval/rag/run';
import { DEV, DEV_OUT, HELD_OUT, HELD_OUT_2, HELD_OUT_2_OUT, HELD_OUT_OUT } from '../eval/rag/queries';

const packs = readdirSync('tests/fixtures/packs').map((f) => parsePack(JSON.parse(readFileSync(`tests/fixtures/packs/${f}`, 'utf8'))));
const kb = buildKb(packs); const retriever = new Retriever(kb);

describe('tokenizer', () => {
  it('folds Bangla digits, drops stop words and punctuation, in both scripts', () => {
    expect(tokenize('What is the NID number? ১২৩')).toEqual(['nid', 'number', '123']);
    expect(tokenize('পাসপোর্ট নবায়নের জন্য কী কী কাগজ লাগে?')).toEqual(['পাসপোর্ট', 'নবায়ন', 'কাগজ', 'লাগ']);
  });
  it('stems both scripts lightly so inflections match', () => {
    expect(tokenize('corrections corrected correcting')).toEqual(['correct', 'correct', 'correct']);
    expect(tokenize('পাসপোর্টে পাসপোর্টের সনদে')).toEqual(['পাসপোর্ট', 'পাসপোর্ট', 'সনদ']);
  });
});
describe('synonyms', () => {
  it('connect words that mean the same in this domain, across languages', () => {
    expect(expandTerm('renew')).toContain('extend'); expect(expandTerm('renew')).toContain('নবায়ন');
    expect(expandTerm('blurry')).toContain('glare'); expect(expandTerm('unknownword')).toEqual(['unknownword']);
  });
});
describe('BM25 index', () => {
  const idx = new Bm25Index([{ id: 'a', title: 'Passport renewal', text: 'bring your old passport' }, { id: 'b', title: 'Tax', text: 'file your income tax return' }]);
  it('ranks the relevant passage first and reports coverage', () => {
    const h = idx.search('renew passport'); expect(h[0].id).toBe('a'); expect(h[0].coverage).toBe(0.5 + 0.5);
  });
  it('returns nothing for words it has never seen', () => expect(idx.search('zzz qqq')).toEqual([]));
});

describe('knowledge base integrity', () => {
  it('has unique ids and text in at least one language. Anything marked official or operator-reported has a source; only unconfirmed pack rules may lack one', () => {
    expect(new Set(kb.map((c) => c.id)).size).toBe(kb.length);
    for (const c of kb) {
      expect(c.text_en || c.text_bn, c.id).toBeTruthy();
      if (c.status === 'official') expect(c.source, `${c.id} is marked official but has no source`).not.toBeNull();
      if (c.status === 'unconfirmed' && c.kind !== 'rule') expect(c.source, `${c.id} is a claim with no source`).not.toBeNull();
    }
  });
  it('curated cards are written in both Bangla and English, and press-only claims are never marked official', () => {
    const curated = kb.filter((c) => c.kind === 'guidance' || c.kind === 'note');
    for (const c of curated) { expect(c.text_bn, c.id).toBeTruthy(); expect(c.text_en, c.id).toBeTruthy(); expect(c.title_bn && c.title_en, c.id).toBeTruthy(); }
    for (const c of kb) if (c.source && /press report/.test(c.source.label)) expect(c.status, c.id).not.toBe('official');
  });
  it('contains a card for every rule in every pack, with the rule status carried over', () => {
    for (const p of packs) for (const r of p.rules) { const c = kb.find((x) => x.id === `${p.pack_id}:${r.id}`)!; expect(c, r.id).toBeTruthy(); expect(c.status).toBe(r.rule_status); }
  });
});

describe('retrieval quality (numbers are for this small hand-written set only)', () => {
  const dev = evaluate(retriever, DEV, DEV_OUT), dev2 = evaluate(retriever, HELD_OUT, HELD_OUT_OUT), held = evaluate(retriever, HELD_OUT_2, HELD_OUT_2_OUT);
  it('development set: finds the right passage in the top 3 at least 95% of the time', () => expect(dev.recallAt3).toBeGreaterThanOrEqual(0.95));
  it('dev 2 set: at least 90%', () => expect(dev2.recallAt3).toBeGreaterThanOrEqual(0.9));
  it('held-out set (not tuned against): at least 85%', () => expect(held.recallAt3, held.misses.join('\n')).toBeGreaterThanOrEqual(0.85));
  it('never answers an out-of-scope question', () => { for (const e of [dev, dev2, held]) expect(e.wronglyAnswered).toEqual([]); });
  it('answers in either language: a Bangla question finds the same passage as the English one', () => {
    expect(retriever.retrieve('এনআইডি সংশোধনে কত সময় লাগে?', 1)[0].card.id).toBe(retriever.retrieve('How long does NID correction take', 1)[0].card.id);
  });
});

describe('scale: thousands of pages', () => {
  it('indexes about 7,500 pages (30,000 passages) of a deliberately hard corpus and answers in well under a quarter of a second', () => {
    const words = 'permit licence trade shop municipal bylaw zoning fee inspection renewal application ward council fire safety signage health food vendor noise parking waste water drainage land tax holding certificate'.split(' ');
    let s = 11; const rnd = () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
    const docs = Array.from({ length: 30_000 }, (_, i) => ({ id: `p${i}`, title: `Bylaw ${i}`, text: Array.from({ length: 120 }, () => words[Math.floor(rnd() * words.length)] + (rnd() < 0.3 ? Math.floor(rnd() * 500) : '')).join(' ') }));
    docs[12_345].text += ' sewage pumping station wetland easement';
    const t0 = performance.now(); const idx = new Bm25Index(docs); const build = performance.now() - t0;
    const lat: number[] = []; let found = '';
    for (let i = 0; i < 50; i++) { const t = performance.now(); const h = idx.search(i === 0 ? 'wetland easement sewage' : 'food vendor licence renewal fee'); lat.push(performance.now() - t); if (i === 0) found = h[0].id; }
    lat.sort((a, b) => a - b);
    expect(found).toBe('p12345'); expect(build).toBeLessThan(20_000); expect(lat[Math.floor(lat.length * 0.95)]).toBeLessThan(150);
    expect(lat[25]).toBeLessThan(75);
    console.log(`scale: 30,000 passages indexed in ${Math.round(build)} ms; query p50 ${lat[25].toFixed(1)} ms, p95 ${lat[47].toFixed(1)} ms`);
  }, 60_000);
});

describe('document ingestion', () => {
  it('splits a long document into overlapping passages', () => {
    const words = Array.from({ length: 300 }, (_, i) => `w${i}`).join(' ');
    const c = chunkText(words, { words: 100, overlap: 20 }); expect(c.length).toBe(4);
    expect(c[0].split(' ').slice(-20)).toEqual(c[1].split(' ').slice(0, 20));
  });
  it('turns documents into searchable passages with their source, in the right language field', () => {
    const src = { label: 'Dhaka North bylaws', url: 'https://example.org/bylaws', retrieved: '2026-10-22' };
    const en = cardsFromDocument('trade-licence.md', '# Trade licence\nA trade licence is required before a shop opens in the ward. '.repeat(1), { source: src });
    const bn = cardsFromDocument('বিজ্ঞপ্তি.txt', 'দোকান খোলার আগে ওয়ার্ড অফিস থেকে ট্রেড লাইসেন্স নিতে হয়। আবেদনের সঙ্গে ভাড়ার চুক্তি জমা দিতে হবে।', { source: src, status: 'official' });
    expect(en[0]).toMatchObject({ kind: 'ingested', status: 'unconfirmed', title_en: 'Trade licence (part 1)', source: src }); expect(en[0].text_bn).toBe('');
    expect(bn[0].text_bn).toContain('ট্রেড লাইসেন্স'); expect(bn[0].text_en).toBe('');
    const r = new Retriever([...kb, ...en, ...bn]);
    expect(r.retrieve('trade licence shop ward', 1)[0].card.id).toBe(en[0].id); expect(r.retrieve('ট্রেড লাইসেন্স দোকান', 1)[0].card.id).toBe(bn[0].id);
  });
});

// ---------- noisy input, romanized Bangla and services not covered (v2) ----------
import { NOISY, NOISY_OUT } from '../eval/rag/noisy';
import { evaluate as evalSet, load as loadKb } from '../eval/rag/run';
import { editDistance, allowedSlips } from '../src/rag/fuzzy';
import { fromBanglish, soundKey, isRomanFiller } from '../src/rag/banglish';
import { rewriteQuery } from '../src/rag/rewrite';
import { detectOutOfScope, loadOutOfScope } from '../src/assistant/scope';

describe('fuzzy matching', () => {
  it('counts a swap as one slip, and refuses short words', () => {
    expect(editDistance('renewal', 'renewal')).toBe(0); expect(editDistance('pasport', 'passport')).toBe(1); expect(editDistance('pasoprt', 'passport')).toBe(2); expect(editDistance('ab', 'xyzxyz', 2)).toBe(3);
    expect([3, 4, 6, 7, 12].map(allowedSlips)).toEqual([0, 1, 1, 2, 2]);
  });
});
describe('romanized Bangla', () => {
  it('maps spelling variants of the same word to one Bangla word', () => {
    for (const v of ['songshodhon', 'shongshodhon', 'sonshodhon', 'songshodhan']) expect(fromBanglish(v), v).toBe('সংশোধন');
    for (const v of ['nobayon', 'nobayan', 'noboyon']) expect(fromBanglish(v), v).toBe('নবায়ন'); expect(fromBanglish('milche')).toBe('মিল'); expect(fromBanglish('probashider')).toBe('প্রবাসী');
  });
  it('does not turn ordinary English words into Bangla', () => { for (const w of ['passport', 'document', 'licence', 'weather', 'driving', 'birth', 'certificate', 'renew', 'name', 'photo']) expect(fromBanglish(w), w).toBeNull(); });
  it('folds sound the same way on both sides, and knows filler words', () => { expect(soundKey('Shomoy')).toBe(soundKey('somoy')); expect(isRomanFiller('korte')).toBe(true); expect(isRomanFiller('passport')).toBe(false); });
});
describe('query rewriting', () => {
  const r = loadKb(); const rw = (q: string) => rewriteQuery(q, (r as any).index, expandTerm);
  it('repairs a typo only when a known word is a small slip away, and reports it', () => { const x = rw('pasport renewel documents'); expect(x.typos.map((t) => t.to)).toEqual(expect.arrayContaining(['passport'])); });
  it('leaves unknown words unknown so coverage still refuses an unrelated question', () => { expect(rw('bitcoin price today').typos).toEqual([]); expect(rw('xylophone').text).toBe('xylophone'); });
});
describe('noisy-input retrieval set (written before the layers existed)', () => {
  const e = evalSet(loadKb(), NOISY, NOISY_OUT);
  it('finds the right passage for typos, romanized Bangla and Bangla spelling variants', () => { expect(e.recallAt3).toBeGreaterThanOrEqual(0.95); expect(e.mrr).toBeGreaterThanOrEqual(0.9); });
  it('still refuses every off-topic question, including near-misses that contain a real domain word', () => { expect(e.wronglyAnswered).toEqual([]); });
});
describe('services not covered', () => {
  const list = loadOutOfScope();
  it('recognises other services in English, Bangla and romanized forms', () => {
    for (const [q, id] of [['driving licence renewal', 'driving-licence'], ['ড্রাইভিং লাইসেন্স নবায়ন', 'driving-licence'], ['how to get a trade licence', 'trade-licence'], ['visa for malaysia', 'visa'], ['jomir namjari kivabe', 'land'], ['birth certificate for my newborn', 'newborn-birth-registration'], ['income tax return', 'tax'], ['death certificate', 'death']] as const)
      expect(detectOutOfScope(q, list)?.id, q).toBe(id);
  });
  it('never claims a passport or NID question is out of scope', () => {
    for (const q of ['do I need a visa stamp page to renew my passport', 'NID correction for tax purposes', 'পাসপোর্ট নবায়ন ভিসা', 'is my NID needed for a driving licence and passport']) expect(detectOutOfScope(q, list), q).toBeNull();
  });
  it('every entry has both names and compiles', () => { expect(list.length).toBeGreaterThanOrEqual(8); for (const s of list) expect(s.name_en && s.name_bn && s.id).toBeTruthy(); });
});
