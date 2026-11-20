/** Optimal-string-alignment distance (insert, delete, substitute, swap two neighbours each cost 1). Stops early past `max`. */
export function editDistance(a: string, b: string, max = 3): number {
  if (a === b) return 0;
  const la = a.length, lb = b.length;
  if (Math.abs(la - lb) > max) return max + 1;
  let prev2: number[] = [], prev = Array.from({ length: lb + 1 }, (_, j) => j);
  for (let i = 1; i <= la; i++) {
    const cur = [i]; let rowMin = i;
    for (let j = 1; j <= lb; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, prev2[j - 2] + 1);
      cur.push(v); if (v < rowMin) rowMin = v;
    }
    if (rowMin > max) return max + 1;
    prev2 = prev; prev = cur;
  }
  return prev[lb];
}

/** How many slips a word of this length may contain and still be treated as a typo of a known word. Short words are never corrected: too many neighbours. */
export function allowedSlips(len: number): number { return len < 4 ? 0 : len < 7 ? 1 : 2; }
