PROBLEMS.push({
  id: 'courier-payouts',
  title: 'Courier payout tracker',
  team: 'Courier Ops',
  level: 'Mid-level',
  difficulty: 'Medium',
  minutes: 45,
  focus: ['Object design', 'Integer money', 'Sweep line'],
  format: 'Modeled on a stateful object-design round reported in 2025–26 AI-assisted interviews: build a small tracker, then absorb new rules in each follow-up.',
  scenario: 'A grocery delivery app pays couriers by the second for time spent on trips. Finance needs the running cost and weekly settlements, and the dispatch team wants to know how many couriers were out at the busiest moment.',
  body: `
<p>Implement <code>PayoutTracker</code>. Times are integer seconds. A trip covers the half-open interval <code>[startSec, endSec)</code>.</p>
<ul>
<li>Every courier has an hourly rate in integer cents, set once by <code>addCourier</code>. Adding a courier id twice throws an <code>Error</code> whose message starts with <code>"Duplicate courier"</code>.</li>
<li><code>recordTrip</code> throws an <code>Error</code> starting with <code>"Unknown courier"</code> for an id that was never added, and one starting with <code>"Invalid trip"</code> when <code>endSec &lt;= startSec</code>.</li>
<li>A trip's cost is <code>centsPerHour × (endSec − startSec) / 3600</code>, rounded to the nearest cent on its own, with exact halves rounded up. So 1000 cents/hour for 9 seconds is 2.5, which becomes 3. Totals are sums of these per-trip integers.</li>
<li>A courier never has two trips that overlap in time.</li>
</ul>`,
  examples: `const p = new PayoutTracker();
p.addCourier("rhea", 1800);
p.addCourier("tomas", 2150);
p.recordTrip("rhea", 0, 1200);      // 600 cents
p.recordTrip("tomas", 600, 1337);   // 440.15... -> 440 cents
p.recordTrip("rhea", 1500, 2700);   // 600 cents
p.totalCost();                      // 1640

p.settle(1500);                     // 1040 (the two trips that ended by 1500)
p.unpaidCost();                     // 600

p.peakConcurrent(0, 3600);          // 2  (rhea and tomas both out during [600, 1200))
p.peakConcurrent(1337, 1500);       // 0`,
  constraints: ['Up to 10⁵ trips and 10³ couriers', '0 ≤ startSec < endSec ≤ 10⁹', '1 ≤ centsPerHour ≤ 10⁵', 'peakConcurrent should be O(n log n) or better per call'],
  starter: `class PayoutTracker {
  constructor() {
    // TODO
  }

  /** @param {string} id  @param {number} centsPerHour */
  addCourier(id, centsPerHour) {
    // TODO
  }

  /** Trip covers [startSec, endSec). */
  recordTrip(courierId, startSec, endSec) {
    // TODO
  }

  /** @returns {number} integer cents for every trip recorded so far */
  totalCost() {
    // TODO
  }

  /** Pays every unpaid trip that ended at or before untilSec. @returns {number} cents paid now */
  settle(untilSec) {
    // TODO
  }

  /** @returns {number} integer cents not yet settled */
  unpaidCost() {
    // TODO
  }

  /** @returns {number} max couriers on a trip at the same instant in [fromSec, toSec) */
  peakConcurrent(fromSec, toSec) {
    // TODO
  }
}
`,
  parts: [
    {
      title: 'Part 1: Record trips and total the cost',
      body: `
<p>Implement <code>addCourier</code>, <code>recordTrip</code> and <code>totalCost</code>.</p>
<ul>
<li><code>totalCost()</code> returns the sum, in integer cents, of every trip recorded so far.</li>
<li>Round each trip on its own before adding. Rounding the grand total once gives different answers.</li>
<li>Validate input as described above. A rejected trip must not change any total.</li>
</ul>`,
      tests: [
        { name: 'Example totals', src: `const p = new PayoutTracker();
p.addCourier('rhea', 1800); p.addCourier('tomas', 2150);
p.recordTrip('rhea', 0, 1200); p.recordTrip('tomas', 600, 1337); p.recordTrip('rhea', 1500, 2700);
return [p.totalCost(), 1640];` },
        { name: 'Each trip is rounded on its own, halves up', src: `const p = new PayoutTracker();
p.addCourier('a', 1000);
p.recordTrip('a', 0, 9); p.recordTrip('a', 100, 109);
const r = [p.totalCost()];
p.addCourier('b', 1000); p.recordTrip('b', 0, 1);
r.push(p.totalCost());
return [r, [6, 6]];` },
        { name: 'No trips costs nothing', src: `const p = new PayoutTracker(); p.addCourier('a', 2400);
return [p.totalCost(), 0];` },
        { name: 'Bad input throws and changes nothing', src: `const p = new PayoutTracker();
p.addCourier('a', 3600); p.recordTrip('a', 0, 60);
const msg = f => { try { f(); return 'no error'; } catch (e) { return e.message.split(':')[0].split(' ').slice(0, 2).join(' '); } };
return [[msg(() => p.recordTrip('ghost', 0, 10)), msg(() => p.recordTrip('a', 50, 50)), msg(() => p.addCourier('a', 1)), p.totalCost()],
        ['Unknown courier', 'Invalid trip', 'Duplicate courier', 60]];` },
      ],
      hidden: [
        { name: 'Rates differ per courier', src: `const p = new PayoutTracker();
p.addCourier('x', 2999); p.addCourier('y', 1);
p.recordTrip('x', 10, 3610); p.recordTrip('y', 0, 1799); p.recordTrip('y', 2000, 3800);
return [p.totalCost(), 3000];` },
        { name: 'Long trip at the top rate stays exact', src: `const p = new PayoutTracker();
p.addCourier('night', 100000);
p.recordTrip('night', 0, 1000000000);
return [p.totalCost(), 27777777778];` },
        { name: 'Ending before starting is invalid', src: `const p = new PayoutTracker(); p.addCourier('a', 100);
let m = ''; try { p.recordTrip('a', 10, 5); } catch (e) { m = e.message; }
return [[m.startsWith('Invalid trip'), p.totalCost()], [true, 0]];` },
      ],
    },
    {
      title: 'Part 2: Settle payouts',
      body: `
<p>Finance pays couriers in batches.</p>
<ul>
<li><code>settle(untilSec)</code> marks every unpaid trip with <code>endSec &lt;= untilSec</code> as paid and returns the cents paid by this call.</li>
<li><code>unpaidCost()</code> returns the cents for trips not yet paid. <code>totalCost()</code> still counts every trip, paid or not.</li>
<li>A trip recorded after a settlement is unpaid, even if it ended before that settlement's <code>untilSec</code>. The next <code>settle</code> that covers it pays it.</li>
</ul>`,
      tests: [
        { name: 'Example settlement', src: `const p = new PayoutTracker();
p.addCourier('rhea', 1800); p.addCourier('tomas', 2150);
p.recordTrip('rhea', 0, 1200); p.recordTrip('tomas', 600, 1337); p.recordTrip('rhea', 1500, 2700);
const paid = p.settle(1500);
return [[paid, p.unpaidCost(), p.totalCost()], [1040, 600, 1640]];` },
        { name: 'Trips are paid only once', src: `const p = new PayoutTracker(); p.addCourier('a', 3600);
p.recordTrip('a', 0, 100); p.recordTrip('a', 200, 300);
return [[p.settle(100), p.settle(100), p.settle(1000), p.unpaidCost()], [100, 0, 100, 0]];` },
        { name: 'A trip ending exactly at the cutoff is paid', src: `const p = new PayoutTracker(); p.addCourier('a', 3600);
p.recordTrip('a', 0, 500); p.recordTrip('a', 500, 501);
return [[p.settle(500), p.unpaidCost()], [500, 1]];` },
        { name: 'Late-recorded trips wait for the next settlement', src: `const p = new PayoutTracker(); p.addCourier('a', 3600);
p.recordTrip('a', 100, 200);
const first = p.settle(1000);
p.recordTrip('a', 0, 50);
const unpaid = p.unpaidCost();
return [[first, unpaid, p.settle(1000), p.unpaidCost()], [100, 50, 50, 0]];` },
      ],
      hidden: [
        { name: 'Settling before anything ends pays nothing', src: `const p = new PayoutTracker(); p.addCourier('a', 3600);
p.recordTrip('a', 10, 20);
return [[p.settle(19), p.unpaidCost()], [0, 10]];` },
        { name: 'Many settlements over 50k trips', src: `const p = new PayoutTracker();
for (let c = 0; c < 50; c++) p.addCourier('c' + c, 1000 + c);
for (let i = 0; i < 50000; i++) p.recordTrip('c' + (i % 50), i * 10, i * 10 + 7 + (i % 13));
let paid = 0; for (let u = 0; u <= 500000; u += 1000) paid += p.settle(u);
return [[paid + p.unpaidCost(), p.totalCost(), p.unpaidCost()], [184150, 184150, 0]];` },
      ],
    },
    {
      title: 'Part 3: Peak couriers on the road',
      body: `
<p>Dispatch wants the busiest moment in a time range.</p>
<ul>
<li><code>peakConcurrent(fromSec, toSec)</code> returns the largest number of trips in progress at the same instant <code>t</code>, over all <code>t</code> with <code>fromSec &lt;= t &lt; toSec</code>. Since a courier's trips never overlap, this is the number of couriers out at once.</li>
<li>Trips are half-open: a trip that ends at 100 and one that starts at 100 are never in progress together.</li>
<li>Count every recorded trip, paid or unpaid. Return <code>0</code> if nothing is in progress in the range.</li>
<li>It must handle 10⁵ trips quickly. Comparing every pair of trips is too slow.</li>
</ul>`,
      tests: [
        { name: 'Example peaks', src: `const p = new PayoutTracker();
p.addCourier('rhea', 1800); p.addCourier('tomas', 2150);
p.recordTrip('rhea', 0, 1200); p.recordTrip('tomas', 600, 1337); p.recordTrip('rhea', 1500, 2700);
return [[p.peakConcurrent(0, 3600), p.peakConcurrent(1200, 1500), p.peakConcurrent(1337, 1500)], [2, 1, 0]];` },
        { name: 'Back-to-back trips do not overlap', src: `const p = new PayoutTracker();
p.addCourier('a', 100); p.addCourier('b', 100);
p.recordTrip('a', 0, 100); p.recordTrip('b', 100, 200);
return [p.peakConcurrent(0, 1000), 1];` },
        { name: 'Only the window counts', src: `const p = new PayoutTracker();
['a','b','c','d'].forEach(id => p.addCourier(id, 100));
p.recordTrip('a', 0, 50); p.recordTrip('b', 10, 60); p.recordTrip('c', 20, 70);
p.recordTrip('d', 65, 90);
return [[p.peakConcurrent(0, 100), p.peakConcurrent(60, 100), p.peakConcurrent(55, 66)], [3, 2, 2]];` },
        { name: '30k trips under a second', src: `const p = new PayoutTracker(); let s = 5;
const next = () => (s = (s * 48271) % 2147483647);
for (let c = 0; c < 300; c++) {
  p.addCourier('c' + c, 1500 + c);
  let t = next() % 3600;
  for (let j = 0; j < 100; j++) { const d = 300 + next() % 2400; p.recordTrip('c' + c, t, t + d); t += d + next() % 1800; }
}
const t0 = performance.now();
const r = [p.peakConcurrent(0, 400000), p.peakConcurrent(100000, 100001), p.peakConcurrent(250000, 260000)];
const ms = performance.now() - t0;
return [[r, ms < 1000], [[231, 175, 33], true]];` },
      ],
      hidden: [
        { name: 'Window edges are half-open', src: `const p = new PayoutTracker();
p.addCourier('a', 100); p.addCourier('b', 100);
p.recordTrip('a', 0, 100); p.recordTrip('b', 50, 150);
return [[p.peakConcurrent(100, 200), p.peakConcurrent(0, 50), p.peakConcurrent(49, 51), p.peakConcurrent(150, 300)], [1, 1, 2, 0]];` },
        { name: 'Paid trips still count', src: `const p = new PayoutTracker();
p.addCourier('a', 100); p.addCourier('b', 100);
p.recordTrip('a', 0, 10); p.recordTrip('b', 5, 20); p.settle(100);
return [p.peakConcurrent(0, 20), 2];` },
        { name: 'Huge window does not allocate per second', src: `const p = new PayoutTracker();
p.addCourier('a', 100); p.addCourier('b', 100);
p.recordTrip('a', 0, 999999999); p.recordTrip('b', 500000000, 1000000000);
return [p.peakConcurrent(0, 1000000000), 2];` },
        { name: '100k trips, five queries', src: `const p = new PayoutTracker(); let s = 17;
const next = () => (s = (s * 48271) % 2147483647);
for (let c = 0; c < 1000; c++) {
  p.addCourier('c' + c, 1200 + (c % 900));
  let t = next() % 7200;
  for (let j = 0; j < 100; j++) { const d = 120 + next() % 3000; p.recordTrip('c' + c, t, t + d); t += d + next() % 2400; }
}
const t0 = performance.now();
const r = [p.peakConcurrent(0, 600000), p.peakConcurrent(0, 3600), p.peakConcurrent(100000, 100001), p.peakConcurrent(150000, 200000), p.peakConcurrent(250000, 300000)];
const ms = performance.now() - t0;
return [[r, p.totalCost(), ms < 2000], [[652, 319, 568, 626, 614], 72404042, true]];` },
      ],
    },
  ],
  followUps: [
    'A courier\'s rate changes mid-week. How would you price a trip that started before the change?',
    'peakConcurrent is called on every dashboard refresh with a sliding window. How would you avoid re-sorting 10⁵ trips each time?',
    'Settlement runs in a separate service that can retry. How do you make settle idempotent?',
  ],
  rubric: 'Strong: rate looked up at record time and validated before any mutation; per-trip Math.round in integer cents (no floats accumulated); separate running totals so totalCost and unpaidCost are O(1); settle walks only unpaid trips and keeps a list or index of them; peakConcurrent clips each trip to the window, sorts starts and ends (ends first on ties, since intervals are half-open) and sweeps, O(n log n). Weak: rounding the grand total, floating-point dollars, rescanning all trips to compute unpaid cost, an O(n²) pairwise overlap count, an array indexed by second (breaks on wide windows), or counting back-to-back trips as overlapping.',
  offline: {
    approach: 'Store rates in a `Map`, push each trip with its precomputed integer cost, and keep running `total` and `unpaid` sums. `settle` moves trips ending by the cutoff out of an unpaid list. For the peak, clip every trip to `[fromSec, toSec)`, then sweep: sort start times and end times separately and walk them in order, processing an end before a start at the same second.',
    hints: [
      'Cost per trip: `Math.round(rate * (end - start) / 3600)`. For positive values `Math.round` rounds halves up.',
      'Keep a list of unpaid trips so `settle` never touches trips already paid.',
      'Clip each trip to the window first: `s = max(start, fromSec)`, `e = min(end, toSec)`, skip it if `s >= e`.',
      'Sweep line: with sorted `starts` and `ends`, advance whichever is smaller; if `ends[j] <= starts[i]`, the end goes first. Track the running count and its maximum.',
    ],
    edge: [
      'A trip that ends exactly when another starts (no overlap).',
      'A trip ending exactly at the settle cutoff (paid).',
      'A trip recorded after a settle with an end time before that cutoff.',
      'A window that starts or ends in the middle of trips.',
      'A window wider than any per-second array could hold.',
    ],
    complexity: '`recordTrip`, `totalCost` and `unpaidCost` are **O(1)**. `settle` is **O(u)** for u unpaid trips. `peakConcurrent` is **O(n log n)** time and **O(n)** space for n trips.',
    skeleton: `class PayoutTracker {
  constructor() {
    this.rates = new Map();
    this.trips = [];
    this.unpaid = [];
    this.total = 0;
    this.unpaidTotal = 0;
  }

  addCourier(id, centsPerHour) {
    // TODO: duplicate check
  }

  recordTrip(courierId, startSec, endSec) {
    // TODO: validate, compute rounded cost, update both totals
  }

  totalCost() { return this.total; }
  unpaidCost() { return this.unpaidTotal; }

  settle(untilSec) {
    // TODO: pay unpaid trips with endSec <= untilSec, return cents paid
  }

  peakConcurrent(fromSec, toSec) {
    const starts = [], ends = [];
    // TODO: clip trips to the window, sort, sweep (ends before starts on ties)
  }
}`,
  },
  solution: `class PayoutTracker {
  constructor() {
    this.rates = new Map();   // courierId -> cents per hour
    this.trips = [];          // every trip, for peakConcurrent
    this.unpaid = [];         // trips not yet settled
    this.total = 0;
    this.unpaidTotal = 0;
  }

  addCourier(id, centsPerHour) {
    if (this.rates.has(id)) throw new Error('Duplicate courier: ' + id);
    this.rates.set(id, centsPerHour);
  }

  recordTrip(courierId, startSec, endSec) {
    const rate = this.rates.get(courierId);
    if (rate === undefined) throw new Error('Unknown courier: ' + courierId);
    if (!(endSec > startSec)) throw new Error('Invalid trip: must end after it starts');

    // Round each trip to whole cents; Math.round sends .5 up for positive values.
    const cost = Math.round(rate * (endSec - startSec) / 3600);
    const trip = { courierId, startSec, endSec, cost };
    this.trips.push(trip);
    this.unpaid.push(trip);
    this.total += cost;
    this.unpaidTotal += cost;
  }

  totalCost() {
    return this.total;
  }

  settle(untilSec) {
    let paid = 0;
    const stillUnpaid = [];
    for (const trip of this.unpaid) {
      if (trip.endSec <= untilSec) paid += trip.cost;
      else stillUnpaid.push(trip);
    }
    this.unpaid = stillUnpaid;
    this.unpaidTotal -= paid;
    return paid;
  }

  unpaidCost() {
    return this.unpaidTotal;
  }

  peakConcurrent(fromSec, toSec) {
    const starts = [];
    const ends = [];
    for (const trip of this.trips) {
      const s = Math.max(trip.startSec, fromSec);
      const e = Math.min(trip.endSec, toSec);
      if (s < e) { starts.push(s); ends.push(e); }
    }
    const byNumber = (a, b) => a - b;
    starts.sort(byNumber);
    ends.sort(byNumber);

    // Sweep: an end at time t is processed before a start at t (half-open trips).
    let i = 0, j = 0, onRoad = 0, peak = 0;
    while (i < starts.length) {
      if (ends[j] <= starts[i]) { onRoad--; j++; }
      else { onRoad++; i++; peak = Math.max(peak, onRoad); }
    }
    return peak;
  }
}
`,
});
