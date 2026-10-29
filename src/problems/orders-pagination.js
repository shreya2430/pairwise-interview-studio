PROBLEMS.push({
  id: 'orders-pagination',
  title: 'Paginate the merchant orders feed',
  team: 'Merchant Dashboard',
  level: 'Mid-level',
  difficulty: 'Medium',
  minutes: 45,
  focus: ['Debugging', 'API design', 'Sorting'],
  format: 'Modeled on reported 2025–26 AI-assisted rounds that start from an existing codebase: make the failing tests pass, then add a feature on top.',
  scenario: 'Bakeries and flower shops use the dashboard to watch incoming orders. The list view is showing orders in a strange order, and large shops need it paged without rows jumping around while new orders arrive.',
  body: `
<p><code>listOrders(orders, options)</code> powers the orders feed. Each order is <code>{ id, createdAt, status }</code>: <code>id</code> is a string, <code>createdAt</code> is a Unix time in seconds, and <code>status</code> is a string such as <code>"paid"</code> or <code>"refunded"</code>.</p>
<ul>
<li>The feed is newest first: <code>createdAt</code> descending, then <code>id</code> ascending (plain string comparison) for orders created in the same second.</li>
<li><code>options.status</code>, when given, keeps only orders with that status. When it is omitted, every order is listed.</li>
<li>The function returns <code>{ items, nextCursor }</code>, where <code>items</code> are order objects. It must not reorder or modify the <code>orders</code> array it receives.</li>
</ul>
<p>The current code is below. Part 1 fixes it, Part 2 adds paging.</p>`,
  examples: `const orders = [
  { id: "A-7", createdAt: 1700000300, status: "paid" },
  { id: "A-2", createdAt: 1700000500, status: "refunded" },
  { id: "A-9", createdAt: 1700000500, status: "paid" },
  { id: "A-4", createdAt: 1700000100, status: "paid" },
];
listOrders(orders, {}).items.map(o => o.id);                  // ["A-2", "A-9", "A-7", "A-4"]
listOrders(orders, { status: "paid" }).items.map(o => o.id);  // ["A-9", "A-7", "A-4"]

const p1 = listOrders(orders, { limit: 2 });
p1.items.map(o => o.id);   // ["A-2", "A-9"]
const p2 = listOrders(orders, { limit: 2, cursor: p1.nextCursor });
p2.items.map(o => o.id);   // ["A-7", "A-4"]
p2.nextCursor;             // null`,
  constraints: ['Up to 2 × 10⁴ orders per call', '1 ≤ limit ≤ 1000 when given', 'createdAt is a positive integer', 'Ids never contain the character "|"'],
  starter: `/**
 * @param {{id: string, createdAt: number, status: string}[]} orders
 * @param {{status?: string, limit?: number, cursor?: string}} [options]
 * @returns {{items: object[], nextCursor: string | null}}
 */
function listOrders(orders, { status, limit, cursor } = {}) {
  const rows = orders.filter(o => o.status === status);
  rows.sort((a, b) => a.createdAt < b.createdAt);
  return { items: rows, nextCursor: null };
}
`,
  parts: [
    {
      title: 'Part 1: Fix the feed order',
      body: `
<p>Merchants report two problems with the feed, and the tests below reproduce them.</p>
<ul>
<li>Orders often appear out of date order, and orders created in the same second come out in a random-looking order.</li>
<li>The "All orders" tab, which calls <code>listOrders</code> without a <code>status</code>, is always empty.</li>
</ul>
<p>Make the visible tests pass. <code>nextCursor</code> stays <code>null</code> for now.</p>`,
      tests: [
        { name: 'Newest orders come first', src: `const orders = [
  {id:'A-1', createdAt:500, status:'paid'}, {id:'A-2', createdAt:900, status:'paid'},
  {id:'A-3', createdAt:100, status:'paid'}, {id:'A-4', createdAt:700, status:'paid'},
  {id:'A-5', createdAt:300, status:'paid'}];
return [listOrders(orders, {status:'paid'}).items.map(o => o.id), ['A-2','A-4','A-1','A-5','A-3']];` },
        { name: 'Same-second orders are ordered by id', src: `const orders = [
  {id:'B-3', createdAt:50, status:'paid'}, {id:'B-1', createdAt:50, status:'paid'},
  {id:'B-2', createdAt:50, status:'paid'}, {id:'B-0', createdAt:10, status:'paid'}];
return [listOrders(orders, {status:'paid'}).items.map(o => o.id), ['B-1','B-2','B-3','B-0']];` },
        { name: 'No status lists every order', src: `const orders = [
  {id:'A-7', createdAt:1700000300, status:'paid'}, {id:'A-2', createdAt:1700000500, status:'refunded'},
  {id:'A-9', createdAt:1700000500, status:'paid'}, {id:'A-4', createdAt:1700000100, status:'paid'}];
const r = listOrders(orders, {});
return [[r.items.map(o => o.id), r.nextCursor], [['A-2','A-9','A-7','A-4'], null]];` },
        { name: 'Status filter keeps only matches', src: `const orders = [
  {id:'A-7', createdAt:1700000300, status:'paid'}, {id:'A-2', createdAt:1700000500, status:'refunded'},
  {id:'A-9', createdAt:1700000500, status:'paid'}, {id:'A-4', createdAt:1700000100, status:'paid'}];
return [[listOrders(orders, {status:'paid'}).items.map(o => o.id), listOrders(orders, {status:'refunded'}).items.map(o => o.id)], [['A-9','A-7','A-4'], ['A-2']]];` },
      ],
      hidden: [
        { name: 'Input array is left untouched', src: `const orders = [{id:'x', createdAt:1, status:'paid'}, {id:'y', createdAt:2, status:'paid'}];
listOrders(orders, {});
return [orders.map(o => o.id), ['x','y']];` },
        { name: 'Called with no options at all', src: `const orders = [{id:'x', createdAt:1, status:'paid'}, {id:'y', createdAt:2, status:'void'}];
return [listOrders(orders).items.map(o => o.id), ['y','x']];` },
        { name: 'Ids compare as strings', src: `const orders = [{id:'C-10', createdAt:5, status:'paid'}, {id:'C-9', createdAt:5, status:'paid'}, {id:'C-100', createdAt:5, status:'paid'}];
return [listOrders(orders, {}).items.map(o => o.id), ['C-10','C-100','C-9']];` },
        { name: '2000 orders in mixed order', src: `const orders = []; let s = 11;
for (let i = 0; i < 2000; i++) { s = (s * 48271) % 2147483647; orders.push({id:'O-' + i, createdAt: 1000 + s % 300, status: i % 3 ? 'paid' : 'refunded'}); }
const ids = listOrders(orders, {status:'paid'}).items.map(o => o.id);
return [[ids.length, ids.slice(0, 3), ids[ids.length - 1]], [1333, ['O-494','O-578','O-749'], 'O-602']];` },
      ],
    },
    {
      title: 'Part 2: Cursor pagination',
      body: `
<p>Large shops have thousands of orders. Add paging with <code>options.limit</code> and <code>options.cursor</code>.</p>
<ul>
<li>With <code>limit</code>, return at most <code>limit</code> items. Without it, return everything, as before.</li>
<li><code>nextCursor</code> is an opaque string that identifies the last item on the page by its <code>(createdAt, id)</code>. It is <code>null</code> when no matching order comes after the page.</li>
<li>Passing <code>cursor</code> returns the orders that come strictly after that position in feed order, under the same <code>status</code> filter.</li>
<li>Pages must stay stable while new orders arrive. If newer orders are added to <code>orders</code> between two calls, the next page must continue exactly where the previous one stopped, with no repeats and no gaps. An offset such as "skip 20" gets this wrong.</li>
</ul>`,
      tests: [
        { name: 'Two pages, then the end', src: `const orders = [
  {id:'A-7', createdAt:1700000300, status:'paid'}, {id:'A-2', createdAt:1700000500, status:'refunded'},
  {id:'A-9', createdAt:1700000500, status:'paid'}, {id:'A-4', createdAt:1700000100, status:'paid'}];
const p1 = listOrders(orders, {limit:2});
const p2 = listOrders(orders, {limit:2, cursor:p1.nextCursor});
return [[p1.items.map(o => o.id), typeof p1.nextCursor, p2.items.map(o => o.id), p2.nextCursor], [['A-2','A-9'], 'string', ['A-7','A-4'], null]];` },
        { name: 'Walking every page returns the full feed', src: `const orders = [];
for (let i = 0; i < 23; i++) orders.push({id:'P-' + String(i).padStart(2, '0'), createdAt: 100 + (i % 5), status:'paid'});
const full = listOrders(orders, {}).items.map(o => o.id);
const seen = []; let cursor = null, pages = 0;
do { const p = listOrders(orders, {limit:5, cursor}); seen.push(...p.items.map(o => o.id)); cursor = p.nextCursor; pages++; } while (cursor);
return [[seen, pages], [full, 5]];` },
        { name: 'New orders between fetches do not shift the next page', src: `const orders = [];
for (let i = 1; i <= 6; i++) orders.push({id:'N-' + i, createdAt: i * 10, status:'paid'});
const p1 = listOrders(orders, {limit:3});
orders.push({id:'N-7', createdAt:70, status:'paid'}, {id:'N-8', createdAt:80, status:'paid'});
const p2 = listOrders(orders, {limit:3, cursor:p1.nextCursor});
return [[p1.items.map(o => o.id), p2.items.map(o => o.id), p2.nextCursor], [['N-6','N-5','N-4'], ['N-3','N-2','N-1'], null]];` },
        { name: 'Paging respects the status filter', src: `const orders = [];
for (let i = 0; i < 10; i++) orders.push({id:'S-' + i, createdAt: 1000 - i, status: i % 2 ? 'refunded' : 'paid'});
const p1 = listOrders(orders, {status:'paid', limit:3});
const p2 = listOrders(orders, {status:'paid', limit:3, cursor:p1.nextCursor});
return [[p1.items.map(o => o.id), p2.items.map(o => o.id), p2.nextCursor], [['S-0','S-2','S-4'], ['S-6','S-8'], null]];` },
      ],
      hidden: [
        { name: 'Exactly limit items left gives a null cursor', src: `const orders = [{id:'a', createdAt:3, status:'paid'}, {id:'b', createdAt:2, status:'paid'}, {id:'c', createdAt:1, status:'paid'}, {id:'d', createdAt:0, status:'paid'}];
const p1 = listOrders(orders, {limit:2});
const p2 = listOrders(orders, {limit:2, cursor:p1.nextCursor});
return [[p1.nextCursor === null, p2.items.map(o => o.id), p2.nextCursor], [false, ['c','d'], null]];` },
        { name: 'Cursor splits orders from the same second', src: `const orders = [];
for (const id of ['T-4','T-1','T-3','T-2','T-5']) orders.push({id, createdAt: 77, status:'paid'});
const p1 = listOrders(orders, {limit:2});
orders.push({id:'T-0', createdAt: 77, status:'paid'});
const p2 = listOrders(orders, {limit:10, cursor:p1.nextCursor});
return [[p1.items.map(o => o.id), p2.items.map(o => o.id)], [['T-1','T-2'], ['T-3','T-4','T-5']]];` },
        { name: 'Cursor still works after its order is deleted', src: `const orders = [{id:'a', createdAt:30, status:'paid'}, {id:'b', createdAt:20, status:'paid'}, {id:'c', createdAt:10, status:'paid'}];
const p1 = listOrders(orders, {limit:2});
orders.splice(1, 1);
return [listOrders(orders, {limit:2, cursor:p1.nextCursor}).items.map(o => o.id), ['c']];` },
        { name: 'Large timestamps survive the cursor round trip', src: `const orders = [{id:'z', createdAt:1799999999, status:'paid'}, {id:'y', createdAt:1799999998, status:'paid'}, {id:'x', createdAt:1799999997, status:'paid'}];
const p1 = listOrders(orders, {limit:1});
const p2 = listOrders(orders, {limit:1, cursor:p1.nextCursor});
const p3 = listOrders(orders, {limit:1, cursor:p2.nextCursor});
return [[p1.items[0].id, p2.items[0].id, p3.items[0].id, p3.nextCursor], ['z','y','x',null]];` },
        { name: '20k orders paged 500 at a time', src: `const orders = []; let s = 3;
for (let i = 0; i < 20000; i++) { s = (s * 48271) % 2147483647; orders.push({id:'L-' + i, createdAt: 1000 + s % 5000, status:'paid'}); }
let cursor = null, n = 0, pages = 0, last = null;
do { const p = listOrders(orders, {limit:500, cursor}); n += p.items.length; last = p.items[p.items.length - 1].id; cursor = p.nextCursor; pages++; } while (cursor);
return [[n, pages, last], [20000, 40, 'L-3372']];` },
      ],
    },
  ],
  followUps: [
    'The orders live in Postgres. What index makes the cursor query fast, and what does the WHERE clause look like?',
    'A client edits the cursor string by hand. How would you validate or sign it?',
    'Support wants a "jump to page 40" button. How does that fit with cursors?',
  ],
  rubric: 'Bugs: (1) the comparator returns a boolean, so sort never sees a negative value and the order is wrong; (2) no id tie-break; (3) the status filter runs even when status is undefined, so "All orders" is empty. Strong: numeric comparator with explicit string tie-break, filter only when status is given, cursor encodes (createdAt, id) and the next page keeps rows strictly after that tuple in feed order, nextCursor computed by checking whether anything remains (not just items.length === limit), explains why offsets duplicate rows when newer orders arrive. Weak: patching the comparator to `b.createdAt - a.createdAt` without a tie-break, encoding an offset or index in the cursor, comparing only createdAt so same-second orders are skipped or repeated, sorting the caller\'s array in place.',
  offline: {
    approach: 'First fix the comparator so it returns a number: `b.createdAt - a.createdAt`, and when that is 0 compare ids as strings. Filter by status only when `status !== undefined`. For paging, the cursor is the `(createdAt, id)` of the last item. Because that tuple fully defines a position in the sort order, "orders after the cursor" is the set where the comparator says cursor < order, which stays correct when newer rows are added above it.',
    hints: [
      '`Array.prototype.sort` treats a `true`/`false` result as `1`/`0`, so it never sees "a comes first". Return a negative, zero or positive number.',
      'An undefined `status` should mean "no filter", not "status equals undefined".',
      'Encode the cursor as something like `createdAt + "|" + id`, and split on the first `|` to decode it.',
      'After filtering and sorting, drop everything at or before the cursor using the same comparator, take `limit`, and set `nextCursor` only if more rows remain.',
    ],
    edge: [
      'Several orders created in the same second, split across two pages.',
      'Exactly `limit` orders left on the last page (nextCursor must be `null`).',
      'New, newer orders inserted between page fetches.',
      'The order the cursor points at is deleted before the next call.',
      'Ids such as `C-10` and `C-9`, which sort as strings.',
    ],
    complexity: 'Each call filters and sorts: **O(n log n)** time and **O(n)** extra space. Walking all pages costs O(p · n log n) here; with a database index on `(createdAt DESC, id ASC)` each page becomes **O(log n + limit)**.',
    skeleton: `function compareOrders(a, b) {
  // TODO: createdAt desc, then id asc as strings
}

function listOrders(orders, { status, limit = Infinity, cursor = null } = {}) {
  let rows = orders.filter(o => status === undefined || o.status === status);
  if (cursor) {
    // TODO: decode (createdAt, id) and keep only rows after it
  }
  rows.sort(compareOrders);
  const items = rows.slice(0, limit);
  // TODO: nextCursor from the last item when rows remain
  return { items, nextCursor: null };
}`,
  },
  solution: `// Feed order: newest first, then id ascending for the same second.
function compareOrders(a, b) {
  if (a.createdAt !== b.createdAt) return b.createdAt - a.createdAt;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

// The cursor names a position in feed order, not an index, so inserts
// above it do not shift the next page.
function encodeCursor(order) {
  return order.createdAt + '|' + order.id;
}

function decodeCursor(cursor) {
  const sep = cursor.indexOf('|');
  const createdAt = Number(cursor.slice(0, sep));
  if (sep < 0 || !Number.isFinite(createdAt)) throw new Error('Invalid cursor');
  return { createdAt, id: cursor.slice(sep + 1) };
}

function listOrders(orders, { status, limit = Infinity, cursor = null } = {}) {
  let rows = orders.filter(o => status === undefined || o.status === status);
  if (cursor) {
    const after = decodeCursor(cursor);
    rows = rows.filter(o => compareOrders(after, o) < 0);
  }
  rows.sort(compareOrders);

  const items = rows.slice(0, limit);
  const nextCursor = rows.length > items.length ? encodeCursor(items[items.length - 1]) : null;
  return { items, nextCursor };
}
`,
});
