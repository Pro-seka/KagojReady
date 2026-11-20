import { evaluate, load } from './run';
import { NOISY, NOISY_OUT } from './noisy';
const e = evaluate(load(), NOISY, NOISY_OUT);
console.log(`noisy set ${e.n} questions: recall@3 ${(100 * e.recallAt3).toFixed(0)}%  MRR ${e.mrr.toFixed(2)}  | ${e.outN} out-of-scope: ${e.wronglyAnswered.length} wrongly answered`);
e.misses.forEach((m) => console.log(`   miss: ${m}`)); e.wronglyAnswered.forEach((m) => console.log(`   WRONGLY ANSWERED: ${m}`));
