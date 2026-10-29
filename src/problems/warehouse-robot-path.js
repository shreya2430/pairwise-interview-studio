PROBLEMS.push({
  id: 'warehouse-robot-path',
  title: 'Route a picking robot through locked aisles',
  team: 'Fulfillment Robotics',
  level: 'Senior',
  difficulty: 'Hard',
  minutes: 60,
  focus: ['Graph search', 'State encoding', 'Debugging'],
  format: 'Staged like Meta\'s AI-enabled coding round (reported 2025–26): fix a bug in existing code, build the feature on top of it, then make it fast.',
  scenario: 'Picking robots at the Reno fulfillment center drive a grid of shelving aisles to reach the charging dock. Some aisles are behind badge-locked gates, and a robot has to pick up the matching badge before a gate opens for it.',
  body: `
<p>You own <code>shortestRoute(map)</code>. <code>map</code> is an array of equal-length strings, one per row of the floor:</p>
<ul>
<li><code>#</code> is a shelf (impassable), <code>.</code> is open floor.</li>
<li><code>@</code> is where the robot starts, <code>*</code> is the charging dock. Both are open floor.</li>
<li>Lowercase <code>a</code>–<code>f</code> are badges, uppercase <code>A</code>–<code>F</code> are gates.</li>
</ul>
<p>The robot moves one cell up, down, left or right per step and cannot leave the map. Return the fewest steps from <code>@</code> to <code>*</code>, or <code>-1</code> if the dock cannot be reached or the map has no robot.</p>`,
  examples: `shortestRoute([
  "@..#",
  ".#..",
  "...*",
]);
// 5

shortestRoute(["@aA*"]);   // 3, pick up badge a, then gate A opens
shortestRoute(["@.A*"]);   // -1, there is no badge a`,
  constraints: ['1 ≤ rows, cols ≤ 400', 'At most 6 badge types (a–f); a gate letter may have no badge on the map', 'Up to 400 × 400 × 64 search states'],
  starter: `/**
 * Fewest steps from '@' to '*', or -1.
 * @param {string[]} map  rows of '#', '.', '@', '*', 'a'-'f', 'A'-'F'
 * @returns {number}
 */
function shortestRoute(map) {
  const rows = map.length, cols = map[0].length;
  let start = null;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (map[r][c] === '@') start = [r, c];
    }
  }
  if (!start) return -1;

  const seen = new Set([start[0] + ',' + start[1]]);
  const queue = [[start[0], start[1], 0]];
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  let head = 0;
  while (head < queue.length) {
    const [r, c, steps] = queue[head++];
    if (map[r][c] === '*') return steps;
    for (const [dr, dc] of dirs) {
      const nr = r + dr, nc = c + dc;
      if (nr < 0 || nr >= rows || nc < 0 || nc > cols) continue;
      if (map[nr][nc] === '#') continue;
      const key = nr + ',' + nc;
      if (seen.has(key)) continue;
      seen.add(key);
      queue.push([nr, nc, steps + 1]);
    }
  }
  return -1;
}
`,
  parts: [
    {
      title: 'Part 1: Fix the route planner',
      body: `
<p>The editor holds the planner that is running on the floor today. Maps so far have no badges or gates. Floor ops filed two reports: on some maps the planner returns a route shorter than any route a robot can actually drive, and on others it finds a route to a dock that is sealed off by shelving.</p>
<p>Find the bug and fix it. Treat badges and gates as open floor for now.</p>`,
      tests: [
        { name: 'Straight corridor', src: `return [shortestRoute(['@...*']), 4];` },
        { name: 'Walled maze', src: `return [shortestRoute([
  '#######',
  '#@..#.#',
  '#.#.#*#',
  '#.#...#',
  '#######',
]), 7];` },
        { name: 'Shelving on the east side forces the long way', src: `return [shortestRoute([
  '....@',
  '.####',
  '....*',
]), 10];` },
        { name: 'A full-width shelf row blocks the dock', src: `return [shortestRoute([
  '@....',
  '#####',
  '....*',
]), -1];` },
      ],
      hidden: [
        { name: 'Map without a robot', src: `return [shortestRoute(['..#', '.*.']), -1];` },
        { name: 'Single-column map', src: `return [[shortestRoute(['@', '#', '*']), shortestRoute(['@', '.', '*'])], [-1, 2]];` },
        { name: 'Dock sealed in the middle', src: `return [shortestRoute([
  '@....',
  '..#..',
  '.#*#.',
  '..#..',
]), -1];` },
        { name: 'Serpentine aisles', src: `const m = [];
for (let r = 0; r < 9; r++) {
  if (r % 2 === 0) m.push('..........');
  else m.push(r % 4 === 1 ? '#########.' : '.#########');
}
m[0] = '@' + m[0].slice(1);
m[8] = m[8].slice(0, 9) + '*';
return [shortestRoute(m), 53];` },
      ],
    },
    {
      title: 'Part 2: Badges and gates',
      body: `
<p>The floor now has badge-locked gates. Extend <code>shortestRoute</code>:</p>
<ul>
<li>Stepping onto a badge cell picks the badge up. The robot keeps every badge it collects, and badges are never used up.</li>
<li>A robot may enter gate <code>X</code> only while it holds badge <code>x</code>. Without it, the gate is a wall.</li>
<li>A gate whose badge is nowhere on the map never opens.</li>
</ul>
<p>The robot may need to walk back over cells it already visited once it holds a new badge. Part 1 tests must keep passing.</p>`,
      tests: [
        { name: 'Locked gate needs its badge', src: `return [[shortestRoute(['@aA*']), shortestRoute(['@.A*'])], [3, -1]];` },
        { name: 'Badge behind the robot', src: `return [shortestRoute(['a.@.A.*']), 8];` },
        { name: 'Two badges in the cheaper order', src: `return [shortestRoute(['b..@a.AB*']), 11];` },
        { name: 'Locked gate with an open way around', src: `return [shortestRoute([
  '@.A.*',
  '.###.',
  '.....',
]), 8];` },
      ],
      hidden: [
        { name: 'Gate with no badge on the map stays shut', src: `return [shortestRoute(['@.C.*', '#####']), -1];` },
        { name: 'Short route through a gate beats the long way', src: `return [shortestRoute([
  '@.A.*',
  'a###.',
  '.....',
]), 6];` },
        { name: 'Picking up the same badge twice', src: `return [shortestRoute(['@aaA*']), 4];` },
        { name: 'Badges in separate rooms', src: `return [shortestRoute([
  '#########',
  '#b.A..@.#',
  '#####.###',
  '#a....B*#',
  '#########',
]), 25];` },
        { name: 'Detour into a side room for a badge', src: `return [shortestRoute([
  '##########',
  '#@...#..b#',
  '#.##.A.###',
  '#a##.#...#',
  '######B#*#',
  '#....c..C#',
  '##########',
]), 14];` },
      ],
    },
    {
      title: 'Part 3: Full-size floor maps',
      body: `
<p>The real floor maps are up to 400 × 400 cells with all six badge types. The planner runs before every dispatch, and it must answer a 300 × 300 map with five badges in well under a second.</p>
<p>Keep the behaviour from parts 1 and 2. Think about how you represent a search state and how much work each visited state costs.</p>`,
      tests: [
        { name: '300 x 300 floor with five badges', src: `const build = (n, badges, seed) => {
  const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  const g = [];
  for (let r = 0; r < n; r++) { const row = []; for (let c = 0; c < n; c++) row.push(rnd() < 0.2 ? '#' : '.'); g.push(row); }
  g[0][0] = '@';
  for (let k = 0; k < badges; k++) g[1 + Math.floor(rnd() * (n - 3))][Math.floor(rnd() * n)] = String.fromCharCode(97 + k);
  for (let k = 0; k <= badges; k++) g[n - 2][n - 1 - k] = '#';
  for (let k = 0; k < badges; k++) g[n - 1][n - 1 - badges + k] = String.fromCharCode(65 + k);
  g[n - 1][n - 1] = '*';
  g[n - 1][n - 2 - badges] = '.';
  return g.map(r => r.join(''));
};
const m = build(300, 5, 42);
const t = performance.now(); const r = shortestRoute(m); const ms = performance.now() - t;
return [[r, ms < 1000], [882, true]];` },
      ],
      hidden: [
        { name: '400 x 400 floor with six badges', src: `const build = (n, badges, seed) => {
  const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  const g = [];
  for (let r = 0; r < n; r++) { const row = []; for (let c = 0; c < n; c++) row.push(rnd() < 0.2 ? '#' : '.'); g.push(row); }
  g[0][0] = '@';
  for (let k = 0; k < badges; k++) g[1 + Math.floor(rnd() * (n - 3))][Math.floor(rnd() * n)] = String.fromCharCode(97 + k);
  for (let k = 0; k <= badges; k++) g[n - 2][n - 1 - k] = '#';
  for (let k = 0; k < badges; k++) g[n - 1][n - 1 - badges + k] = String.fromCharCode(65 + k);
  g[n - 1][n - 1] = '*';
  g[n - 1][n - 2 - badges] = '.';
  return g.map(r => r.join(''));
};
return [shortestRoute(build(400, 6, 42)), 1106];` },
        { name: 'Large floor where the dock is out of reach', src: `const build = (n, badges, seed) => {
  const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  const g = [];
  for (let r = 0; r < n; r++) { const row = []; for (let c = 0; c < n; c++) row.push(rnd() < 0.2 ? '#' : '.'); g.push(row); }
  g[0][0] = '@';
  for (let k = 0; k < badges; k++) g[1 + Math.floor(rnd() * (n - 3))][Math.floor(rnd() * n)] = String.fromCharCode(97 + k);
  for (let k = 0; k <= badges; k++) g[n - 2][n - 1 - k] = '#';
  for (let k = 0; k < badges; k++) g[n - 1][n - 1 - badges + k] = String.fromCharCode(65 + k);
  g[n - 1][n - 1] = '*';
  g[n - 1][n - 2 - badges] = '.';
  return g.map(r => r.join(''));
};
return [shortestRoute(build(300, 4, 42)), -1];` },
        { name: 'Open 200 x 200 floor, no badges', src: `const m = [];
for (let r = 0; r < 200; r++) m.push('.'.repeat(200));
m[0] = '@' + m[0].slice(1);
m[199] = m[199].slice(0, 199) + '*';
return [shortestRoute(m), 398];` },
      ],
    },
  ],
  followUps: [
    'Forty robots plan at once on the same map. What do you precompute and share, and what stays per robot?',
    'A shelf gets knocked over mid-shift and a cell becomes a wall. How do you replan without searching from scratch every time?',
    'Some aisles are slower (one-way, or half speed). What replaces BFS, and what happens to your state encoding?',
  ],
  rubric: 'Strong: spots the `nc > cols` bounds check (reading `map[r][cols]` gives `undefined`, which is not `#`, so the robot drives a phantom column off the east edge) and explains the symptom; turns the visited set into (row, col, badgeMask) and only blocks a gate when its bit is missing; picks up badges on entry with `mask | bit`; encodes state as one integer `(r * cols + c) * 2^k + mask` with a `Uint8Array` visited array and an index-based queue, and sizes k from the badges that exist. Weak: patches the symptom with a border of walls, marks cells visited without the mask (so it cannot walk back after a pickup), string keys with array copies per state, `queue.shift()` on a million-entry queue, or treating a gate with no badge as open.',
  offline: {
    approach: 'Breadth-first search, where a state is not just a cell but **(row, col, badges held)**. The badge set fits in a 6-bit mask, so every state is one integer. Fix the bounds check first, then widen the visited set to include the mask, then replace string keys with a typed array indexed by the encoded state.',
    hints: [
      'Part 1: look at every comparison in the bounds check. What does `map[r][c]` return when `c` is just past the end of the row?',
      'Part 2: the same cell can be worth visiting again once you hold a new badge, so the visited set must be keyed by `(r, c, mask)`.',
      'Gate check: `if (ch >= "A" && ch <= "F" && !(mask & (1 << (ch.charCodeAt(0) - 65)))) continue;`',
      'Part 3: encode `state = (r * cols + c) * (1 << k) + mask`, keep `seen` as a `Uint8Array`, and use an `Int32Array` queue with a head index. No strings, no object allocation per state.',
    ],
    edge: [
      'Open floor along the east edge (the original bug).',
      'A gate whose badge does not exist anywhere.',
      'A badge that sits behind the robot, so it has to double back.',
      'The dock unreachable on a large map, so the whole state space is explored.',
      'A map with no `@`.',
    ],
    complexity: 'Each state `(cell, mask)` is visited once: **O(R · C · 2^k)** time and space, with k ≤ 6 badge types. At 400 × 400 × 64 that is about 10⁷ states, so per-state cost matters: one typed-array read and write, not a string build and hash.',
    skeleton: `function shortestRoute(map) {
  const rows = map.length, cols = map[0].length;
  // TODO: find '@', and k = number of badge types on the map
  const masks = 1 << k;
  const seen = new Uint8Array(rows * cols * masks);
  const queue = new Int32Array(rows * cols * masks);
  let head = 0, tail = 0;
  // TODO: push the start state (startCell * masks + 0)

  for (let steps = 0; head < tail; steps++) {
    const levelEnd = tail;
    while (head < levelEnd) {
      const state = queue[head++];
      const mask = state % masks, cell = (state - mask) / masks;
      // TODO: dock check, then 4 neighbours: bounds, shelves, gates, badges
    }
  }
  return -1;
}`,
  },
  solution: `/**
 * BFS over (cell, badges held). A state is one integer:
 *   state = (row * cols + col) * 2^k + mask
 * where k is the number of badge types on the map.
 */
function shortestRoute(map) {
  if (!Array.isArray(map) || map.length === 0) return -1;
  const rows = map.length, cols = map[0].length;

  let start = -1, k = 0;
  for (let r = 0; r < rows; r++) {
    if (map[r].length !== cols) return -1; // malformed map
    for (let c = 0; c < cols; c++) {
      const ch = map[r][c];
      if (ch === '@') start = r * cols + c;
      else if (ch >= 'a' && ch <= 'f') k = Math.max(k, ch.charCodeAt(0) - 96);
    }
  }
  if (start < 0) return -1;

  const masks = 1 << k;
  const total = rows * cols * masks;
  const seen = new Uint8Array(total);
  const queue = new Int32Array(total); // each state is queued at most once
  let head = 0, tail = 0;
  seen[start * masks] = 1;
  queue[tail++] = start * masks;

  const dr = [1, -1, 0, 0], dc = [0, 0, 1, -1];
  for (let steps = 0; head < tail; steps++) {
    const levelEnd = tail;
    while (head < levelEnd) {
      const state = queue[head++];
      const mask = state % masks;
      const cell = (state - mask) / masks;
      const r = Math.floor(cell / cols), c = cell % cols;
      if (map[r][c] === '*') return steps;

      for (let d = 0; d < 4; d++) {
        const nr = r + dr[d], nc = c + dc[d];
        if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
        const ch = map[nr][nc];
        if (ch === '#') continue;

        let nextMask = mask;
        if (ch >= 'A' && ch <= 'F') {
          // Locked unless we hold the badge (a badge type beyond k never exists).
          if (!(mask & (1 << (ch.charCodeAt(0) - 65)))) continue;
        } else if (ch >= 'a' && ch <= 'f') {
          nextMask = mask | (1 << (ch.charCodeAt(0) - 97));
        }

        const next = (nr * cols + nc) * masks + nextMask;
        if (seen[next]) continue;
        seen[next] = 1;
        queue[tail++] = next;
      }
    }
  }
  return -1;
}
`,
});
