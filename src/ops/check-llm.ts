import { readFileSync } from 'node:fs';
import { extractDocument } from '../extract/extractor';
import type { LlmConfig } from '../extract/provider';
import { loadPack } from '../pack/load';
import { judgeField, loadManifest } from '../../eval/extract-eval';

/** Turns an error from the AI service into a plain next step. */
export function hintFor(text: string): string {
  const t = text.toLowerCase();
  if (/location is not supported|not available in your (country|region)/.test(t)) return 'Google says this API is not available in your country or region. Try a different network, or use LLM_PROVIDER=anthropic.';
  if (/api key not valid|api_key_invalid|invalid api key|status 401/.test(t)) return 'The key was rejected. Copy it again from https://aistudio.google.com/apikey and paste it into .env with no spaces or quotes.';
  if (/status 403/.test(t)) return 'Access was denied. The key may be restricted, or the Gemini API may be switched off for its project. Create a fresh key at https://aistudio.google.com/apikey.';
  if (/status 404|not found/.test(t)) return 'That model name is not available to this key. Pick one from the list above and set LLM_MODEL=<name> in .env.';
  if (/status 429|quota|rate limit/.test(t)) return 'You hit a rate or daily limit. Wait a few minutes (daily limits reset at midnight Pacific time), or lower LLM_MAX_RPM. Your real limits: https://aistudio.google.com/rate-limit';
  if (/blocked/.test(t)) return 'Google blocked the request under its safety rules. Try again with a different photo.';
  if (/network|fetch failed|econnrefused|enotfound|etimedout/.test(t)) return 'Could not reach the AI service. Check your internet connection, VPN, proxy or firewall.';
  return 'The AI service returned an error. Run again; if it repeats, switch provider in .env.';
}

/** First-run check: is the key valid, is the model real, and can it read a sample photo correctly? */
export async function runLlmCheck(cfg: LlmConfig, log: (line: string) => void): Promise<boolean> {
  log(`Provider: ${cfg.provider} | model: ${cfg.model} | tier: ${cfg.tier === 'n/a' ? 'paid' : cfg.tier}`);
  if (cfg.tier === 'free') log('Free tier: this check sends only the synthetic SPECIMEN photos from testdata/. Do not upload real ID papers while on the free tier.');
  if (cfg.listModels) {
    try {
      const usable = (await cfg.listModels()).filter((m) => m.methods.includes('generateContent')).map((m) => m.name);
      log(`1. Key accepted. ${usable.length} models can generate content.`);
      if (!usable.includes(cfg.model)) {
        const likely = usable.filter((n) => /flash|pro/.test(n) && !/image|tts|embed|live|audio/.test(n)).slice(0, 10);
        log(`   Model "${cfg.model}" is not available to this key. Models you can use:`);
        likely.forEach((n) => log(`     ${n}`));
        log('   Set LLM_MODEL=<one of these> in .env and run again.');
        return false;
      }
      log(`2. Model "${cfg.model}" is available.`);
    } catch (e) {
      const err = e as { message?: string; detail?: string };
      log(`1. FAILED to check the key: ${err.message} ${err.detail ?? ''}`.trim()); log(`   ${hintFor(`${err.message} ${err.detail ?? ''}`)}`);
      return false;
    }
  }
  const set = loadManifest().find((s) => s.id === 'clean_english__clean')!;
  const pack = loadPack('packs/bd-passport-adult-renewal.json');
  log(`3. Reading two sample photos${cfg.minIntervalMs ? ` (paced, about ${Math.ceil((cfg.minIntervalMs * 2) / 1000)}s)` : ''}...`);
  let correct = 0, wrong = 0, unread = 0;
  for (const def of pack.documents) {
    const rel = set.images[def.id]; if (!rel) continue;
    const r = await extractDocument(cfg.client, def, `data:image/jpeg;base64,${readFileSync(`testdata/specimens/${rel}`).toString('base64')}`);
    if (!r.doc) { log(`   ${def.id}: FAILED (${r.issue}${r.detail ? ', ' + r.detail : ''})`); log(`   ${hintFor(`${r.issue} ${r.detail ?? ''}`)}`); return false; }
    for (const f of def.fields) {
      const truth = set.truth[def.id]?.[f]; const got = r.doc[f]; const v = judgeField(f, got, truth);
      if (v === 'skip') continue;
      if (v === 'correct') correct++; else if (v === 'wrong') wrong++; else unread++;
      log(`   ${`${def.id}.${f}`.padEnd(24)} expected ${JSON.stringify(truth?.value).padEnd(16)} read ${JSON.stringify(got?.value ?? null).padEnd(16)} ${v === 'correct' ? 'OK' : v === 'wrong' ? 'WRONG' : 'unclear'}`);
    }
  }
  const total = correct + wrong + unread, ok = wrong === 0 && correct >= Math.ceil(total * 0.8);
  log(`   ${correct} of ${total} fields read correctly, ${wrong} wrong, ${unread} unclear.${cfg.client.stats?.modelVersion ? ` Model version used: ${cfg.client.stats.modelVersion}.` : ''}`);
  log(ok ? 'Setup looks good. Start the app with: npm run start:dev   then open http://localhost:3000' : 'The model read too many fields wrongly or unclearly. Try another model (LLM_MODEL=...) or provider.');
  return ok;
}
