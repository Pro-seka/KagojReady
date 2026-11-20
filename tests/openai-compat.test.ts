import { describe, expect, it } from 'vitest';
import { openaiCompatClient } from '../src/extract/openai-compat';
import { geminiClient } from '../src/extract/gemini';
import { anthropicClient } from '../src/extract/anthropic';
import { ExtractionError } from '../src/extract/types';
import { JPEG } from './helpers';

const img = { base64: JPEG.toString('base64'), mediaType: 'image/jpeg' as const };
const ok = (text: string, extra: object = {}) => new Response(JSON.stringify({ choices: [{ message: { content: text } }], usage: { prompt_tokens: 50, completion_tokens: 9 }, ...extra }));
function seq(...rs: Array<Response | Error>) {
  const calls: Array<{ url: string; init: any }> = []; let i = 0;
  return { calls, fetchImpl: (async (url: string, init: any) => { calls.push({ url, init }); const r = rs[Math.min(i++, rs.length - 1)]; if (r instanceof Error) throw r; return r.clone(); }) as unknown as typeof fetch };
}

describe('OpenAI-compatible client (local or sovereign models)', () => {
  it('sends an image as a data URI and reads the reply and token counts', async () => {
    const { fetchImpl, calls } = seq(ok('{"a":1}'));
    const c = openaiCompatClient({ baseUrl: 'http://localhost:11434/v1/', model: 'm', fetchImpl });
    expect(await c.complete({ system: 's', userText: 'u', image: img, maxTokens: 100 })).toBe('{"a":1}');
    const b = JSON.parse(calls[0].init.body);
    expect(calls[0].url).toBe('http://localhost:11434/v1/chat/completions'); expect(calls[0].init.headers.authorization).toBeUndefined();
    expect(b.messages[0]).toEqual({ role: 'system', content: 's' });
    expect(b.messages[1].content[0]).toEqual({ type: 'image_url', image_url: { url: `data:image/jpeg;base64,${img.base64}` } });
    expect(c.stats).toEqual({ calls: 1, inputTokens: 50, outputTokens: 9 });
  });
  it('sends plain text when there is no image, and a bearer token only when configured', async () => {
    const { fetchImpl, calls } = seq(ok('hi'));
    await openaiCompatClient({ baseUrl: 'https://gw.example/v1', model: 'm', apiKey: 'TOK', fetchImpl }).complete({ system: 's', userText: 'question', maxTokens: 10 });
    expect(JSON.parse(calls[0].init.body).messages[1].content).toBe('question'); expect(calls[0].init.headers.authorization).toBe('Bearer TOK');
  });
  it('retries once on a server error, then reports clean errors without leaking the token', async () => {
    const a = seq(new Response('{}', { status: 500 }), ok('fine'));
    expect(await openaiCompatClient({ baseUrl: 'http://x', model: 'm', fetchImpl: a.fetchImpl }).complete({ system: '', userText: 'u', maxTokens: 1 })).toBe('fine'); expect(a.calls.length).toBe(2);
    const bad: any = await openaiCompatClient({ baseUrl: 'http://x', model: 'm', apiKey: 'SECRET-TOK', fetchImpl: seq(new Response(JSON.stringify({ error: { message: 'model not found' } }), { status: 404 })).fetchImpl }).complete({ system: '', userText: 'u', maxTokens: 1 }).catch((e) => e);
    expect(bad).toBeInstanceOf(ExtractionError); expect(bad.detail).toMatch(/model not found/); expect(JSON.stringify([bad.message, bad.detail, bad.stack])).not.toMatch(/SECRET-TOK/);
    const empty: any = await openaiCompatClient({ baseUrl: 'http://x', model: 'm', fetchImpl: seq(ok('')).fetchImpl }).complete({ system: '', userText: 'u', maxTokens: 1 }).catch((e) => e);
    expect(empty.message).toBe('empty reply');
  }, 10_000);
});

describe('text-only requests on the other providers', () => {
  it('gemini sends no image part when there is no image', async () => {
    const { fetchImpl, calls } = seq(new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: 'x' }] } }] })));
    await geminiClient({ apiKey: 'k', model: 'm', fetchImpl }).complete({ system: 's', userText: 'q', maxTokens: 10 });
    expect(JSON.parse(calls[0].init.body).contents[0].parts).toEqual([{ text: 'q' }]);
  });
  it('anthropic sends no image block when there is no image', async () => {
    const { fetchImpl, calls } = seq(new Response(JSON.stringify({ content: [{ type: 'text', text: 'x' }] })));
    await anthropicClient({ apiKey: 'k', model: 'm', fetchImpl }).complete({ system: 's', userText: 'q', maxTokens: 10 });
    expect(JSON.parse(calls[0].init.body).messages[0].content).toEqual([{ type: 'text', text: 'q' }]);
  });
});
