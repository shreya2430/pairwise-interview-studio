PROBLEMS.push({
  id: 'ring-route-distance',
  title: 'Shuttle loop route distance',
  team: 'Campus Mobility',
  level: 'New grad',
  difficulty: 'Easy',
  minutes: 30,
  focus: ['Arrays', 'Prefix sums'],
  format: 'Modeled on a new-grad online assessment with an AI assistant allowed (reported July 2026): get a brute force right on small inputs, then rewrite it to pass a timed large test.',
  scenario: 'The campus shuttle runs on a closed loop and can drive in either direction. Dispatch wants to know how far a shuttle travels for a list of pickups so it can plan charging stops.',
  body: `
<p>Write <code>routeDistance(gaps, stops)</code>. There are <code>n = gaps.length</code> stations on a loop, numbered <code>0</code> to <code>n - 1</code>.</p>
<ul>
<li><code>gaps[i]</code> is the distance from station <code>i</code> to station <code>i + 1</code>. The last gap, <code>gaps[n - 1]</code>, connects station <code>n - 1</code> back to station <code>0</code>.</li>
<li>The shuttle starts at <code>stops[0]</code> and then visits <code>stops[1]</code>, <code>stops[2]</code>, and so on, in order.</li>
<li>For each leg it drives whichever way around the loop is shorter. A leg between the same station is <code>0</code>.</li>
<li>Return the total distance of all legs. With fewer than two stops the answer is <code>0</code>.</li>
</ul>`,
  examples: `routeDistance([3, 1, 4, 1, 5], [0, 2, 4]);
// 9: 0 -> 2 forward is 3 + 1 = 4, 2 -> 4 forward is 4 + 1 = 5

routeDistance([3, 1, 4, 1, 5], [0, 4]);
// 5: going backward from 0 to 4 uses only the last gap

routeDistance([3, 1, 4, 1, 5], [2]);
// 0`,
  constraints: ['1 ≤ n ≤ 2 × 10⁵', '0 ≤ gaps[i] ≤ 10⁵', 'Up to 2 × 10⁵ stops, each a valid station index', 'Totals can exceed 2³¹ but stay below Number.MAX_SAFE_INTEGER'],
  starter: `/**
 * @param {number[]} gaps   gaps[i] = distance from station i to station i + 1 (wrapping)
 * @param {number[]} stops  station indices to visit, in order
 * @returns {number} total distance, taking the shorter direction for each leg
 */
function routeDistance(gaps, stops) {
  // TODO
}
`,
  parts: [
    {
      title: 'Part 1: Get the distance right',
      body: `<p>Make <code>routeDistance</code> correct. Inputs in this part are small, so walking around the loop for each leg is fine. Think about legs that wrap past station <code>0</code> in either direction.</p>`,
      tests: [
        { name: 'Two forward legs', src: `return [routeDistance([3, 1, 4, 1, 5], [0, 2, 4]), 9];` },
        { name: 'Backward through the wrap gap', src: `return [routeDistance([3, 1, 4, 1, 5], [0, 4]), 5];` },
        { name: 'Leg from a high index to a low one', src: `return [routeDistance([3, 1, 4, 1, 5], [3, 1]), 5];` },
        { name: 'Single stop and repeated stops', src: `return [[routeDistance([2, 2], [1]), routeDistance([2, 2], [1, 1, 1]), routeDistance([7], [0, 0])], [0, 0, 0]];` },
      ],
      hidden: [
        { name: 'Both directions tie', src: `return [routeDistance([1, 1, 1, 1], [0, 2, 0]), 4];` },
        { name: 'Zero-length gaps', src: `return [routeDistance([0, 0, 6, 0], [0, 1, 2, 3, 0]), 0];` },
        { name: 'Empty stop list', src: `return [routeDistance([4, 4, 4], []), 0];` },
        { name: 'Zigzag across the loop', src: `return [routeDistance([10, 1, 1, 1, 10, 1], [0, 3, 5, 1, 4]), 37];` },
      ],
    },
    {
      title: 'Part 2: Make it fast',
      body: `<p>Real lines have up to <code>2 × 10⁵</code> stations and pickup lists just as long. Walking the loop for every leg is too slow. Answer each leg in constant time after one pass over <code>gaps</code>.</p>
<p>The visible test checks both the answer and that it finishes within one second. Totals here are larger than <code>2³¹</code>, so avoid 32-bit tricks.</p>`,
      tests: [
        { name: '35k stations, 35k stops, under a second', src: `let s = 7; const rnd = () => (s = (s * 48271) % 2147483647);
const gaps = [], stops = [];
for (let i = 0; i < 35000; i++) gaps.push(rnd() % 100001);
for (let i = 0; i < 35000; i++) stops.push(rnd() % 35000);
const t = performance.now(); const r = routeDistance(gaps, stops); const ms = performance.now() - t;
return [[r, ms < 1000], [15331544780086, true]];` },
        { name: 'Large total does not overflow', src: `const gaps = new Array(1000).fill(100000);
const stops = []; for (let i = 0; i < 2000; i++) stops.push(i % 2 === 0 ? 0 : 500);
return [routeDistance(gaps, stops), 99950000000];` },
      ],
      hidden: [
        { name: '200k stations, 200k stops', src: `let s = 99; const rnd = () => (s = (s * 48271) % 2147483647);
const gaps = [], stops = [];
for (let i = 0; i < 200000; i++) gaps.push(rnd() % 100001);
for (let i = 0; i < 200000; i++) stops.push(rnd() % 200000);
return [routeDistance(gaps, stops), 498934805734426];` },
        { name: 'Many tiny legs on a huge loop', src: `const gaps = new Array(200000).fill(3);
const stops = []; for (let i = 0; i < 200000; i++) stops.push((i * 199999) % 200000);
return [routeDistance(gaps, stops), 599997];` },
      ],
    },
  ],
  followUps: ['Gaps change while the shuttle runs (road works). How do you keep leg queries fast with updates?', 'Some segments are one-way. What changes?', 'Dispatch asks for the distance of a sub-range of the stop list many times. How would you answer each in O(1)?'],
  rubric: 'Strong: one prefix-sum array of length n + 1 and the loop length; forward distance = prefix[b] - prefix[a] (or loop minus that when b < a); leg = min(forward, loop - forward); O(n + m) total; notes that doubles are exact up to 2^53 and avoids Int32Array or |0. Weak: walking the loop per leg (O(n·m)), modulo bugs on the wrap, forgetting the backward direction, returning undefined for 0 or 1 stops.',
  offline: {
    approach: 'Build `prefix` where `prefix[i]` is the distance from station `0` to station `i` going forward, plus the full loop length. The forward distance from `a` to `b` is `prefix[b] - prefix[a]` when `a <= b`, otherwise the loop length minus `prefix[a] - prefix[b]`. Each leg is the smaller of forward and `loop - forward`.',
    hints: ['Start with the obvious walk: step forward from `a` adding gaps until you reach `b`. That alone passes Part 1 once you take `min(forward, loop - forward)`.', 'The walk sums a contiguous run of `gaps`. Which precomputed array answers "sum of a range" in O(1)?', 'Use `prefix` of length `n + 1` with `prefix[0] = 0`. When the range wraps, subtract the part you did not travel from the loop length.', 'Plain JavaScript numbers hold integers exactly up to 2^53, which covers these totals. Avoid `| 0` and typed 32-bit arrays.'],
    edge: ['Fewer than two stops (answer `0`).', 'Consecutive stops at the same station.', 'A leg from a high index to a low index that is shorter going forward through the wrap.', 'Both directions equal.', 'All gaps zero.'],
    complexity: 'Prefix sums take **O(n)** time and space, then each leg is **O(1)**, so the total is **O(n + m)**. Walking the loop per leg is **O(n · m)**, about 10¹⁰ steps at full size.',
    skeleton: `function routeDistance(gaps, stops) {
  const n = gaps.length;
  const prefix = [0];
  // TODO: prefix[i + 1] = prefix[i] + gaps[i]
  const loop = prefix[n];

  let total = 0;
  for (let i = 1; i < stops.length; i++) {
    const a = stops[i - 1], b = stops[i];
    // TODO: forward distance from a to b, then the shorter of the two directions
  }
  return total;
}`,
  },
  solution: `function routeDistance(gaps, stops) {
  const n = gaps.length;

  // prefix[i] = forward distance from station 0 to station i.
  const prefix = new Array(n + 1);
  prefix[0] = 0;
  for (let i = 0; i < n; i++) prefix[i + 1] = prefix[i] + gaps[i];
  const loop = prefix[n];

  let total = 0;
  for (let i = 1; i < stops.length; i++) {
    const a = stops[i - 1];
    const b = stops[i];
    const forward = a <= b ? prefix[b] - prefix[a] : loop - (prefix[a] - prefix[b]);
    total += Math.min(forward, loop - forward);
  }
  return total;
}
`,
});
