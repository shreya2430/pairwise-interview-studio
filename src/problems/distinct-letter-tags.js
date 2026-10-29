PROBLEMS.push({
  id: 'distinct-letter-tags',
  title: 'Pick bin labels with no shared letters',
  team: 'Warehouse Systems',
  level: 'Senior',
  difficulty: 'Hard',
  minutes: 45,
  focus: ['Backtracking', 'Bitmasks', 'Pruning'],
  format: 'Staged brute force then optimize, as in AI-assisted coding rounds reported in 2025–26: get a correct exhaustive answer, pin down a deterministic output, then make it scale.',
  scenario: 'Pickers scan bins by typing a short code into a wrist scanner that autocompletes after the first letter. A new zone gets a set of codes where no letter appears twice across all the codes chosen, so one keystroke always identifies the bin.',
  body: `
<p>Write <code>pickTags(words)</code>. <code>words</code> is a list of candidate labels, each a lowercase string of letters <code>a</code>–<code>z</code>.</p>
<ul>
<li>Choose a subset of the labels so that no letter appears more than once across all chosen labels, counting repeats inside a single label too. A label like <code>"noon"</code> can never be chosen.</li>
<li>Maximize the total number of letters in the chosen labels.</li>
<li>Return <code>{ letters, tags }</code>: the maximum total, and the chosen labels in the order they appear in <code>words</code>.</li>
</ul>
<p>The same label may appear more than once in <code>words</code>. Choosing nothing is allowed and gives <code>{ letters: 0, tags: [] }</code>.</p>`,
  examples: `pickTags(["dock", "bay", "rack", "lift", "aisle", "zone"]);
// { letters: 12, tags: ["rack", "lift", "zone"] }

pickTags(["noon", "tt", "abc"]);
// { letters: 3, tags: ["abc"] }`,
  constraints: ['0 ≤ words.length ≤ 60', '1 ≤ words[i].length ≤ 10, lowercase a–z only', 'Duplicates and anagrams are common: labels come from several teams'],
  starter: `/**
 * @param {string[]} words  candidate labels, lowercase a-z
 * @returns {{ letters: number, tags: string[] }}
 */
function pickTags(words) {
  // TODO
}
`,
  parts: [
    {
      title: 'Part 1: Maximum letter count',
      body: `
<p>Return the correct <code>letters</code> value. Zones in this stage have at most 16 candidate labels, so trying every subset is fine. The <code>tags</code> field is not checked yet.</p>`,
      tests: [
        { name: 'Example from the spec', src: `return [pickTags(['dock', 'bay', 'rack', 'lift', 'aisle', 'zone']).letters, 12];` },
        { name: 'Labels with repeated letters are never usable', src: `return [pickTags(['noon', 'tt', 'abc']).letters, 3];` },
        { name: 'Two overlapping labels, take the longer', src: `return [pickTags(['ab', 'bcd']).letters, 3];` },
        { name: 'Sixteen labels', src: `return [pickTags(['crate', 'pallet', 'bin', 'tote', 'shelf', 'dock', 'lane', 'bay', 'rack', 'lift', 'aisle', 'zone', 'pick', 'pack', 'ship', 'yard']).letters, 13];` },
      ],
      hidden: [
        { name: 'No labels', src: `return [pickTags([]).letters, 0];` },
        { name: 'Every label has an internal repeat', src: `return [pickTags(['aa', 'bob', 'deed']).letters, 0];` },
        { name: 'Several labels fit together', src: `return [pickTags(['mint', 'glyph', 'quack', 'verbs', 'fjord', 'wax', 'zoo']).letters, 19];` },
      ],
    },
    {
      title: 'Part 2: Return the labels, deterministically',
      body: `
<p>The zone planner prints the chosen labels, and the output must not change between runs. Return <code>tags</code> too.</p>
<p>When several selections reach the maximum, compare two selections by the lowest index in <code>words</code> where one uses the label and the other does not. The selection that uses it wins. In other words, earlier-listed labels are preferred. <code>tags</code> lists the chosen labels in input order.</p>
<pre class="inline-pre">pickTags(["ab", "cd", "ac", "bd"]);  // { letters: 4, tags: ["ab", "cd"] }
pickTags(["abc", "ab", "c"]);        // { letters: 3, tags: ["abc"] }</pre>`,
      tests: [
        { name: 'Example labels', src: `return [pickTags(['dock', 'bay', 'rack', 'lift', 'aisle', 'zone']), { letters: 12, tags: ['rack', 'lift', 'zone'] }];` },
        { name: 'Tie goes to the earlier label', src: `return [pickTags(['ab', 'cd', 'ac', 'bd']), { letters: 4, tags: ['ab', 'cd'] }];` },
        { name: 'One label can beat two in a tie', src: `return [pickTags(['abc', 'ab', 'c']), { letters: 3, tags: ['abc'] }];` },
        { name: 'Duplicate letter sets keep the earliest label', src: `return [pickTags(['ba', 'ab', 'c']), { letters: 3, tags: ['ba', 'c'] }];` },
      ],
      hidden: [
        { name: 'Labels come back in input order', src: `return [pickTags(['d', 'abc']), { letters: 4, tags: ['d', 'abc'] }];` },
        { name: 'Empty input gives empty tags', src: `return [pickTags(['zz', 'yy']), { letters: 0, tags: [] }];` },
        { name: 'Sixteen labels with tags', src: `return [pickTags(['crate', 'pallet', 'bin', 'tote', 'shelf', 'dock', 'lane', 'bay', 'rack', 'lift', 'aisle', 'zone', 'pick', 'pack', 'ship', 'yard']), { letters: 13, tags: ['shelf', 'pick', 'yard'] }];` },
      ],
    },
    {
      title: 'Part 3: Sixty labels',
      body: `
<p>Large zones collect up to 60 candidate labels from several teams. Many are duplicates or anagrams of each other (<code>"st"</code> and <code>"ts"</code>), and some contain repeated letters. The planner must answer in well under a second.</p>
<p>Keep the output from part 2 exactly, including the tie-break.</p>`,
      tests: [
        { name: 'Sixty labels with many anagrams', src: `let seed = 2; const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
const L = 'bcdfghjklmnpqrstvwxyaeiou', words = [];
for (let i = 0; i < 60; i++) {
  const roll = rnd();
  if (roll < 0.8) { const b = Math.floor(rnd() * 11); const x = L[2 * b], y = L[2 * b + 1]; words.push(rnd() < 0.5 ? x + y : y + x); }
  else if (roll < 0.9) { const a = Math.floor(rnd() * 22); words.push(L[a] + L[a + 1] + L[a + 3]); }
  else { const a = Math.floor(rnd() * 22); words.push(L[a] + 'e' + L[a]); }
}
const t = performance.now(); const r = pickTags(words); const ms = performance.now() - t;
return [[r, ms < 1000], [{ letters: 22, tags: ['st', 'ae', 'wv', 'ml', 'rq', 'df', 'hg', 'kj', 'pn', 'xy', 'cb'] }, true]];` },
      ],
      hidden: [
        { name: 'Sixty labels, denser duplicates', src: `let seed = 3; const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
const L = 'bcdfghjklmnpqrstvwxyaeiou', words = [];
for (let i = 0; i < 60; i++) {
  const roll = rnd();
  if (roll < 0.8) { const b = Math.floor(rnd() * 10); const x = L[2 * b], y = L[2 * b + 1]; words.push(rnd() < 0.5 ? x + y : y + x); }
  else if (roll < 0.9) { const a = Math.floor(rnd() * 22); words.push(L[a] + L[a + 1] + L[a + 3]); }
  else { const a = Math.floor(rnd() * 22); words.push(L[a] + 'e' + L[a]); }
}
return [pickTags(words), { letters: 23, tags: ['hg', 'ml', 'rq', 'yx', 'cb', 'jk', 'np', 'st', 'df', 'vw', 'aeo'] }];` },
        { name: 'Sixty random labels', src: `let seed = 99; const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
const words = [];
for (let i = 0; i < 60; i++) { const len = 2 + Math.floor(rnd() * 4); let s = ''; for (let j = 0; j < len; j++) s += String.fromCharCode(97 + Math.floor(rnd() * 26)); words.push(s); }
return [pickTags(words), { letters: 25, tags: ['rz', 'ql', 'jwh', 'pma', 'suvc', 'iodgb', 'kt', 'exyn'] }];` },
        { name: 'Sixty copies of one label', src: `return [pickTags(new Array(60).fill('bin')), { letters: 3, tags: ['bin'] }];` },
      ],
    },
  ],
  followUps: [
    'The zone grows to 500 candidate labels. What breaks first, and what would you return if an exact answer is out of reach?',
    'Codes come in from teams through an API, sometimes with uppercase letters, spaces or digits. Where do you validate, and do you reject or normalise?',
    'Ops wants to pin two labels that must be in the result. How does that change the search?',
  ],
  rubric: 'Strong: converts each label to a 26-bit mask and drops labels with an internal repeat; backtracking with include/exclude and a `used & mask` conflict check; states the tie-break as include-first DFS in input order and takes a new best only on strict improvement; dedupes identical masks keeping the earliest index (and explains why that preserves the tie-break); prunes with an upper bound such as `letters + min(remaining letters, 26 - letters) <= best`. Weak: enumerating all 2^n subsets at n = 60, comparing sets of strings instead of masks, sorting labels by length for pruning and silently breaking the tie-break, using `>=` when updating the best, or forgetting that duplicates of a label multiply the search.',
  offline: {
    approach: 'Map each label to a bitmask of its letters (skip labels with a repeated letter). Backtrack over the labels in input order: at each index try **including** it if its mask does not overlap the used mask, then try skipping it. Keep the best total and the chosen indices, updating only on a strictly larger total. For 60 labels, collapse identical masks to their first occurrence and prune branches that cannot beat the best.',
    hints: [
      'A label is usable only if `mask & bit` is never already set while building its mask.',
      'Include-before-exclude, in input order, visits selections in exactly the order the tie-break wants, so the first optimum found is the answer.',
      'Duplicates and anagrams share a mask. Keep only the first label for each mask: any selection using a later copy loses the tie-break to the same selection using the earlier copy.',
      'Upper bound: `letters + Math.min(sum of remaining sizes, 26 - letters)`. If that is `<= best`, return.',
    ],
    edge: [
      'Labels such as `"noon"` with a repeated letter.',
      'The same label listed many times.',
      'A tie between one long label and two short ones.',
      'No usable labels at all (`letters: 0, tags: []`).',
    ],
    complexity: 'Worst case is still exponential, **O(2^m)** for m distinct masks, but at most 26 letters can be used, dedupe caps m, and bound pruning cuts most branches. Building masks is **O(total characters)**. Without dedupe, k copies of a mask multiply the search by about (k + 1) per mask.',
    skeleton: `function pickTags(words) {
  const firstIndex = new Map(); // mask -> earliest index with that mask
  for (let i = 0; i < words.length; i++) {
    let mask = 0, ok = true;
    // TODO: build mask, ok = false on a repeated letter
    if (ok && !firstIndex.has(mask)) firstIndex.set(mask, i);
  }
  const masks = [...firstIndex.keys()], index = [...firstIndex.values()];

  let best = 0, bestPick = [];
  const pick = [];
  const dfs = (i, used, letters) => {
    // TODO: record strict improvements, prune, include then exclude
  };
  dfs(0, 0, 0);
  return { letters: best, tags: bestPick.map(i => words[i]) };
}`,
  },
  solution: `/**
 * Backtracking over letter masks, in input order.
 * Include-before-exclude visits selections in tie-break order, so the first
 * optimum found (strict improvement only) is the one to return.
 */
function pickTags(words) {
  // One entry per distinct letter set, keeping the earliest label that has it.
  const firstIndex = new Map(); // mask -> index in words
  for (let i = 0; i < words.length; i++) {
    let mask = 0, ok = words[i].length > 0;
    for (const ch of words[i]) {
      const bit = 1 << (ch.charCodeAt(0) - 97);
      if (mask & bit) { ok = false; break; }
      mask |= bit;
    }
    if (ok && !firstIndex.has(mask)) firstIndex.set(mask, i);
  }

  // Map keeps insertion order, so these stay sorted by first index.
  const masks = [...firstIndex.keys()];
  const index = [...firstIndex.values()];
  const size = index.map(i => words[i].length);
  const n = masks.length;

  // remaining[i] = letters in masks i..n-1, for the upper bound
  const remaining = new Array(n + 1).fill(0);
  for (let i = n - 1; i >= 0; i--) remaining[i] = remaining[i + 1] + size[i];

  let best = 0, bestPick = [];
  const pick = [];

  const dfs = (i, used, letters) => {
    if (letters > best) {
      best = letters;
      bestPick = pick.slice();
    }
    if (i === n) return;
    // Even taking everything left (capped at 26 letters) cannot win.
    if (letters + Math.min(remaining[i], 26 - letters) <= best) return;

    if ((used & masks[i]) === 0) {
      pick.push(index[i]);
      dfs(i + 1, used | masks[i], letters + size[i]);
      pick.pop();
    }
    dfs(i + 1, used, letters);
  };

  dfs(0, 0, 0);
  return { letters: best, tags: bestPick.map(i => words[i]) };
}
`,
});
