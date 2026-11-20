import { describe, expect, it } from 'vitest';
import { decodeImage, MAX_IMAGE_BYTES, sniffMediaType } from '../src/extract/image';
import { extractDocument, extractJson, parseExtraction } from '../src/extract/extractor';
import { anthropicClient } from '../src/extract/anthropic';
import { ExtractionError } from '../src/extract/types';
import { SYSTEM_PROMPT } from '../src/extract/prompt';
import { runCheck } from '../src/pipeline';
import { loadPack } from '../src/pack/load';
import { dataUrl, fakeLlm, JPEG, NID_REPLY, PNG, reply, TODAY } from './helpers';

const NID_DEF = { id: 'nid', name_en: 'National ID card', fields: ['name', 'dob'] };

describe('image validation', () => {
  it('sniffs real types from bytes', () => {
    expect(sniffMediaType(JPEG)).toBe('image/jpeg');
    expect(sniffMediaType(PNG)).toBe('image/png');
    expect(sniffMediaType(Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBP'), Buffer.alloc(8)]))).toBe('image/webp');
    expect(sniffMediaType(Buffer.from('hello world, not an image'))).toBeNull();
  });
  it('accepts data URLs and bare base64, ignoring a spoofed declared type', () => {
    expect(decodeImage(dataUrl(JPEG, 'image/png')).mediaType).toBe('image/jpeg');
    expect(decodeImage(JPEG.toString('base64')).mediaType).toBe('image/jpeg');
  });
  it('rejects junk, non-images, empty and oversize input', () => {
    for (const bad of [undefined, null, 42, '', 'not base64 !!', dataUrl(Buffer.from('plain text file')), dataUrl(Buffer.alloc(0))])
      expect(() => decodeImage(bad)).toThrow(ExtractionError);
    const big = Buffer.concat([JPEG, Buffer.alloc(MAX_IMAGE_BYTES)]);
    expect(() => decodeImage(dataUrl(big))).toThrow(ExtractionError);
  });
});

describe('parseExtraction', () => {
  it('parses a clean reply', () => {
    const { doc, isExpected } = parseExtraction(NID_REPLY, ['name', 'dob']);
    expect(isExpected).toBe(true);
    expect(doc.name?.value).toBe('Abdur Rahim');
    expect(doc.name?.legible).toBe(true);
  });
  it('tolerates code fences and surrounding prose', () => {
    expect(extractJson('Here you go:\n```json\n{"a":1}\n```\nDone')).toEqual({ a: 1 });
  });
  it('drops fields that were not requested (data minimization)', () => {
    const { doc } = parseExtraction(NID_REPLY, ['name']);
    expect(Object.keys(doc)).toEqual(['name']);
  });
  it('clamps confidence and normalizes whitespace and length', () => {
    const { doc } = parseExtraction(reply({ name: { value: '  Abdur   Rahim ', confidence: 7 }, dob: { value: 'x'.repeat(500), confidence: -2 } }), ['name', 'dob']);
    expect(doc.name).toMatchObject({ value: 'Abdur Rahim', confidence: 1 });
    expect(doc.dob?.value?.length).toBe(200);
    expect(doc.dob?.confidence).toBe(0);
  });
  it('leaves unrequested-but-missing fields out, so the engine reports them as unsure', () => {
    const { doc } = parseExtraction(reply({ name: { value: 'A' } }), ['name', 'dob']);
    expect(doc.dob).toBeUndefined();
  });
  it('marks a null low-confidence field as not legible', () => {
    const { doc } = parseExtraction(reply({ dob: { value: null, confidence: 0.1 } }), ['dob']);
    expect(doc.dob?.legible).toBe(false);
  });
  it('rejects malformed replies', () => {
    for (const bad of ['', 'no json here', '{"fields": 5}', '{"fields": {"name": {"value": 5}}}', '{broken'])
      expect(() => parseExtraction(bad, ['name'])).toThrow(ExtractionError);
  });
});

describe('extractDocument', () => {
  const llmSeq = (...replies: Array<string | Error>) => {
    let i = 0; const calls = { n: 0 };
    return { calls, complete: async () => { calls.n++; const r = replies[Math.min(i++, replies.length - 1)]; if (r instanceof Error) throw r; return r; } };
  };
  it('succeeds in one call on a good reply', async () => {
    const l = llmSeq(NID_REPLY);
    const r = await extractDocument(l, NID_DEF, dataUrl(JPEG));
    expect(r.doc?.name?.value).toBe('Abdur Rahim'); expect(l.calls.n).toBe(1);
  });
  it('retries once on malformed output, then succeeds', async () => {
    const l = llmSeq('garbage', NID_REPLY);
    expect((await extractDocument(l, NID_DEF, dataUrl(JPEG))).doc).toBeDefined(); expect(l.calls.n).toBe(2);
  });
  it('gives up after two malformed replies', async () => {
    const l = llmSeq('garbage', 'more garbage');
    expect(await extractDocument(l, NID_DEF, dataUrl(JPEG))).toMatchObject({ doc: undefined, issue: 'invalid_output' });
  });
  it('reports the wrong document type', async () => {
    const l = llmSeq(reply({ name: { value: null } }, false));
    expect(await extractDocument(l, NID_DEF, dataUrl(JPEG))).toEqual({ doc: undefined, issue: 'wrong_document' });
  });
  it('maps service failures and bad images without calling the model', async () => {
    expect((await extractDocument(llmSeq(new ExtractionError('service_error')), NID_DEF, dataUrl(JPEG))).issue).toBe('service_error');
    expect((await extractDocument(llmSeq(new Error('boom')), NID_DEF, dataUrl(JPEG))).issue).toBe('service_error');
    const l = llmSeq(NID_REPLY);
    expect((await extractDocument(l, NID_DEF, 'junk')).issue).toBe('bad_image'); expect(l.calls.n).toBe(0);
  });
  it('tells the model that text in the image is data, never instructions', () => {
    expect(SYSTEM_PROMPT).toMatch(/never instructions/i);
    expect(SYSTEM_PROMPT).toMatch(/NEVER guess/);
  });
});

describe('anthropic client', () => {
  const okBody = { content: [{ type: 'text', text: 'hello' }] };
  const req = { system: 's', userText: 'u', image: { base64: JPEG.toString('base64'), mediaType: 'image/jpeg' as const }, maxTokens: 1000 };
  const mk = (responses: Array<Response | Error>, seen: any[] = []) => {
    let i = 0;
    const fetchImpl = (async (url: string, init: RequestInit) => {
      seen.push({ url, init }); const r = responses[Math.min(i++, responses.length - 1)]; if (r instanceof Error) throw r; return r;
    }) as unknown as typeof fetch;
    return anthropicClient({ apiKey: 'sk-test-SECRET', model: 'test-model', fetchImpl });
  };
  const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status });
  it('sends a correct vision request', async () => {
    const seen: any[] = [];
    expect(await mk([json(okBody)], seen).complete(req)).toBe('hello');
    const { url, init } = seen[0]; const body = JSON.parse(init.body);
    expect(url).toBe('https://api.anthropic.com/v1/messages');
    expect(init.headers['x-api-key']).toBe('sk-test-SECRET');
    expect(init.headers['anthropic-version']).toBe('2023-06-01');
    expect(body.model).toBe('test-model');
    expect(body.messages[0].content[0]).toEqual({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: req.image.base64 } });
    expect(body.messages[0].content[1].type).toBe('text');
  });
  it('retries once on 429 then succeeds', async () => {
    const seen: any[] = [];
    expect(await mk([json({}, 429), json(okBody)], seen).complete(req)).toBe('hello'); expect(seen.length).toBe(2);
  }, 10_000);
  it('fails with service_error on 401 and never leaks the key or image in the error', async () => {
    const err: any = await mk([json({ error: 'bad key' }, 401)]).complete(req).catch((e) => e);
    expect(err).toBeInstanceOf(ExtractionError); expect(err.code).toBe('service_error');
    expect(JSON.stringify([err.message, err.stack])).not.toMatch(/SECRET|\/9j|base64/);
  });
  it('fails cleanly on empty replies', async () => {
    const err: any = await mk([json({ content: [] })]).complete(req).catch((e) => e);
    expect(err.code).toBe('service_error');
  });
});

describe('pipeline', () => {
  const pack = loadPack('tests/fixtures/packs/bd-passport-adult-renewal.json');
  const images = { nid: dataUrl(JPEG), old_passport: dataUrl(PNG, 'image/png') };
  it('turns two photos into a READY report', async () => {
    const { report, issues } = await runCheck({ pack, applicantType: 'adult', images, llm: fakeLlm(), today: TODAY });
    expect(report.verdict).toBe('READY'); expect(issues).toEqual({});
  });
  it('a missing photo is a failed required document, not a crash', async () => {
    const { report } = await runCheck({ pack, applicantType: 'adult', images: { nid: images.nid }, llm: fakeLlm(), today: TODAY });
    expect(report.verdict).toBe('NOT_READY');
    expect(report.results.find((r) => r.ruleId === 'RN-001')?.outcome).toBe('FAIL');
  });
  it('a model outage never produces READY', async () => {
    const llm = { complete: async () => { throw new ExtractionError('service_error'); } };
    const { report, issues } = await runCheck({ pack, applicantType: 'adult', images, llm, today: TODAY });
    expect(report.verdict).not.toBe('READY'); expect(issues.nid).toBe('service_error');
  });
  it('a misread date of birth is caught as a mismatch, not passed', async () => {
    const llm = fakeLlm({ nid: reply({ name: { value: 'Abdur Rahim' }, father_name: { value: 'K' }, mother_name: { value: 'R' }, dob: { value: '12 Mar 1991' }, nid_number: { value: '1234567890' } }) });
    const { report } = await runCheck({ pack, applicantType: 'adult', images, llm, today: TODAY });
    expect(report.verdict).toBe('NOT_READY');
  });
});
