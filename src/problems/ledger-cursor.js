PROBLEMS.push({
  id: 'ledger-cursor',
  title: 'Ledger table cursor and pages',
  team: 'Payments Ledger',
  level: 'Mid-level',
  difficulty: 'Hard',
  minutes: 50,
  focus: ['Debugging', 'Iterators', 'Pagination'],
  format: 'Modeled on a 2026 debug-and-extend codebase round: find a bug in a small existing class, then add sorting and stable pagination on top of it.',
  scenario: 'The ledger team tests reporting code against a small in-memory table instead of the real database. Reports built on it keep coming up short, and the statements page needs pagination that holds up while new entries arrive.',
  body: `
<p>The starter has a working <code>Table</code> and a <code>Cursor</code>. Rows are plain objects, and every row has a unique numeric <code>id</code>.</p>
<ul>
<li><code>table.insert(row)</code> stores a row.</li>
<li><code>table.query(predicate)</code> returns a <code>Cursor</code> over the rows for which <code>predicate(row)</code> is true, in insertion order.</li>
<li><code>cursor.hasNext()</code> says whether another row is available. <code>cursor.next()</code> returns that row and moves past it.</li>
</ul>
<p>Later parts add options to <code>query</code> and a new <code>page</code> method. Keep every earlier test passing.</p>`,
  examples: `const t = new Table();
t.insert({ id: 1, account: "acme", amount: 120 });
t.insert({ id: 2, account: "zeta", amount: 40 });
t.insert({ id: 3, account: "acme", amount: 75 });

const c = t.query(r => r.account === "acme");
while (c.hasNext()) console.log(c.next().id);   // 1, then 3
c.next();                                        // throws Error("No more rows")

t.query(() => true, { orderBy: "amount", limit: 2 });  // cursor over ids 2, 3

const p1 = t.page(() => true, { orderBy: "amount", limit: 2 });
// { rows: [id 2, id 3], token: "<opaque string>" }
t.page(() => true, { orderBy: "amount", limit: 2, after: p1.token });
// { rows: [id 1], token: null }`,
  constraints: ['Up to 10⁴ rows per table', 'ids are unique integers', 'orderBy columns hold numbers or strings, never mixed within a column', 'No external libraries'],
  starter: `class Cursor {
  constructor(rows, predicate) {
    this._rows = rows;
    this._pred = predicate;
    this._pos = 0;
  }

  /** @returns {boolean} true if next() will return a row */
  hasNext() {
    while (this._pos < this._rows.length) {
      if (this._pred(this._rows[this._pos++])) return true;
    }
    return false;
  }

  /** @returns {object} the next matching row */
  next() {
    while (this._pos < this._rows.length) {
      const row = this._rows[this._pos++];
      if (this._pred(row)) return row;
    }
    return undefined;
  }
}

class Table {
  constructor() {
    this._rows = [];
  }

  insert(row) {
    this._rows.push(row);
  }

  /**
   * @param {(row: object) => boolean} predicate
   * @param {{orderBy?: string, limit?: number}} [options]
   * @returns {Cursor}
   */
  query(predicate, options = {}) {
    return new Cursor(this._rows, predicate);
  }

  /**
   * @param {(row: object) => boolean} predicate
   * @param {{orderBy?: string, limit: number, after?: string}} options
   * @returns {{rows: object[], token: string|null}}
   */
  page(predicate, options) {
    // TODO
  }
}
`,
  parts: [
    {
      title: 'Part 1: Reports are missing rows',
      body: `<p>Report code loops with <code>while (c.hasNext()) rows.push(c.next())</code> and gets fewer rows than the table holds. Code that checks <code>hasNext()</code> more than once before reading loses even more. Also, reading past the end quietly returns <code>undefined</code>, which hides the problem.</p>
<p>Fix the cursor. Calling <code>hasNext()</code> any number of times must not change what <code>next()</code> returns. Calling <code>next()</code> when no row is left must throw an <code>Error</code> with the message <code>"No more rows"</code>.</p>`,
      tests: [
        { name: 'Loop sees every matching row', src: `const t = new Table();
[[1,'acme',120],[2,'zeta',40],[3,'acme',75],[4,'acme',10]].forEach(([id,account,amount]) => t.insert({id, account, amount}));
const c = t.query(r => r.account === 'acme'); const ids = [];
while (c.hasNext()) ids.push(c.next().id);
return [ids, [1, 3, 4]];` },
        { name: 'hasNext twice does not skip', src: `const t = new Table();
for (let i = 1; i <= 3; i++) t.insert({id: i, amount: i});
const c = t.query(() => true);
c.hasNext(); c.hasNext();
const a = c.next().id; c.hasNext(); c.hasNext(); c.hasNext();
return [[a, c.next().id, c.next().id, c.hasNext()], [1, 2, 3, false]];` },
        { name: 'next past the end throws', src: `const t = new Table(); t.insert({id: 1, amount: 5});
const c = t.query(() => true); c.next();
try { c.next(); return ['no error', 'No more rows']; } catch (e) { return [e.message, 'No more rows']; }` },
        { name: 'next without hasNext', src: `const t = new Table();
for (let i = 1; i <= 5; i++) t.insert({id: i, amount: i * 10});
const c = t.query(r => r.amount % 20 === 0);
return [[c.next().id, c.next().id], [2, 4]];` },
      ],
      hidden: [
        { name: 'No matches', src: `const t = new Table(); t.insert({id: 1, amount: 5});
const c = t.query(r => r.amount > 100);
let msg = ''; try { c.next(); } catch (e) { msg = e.message; }
return [[c.hasNext(), c.hasNext(), msg], [false, false, 'No more rows']];` },
        { name: 'Empty table', src: `const c = new Table().query(() => true);
return [c.hasNext(), false];` },
        { name: 'Two cursors are independent', src: `const t = new Table();
for (let i = 1; i <= 4; i++) t.insert({id: i, amount: i});
const a = t.query(() => true), b = t.query(() => true);
a.next(); a.next();
return [[b.next().id, a.next().id], [1, 3]];` },
      ],
    },
    {
      title: 'Part 2: Sorted queries with a limit',
      body: `<p><code>query(predicate, { orderBy, limit })</code> now honours its options.</p>
<ul>
<li><code>orderBy</code> names a column. Matching rows come back sorted by that column ascending, and rows with equal values are ordered by <code>id</code> ascending.</li>
<li><code>limit</code> caps how many rows the cursor returns. <code>limit: 0</code> returns none.</li>
<li>Without <code>orderBy</code>, rows keep insertion order. Without <code>limit</code>, every match is returned.</li>
</ul>`,
      tests: [
        { name: 'Sorted by a numeric column', src: `const t = new Table();
[[1,120],[2,40],[3,75],[4,10]].forEach(([id,amount]) => t.insert({id, amount}));
const c = t.query(() => true, {orderBy: 'amount'}); const ids = [];
while (c.hasNext()) ids.push(c.next().id);
return [ids, [4, 2, 3, 1]];` },
        { name: 'Ties broken by id', src: `const t = new Table();
[[9,50],[3,50],[7,10],[5,50]].forEach(([id,amount]) => t.insert({id, amount}));
const c = t.query(() => true, {orderBy: 'amount'}); const ids = [];
while (c.hasNext()) ids.push(c.next().id);
return [ids, [7, 3, 5, 9]];` },
        { name: 'Limit with a filter', src: `const t = new Table();
for (let i = 1; i <= 10; i++) t.insert({id: i, account: i % 2 ? 'odd' : 'even', amount: 100 - i});
const c = t.query(r => r.account === 'odd', {orderBy: 'amount', limit: 2}); const ids = [];
while (c.hasNext()) ids.push(c.next().id);
return [ids, [9, 7]];` },
        { name: 'String column order', src: `const t = new Table();
['mango','apple','kiwi','apple'].forEach((name, i) => t.insert({id: 10 - i, name}));
const c = t.query(() => true, {orderBy: 'name'}); const ids = [];
while (c.hasNext()) ids.push(c.next().id);
return [ids, [7, 9, 8, 10]];` },
      ],
      hidden: [
        { name: 'Limit of zero', src: `const t = new Table(); t.insert({id: 1, amount: 1});
return [t.query(() => true, {limit: 0}).hasNext(), false];` },
        { name: 'Limit without orderBy keeps insertion order', src: `const t = new Table();
[5, 1, 4, 2].forEach(id => t.insert({id, amount: 0}));
const c = t.query(() => true, {limit: 3}); const ids = [];
while (c.hasNext()) ids.push(c.next().id);
return [ids, [5, 1, 4]];` },
        { name: 'Limit larger than the matches', src: `const t = new Table();
[3, 1, 2].forEach(id => t.insert({id, amount: id}));
const c = t.query(r => r.id > 1, {orderBy: 'id', limit: 50}); const ids = [];
while (c.hasNext()) ids.push(c.next().id);
let msg = ''; try { c.next(); } catch (e) { msg = e.message; }
return [[ids, msg], [[2, 3], 'No more rows']];` },
        { name: 'Sorting does not reorder the table', src: `const t = new Table();
[3, 1, 2].forEach(id => t.insert({id, amount: id}));
t.query(() => true, {orderBy: 'amount'});
const c = t.query(() => true); const ids = [];
while (c.hasNext()) ids.push(c.next().id);
return [ids, [3, 1, 2]];` },
      ],
    },
    {
      title: 'Part 3: Pages that survive inserts',
      body: `<p>Add <code>page(predicate, { orderBy, limit, after })</code>. It returns <code>{ rows, token }</code>.</p>
<ul>
<li>Order is the same as <code>query</code>: by <code>orderBy</code> ascending, ties by <code>id</code>. If <code>orderBy</code> is missing, order by <code>id</code>.</li>
<li><code>rows</code> holds at most <code>limit</code> matching rows. Without <code>after</code> it starts at the beginning.</li>
<li><code>token</code> is an opaque string that, passed back as <code>after</code>, resumes right after the last row of this page. It is <code>null</code> when no matching row comes after this page.</li>
<li>Rows inserted between page calls must not cause any already-existing row to be returned twice or skipped. A new row appears on a later page only if it sorts after the token.</li>
<li>If <code>after</code> is not a token this method produced, throw an <code>Error</code> with the message <code>"Invalid page token"</code>.</li>
</ul>`,
      tests: [
        { name: 'Walk every page', src: `const t = new Table();
[[1,50],[2,10],[3,40],[4,20],[5,30]].forEach(([id,amount]) => t.insert({id, amount}));
const seen = []; let after; let pages = 0;
do { const p = t.page(() => true, {orderBy: 'amount', limit: 2, after}); seen.push(p.rows.map(r => r.id)); after = p.token; pages++; } while (after && pages < 10);
return [seen, [[2, 4], [5, 3], [1]]];` },
        { name: 'Token is a string, then null at the end', src: `const t = new Table();
for (let i = 1; i <= 4; i++) t.insert({id: i, amount: i});
const p1 = t.page(() => true, {orderBy: 'amount', limit: 2});
const p2 = t.page(() => true, {orderBy: 'amount', limit: 2, after: p1.token});
return [[typeof p1.token, p2.rows.map(r => r.id), p2.token], ['string', [3, 4], null]];` },
        { name: 'Inserts between pages cause no duplicates or skips', src: `const t = new Table();
[[1,10],[2,20],[3,30],[4,40],[5,50]].forEach(([id,amount]) => t.insert({id, amount}));
const p1 = t.page(() => true, {orderBy: 'amount', limit: 2});
t.insert({id: 6, amount: 5});
t.insert({id: 7, amount: 35});
const p2 = t.page(() => true, {orderBy: 'amount', limit: 2, after: p1.token});
const p3 = t.page(() => true, {orderBy: 'amount', limit: 2, after: p2.token});
return [[p1.rows.map(r => r.id), p2.rows.map(r => r.id), p3.rows.map(r => r.id), p3.token], [[1, 2], [3, 7], [4, 5], null]];` },
        { name: 'Page boundary inside a run of equal values', src: `const t = new Table();
[8, 2, 6, 4].forEach(id => t.insert({id, amount: 100}));
t.insert({id: 1, amount: 200});
const p1 = t.page(() => true, {orderBy: 'amount', limit: 3});
const p2 = t.page(() => true, {orderBy: 'amount', limit: 3, after: p1.token});
return [[p1.rows.map(r => r.id), p2.rows.map(r => r.id)], [[2, 4, 6], [8, 1]]];` },
      ],
      hidden: [
        { name: 'Malformed token', src: `const t = new Table(); t.insert({id: 1, amount: 1});
try { t.page(() => true, {limit: 1, after: 'garbage'}); return ['no error', 'Invalid page token']; } catch (e) { return [e.message, 'Invalid page token']; }` },
        { name: 'Empty result', src: `const t = new Table(); t.insert({id: 1, amount: 1});
return [t.page(r => r.amount > 5, {orderBy: 'amount', limit: 3}), {rows: [], token: null}];` },
        { name: 'Default order is by id, with a filter', src: `const t = new Table();
[9, 4, 7, 1, 3].forEach(id => t.insert({id, kind: id % 2 ? 'debit' : 'credit'}));
const p1 = t.page(r => r.kind === 'debit', {limit: 2});
const p2 = t.page(r => r.kind === 'debit', {limit: 2, after: p1.token});
return [[p1.rows.map(r => r.id), p2.rows.map(r => r.id), p2.token], [[1, 3], [7, 9], null]];` },
        { name: '5000 rows paged while new rows keep arriving', src: `let s = 11; const rnd = () => (s = (s * 48271) % 2147483647);
const t = new Table(); const original = [];
for (let i = 1; i <= 5000; i++) { t.insert({id: i, amount: rnd() % 300}); original.push(i); }
let nextId = 5001, after, pages = 0; const seen = [];
do {
  const p = t.page(() => true, {orderBy: 'amount', limit: 37, after});
  for (const r of p.rows) seen.push(r.id);
  after = p.token; pages++;
  t.insert({id: nextId++, amount: rnd() % 300});
} while (after && pages < 1000);
const oldSeen = seen.filter(id => id <= 5000);
const dupes = seen.length - new Set(seen).size;
let sorted = true; const amt = new Map();
const c = t.query(() => true); while (c.hasNext()) { const r = c.next(); amt.set(r.id, r.amount); }
for (let i = 1; i < seen.length; i++) { const a = amt.get(seen[i - 1]), b = amt.get(seen[i]); if (a > b || (a === b && seen[i - 1] > seen[i])) sorted = false; }
return [[oldSeen.length, dupes, sorted], [5000, 0, true]];` },
      ],
    },
  ],
  followUps: ['Your token encodes the last value and id. What happens if a client reuses a token with a different orderBy or filter, and how would you detect it?', 'On a real database, which index makes each page O(log n + limit) instead of a full scan and sort?', 'Rows can now be updated in place, including the orderBy column. What guarantees can keyset pagination still give?'],
  rubric: 'Strong: spots that hasNext consumes the row and fixes it with a one-row lookahead buffer (or by making hasNext only peek); next throws "No more rows"; sorts a copy of the matches with a comparator on (column, id); limit applied after sorting; page uses keyset logic (value > last or value === last and id > last.id) instead of an offset; token is an encoded tuple validated on decode; fetches limit + 1 to decide whether the token is null. Weak: patching the report loop instead of the cursor, sorting this._rows in place, offset-based tokens (duplicates after an insert), forgetting the id tie-break so equal values split across pages lose rows, non-string tokens.',
  offline: {
    approach: 'The cursor bug is that `hasNext()` both finds the next match and moves past it. Give the cursor a one-row lookahead: `hasNext()` fills a buffer if it is empty, `next()` returns and clears the buffer. For Part 2, filter, copy, sort with a `(column, id)` comparator and slice to `limit`. For Part 3, encode the last row\'s `[value, id]` as the token and on the next call keep only rows strictly after that tuple.',
    hints: ['Trace `while (c.hasNext()) c.next()` by hand on two rows. Which row does `next()` return first?', 'Store the found row in something like `this._buffered`. `hasNext` only searches when nothing is buffered; `next` uses the buffer.', 'Comparator: `(a, b) => a[col] < b[col] ? -1 : a[col] > b[col] ? 1 : a.id - b.id`. Never sort `this._rows` itself.', 'An offset token breaks when a row is inserted earlier in the order. Remember the last row\'s `(value, id)` instead, and take `limit + 1` rows to know whether another page exists.'],
    edge: ['Calling `hasNext()` several times in a row.', '`next()` after the last row.', 'A page boundary in the middle of equal `orderBy` values.', 'A row inserted between pages that sorts before the token.', 'A token string that was never issued by `page`.'],
    complexity: 'Each `query` or `page` call filters and sorts the table: **O(n log n)** time and **O(n)** extra space. Cursor operations are **O(1)** amortized. A sorted index on `(orderBy, id)` would make each page **O(log n + limit)**.',
    skeleton: `class Cursor {
  constructor(rows) {
    this._rows = rows;   // already filtered (and sorted)
    this._pos = 0;
  }
  hasNext() {
    // TODO: report without moving
  }
  next() {
    // TODO: throw new Error('No more rows') at the end
  }
}

class Table {
  constructor() { this._rows = []; }
  insert(row) { this._rows.push(row); }

  _sorted(predicate, orderBy) {
    const rows = this._rows.filter(predicate);
    // TODO: sort by orderBy, then id, when orderBy is given
    return rows;
  }

  query(predicate, options = {}) {
    // TODO: apply limit
  }

  page(predicate, options) {
    // TODO: decode token, keep rows after (value, id), take limit + 1
  }
}`,
  },
  solution: `class Cursor {
  constructor(rows) {
    this._rows = rows; // the matching rows, already in final order
    this._pos = 0;
  }

  hasNext() {
    // Only looks; never moves the position.
    return this._pos < this._rows.length;
  }

  next() {
    if (!this.hasNext()) throw new Error('No more rows');
    return this._rows[this._pos++];
  }
}

function compareBy(column) {
  return (a, b) => {
    if (a[column] < b[column]) return -1;
    if (a[column] > b[column]) return 1;
    return a.id - b.id;
  };
}

class Table {
  constructor() {
    this._rows = [];
  }

  insert(row) {
    this._rows.push(row);
  }

  // Matching rows in output order. Sorts a copy, never the table itself.
  _matches(predicate, orderBy) {
    const rows = this._rows.filter(predicate);
    if (orderBy) rows.sort(compareBy(orderBy));
    return rows;
  }

  query(predicate, options = {}) {
    let rows = this._matches(predicate, options.orderBy);
    if (options.limit !== undefined) rows = rows.slice(0, options.limit);
    return new Cursor(rows);
  }

  page(predicate, options = {}) {
    const orderBy = options.orderBy || 'id';
    let rows = this._matches(predicate, orderBy);

    if (options.after !== undefined && options.after !== null) {
      const [lastValue, lastId] = decodeToken(options.after);
      // Keyset: keep rows strictly after (lastValue, lastId).
      rows = rows.filter(r =>
        r[orderBy] > lastValue || (r[orderBy] === lastValue && r.id > lastId));
    }

    const pageRows = rows.slice(0, options.limit);
    const hasMore = rows.length > pageRows.length;
    const last = pageRows[pageRows.length - 1];
    const token = hasMore ? encodeToken([last[orderBy], last.id]) : null;
    return { rows: pageRows, token };
  }
}

const TOKEN_PREFIX = 'pg1:';

function encodeToken(tuple) {
  return TOKEN_PREFIX + JSON.stringify(tuple);
}

function decodeToken(token) {
  if (typeof token !== 'string' || !token.startsWith(TOKEN_PREFIX)) {
    throw new Error('Invalid page token');
  }
  let tuple;
  try {
    tuple = JSON.parse(token.slice(TOKEN_PREFIX.length));
  } catch (e) {
    throw new Error('Invalid page token');
  }
  if (!Array.isArray(tuple) || tuple.length !== 2 || typeof tuple[1] !== 'number') {
    throw new Error('Invalid page token');
  }
  return tuple;
}
`,
});
