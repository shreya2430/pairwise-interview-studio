PROBLEMS.push({
  id: 'coverage-ranges',
  title: 'Track uploaded byte ranges',
  team: 'Storage',
  level: 'Senior',
  difficulty: 'Medium',
  minutes: 45,
  focus: ['Intervals', 'Binary search', 'Data structures'],
  format: 'Classic interval data structure with escalating follow-ups, as reported in AI-assisted coding rounds in 2025–26: a working core, then mutation, then query speed.',
  scenario: 'Large video files reach the storage service as resumable uploads. Clients send chunks in any order, retry chunks after timeouts, and the server sometimes discards chunks that fail a checksum. The upload service needs to know exactly which bytes it holds.',
  body: `
<p>Implement <code>RangeSet</code>, a set of integer offsets stored as half-open ranges <code>[start, end)</code>. The range <code>[10, 20)</code> covers offsets 10 to 19.</p>
<ul>
<li>Ranges that overlap or touch are stored as one range: <code>[0, 10)</code> and <code>[10, 20)</code> become <code>[0, 20)</code>.</li>
<li>A call with <code>start &gt;= end</code> is a malformed request and must leave the set unchanged.</li>
<li>Adding a range that is already covered (a retried chunk) changes nothing.</li>
</ul>
<p>Each part adds methods. The starter already declares all of them.</p>`,
  examples: `const s = new RangeSet();
s.add(0, 10);
s.add(20, 30);
s.add(10, 15);
s.ranges();     // [[0, 15], [20, 30]]
s.remove(5, 25);
s.ranges();     // [[0, 5], [25, 30]]
s.covered();    // 10
s.contains(25); // true
s.nextGap(25);  // 30`,
  constraints: ['0 ≤ start, end ≤ 2 × 10⁹, integers', 'Up to 10⁵ stored ranges and 10⁵ queries per test', 'contains and nextGap should be O(log n)'],
  starter: `class RangeSet {
  constructor() {
    // TODO
  }

  /** Cover [start, end). */
  add(start, end) {
    // TODO
  }

  /** @returns {number[][]} sorted, merged [start, end) pairs */
  ranges() {
    // TODO
  }

  /** Uncover [start, end). */
  remove(start, end) {
    // TODO
  }

  /** @returns {number} total number of covered offsets */
  covered() {
    // TODO
  }

  /** @returns {boolean} */
  contains(point) {
    // TODO
  }

  /** @returns {number} smallest uncovered offset >= from */
  nextGap(from) {
    // TODO
  }
}
`,
  parts: [
    {
      title: 'Part 1: Add and list ranges',
      body: `
<p>Implement <code>add(start, end)</code> and <code>ranges()</code>. <code>ranges()</code> returns the merged ranges sorted by start, as a new array of <code>[start, end]</code> pairs that the caller may modify freely.</p>`,
      tests: [
        { name: 'Separate ranges stay separate', src: `const s = new RangeSet(); s.add(20, 30); s.add(0, 10);
return [s.ranges(), [[0, 10], [20, 30]]];` },
        { name: 'Overlapping ranges merge', src: `const s = new RangeSet(); s.add(0, 10); s.add(5, 15);
return [s.ranges(), [[0, 15]]];` },
        { name: 'Touching ranges merge', src: `const s = new RangeSet(); s.add(0, 10); s.add(10, 20);
return [s.ranges(), [[0, 20]]];` },
        { name: 'One chunk bridges several ranges', src: `const s = new RangeSet(); s.add(50, 60); s.add(0, 5); s.add(20, 30); s.add(4, 21);
return [s.ranges(), [[0, 30], [50, 60]]];` },
      ],
      hidden: [
        { name: 'Retried chunk changes nothing', src: `const s = new RangeSet(); s.add(0, 100); s.add(10, 20); s.add(0, 100);
return [s.ranges(), [[0, 100]]];` },
        { name: 'Malformed adds are ignored', src: `const s = new RangeSet(); s.add(5, 5); s.add(9, 3); s.add(1, 2);
return [s.ranges(), [[1, 2]]];` },
        { name: 'ranges() returns a copy', src: `const s = new RangeSet(); s.add(0, 10);
const r = s.ranges(); r[0][0] = 99; r.push([200, 300]);
return [s.ranges(), [[0, 10]]];` },
        { name: 'A wide range swallows many', src: `const s = new RangeSet(); for (let i = 0; i < 50; i++) s.add(i * 10, i * 10 + 3); s.add(0, 1000); s.add(2000, 2001);
return [s.ranges(), [[0, 1000], [2000, 2001]]];` },
      ],
    },
    {
      title: 'Part 2: Discard chunks and measure coverage',
      body: `
<p>A chunk that fails its checksum is discarded. Implement <code>remove(start, end)</code>, which uncovers <code>[start, end)</code> and may split a range in two, and <code>covered()</code>, the total number of covered offsets. Removing space that is not covered does nothing, and malformed calls are ignored.</p>
<p>The progress bar calls <code>covered()</code> often, so it should not walk every range each time.</p>`,
      tests: [
        { name: 'Remove splits a range', src: `const s = new RangeSet(); s.add(0, 100); s.remove(40, 60);
return [[s.ranges(), s.covered()], [[[0, 40], [60, 100]], 80]];` },
        { name: 'Remove across several ranges', src: `const s = new RangeSet(); s.add(0, 10); s.add(20, 30); s.add(40, 50); s.remove(5, 45);
return [[s.ranges(), s.covered()], [[[0, 5], [45, 50]], 10]];` },
        { name: 'covered counts merged offsets once', src: `const s = new RangeSet(); s.add(0, 10); s.add(5, 15); s.add(15, 20);
return [s.covered(), 20];` },
        { name: 'Removing uncovered space is a no-op', src: `const s = new RangeSet(); s.add(10, 20); s.remove(0, 10); s.remove(20, 30);
return [[s.ranges(), s.covered()], [[[10, 20]], 10]];` },
      ],
      hidden: [
        { name: 'Remove exactly one whole range', src: `const s = new RangeSet(); s.add(0, 10); s.add(20, 30); s.add(40, 50); s.remove(20, 30);
return [[s.ranges(), s.covered()], [[[0, 10], [40, 50]], 20]];` },
        { name: 'Re-uploading fills the hole', src: `const s = new RangeSet(); s.add(0, 100); s.remove(30, 70); s.add(30, 70);
return [[s.ranges(), s.covered()], [[[0, 100]], 100]];` },
        { name: 'Malformed removes are ignored', src: `const s = new RangeSet(); s.add(0, 10); s.remove(8, 2); s.remove(5, 5);
return [[s.ranges(), s.covered()], [[[0, 10]], 10]];` },
        { name: 'Remove everything', src: `const s = new RangeSet(); s.add(3, 9); s.add(12, 40); s.remove(0, 1000);
return [[s.ranges(), s.covered()], [[], 0]];` },
      ],
    },
    {
      title: 'Part 3: Fast queries',
      body: `
<p>The resume endpoint asks two questions, many times per second:</p>
<ul>
<li><code>contains(point)</code>: is this offset already stored?</li>
<li><code>nextGap(from)</code>: the smallest offset <code>&gt;= from</code> that is not stored. That is where the client should resume sending.</li>
</ul>
<p>Files can hold 10⁵ separate ranges, and both queries must be fast at that size.</p>`,
      tests: [
        { name: 'contains respects half-open ends', src: `const s = new RangeSet(); s.add(10, 20);
return [[9, 10, 19, 20].map(p => s.contains(p)), [false, true, true, false]];` },
        { name: 'nextGap jumps to the end of a covered run', src: `const s = new RangeSet(); s.add(0, 10); s.add(10, 20); s.add(25, 30);
return [[s.nextGap(0), s.nextGap(20), s.nextGap(27), s.nextGap(100)], [20, 20, 30, 100]];` },
        { name: '10k ranges, 100k queries', src: `let seed = 5; const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
const t = performance.now();
const s = new RangeSet(); let pos = 0;
for (let i = 0; i < 10000; i++) { pos += Math.floor(rnd() * 4); const len = 1 + Math.floor(rnd() * 20); s.add(pos, pos + len); pos += len; }
let hits = 0, gaps = 0;
for (let q = 0; q < 100000; q++) { const p = Math.floor(rnd() * (pos + 50)); if (s.contains(p)) hits++; gaps += s.nextGap(p) - p; }
const ms = performance.now() - t;
return [[hits, gaps, s.ranges().length, s.covered(), ms < 1000], [87375, 947828, 7411, 103760, true]];` },
      ],
      hidden: [
        { name: 'Queries after a split', src: `const s = new RangeSet(); s.add(0, 100); s.remove(40, 60);
return [[s.contains(39), s.contains(40), s.contains(60), s.nextGap(10), s.nextGap(45), s.nextGap(60)], [true, false, true, 40, 45, 100]];` },
        { name: 'Queries on an empty set', src: `const s = new RangeSet();
return [[s.contains(0), s.nextGap(7)], [false, 7]];` },
        { name: '100k ranges, 100k queries', src: `let seed = 6; const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
const s = new RangeSet(); let pos = 0;
for (let i = 0; i < 100000; i++) { pos += Math.floor(rnd() * 4); const len = 1 + Math.floor(rnd() * 20); s.add(pos, pos + len); pos += len; }
let hits = 0, gaps = 0;
for (let q = 0; q < 100000; q++) { const p = Math.floor(rnd() * (pos + 50)); if (s.contains(p)) hits++; gaps += s.nextGap(p) - p; }
return [[hits, gaps, s.ranges().length, s.covered()], [87543, 969696, 74089, 1044555]];` },
        { name: 'Chunks arriving out of order', src: `let seed = 9; const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
const n = 20000, chunks = [];
for (let i = 0; i < n; i++) chunks.push(i);
for (let i = n - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [chunks[i], chunks[j]] = [chunks[j], chunks[i]]; }
const s = new RangeSet(), out = [];
for (let k = 0; k < n; k++) { const c = chunks[k]; if (c % 7 !== 3) s.add(c * 64, c * 64 + 64); if (k === n / 2) out.push(s.ranges().length, s.covered()); }
out.push(s.ranges().length, s.covered(), s.nextGap(0), s.contains(3 * 64), s.contains(3 * 64 - 1));
return [out, [4992, 549056, 2858, 1097152, 192, false, true]];` },
        { name: 'Queries after many removals', src: `let seed = 13; const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
const s = new RangeSet(); let pos = 0;
for (let i = 0; i < 50000; i++) { pos += Math.floor(rnd() * 4); const len = 1 + Math.floor(rnd() * 20); s.add(pos, pos + len); pos += len; }
for (let i = 0; i < 5000; i++) { const a = Math.floor(rnd() * pos); s.remove(a, a + 1 + Math.floor(rnd() * 30)); }
let hits = 0, gaps = 0;
for (let q = 0; q < 50000; q++) { const p = Math.floor(rnd() * (pos + 50)); if (s.contains(p)) hits++; gaps += s.nextGap(p) - p; }
return [[hits, gaps, s.ranges().length, s.covered()], [32580, 335159, 36090, 459208]];` },
      ],
    },
  ],
  followUps: [
    'Inserts now arrive in random order at 10⁶ ranges. Sorted arrays with splice become O(n) per add. What structure do you switch to?',
    'The upload service restarts. How do you persist the set so a crash between writing a chunk and recording it cannot claim bytes you do not have?',
    'Two workers write chunks of the same file at once. How do you keep the set consistent, and is add idempotent enough to make retries safe?',
  ],
  rubric: 'Strong: keeps disjoint, non-touching ranges sorted by start (two parallel arrays or an array of pairs); add binary-searches the first range with end >= start, absorbs every range with start <= end, and splices once; remove trims or splits only the overlapping run; keeps a running covered total updated in add and remove; contains and nextGap binary-search the first range with end > point; ranges() returns fresh pairs. Mentions a balanced tree or skip list when inserts are random at scale. Weak: re-sorting the whole list on every add, merging only overlapping and not touching ranges, off-by-one on half-open ends (contains(end) true), recomputing covered by walking every range, linear scans in contains/nextGap, returning internal arrays.',
  offline: {
    approach: 'Keep the ranges disjoint, non-touching and sorted by start. Then every operation starts with one binary search: find the first range whose end is at or after the position you care about. `add` merges the run of ranges that overlap or touch `[start, end)`, `remove` trims the run that overlaps it, and queries look at a single range.',
    hints: [
      'Merge condition for add: an existing `[a, b)` joins the new range when `b >= start && a <= end` (touching counts).',
      'Remove is the same scan with strict inequalities: `[a, b)` is affected when `b > start && a < end`. Keep `[a, start)` and `[end, b)` if non-empty.',
      'Track `total` as you go: subtract the lengths of ranges you absorb or cut, add the length of what you insert.',
      'For `contains(p)` and `nextGap(p)`, binary-search the first range with `end > p`. If its start is `<= p`, `p` is covered and the gap starts at that range\'s end.',
    ],
    edge: [
      'Ranges that touch exactly (`[0, 10)` then `[10, 20)`).',
      '`contains(end)` on a half-open range (false).',
      'A remove that starts or ends exactly on a range boundary.',
      'Malformed calls with `start >= end`.',
      'A caller mutating the array returned by `ranges()`.',
    ],
    complexity: '`contains`, `nextGap` and `covered` are **O(log n)**, **O(log n)** and **O(1)**. `add` and `remove` are **O(log n + k)** to find and merge k ranges, plus O(n) for the array splice; a balanced tree makes that **O(log n)** when inserts land in the middle. `ranges()` is **O(n)**.',
    skeleton: `class RangeSet {
  constructor() {
    this.starts = []; // sorted, disjoint, non-touching
    this.ends = [];
    this.total = 0;
  }

  // first index i with ends[i] >= x
  _lowerEnd(x) {
    let lo = 0, hi = this.ends.length;
    // TODO: binary search
    return lo;
  }

  add(start, end) {
    if (!(start < end)) return;
    const i = this._lowerEnd(start);
    // TODO: absorb ranges i.. while starts[j] <= end, splice once, update total
  }

  remove(start, end) { /* TODO */ }
  ranges() { return this.starts.map((s, i) => [s, this.ends[i]]); }
  covered() { return this.total; }
  contains(point) { /* TODO */ }
  nextGap(from) { /* TODO */ }
}`,
  },
  solution: `/**
 * Disjoint, non-touching ranges kept sorted in two parallel arrays:
 * range i is [starts[i], ends[i]). Every operation starts with a binary search.
 */
class RangeSet {
  constructor() {
    this.starts = [];
    this.ends = [];
    this.total = 0; // covered offsets, kept up to date by add and remove
  }

  // Index of the first range whose end is >= x.
  _firstEndAtOrAfter(x) {
    let lo = 0, hi = this.ends.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (this.ends[mid] < x) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  }

  add(start, end) {
    if (!(start < end)) return; // malformed
    // Ranges i..j-1 overlap or touch [start, end) and get absorbed.
    const i = this._firstEndAtOrAfter(start);
    let j = i, newStart = start, newEnd = end, absorbed = 0;
    while (j < this.starts.length && this.starts[j] <= end) {
      newStart = Math.min(newStart, this.starts[j]);
      newEnd = Math.max(newEnd, this.ends[j]);
      absorbed += this.ends[j] - this.starts[j];
      j++;
    }
    this.starts.splice(i, j - i, newStart);
    this.ends.splice(i, j - i, newEnd);
    this.total += newEnd - newStart - absorbed;
  }

  remove(start, end) {
    if (!(start < end)) return; // malformed
    let i = this._firstEndAtOrAfter(start);
    if (i < this.ends.length && this.ends[i] === start) i++; // touches only, no overlap

    const keptStarts = [], keptEnds = [];
    let j = i;
    while (j < this.starts.length && this.starts[j] < end) {
      const s = this.starts[j], e = this.ends[j];
      this.total -= e - s;
      if (s < start) { keptStarts.push(s); keptEnds.push(start); this.total += start - s; }
      if (e > end) { keptStarts.push(end); keptEnds.push(e); this.total += e - end; }
      j++;
    }
    this.starts.splice(i, j - i, ...keptStarts);
    this.ends.splice(i, j - i, ...keptEnds);
  }

  ranges() {
    return this.starts.map((s, i) => [s, this.ends[i]]);
  }

  covered() {
    return this.total;
  }

  contains(point) {
    const i = this._firstEndAtOrAfter(point + 1); // first range with end > point
    return i < this.starts.length && this.starts[i] <= point;
  }

  nextGap(from) {
    const i = this._firstEndAtOrAfter(from + 1);
    // Ranges never touch, so the end of a covering range is always uncovered.
    if (i < this.starts.length && this.starts[i] <= from) return this.ends[i];
    return from;
  }
}
`,
});
