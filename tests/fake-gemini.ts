import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { loadManifest, oracleClient } from '../eval/extract-eval';

/** A local server that speaks Gemini's HTTP format and "reads" the specimen photos perfectly. */
export function startFakeGemini(opts: { quota?: boolean; region?: boolean } = {}) {
  const oracle = oracleClient(loadManifest());
  const server = http.createServer(async (rq, rs) => {
    const send = (status: number, body: unknown) => { rs.writeHead(status, { 'content-type': 'application/json' }); rs.end(JSON.stringify(body)); };
    if (rq.headers['x-goog-api-key'] !== 'good-key') return send(400, { error: { code: 400, message: 'API key not valid. Please pass a valid API key.', status: 'INVALID_ARGUMENT' } });
    if (opts.region) return send(403, { error: { code: 403, message: 'User location is not supported for the API use.', status: 'PERMISSION_DENIED' } });
    if (rq.method === 'GET' && rq.url!.startsWith('/v1beta/models')) return send(200, { models: [
      { name: 'models/gemini-test', supportedGenerationMethods: ['generateContent'] }, { name: 'models/gemini-test-pro', supportedGenerationMethods: ['generateContent'] },
      { name: 'models/embed-1', supportedGenerationMethods: ['embedContent'] }] });
    const m = /^\/v1beta\/models\/([^:]+):generateContent$/.exec(rq.url ?? '');
    if (!m || m[1] !== 'gemini-test') return send(404, { error: { code: 404, message: `models/${m?.[1]} is not found for API version v1beta`, status: 'NOT_FOUND' } });
    if (opts.quota) return send(429, { error: { code: 429, message: 'Quota exceeded for requests per day (free tier)', status: 'RESOURCE_EXHAUSTED', details: [{ '@type': 'type.googleapis.com/google.rpc.RetryInfo', retryDelay: '0s' }] } });
    let raw = ''; for await (const c of rq) raw += c;
    const img = JSON.parse(raw).contents[0].parts.find((p: any) => p.inline_data).inline_data;
    const text = await oracle.complete({ system: '', userText: '', image: { base64: img.data, mediaType: img.mime_type }, maxTokens: 1 });
    send(200, { candidates: [{ content: { parts: [{ text }] }, finishReason: 'STOP' }], usageMetadata: { promptTokenCount: 1300, candidatesTokenCount: 90 }, modelVersion: 'gemini-test-001' });
  });
  const url = new Promise<string>((r) => server.listen(0, '127.0.0.1', () => r(`http://127.0.0.1:${(server.address() as AddressInfo).port}`)));
  return { url, close: () => server.close() };
}
