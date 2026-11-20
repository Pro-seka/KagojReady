import { toAsciiDigits } from '../normalize/digits';

const STOP = new Set(('a an the is are was were be been am of to for in on at by with from and or but not no do does did can could should would will my me i you your we our it its this that these those what which who how when where why there here if then so as about into any some please tell give need want get have has had').split(/\s+/)
  .concat('এবং ও বা কি কী কে কেন কখন কোথায় যে এই সেই ওই জন্য আমার আমি আমাকে আপনি আপনার করে করতে করা হয় হবে হলে হচ্ছে আছে নেই না থেকে সাথে মধ্যে একটি একটা কিছু কত কোন কোনো যদি তাহলে তবে তো ই কি? এর'.split(/\s+/)));

const BN_SUFFIXES = ['গুলোকে', 'গুলোর', 'গুলো', 'গুলি', 'দের', 'ের', 'কে', 'তে', 'রা', 'টা', 'টি', 'র', 'ে'];
const EN_SUFFIXES = ['ations', 'ation', 'ings', 'ing', 'ions', 'ion', 'ed', 'al', 'ly', 'es', 's'];

const hasBangla = (s: string) => /[\u0980-\u09FF]/.test(s);
function stem(t: string): string {
  if (hasBangla(t)) { for (const s of BN_SUFFIXES) if (t.endsWith(s) && t.length - s.length >= 3) return t.slice(0, -s.length); return t; }
  for (const s of EN_SUFFIXES) if (t.endsWith(s) && t.length - s.length >= 4 && !t.endsWith('ss')) return t.slice(0, -s.length);
  return t;
}

/** Lower-cases, folds Bangla digits, splits on anything that is not a letter, mark or digit, drops stop words, and lightly stems both scripts. */
export function tokenize(text: string): string[] {
  return toAsciiDigits(text.normalize('NFC')).toLowerCase().split(/[^\p{L}\p{M}\p{N}]+/u)
    .filter((t) => t.length > 1 && !STOP.has(t)).map(stem);
}
