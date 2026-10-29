// Problem bank. Each test's `src` runs after the candidate's code and returns [actual, expected].
const PROBLEMS = [
  {
    id: 'rate-limiter',
    title: 'Sliding-window rate limiter',
    team: 'API Platform',
    level: 'Mid-level',
    difficulty: 'Medium',
    minutes: 40,
    focus: ['Data structures', 'Design'],
    format: 'Single-part data-structure design task with hidden boundary and scale tests.',
    scenario: 'Partners are hammering the public Orders API during flash sales. You own the gateway that decides, per API key, whether a request goes through.',
    body: `
<p>Implement <code>RateLimiter</code>. A client may make at most <code>limit</code> successful requests in any rolling window of <code>windowMs</code> milliseconds.</p>
<ul>
<li><code>allow(clientId, timestamp)</code> returns <code>true</code> and records the request if the client has fewer than <code>limit</code> allowed requests with timestamps in <code>(timestamp - windowMs, timestamp]</code>. Otherwise it returns <code>false</code>. Rejected requests do not count against the client.</li>
<li><code>retryAfter(clientId, timestamp)</code> returns how many milliseconds the client must wait before a request would be allowed, or <code>0</code> if one would be allowed now.</li>
</ul>
<p>Timestamps for a single client never decrease. Clients are independent.</p>`,
    examples: `const rl = new RateLimiter(3, 1000);
rl.allow("key_A", 0);     // true
rl.allow("key_A", 100);   // true
rl.allow("key_A", 200);   // true
rl.allow("key_A", 300);   // false, 3 requests in (−700, 300]
rl.retryAfter("key_A", 300); // 700, the request at 0 ages out at 1000
rl.allow("key_A", 1000);  // true`,
    constraints: ['1 ≤ limit ≤ 10⁴', '1 ≤ windowMs ≤ 10⁷', 'Up to 2 × 10⁵ calls per test', 'Each call should be amortized O(1)'],
    starter: `class RateLimiter {
  /**
   * @param {number} limit     max allowed requests per window
   * @param {number} windowMs  window length in milliseconds
   */
  constructor(limit, windowMs) {
    // TODO
  }

  /** @returns {boolean} */
  allow(clientId, timestamp) {
    // TODO
  }

  /** @returns {number} ms until a request would be allowed */
  retryAfter(clientId, timestamp) {
    // TODO
  }
}
`,
    tests: [
      { name: 'Allows up to the limit, then rejects', src: `const r = new RateLimiter(3, 1000);
return [[0,100,200,300,1000,1001].map(t => r.allow('a', t)), [true,true,true,false,true,false]];` },
      { name: 'Clients are independent', src: `const r = new RateLimiter(1, 500);
return [[r.allow('a',0), r.allow('b',0), r.allow('a',10), r.allow('b',499), r.allow('a',500)], [true,true,false,false,true]];` },
      { name: 'Rejected requests do not count', src: `const r = new RateLimiter(1, 100);
return [[r.allow('a',0), r.allow('a',50), r.allow('a',99), r.allow('a',100)], [true,false,false,true]];` },
      { name: 'retryAfter reports the wait', src: `const r = new RateLimiter(2, 1000);
r.allow('a', 0); r.allow('a', 400);
return [[r.retryAfter('a', 500), r.retryAfter('a', 1000), r.retryAfter('new', 5)], [500, 0, 0]];` },
    ],
    hidden: [
      { name: 'Window boundary is exclusive of the old edge', src: `const r = new RateLimiter(2, 10);
return [[r.allow('a',0), r.allow('a',9), r.allow('a',10), r.allow('a',18), r.allow('a',19), r.allow('a',20)], [true,true,true,false,true,true]];` },
      { name: 'retryAfter after the window slides', src: `const r = new RateLimiter(2, 100);
r.allow('a', 0); r.allow('a', 30); r.allow('a', 100);
return [[r.retryAfter('a', 101), r.retryAfter('a', 130)], [29, 0]];` },
      { name: 'Heavy single-client traffic (200k calls)', src: `const r = new RateLimiter(100, 1000);
let c = 0; for (let i = 0; i < 200000; i++) if (r.allow('hot', i * 5)) c++;
return [c, 100000];` },
      { name: 'Many clients (30k calls)', src: `const r = new RateLimiter(2, 50);
let c = 0; for (let i = 0; i < 10000; i++) for (let j = 0; j < 3; j++) if (r.allow('k' + i, j)) c++;
return [c, 20000];` },
    ],
    followUps: ['How would this work across 20 gateway nodes sharing one limit?', 'Memory grows with idle clients. How do you evict them?', 'Switch to a token bucket. What changes for bursty partners?'],
    rubric: 'Strong: per-client queue/deque of allowed timestamps, evict from the front (amortized O(1)); handles exclusive old edge (t - windowMs drops out); rejected requests not stored; retryAfter = oldest + windowMs - t. Weak: filtering the whole array each call (O(limit)), counting rejected requests, off-by-one at the window edge.',
    offline: {
      approach: 'Keep a queue of **allowed** timestamps per client (a `Map` from client id to array). On each call, drop timestamps `<= timestamp - windowMs` from the front, then compare the queue length with `limit`.',
      hints: ['Only successful requests go into the queue; a rejected call should leave state untouched.', 'The oldest kept timestamp decides `retryAfter`: it ages out at `oldest + windowMs`.', 'Watch the edge: a request exactly `windowMs` old is outside the window, so evict with `<=`.', '`Array.prototype.shift()` is fine at this size, but a head index avoids O(n) shifts on long queues.'],
      edge: ['A request exactly `windowMs` after the oldest one (should be allowed).', 'Several rejected calls in a row (must not extend the block).', '`retryAfter` for a client never seen before (should be `0`).', 'Two clients interleaved at the same timestamps.'],
      complexity: 'With a per-client queue each timestamp is pushed once and evicted once, so `allow` is amortized **O(1)** and memory is **O(limit)** per active client. Filtering the full history on every call is O(limit) per call.',
      skeleton: `class RateLimiter {
  constructor(limit, windowMs) {
    this.limit = limit;
    this.windowMs = windowMs;
    this.hits = new Map(); // clientId -> allowed timestamps, oldest first
  }

  _window(clientId, timestamp) {
    let q = this.hits.get(clientId);
    if (!q) { q = []; this.hits.set(clientId, q); }
    // TODO: drop timestamps that are outside (timestamp - windowMs, timestamp]
    return q;
  }

  allow(clientId, timestamp) {
    const q = this._window(clientId, timestamp);
    // TODO: record and return true when under the limit
  }

  retryAfter(clientId, timestamp) {
    const q = this._window(clientId, timestamp);
    // TODO: 0 when under the limit, otherwise when the oldest ages out
  }
}`,
    },
    solution: `class RateLimiter {
  /**
   * @param {number} limit     max allowed requests per window
   * @param {number} windowMs  window length in milliseconds
   */
  constructor(limit, windowMs) {
    this.limit = limit;
    this.windowMs = windowMs;
    this.clients = new Map(); // clientId -> { times: allowed timestamps, head: index of the oldest live one }
  }

  // Drop timestamps outside (timestamp - windowMs, timestamp] and return the client's queue.
  _window(clientId, timestamp) {
    let q = this.clients.get(clientId);
    if (!q) {
      q = { times: [], head: 0 };
      this.clients.set(clientId, q);
    }
    while (q.head < q.times.length && q.times[q.head] <= timestamp - this.windowMs) q.head++;
    // Compact now and then so the array does not grow forever.
    if (q.head > 1024 && q.head * 2 > q.times.length) {
      q.times = q.times.slice(q.head);
      q.head = 0;
    }
    return q;
  }

  allow(clientId, timestamp) {
    const q = this._window(clientId, timestamp);
    if (q.times.length - q.head >= this.limit) return false; // rejected requests are not recorded
    q.times.push(timestamp);
    return true;
  }

  retryAfter(clientId, timestamp) {
    const q = this._window(clientId, timestamp);
    if (q.times.length - q.head < this.limit) return 0;
    // The oldest allowed request leaves the window at oldest + windowMs.
    return q.times[q.head] + this.windowMs - timestamp;
  }
}
`,
  },
  {
    id: 'ttl-cache',
    title: 'LRU cache with expiry',
    team: 'Edge Caching',
    level: 'Senior',
    difficulty: 'Hard',
    minutes: 45,
    focus: ['Data structures', 'Edge cases'],
    format: 'Single-part class design task with tricky eviction rules and a hidden high-volume test.',
    scenario: 'The product-detail service caches pricing at the edge. Prices expire, and the box has a hard memory cap, so the cache needs both TTLs and LRU eviction.',
    body: `
<p>Implement <code>TTLCache</code> with a fixed <code>capacity</code>. Every operation receives the current time <code>now</code> in milliseconds.</p>
<ul>
<li><code>put(key, value, ttlMs, now)</code> inserts or updates an entry that expires at <code>now + ttlMs</code>. An entry is expired when <code>now &gt;= expiresAt</code>. Updating a key refreshes its value, expiry and recency.</li>
<li>When inserting a <strong>new</strong> key into a full cache, first remove every expired entry. If the cache is still full, evict the least recently used entry.</li>
<li><code>get(key, now)</code> returns the value, or <code>-1</code> when the key is missing or expired. A successful <code>get</code> marks the entry as most recently used.</li>
<li><code>size(now)</code> returns the number of entries that have not expired.</li>
</ul>`,
    examples: `const c = new TTLCache(2);
c.put("sku-1", 19.99, 50, 0);
c.put("sku-2", 4.50, 1000, 0);
c.get("sku-1", 10);          // 19.99 (sku-1 is now most recent)
c.put("sku-3", 7.25, 1000, 60); // sku-1 expired at 50, so it goes first; sku-2 stays
c.get("sku-2", 61);          // 4.5`,
    constraints: ['1 ≤ capacity ≤ 10⁵', 'Up to 10⁵ operations per test', 'get and put should be O(1) when nothing is expired'],
    starter: `class TTLCache {
  /** @param {number} capacity */
  constructor(capacity) {
    // TODO
  }

  get(key, now) {
    // TODO
  }

  put(key, value, ttlMs, now) {
    // TODO
  }

  size(now) {
    // TODO
  }
}
`,
    tests: [
      { name: 'Evicts least recently used', src: `const c = new TTLCache(2);
c.put('a', 1, 1000, 0); c.put('b', 2, 1000, 0);
const r = [c.get('a', 1)]; c.put('c', 3, 1000, 2);
r.push(c.get('b', 3), c.get('a', 3), c.get('c', 3));
return [r, [1, -1, 1, 3]];` },
      { name: 'Entries expire at now + ttl', src: `const c = new TTLCache(2);
c.put('a', 1, 100, 0);
return [[c.get('a', 99), c.get('a', 100)], [1, -1]];` },
      { name: 'Expired entries go before LRU eviction', src: `const c = new TTLCache(2);
c.put('a', 1, 50, 0); c.put('b', 2, 1000, 0);
const r = [c.get('a', 10)]; c.put('c', 3, 1000, 60);
r.push(c.get('b', 61), c.get('c', 61), c.get('a', 61));
return [r, [1, 2, 3, -1]];` },
      { name: 'size counts live entries', src: `const c = new TTLCache(3);
c.put('a', 1, 10, 0); c.put('b', 2, 20, 0); c.put('c', 3, 30, 0);
return [[c.size(0), c.size(15), c.size(30)], [3, 2, 0]];` },
    ],
    hidden: [
      { name: 'Update refreshes value, expiry and recency', src: `const c = new TTLCache(2);
c.put('a', 1, 100, 0); c.put('b', 2, 1000, 0); c.put('a', 10, 1000, 50); c.put('c', 3, 1000, 60);
return [[c.get('a', 200), c.get('b', 200), c.get('c', 200)], [10, -1, 3]];` },
      { name: 'Updating an existing key never evicts', src: `const c = new TTLCache(2);
c.put('a', 1, 1000, 0); c.put('b', 2, 1000, 0); c.put('b', 5, 1000, 1);
return [[c.get('a', 2), c.get('b', 2)], [1, 5]];` },
      { name: 'Expired get does not count as a use', src: `const c = new TTLCache(2);
c.put('a', 1, 10, 0); c.put('b', 2, 1000, 0); c.get('a', 20); c.put('c', 3, 1000, 21); c.put('d', 4, 1000, 22);
return [[c.get('b', 23), c.get('c', 23), c.get('d', 23)], [-1, 3, 4]];` },
      { name: 'Capacity 1', src: `const c = new TTLCache(1);
c.put('x', 'v1', 100, 0); c.put('y', 'v2', 100, 1);
return [[c.get('x', 2), c.get('y', 2)], [-1, 'v2']];` },
      { name: '100k mixed operations', src: `const c = new TTLCache(1000);
let hits = 0;
for (let i = 0; i < 100000; i++) { c.put('k' + (i % 3000), i, 5000, i); if (c.get('k' + ((i * 7) % 3000), i) !== -1) hits++; }
return [hits, 29718];` },
    ],
    followUps: ['Your cleanup on insert can be O(n). How would you bound it?', 'How would you add a "stale-while-revalidate" window?', 'What changes if two threads call put at once?'],
    rubric: 'Strong: Map insertion order (delete + set) or hashmap + doubly linked list for O(1) LRU; expiry checked on read (lazy); purge expired before LRU eviction only when inserting a new key into a full cache; update path refreshes recency without evicting. Weak: arrays with indexOf (O(n)), evicting by LRU before purging expired, counting expired gets as use.',
    offline: {
      approach: 'A JavaScript `Map` keeps insertion order, so `delete` then `set` moves a key to the most-recent end and `map.keys().next().value` is the least recently used. Store `{ value, expiresAt }` per key and check expiry lazily on `get`.',
      hints: ['On `get`, an expired entry should be deleted and return `-1` without touching recency.', 'Only purge expired entries when a **new** key arrives and the cache is full.', 'Updating an existing key: delete it first, then set it, so it never triggers eviction.', 'Deleting from a `Map` while iterating it with `for...of` is safe in JavaScript.'],
      edge: ['Capacity 1.', 'Re-putting an existing key in a full cache (must not evict anything).', 'An entry read exactly at `expiresAt` (expired).', 'All entries expired when a new key arrives.'],
      complexity: '`get` and `put` are **O(1)** with a `Map` (or hashmap + doubly linked list). The purge on a full insert is O(n) in the worst case; a min-heap or bucketed expiry wheel bounds that if it matters.',
      skeleton: `class TTLCache {
  constructor(capacity) {
    this.capacity = capacity;
    this.entries = new Map(); // key -> { value, expiresAt }, least recent first
  }

  get(key, now) {
    const e = this.entries.get(key);
    // TODO: missing or expired -> -1; otherwise move to most recent
  }

  put(key, value, ttlMs, now) {
    // TODO: update path vs new-key path (purge expired, then evict LRU)
  }

  size(now) {
    // TODO
  }
}`,
    },
    solution: `class TTLCache {
  /** @param {number} capacity */
  constructor(capacity) {
    this.capacity = capacity;
    // A Map keeps insertion order: the first key is the least recently used.
    this.entries = new Map(); // key -> { value, expiresAt }
  }

  get(key, now) {
    const e = this.entries.get(key);
    if (!e) return -1;
    if (now >= e.expiresAt) {
      this.entries.delete(key); // expired reads do not count as a use
      return -1;
    }
    // Move to the most recently used end.
    this.entries.delete(key);
    this.entries.set(key, e);
    return e.value;
  }

  put(key, value, ttlMs, now) {
    if (this.entries.has(key)) {
      // Updating an existing key never evicts anything.
      this.entries.delete(key);
    } else if (this.entries.size >= this.capacity) {
      // New key in a full cache: purge expired entries first...
      for (const [k, e] of this.entries) {
        if (now >= e.expiresAt) this.entries.delete(k);
      }
      // ...then fall back to evicting the least recently used one.
      if (this.entries.size >= this.capacity) {
        this.entries.delete(this.entries.keys().next().value);
      }
    }
    this.entries.set(key, { value, expiresAt: now + ttlMs });
  }

  size(now) {
    let live = 0;
    for (const e of this.entries.values()) if (now < e.expiresAt) live++;
    return live;
  }
}
`,
  },
  {
    id: 'free-slots',
    title: 'Find common free time',
    team: 'Calendar',
    level: 'New grad',
    difficulty: 'Medium',
    minutes: 35,
    focus: ['Intervals', 'Parsing'],
    format: 'Single-part algorithm task (interval merging) with hidden edge-case tests.',
    scenario: 'The "Find a time" button in the team calendar suggests meeting slots. Product wants every gap where all attendees are free for at least the requested length.',
    body: `
<p>Write <code>findFreeSlots(calendars, workday, durationMin)</code>.</p>
<ul>
<li><code>calendars</code> is one array per attendee of busy intervals <code>["HH:MM", "HH:MM"]</code>. Intervals can be unsorted, overlap, or fall partly outside the workday.</li>
<li><code>workday</code> is <code>["HH:MM", "HH:MM"]</code>. Only time inside it counts.</li>
<li>Return every maximal interval when <strong>all</strong> attendees are free and that lasts at least <code>durationMin</code> minutes, in order, formatted <code>"HH:MM"</code>.</li>
</ul>
<p>Back-to-back meetings (one ends at 14:30, the next starts at 14:30) leave no gap.</p>`,
    examples: `findFreeSlots(
  [
    [["09:00","10:30"], ["12:00","13:00"], ["16:00","18:00"]],
    [["10:00","11:30"], ["12:30","14:30"], ["14:30","15:00"]],
  ],
  ["09:00","17:00"],
  30
);
// [["11:30","12:00"], ["15:00","16:00"]]`,
    constraints: ['Up to 50 attendees with 200 meetings each', 'Times are on one day, 00:00–23:59', '1 ≤ durationMin ≤ 480'],
    starter: `/**
 * @param {string[][][]} calendars  busy intervals per attendee
 * @param {string[]} workday        ["HH:MM", "HH:MM"]
 * @param {number} durationMin
 * @returns {string[][]}            free intervals
 */
function findFreeSlots(calendars, workday, durationMin) {
  // TODO
}
`,
    tests: [
      { name: 'Example from the spec', src: `return [findFreeSlots([[['09:00','10:30'],['12:00','13:00'],['16:00','18:00']],[['10:00','11:30'],['12:30','14:30'],['14:30','15:00']]], ['09:00','17:00'], 30), [['11:30','12:00'],['15:00','16:00']]];` },
      { name: 'Longer meeting filters short gaps', src: `return [findFreeSlots([[['09:00','10:30'],['12:00','13:00'],['16:00','18:00']],[['10:00','11:30'],['12:30','14:30'],['14:30','15:00']]], ['09:00','17:00'], 45), [['15:00','16:00']]];` },
      { name: 'Nobody busy', src: `return [findFreeSlots([[], []], ['09:00','17:00'], 60), [['09:00','17:00']]];` },
      { name: 'Meeting that starts before the workday', src: `return [findFreeSlots([[['07:00','09:30']]], ['09:00','17:00'], 60), [['09:30','17:00']]];` },
    ],
    hidden: [
      { name: 'Unsorted, nested and overlapping', src: `return [findFreeSlots([[['13:00','14:00'],['09:00','12:00']],[['10:00','11:00'],['11:30','13:30']]], ['09:00','17:00'], 15), [['14:00','17:00']]];` },
      { name: 'Fully booked day', src: `return [findFreeSlots([[['08:00','12:00']],[['11:00','18:00']]], ['09:00','17:00'], 5), []];` },
      { name: 'Gap exactly the requested length', src: `return [findFreeSlots([[['09:00','09:30'],['10:00','17:00']]], ['09:00','17:00'], 30), [['09:30','10:00']]];` },
      { name: 'Meetings entirely outside the workday', src: `return [findFreeSlots([[['06:00','07:00'],['18:00','19:00']]], ['08:00','10:00'], 120), [['08:00','10:00']]];` },
      { name: '50 attendees, random calendars', src: `let seed = 7; const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
const pad = m => String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
const cals = [];
for (let p = 0; p < 50; p++) { const c = []; for (let k = 0; k < 4; k++) { const s = 480 + Math.floor(rnd() * 600); c.push([pad(s), pad(Math.min(s + 5 + Math.floor(rnd() * 40), 1439))]); } cals.push(c); }
const busy = new Array(1440).fill(false);
for (const c of cals) for (const [a, b] of c) { const s = +a.slice(0, 2) * 60 + +a.slice(3), e = +b.slice(0, 2) * 60 + +b.slice(3); for (let m = s; m < e; m++) busy[m] = true; }
const want = []; let m = 540;
while (m < 1080) { if (busy[m]) { m++; continue; } let e = m; while (e < 1080 && !busy[e]) e++; if (e - m >= 20) want.push([pad(m), pad(e)]); m = e; }
return [findFreeSlots(cals, ['09:00', '18:00'], 20), want];` },
    ],
    followUps: ['Attendees are in different time zones. What changes?', 'Rank the slots: prefer ones that do not fragment anyone’s afternoon.', 'Some attendees are optional. How do you return "best" slots?'],
    rubric: 'Strong: convert to minutes, clip to workday, flatten + sort by start, sweep with a running max end, emit gaps >= duration, format with zero padding. O(n log n). Weak: minute-by-minute arrays without noting cost, string comparison bugs, missing clip, treating back-to-back as a gap, forgetting the gap at the end of the day.',
    offline: {
      approach: 'Convert every time to minutes since midnight, clip each busy interval to the workday, flatten all attendees into one list, sort by start, then sweep with a cursor that tracks the latest busy end. Any gap between the cursor and the next start that is at least `durationMin` is a free slot.',
      hints: ['Flattening all calendars is fine: you only care when *anyone* is busy.', 'Clip with `Math.max(start, dayStart)` and `Math.min(end, dayEnd)`, then drop intervals that became empty.', 'Advance the cursor with `Math.max(cursor, end)` so nested meetings do not move it backwards.', 'Don’t forget the gap between the last meeting and the end of the workday.'],
      edge: ['No meetings at all.', 'A gap of exactly `durationMin`.', 'A meeting nested inside another one.', 'Meetings that start before or end after the workday.'],
      complexity: 'Sorting dominates: **O(n log n)** for n busy intervals across all attendees, O(n) extra space. A minute-array works because a day has 1,440 minutes, but it ties the solution to minute granularity.',
      skeleton: `function findFreeSlots(calendars, workday, durationMin) {
  const toMin = t => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
  const toTime = m => String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
  const dayStart = toMin(workday[0]), dayEnd = toMin(workday[1]);

  const busy = calendars.flat()
    .map(([a, b]) => [Math.max(toMin(a), dayStart), Math.min(toMin(b), dayEnd)])
    .filter(([a, b]) => a < b)
    .sort((x, y) => x[0] - y[0]);

  const free = [];
  let cursor = dayStart;
  // TODO: sweep busy intervals, push gaps >= durationMin
  return free;
}`,
    },
    solution: `/**
 * @param {string[][][]} calendars  busy intervals per attendee
 * @param {string[]} workday        ["HH:MM", "HH:MM"]
 * @param {number} durationMin
 * @returns {string[][]}            free intervals
 */
function findFreeSlots(calendars, workday, durationMin) {
  const toMin = t => {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  };
  const toTime = m => String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');

  const dayStart = toMin(workday[0]);
  const dayEnd = toMin(workday[1]);

  // Anyone busy blocks the slot, so all calendars can be merged into one list.
  // Clip to the workday and drop intervals that end up empty.
  const busy = calendars
    .flat()
    .map(([a, b]) => [Math.max(toMin(a), dayStart), Math.min(toMin(b), dayEnd)])
    .filter(([a, b]) => a < b)
    .sort((x, y) => x[0] - y[0]);

  const free = [];
  let cursor = dayStart; // everything before cursor is accounted for
  for (const [start, end] of busy) {
    if (start - cursor >= durationMin) free.push([toTime(cursor), toTime(start)]);
    cursor = Math.max(cursor, end); // nested meetings must not move the cursor back
  }
  if (dayEnd - cursor >= durationMin) free.push([toTime(cursor), toTime(dayEnd)]);
  return free;
}
`,
  },
  {
    id: 'reconcile',
    title: 'Fix the payment reconciliation job',
    team: 'Finance Engineering',
    level: 'Mid-level',
    difficulty: 'Medium',
    minutes: 30,
    focus: ['Debugging', 'Money handling'],
    format: 'Fix-the-bug code review task: debug a handed-over implementation against a written spec.',
    scenario: 'Last night’s finance report flagged 312 orders as unpaid that customers had paid. The job was written in a hurry. Find and fix every bug in the code you were handed.',
    body: `
<p>The editor already contains <code>reconcile(orders, payments)</code>. It runs, but it gets several cases wrong. Fix it so it meets this spec:</p>
<ul>
<li>An order can be paid in several parts, and a refund is a payment with a negative amount.</li>
<li>Order ids are case-insensitive: <code>"ord-7"</code> pays <code>"ORD-7"</code>.</li>
<li>Amounts are dollars. Totals that differ by less than half a cent are equal.</li>
<li>Return <code>{ paid, unpaid, overpaid, unmatchedPayments }</code>. The first three list order ids exactly as written in <code>orders</code>. <code>unmatchedPayments</code> lists uppercase order ids that have payments but no order, without duplicates.</li>
<li>Every list is sorted ascending.</li>
</ul>`,
    examples: `reconcile(
  [{ id: "ORD-1", total: 59.97 }, { id: "ORD-2", total: 15 }],
  [
    { orderId: "ORD-1", amount: 19.99 },
    { orderId: "ord-1", amount: 19.99 },
    { orderId: "ORD-1", amount: 19.99 },
    { orderId: "ORD-9", amount: 3 },
  ]
);
// { paid: ["ORD-1"], unpaid: ["ORD-2"], overpaid: [], unmatchedPayments: ["ORD-9"] }`,
    constraints: ['Up to 10⁵ orders and 3 × 10⁵ payments', 'Amounts have at most 2 decimal places', 'Should run in O(n log n)'],
    starter: `// Nightly job: match payments to orders for the finance report.
// orders:   [{ id: "ORD-1001", total: 59.97 }]
// payments: [{ orderId: "ord-1001", amount: 19.99 }]  (orders can be paid in parts)
function reconcile(orders, payments) {
  const totals = {};
  for (const p of payments) {
    totals[p.orderId] = p.amount;
  }

  const result = { paid: [], unpaid: [], overpaid: [], unmatchedPayments: [] };
  for (const o of orders) {
    const received = totals[o.id];
    if (received === o.total) result.paid.push(o.id);
    else if (received > o.total) result.overpaid.push(o.id);
    else result.unpaid.push(o.id);
  }

  for (const id in totals) {
    if (!orders.find(o => o.id === id)) result.unmatchedPayments.push(id);
  }
  return result;
}
`,
    tests: [
      { name: 'Split payments add up', src: `return [reconcile([{id:'ORD-1',total:59.97}], [{orderId:'ORD-1',amount:19.99},{orderId:'ORD-1',amount:19.99},{orderId:'ORD-1',amount:19.99}]), {paid:['ORD-1'],unpaid:[],overpaid:[],unmatchedPayments:[]}];` },
      { name: 'Ids are case-insensitive', src: `return [reconcile([{id:'ORD-7',total:10}], [{orderId:'ord-7',amount:10}]), {paid:['ORD-7'],unpaid:[],overpaid:[],unmatchedPayments:[]}];` },
      { name: 'Overpaid, partly paid and unpaid', src: `return [reconcile([{id:'A',total:20},{id:'B',total:15},{id:'C',total:5}], [{orderId:'A',amount:25},{orderId:'B',amount:10}]), {paid:[],unpaid:['B','C'],overpaid:['A'],unmatchedPayments:[]}];` },
      { name: 'Payments without an order', src: `return [reconcile([], [{orderId:'ord-9',amount:3},{orderId:'ORD-9',amount:1}]), {paid:[],unpaid:[],overpaid:[],unmatchedPayments:['ORD-9']}];` },
    ],
    hidden: [
      { name: 'Refunds reduce the total', src: `return [reconcile([{id:'D',total:30}], [{orderId:'D',amount:40},{orderId:'D',amount:-10}]), {paid:['D'],unpaid:[],overpaid:[],unmatchedPayments:[]}];` },
      { name: 'Every list is sorted', src: `return [reconcile([{id:'ORD-3',total:1},{id:'ORD-1',total:1},{id:'ORD-2',total:1}], [{orderId:'ord-3',amount:1},{orderId:'ord-1',amount:1},{orderId:'ord-2',amount:1},{orderId:'z-1',amount:1},{orderId:'b-1',amount:1}]), {paid:['ORD-1','ORD-2','ORD-3'],unpaid:[],overpaid:[],unmatchedPayments:['B-1','Z-1']}];` },
      { name: 'Float drift across many small payments', src: `const pays = []; for (let i = 0; i < 10; i++) pays.push({orderId:'X', amount:0.1});
return [reconcile([{id:'X',total:1}], pays).paid, ['X']];` },
      { name: 'Ids keep their original spelling in the output', src: `return [reconcile([{id:'ord-55',total:2}], [{orderId:'ORD-55',amount:2}]).paid, ['ord-55']];` },
      { name: '100k orders, 300k payments', src: `const orders = [], pays = [];
for (let i = 0; i < 100000; i++) { orders.push({id:'O-' + i, total: 30}); for (let j = 0; j < 3; j++) pays.push({orderId:'o-' + i, amount: i % 10 === 0 ? 9.99 : 10}); }
const r = reconcile(orders, pays);
return [[r.paid.length, r.unpaid.length, r.overpaid.length, r.unmatchedPayments.length], [90000, 10000, 0, 0]];` },
    ],
    followUps: ['Finance wants currency support. How do you avoid floats entirely?', 'The job reads 40 GB of payments. How do you stream it?', 'How would you test this so the bug never returns?'],
    rubric: 'Bugs: (1) overwrites instead of summing; (2) case-sensitive ids in both loops; (3) float equality on money; (4) undefined received for unpaid orders (works by accident); (5) O(n*m) orders.find; (6) unsorted output; (7) unmatched ids not uppercased/deduped. Strong: integer cents via Math.round(x*100), normalized keys, Set of order ids, sort at end, keeps original id spelling. Weak: tolerance hacks without reasoning, fixing only visible tests.',
    offline: {
      approach: 'Read the code against the spec line by line. The first loop overwrites instead of summing, every id comparison is case-sensitive, money is compared with `===` on floats, `orders.find` inside a loop is O(n·m), and nothing is sorted.',
      hints: ['Sum into a `Map` keyed by `orderId.toUpperCase()`.', 'Work in integer cents: `Math.round(amount * 100)` makes 0.1 × 10 equal 1.00.', 'Build a `Set` of normalized order ids once, instead of `orders.find` per payment.', 'Sort each list at the end, and keep the original order id spelling for paid/unpaid/overpaid.'],
      edge: ['Ten payments of `0.10` against a total of `1.00`.', 'A refund (negative amount) that brings an overpaid order back to paid.', 'An order whose id is lowercase in `orders` but uppercase in payments.', 'Two payments for the same unknown order id with different casing.'],
      complexity: 'One pass over payments, one over orders, then sorting: **O((n + m) log n)**. The original `orders.find` per key is **O(n · m)**, which times out at 10⁵ orders.',
      skeleton: `function reconcile(orders, payments) {
  const cents = x => Math.round(x * 100);
  const received = new Map(); // ORDER-ID -> cents
  for (const p of payments) {
    const key = p.orderId.toUpperCase();
    received.set(key, (received.get(key) || 0) + cents(p.amount));
  }

  const result = { paid: [], unpaid: [], overpaid: [], unmatchedPayments: [] };
  const known = new Set();
  for (const o of orders) {
    // TODO: compare cents(o.total) with received, keep o.id spelling
  }
  // TODO: unmatched payments, then sort every list
  return result;
}`,
    },
    solution: `// Nightly job: match payments to orders for the finance report.
function reconcile(orders, payments) {
  // Work in integer cents so 0.1 * 10 compares equal to 1.00.
  const cents = x => Math.round(x * 100);

  // Sum every payment (refunds are negative) per case-insensitive order id.
  const received = new Map(); // ORDER-ID -> cents
  for (const p of payments) {
    const key = p.orderId.toUpperCase();
    received.set(key, (received.get(key) || 0) + cents(p.amount));
  }

  const result = { paid: [], unpaid: [], overpaid: [], unmatchedPayments: [] };
  const known = new Set();
  for (const o of orders) {
    const key = o.id.toUpperCase();
    known.add(key);
    const got = received.get(key) || 0;
    const due = cents(o.total);
    // Keep the order id exactly as written in orders.
    if (got === due) result.paid.push(o.id);
    else if (got > due) result.overpaid.push(o.id);
    else result.unpaid.push(o.id);
  }

  // Map keys are already uppercase and unique.
  for (const key of received.keys()) {
    if (!known.has(key)) result.unmatchedPayments.push(key);
  }

  for (const list of Object.values(result)) list.sort();
  return result;
}
`,
  },
  {
    id: 'install-order',
    title: 'Package install order',
    team: 'Developer Tools',
    level: 'Mid-level',
    difficulty: 'Medium',
    minutes: 35,
    focus: ['Graphs', 'Determinism'],
    format: 'Single-part graph algorithm task with a determinism requirement and hidden scale tests.',
    scenario: 'The internal package manager installs dependencies in parallel today, and builds are flaky. You are making installs sequential and reproducible.',
    body: `
<p>Write <code>installOrder(packages)</code>. <code>packages</code> maps a package name to the names it depends on.</p>
<ul>
<li>Return every package in an order where each package comes after all of its dependencies.</li>
<li>A dependency that is not a key in <code>packages</code> is a package with no dependencies, and it is installed too.</li>
<li>When several packages are ready at once, install the alphabetically smallest first, so the order is deterministic.</li>
<li>Duplicate dependencies count once. If the graph has a cycle, throw an <code>Error</code> whose message starts with <code>"Cycle detected"</code>.</li>
</ul>`,
    examples: `installOrder({
  app:  ["web", "db"],
  web:  ["http"],
  db:   [],
  http: [],
});
// ["db", "http", "web", "app"]

installOrder({ a: ["b"], b: ["a"] });
// throws Error("Cycle detected: a -> b -> a")`,
    constraints: ['Up to 2 × 10⁴ packages and 10⁵ edges', 'Names are lowercase ASCII', 'Should run in O((V + E) log V)'],
    starter: `/**
 * @param {Record<string, string[]>} packages
 * @returns {string[]} install order
 */
function installOrder(packages) {
  // TODO
}
`,
    tests: [
      { name: 'Example graph', src: `return [installOrder({app:['web','db'], web:['http'], db:[], http:[]}), ['db','http','web','app']];` },
      { name: 'Implicit leaf packages are installed', src: `return [installOrder({cli:['parser','color']}), ['color','parser','cli']];` },
      { name: 'Alphabetical tie-break', src: `return [installOrder({c:[], b:[], a:[]}), ['a','b','c']];` },
      { name: 'Cycle throws', src: `try { installOrder({a:['b'], b:['c'], c:['a']}); return ['no error thrown', 'Error starting with "Cycle detected"']; }
catch (e) { return [String(e && e.message).startsWith('Cycle detected') ? 'Error starting with "Cycle detected"' : 'Error: ' + (e && e.message), 'Error starting with "Cycle detected"']; }` },
    ],
    hidden: [
      { name: 'Self-dependency is a cycle', src: `try { installOrder({a:['a']}); return ['no error thrown', 'Cycle error']; }
catch (e) { return [String(e && e.message).startsWith('Cycle detected') ? 'Cycle error' : 'Error: ' + (e && e.message), 'Cycle error']; }` },
      { name: 'Duplicate dependencies count once', src: `return [installOrder({x:['y','y'], y:[]}), ['y','x']];` },
      { name: 'Ready set re-sorts as packages unlock', src: `return [installOrder({b:['z'], a:['z'], y:[], z:[]}), ['y','z','a','b']];` },
      { name: 'Cycle deep in a larger graph', src: `try { installOrder({a:['b'], b:['c'], c:[], d:['e'], e:['f'], f:['d']}); return ['no error thrown', 'Cycle error']; }
catch (e) { return [String(e && e.message).startsWith('Cycle detected') ? 'Cycle error' : 'Error: ' + (e && e.message), 'Cycle error']; }` },
      { name: 'Chain of 20k packages', src: `const g = {}; for (let i = 1; i < 20000; i++) g['p' + String(i).padStart(5, '0')] = ['p' + String(i - 1).padStart(5, '0')];
const out = installOrder(g);
return [[out.length, out[0], out[19999]], [20000, 'p00000', 'p19999']];` },
    ],
    followUps: ['Install in parallel batches instead. What is the minimum number of rounds?', 'Report the actual cycle path in the error.', 'Two versions of the same package are requested. What do you do?'],
    rubric: "Strong: collect all names including implicit leaves, dedupe edges, Kahn's algorithm with a min-heap or sorted ready list, count emitted vs total to detect cycles (including self loops). Weak: DFS order that ignores the tie-break, missing implicit leaves, infinite loop on cycles, re-sorting an O(V) array per pop on large inputs without noting it.",
    offline: {
      approach: "Use Kahn's algorithm. Collect every name (keys and dependencies), count each package's unique dependencies (in-degree), keep a ready set of packages with in-degree 0, and always take the alphabetically smallest ready package. If you emit fewer packages than exist, there is a cycle.",
      hints: ['Build a reverse map: dependency -> packages that need it, so you can decrement in-degrees.', 'Dedupe with `new Set(deps)` before counting in-degrees.', 'A sorted array works for the ready set; a small binary heap avoids re-sorting on large graphs.', 'Cycle check: `if (order.length !== allNames.size) throw new Error("Cycle detected")`.'],
      edge: ['A package that depends on itself.', 'Dependencies that are never declared as keys.', 'Two packages that become ready at the same time, out of alphabetical order.', 'A cycle that does not include the first package.'],
      complexity: "Kahn's algorithm is **O(V + E)** plus the cost of choosing the smallest ready package: **O(log V)** per pop with a heap, so **O((V + E) log V)** overall.",
      skeleton: `function installOrder(packages) {
  const names = new Set(Object.keys(packages));
  for (const deps of Object.values(packages)) deps.forEach(d => names.add(d));

  const indegree = new Map([...names].map(n => [n, 0]));
  const dependents = new Map([...names].map(n => [n, []]));
  for (const [pkg, deps] of Object.entries(packages)) {
    for (const d of new Set(deps)) {
      // TODO: count the edge d -> pkg
    }
  }

  const ready = [...names].filter(n => indegree.get(n) === 0).sort();
  const order = [];
  // TODO: Kahn's loop, smallest ready first
  // TODO: cycle check
  return order;
}`,
    },
    solution: `/**
 * @param {Record<string, string[]>} packages
 * @returns {string[]} install order
 */
function installOrder(packages) {
  // Every package, including dependencies that are never declared as keys.
  const names = new Set(Object.keys(packages));
  for (const deps of Object.values(packages)) deps.forEach(d => names.add(d));

  const indegree = new Map();   // package -> number of unique dependencies left
  const dependents = new Map(); // dependency -> packages waiting on it
  for (const n of names) {
    indegree.set(n, 0);
    dependents.set(n, []);
  }
  for (const [pkg, deps] of Object.entries(packages)) {
    for (const d of new Set(deps)) { // duplicates count once
      indegree.set(pkg, indegree.get(pkg) + 1);
      dependents.get(d).push(pkg);
    }
  }

  // Kahn's algorithm, always taking the alphabetically smallest ready package.
  // The ready list is kept sorted descending so pop() returns the smallest.
  const ready = [...names].filter(n => indegree.get(n) === 0).sort().reverse();
  const insertReady = name => {
    let lo = 0, hi = ready.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (ready[mid] > name) lo = mid + 1;
      else hi = mid;
    }
    ready.splice(lo, 0, name);
  };

  const order = [];
  while (ready.length) {
    const pkg = ready.pop();
    order.push(pkg);
    for (const next of dependents.get(pkg)) {
      indegree.set(next, indegree.get(next) - 1);
      if (indegree.get(next) === 0) insertReady(next);
    }
  }

  // Anything left over is stuck on a cycle (self-dependencies included).
  if (order.length !== names.size) {
    const stuck = [...names].filter(n => indegree.get(n) > 0).sort();
    throw new Error('Cycle detected among: ' + stuck.join(', '));
  }
  return order;
}
`,
  },
  {
    id: 'slow-endpoints',
    title: 'Slowest endpoints from access logs',
    team: 'Observability',
    level: 'New grad',
    difficulty: 'Easy',
    minutes: 30,
    focus: ['Parsing', 'Aggregation'],
    format: 'Single-part parsing and aggregation task with hidden malformed-input and scale tests.',
    scenario: 'On-call wants a quick report of which endpoints regressed after yesterday’s deploy. All you have is raw gateway access logs.',
    body: `
<p>Write <code>slowestEndpoints(lines, k)</code>. Each line looks like:</p>
<pre class="inline-pre">2026-03-04T10:15:02Z GET /api/orders/8812?expand=items 200 184ms</pre>
<ul>
<li>Group by method and normalized path. Normalize by dropping the query string and replacing every path segment made only of digits with <code>:id</code>, giving <code>GET /api/orders/:id</code>.</li>
<li>For each endpoint, compute the p95 latency with the nearest-rank method: sort ascending and take the value at position <code>ceil(0.95 × n)</code> (1-based).</li>
<li>Return the top <code>k</code> as <code>{ endpoint, p95, count }</code>, sorted by <code>p95</code> descending, then by <code>endpoint</code> ascending.</li>
<li>Skip lines that do not match the format.</li>
</ul>`,
    examples: `slowestEndpoints([
  "2026-03-04T10:15:02Z GET /api/orders/1 200 100ms",
  "2026-03-04T10:15:03Z GET /api/orders/2 200 300ms",
  "2026-03-04T10:15:03Z GET /api/users 200 50ms",
  "2026-03-04T10:15:04Z POST /api/orders 201 400ms",
], 2);
// [ { endpoint: "POST /api/orders", p95: 400, count: 1 },
//   { endpoint: "GET /api/orders/:id", p95: 300, count: 2 } ]`,
    constraints: ['Up to 5 × 10⁵ lines', 'Latencies are integers in ms', '1 ≤ k ≤ 1,000'],
    starter: `/**
 * @param {string[]} lines  raw access-log lines
 * @param {number} k
 * @returns {{endpoint: string, p95: number, count: number}[]}
 */
function slowestEndpoints(lines, k) {
  // TODO
}
`,
    tests: [
      { name: 'Example from the spec', src: `return [slowestEndpoints(['2026-03-04T10:15:02Z GET /api/orders/1 200 100ms','2026-03-04T10:15:03Z GET /api/orders/2 200 300ms','2026-03-04T10:15:03Z GET /api/users 200 50ms','2026-03-04T10:15:04Z POST /api/orders 201 400ms'], 2), [{endpoint:'POST /api/orders',p95:400,count:1},{endpoint:'GET /api/orders/:id',p95:300,count:2}]];` },
      { name: 'Nearest-rank p95 over 20 samples', src: `const lines = []; for (let i = 1; i <= 20; i++) lines.push('t GET /health 200 ' + i + 'ms');
return [slowestEndpoints(lines, 1), [{endpoint:'GET /health',p95:19,count:20}]];` },
      { name: 'Query strings are dropped', src: `return [slowestEndpoints(['t GET /search?q=shoes 200 80ms','t GET /search?q=hats 200 90ms'], 5), [{endpoint:'GET /search',p95:90,count:2}]];` },
      { name: 'Malformed lines are skipped', src: `return [slowestEndpoints(['garbage','t GET /a 200 abcms','t GET /a 200 12ms',''], 5), [{endpoint:'GET /a',p95:12,count:1}]];` },
    ],
    hidden: [
      { name: 'Ties sort by endpoint', src: `return [slowestEndpoints(['t GET /b 200 10ms','t GET /a 200 10ms','t DELETE /c 204 10ms'], 3).map(r => r.endpoint), ['DELETE /c','GET /a','GET /b']];` },
      { name: 'Several numeric segments', src: `return [slowestEndpoints(['t GET /v2/users/42/orders/7 200 5ms','t GET /v2/users/9/orders/123 200 9ms'], 1), [{endpoint:'GET /v2/users/:id/orders/:id',p95:9,count:2}]];` },
      { name: 'k larger than the endpoint count', src: `return [slowestEndpoints(['t GET /x 200 1ms'], 10).length, 1];` },
      { name: 'Mixed segments keep their text', src: `return [slowestEndpoints(['t GET /files/v2/7a 200 3ms','t GET /files/v2/77 200 4ms'], 5).map(r => r.endpoint).sort(), ['GET /files/v2/7a','GET /files/v2/:id']];` },
      { name: '500k lines', src: `const lines = []; for (let i = 0; i < 500000; i++) lines.push('2026-03-04T10:00:00Z GET /api/items/' + i + ' 200 ' + (i % 1000) + 'ms');
const r = slowestEndpoints(lines, 1);
return [r, [{endpoint:'GET /api/items/:id',p95:949,count:500000}]];` },
    ],
    followUps: ['The file is 80 GB. How do you compute p95 without holding every sample?', 'How would you flag regressions compared with last week?', 'Paths like /users/me collide with /users/:id. Does that matter?'],
    rubric: 'Strong: strict regex or split with validation, strip query, digit-only segment check, group in a Map, numeric sort (not default string sort), nearest-rank index ceil(0.95n)-1, stable tiebreak with localeCompare or < comparison, slice k. Weak: default .sort() on numbers, off-by-one p95, normalizing mixed segments like 7a, crashing on malformed lines.',
    offline: {
      approach: 'Parse each line with one regex, normalize the path, push the latency into a `Map` keyed by `"METHOD /path"`, then sort each sample list numerically, take index `Math.ceil(0.95 * n) - 1`, sort the results and slice `k`.',
      hints: ['A regex like `/^\\S+\\s+([A-Z]+)\\s+(\\S+)\\s+(\\d{3})\\s+(\\d+)ms$/` both parses and rejects malformed lines.', 'Strip the query with `path.split("?")[0]`, then map segments with `/^\\d+$/.test(seg) ? ":id" : seg`.', 'Use `sort((a, b) => a - b)`. The default sort compares numbers as strings.', 'Tie-break with `a.endpoint < b.endpoint ? -1 : 1` after comparing p95.'],
      edge: ['A segment like `7a` (not all digits, keep it).', 'Exactly 20 samples: p95 is the 19th value.', 'Blank or truncated lines.', '`k` larger than the number of endpoints.'],
      complexity: 'Parsing is **O(L)** for L lines; sorting samples is **O(L log L)** in total. For streaming data you would swap exact samples for a t-digest or HDR histogram.',
      skeleton: `function slowestEndpoints(lines, k) {
  const LINE = /^\\S+\\s+([A-Z]+)\\s+(\\S+)\\s+(\\d{3})\\s+(\\d+)ms$/;
  const samples = new Map(); // "GET /api/orders/:id" -> [ms, ...]

  for (const line of lines) {
    const m = LINE.exec(line.trim());
    if (!m) continue;
    // TODO: normalize m[2], push Number(m[4])
  }

  const rows = [];
  // TODO: p95 per endpoint (nearest rank), sort, slice k
  return rows;
}`,
    },
    solution: `/**
 * @param {string[]} lines  raw access-log lines
 * @param {number} k
 * @returns {{endpoint: string, p95: number, count: number}[]}
 */
function slowestEndpoints(lines, k) {
  // timestamp, method, path, status, latency in ms. Anything else is skipped.
  const LINE = /^\\S+\\s+([A-Z]+)\\s+(\\S+)\\s+(\\d{3})\\s+(\\d+)ms$/;
  const samples = new Map(); // "GET /api/orders/:id" -> [ms, ...]

  for (const line of lines) {
    const m = LINE.exec(line.trim());
    if (!m) continue;
    const path = m[2]
      .split('?')[0]                                   // drop the query string
      .split('/')
      .map(seg => (/^\\d+$/.test(seg) ? ':id' : seg))   // only all-digit segments
      .join('/');
    const endpoint = m[1] + ' ' + path;
    if (!samples.has(endpoint)) samples.set(endpoint, []);
    samples.get(endpoint).push(Number(m[4]));
  }

  const rows = [];
  for (const [endpoint, ms] of samples) {
    ms.sort((a, b) => a - b); // numeric sort, not the default string sort
    const p95 = ms[Math.ceil(0.95 * ms.length) - 1]; // nearest rank, 1-based
    rows.push({ endpoint, p95, count: ms.length });
  }

  rows.sort((a, b) => b.p95 - a.p95 || (a.endpoint < b.endpoint ? -1 : a.endpoint > b.endpoint ? 1 : 0));
  return rows.slice(0, k);
}
`,
  },
];

