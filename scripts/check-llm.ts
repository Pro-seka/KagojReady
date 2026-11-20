import { loadDotEnv } from '../src/config/env';
import { configureLlm } from '../src/extract/provider';
import { runLlmCheck } from '../src/ops/check-llm';

const found = loadDotEnv();
let cfg: ReturnType<typeof configureLlm> = null;
try { cfg = configureLlm(process.env); } catch (e) { console.error((e as Error).message); process.exit(2); }
if (!cfg) {
  console.error(found ? 'No key found in .env. Add GEMINI_API_KEY=... (free key: https://aistudio.google.com/apikey).' : 'No .env file found. Copy .env.example to .env, add GEMINI_API_KEY=..., then run this again.');
  process.exit(2);
}
process.exit((await runLlmCheck(cfg, (l) => console.log(l))) ? 0 : 1);
