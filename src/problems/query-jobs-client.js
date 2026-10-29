PROBLEMS.push({
  id: 'query-jobs-client',
  title: 'Warehouse query job client',
  team: 'Data Platform',
  level: 'Mid-level',
  difficulty: 'Medium',
  minutes: 45,
  focus: ['State machines', 'Error handling', 'Concurrency limits'],
  format: 'Modeled on a 2026 round built around a mock data-warehouse client: track async query jobs against a fake backend, then add a batch runner with a concurrency cap.',
  scenario: 'Analysts run nightly SQL against the warehouse, which accepts a query, runs it in the background, and is polled for status. The network to it drops calls now and then. You are writing the client the reporting scripts use.',
  body: `
<p>Implement <code>JobClient</code>. It wraps a <code>backend</code> that the tests provide. The backend is synchronous and scripted:</p>
<ul>
<li><code>backend.start(sql)</code> starts a query and returns the backend's own key for it (a string).</li>
<li><code>backend.status(key)</code> returns <code>"QUEUED"</code>, <code>"RUNNING"</code>, <code>"SUCCEEDED"</code> or <code>"FAILED"</code>. Each call may move the job forward. It can also throw an object with <code>transient: true</code>, which means the call was lost on the network.</li>
<li><code>backend.rows(key)</code> returns the result rows of a job that succeeded.</li>
</ul>
<p>The client gives each job its own id: <code>"j1"</code>, <code>"j2"</code>, and so on, in submission order. <code>SUCCEEDED</code> and <code>FAILED</code> are final: once a job reaches one, the client never asks the backend about it again.</p>`,
  examples: `// Test double: each SQL string maps to the statuses the backend reports, one per status() call.
// "NET" means that call throws { transient: true }. The last status repeats.
const backend = fakeBackend({
  "SELECT 1": ["RUNNING", "NET", "SUCCEEDED"],
  "A": ["RUNNING", "SUCCEEDED"], "B": ["RUNNING", "SUCCEEDED"], "C": ["RUNNING", "SUCCEEDED"],
});
const client = new JobClient(backend);
client.submit("SELECT 1");   // "j1"
client.poll("j1");           // "RUNNING"
client.poll("j1");           // "RUNNING" (network error, last known state)
client.poll("j1");           // "SUCCEEDED"
client.result("j1");         // [{ sql: "SELECT 1" }]

client.submitBatch(["A", "B", "C"], 2);  // ["j2", "j3", "j4"], only j2 and j3 start
client.pollAll();  // { PENDING: 1, QUEUED: 0, RUNNING: 2, SUCCEEDED: 1, FAILED: 0 }`,
  constraints: ['Up to 10⁴ jobs per client', 'The backend never calls back; all progress happens inside poll and pollAll', 'Error messages must match exactly', 'Never call Date.now() or timers'],
  starter: `class JobClient {
  /**
   * @param {{start(sql: string): string, status(key: string): string, rows(key: string): object[]}} backend
   */
  constructor(backend) {
    this.backend = backend;
    // TODO
  }

  /** @returns {string} job id, "j1", "j2", ... */
  submit(sql) {
    // TODO
  }

  /** @returns {string} the job's state after this poll */
  poll(id) {
    // TODO
  }

  /** @returns {object[]} rows of a job that succeeded */
  result(id) {
    // TODO
  }

  /** @returns {string[]} job ids, in the order of sqls */
  submitBatch(sqls, maxConcurrent) {
    // TODO
  }

  /** @returns {{PENDING: number, QUEUED: number, RUNNING: number, SUCCEEDED: number, FAILED: number}} */
  pollAll() {
    // TODO
  }
}
`,
  parts: [
    {
      title: 'Part 1: Submit, poll and fetch results',
      body: `<ul>
<li><code>submit(sql)</code> calls <code>backend.start(sql)</code> right away and returns the next job id. The job's state starts as <code>"QUEUED"</code>.</li>
<li><code>poll(id)</code> asks the backend for the job's status once, records it and returns it. If that call throws a transient error, the state does not change and <code>poll</code> returns the last known state. Any other error from the backend is rethrown unchanged. Polling a finished job returns its state without calling the backend.</li>
<li><code>result(id)</code> returns <code>backend.rows(key)</code> for a job in <code>SUCCEEDED</code>. Otherwise it throws an <code>Error</code> with one of these messages:
<ul>
<li>unknown id: <code>"Unknown job: j9"</code> (also thrown by <code>poll</code>)</li>
<li>not finished: <code>"Job j1 is not finished (RUNNING)"</code>, with the current state</li>
<li>failed: <code>"Job j1 failed"</code></li>
</ul></li>
</ul>`,
      tests: [
        { name: 'Ids count up from j1', src: `const fakeBackend = s => { const jobs = {}, started = []; return { started, start(sql) { started.push(sql); const k = 'q' + started.length; jobs[k] = { sql, steps: s[sql].slice() }; return k; }, status(k) { const j = jobs[k]; const st = j.steps.length > 1 ? j.steps.shift() : j.steps[0]; if (st === 'NET') throw { transient: true }; return st; }, rows(k) { return [{ sql: jobs[k].sql }]; } }; };
const be = fakeBackend({A: ['SUCCEEDED'], B: ['RUNNING']});
const c = new JobClient(be);
return [[c.submit('A'), c.submit('B'), c.submit('A'), be.started], ['j1', 'j2', 'j3', ['A', 'B', 'A']]];` },
        { name: 'Poll walks the scripted states', src: `const fakeBackend = s => { const jobs = {}, started = []; return { started, start(sql) { started.push(sql); const k = 'q' + started.length; jobs[k] = { sql, steps: s[sql].slice() }; return k; }, status(k) { const j = jobs[k]; const st = j.steps.length > 1 ? j.steps.shift() : j.steps[0]; if (st === 'NET') throw { transient: true }; return st; }, rows(k) { return [{ sql: jobs[k].sql }]; } }; };
const c = new JobClient(fakeBackend({Q: ['QUEUED', 'RUNNING', 'RUNNING', 'SUCCEEDED']}));
const id = c.submit('Q'); const seen = [];
for (let i = 0; i < 5; i++) seen.push(c.poll(id));
return [[seen, c.result(id)], [['QUEUED', 'RUNNING', 'RUNNING', 'SUCCEEDED', 'SUCCEEDED'], [{sql: 'Q'}]]];` },
        { name: 'Network error keeps the last known state', src: `const fakeBackend = s => { const jobs = {}, started = []; return { started, start(sql) { started.push(sql); const k = 'q' + started.length; jobs[k] = { sql, steps: s[sql].slice() }; return k; }, status(k) { const j = jobs[k]; const st = j.steps.length > 1 ? j.steps.shift() : j.steps[0]; if (st === 'NET') throw { transient: true }; return st; }, rows(k) { return [{ sql: jobs[k].sql }]; } }; };
const c = new JobClient(fakeBackend({Q: ['NET', 'RUNNING', 'NET', 'NET', 'FAILED']}));
const id = c.submit('Q'); const seen = [];
for (let i = 0; i < 5; i++) seen.push(c.poll(id));
return [seen, ['QUEUED', 'RUNNING', 'RUNNING', 'RUNNING', 'FAILED']];` },
        { name: 'Result errors', src: `const fakeBackend = s => { const jobs = {}, started = []; return { started, start(sql) { started.push(sql); const k = 'q' + started.length; jobs[k] = { sql, steps: s[sql].slice() }; return k; }, status(k) { const j = jobs[k]; const st = j.steps.length > 1 ? j.steps.shift() : j.steps[0]; if (st === 'NET') throw { transient: true }; return st; }, rows(k) { return [{ sql: jobs[k].sql }]; } }; };
const c = new JobClient(fakeBackend({OK: ['RUNNING'], BAD: ['FAILED']}));
const a = c.submit('OK'), b = c.submit('BAD');
c.poll(a); c.poll(b);
const msg = f => { try { f(); return 'no error'; } catch (e) { return e.message; } };
return [[msg(() => c.result('j9')), msg(() => c.result(a)), msg(() => c.result(b)), msg(() => c.poll('j9'))], ['Unknown job: j9', 'Job j1 is not finished (RUNNING)', 'Job j2 failed', 'Unknown job: j9']];` },
      ],
      hidden: [
        { name: 'Finished jobs are not polled again', src: `const fakeBackend = s => { const jobs = {}, started = []; return { started, start(sql) { started.push(sql); const k = 'q' + started.length; jobs[k] = { sql, steps: s[sql].slice() }; return k; }, status(k) { const j = jobs[k]; const st = j.steps.length > 1 ? j.steps.shift() : j.steps[0]; if (st === 'NET') throw { transient: true }; return st; }, rows(k) { return [{ sql: jobs[k].sql }]; } }; };
const be = fakeBackend({Q: ['SUCCEEDED']}); let calls = 0;
const status = be.status; be.status = k => { calls++; return status(k); };
const c = new JobClient(be); const id = c.submit('Q');
c.poll(id); c.poll(id); c.poll(id);
return [[calls, c.poll(id)], [1, 'SUCCEEDED']];` },
        { name: 'Result before any poll', src: `const fakeBackend = s => { const jobs = {}, started = []; return { started, start(sql) { started.push(sql); const k = 'q' + started.length; jobs[k] = { sql, steps: s[sql].slice() }; return k; }, status(k) { const j = jobs[k]; const st = j.steps.length > 1 ? j.steps.shift() : j.steps[0]; if (st === 'NET') throw { transient: true }; return st; }, rows(k) { return [{ sql: jobs[k].sql }]; } }; };
const c = new JobClient(fakeBackend({Q: ['SUCCEEDED']})); const id = c.submit('Q');
try { c.result(id); return ['no error', 'Job j1 is not finished (QUEUED)']; } catch (e) { return [e.message, 'Job j1 is not finished (QUEUED)']; }` },
        { name: 'Other backend errors are rethrown', src: `const be = { start: () => 'k', status: () => { throw new Error('auth expired'); }, rows: () => [] };
const c = new JobClient(be); const id = c.submit('X');
let msg = ''; try { c.poll(id); } catch (e) { msg = e.message; }
let state = ''; try { c.result(id); } catch (e) { state = e.message; }
return [[msg, state], ['auth expired', 'Job j1 is not finished (QUEUED)']];` },
        { name: 'Jobs keep separate backend keys', src: `const fakeBackend = s => { const jobs = {}, started = []; return { started, start(sql) { started.push(sql); const k = 'q' + started.length; jobs[k] = { sql, steps: s[sql].slice() }; return k; }, status(k) { const j = jobs[k]; const st = j.steps.length > 1 ? j.steps.shift() : j.steps[0]; if (st === 'NET') throw { transient: true }; return st; }, rows(k) { return [{ sql: jobs[k].sql }]; } }; };
const c = new JobClient(fakeBackend({X: ['SUCCEEDED'], Y: ['RUNNING', 'SUCCEEDED']}));
const a = c.submit('Y'), b = c.submit('X');
return [[c.poll(b), c.poll(a), c.result(b), c.poll(a), c.result(a)], ['SUCCEEDED', 'RUNNING', [{sql: 'X'}], 'SUCCEEDED', [{sql: 'Y'}]]];` },
      ],
    },
    {
      title: 'Part 2: Batches with a concurrency cap',
      body: `<p>Reporting scripts submit dozens of queries at once and overload the warehouse. Add batches.</p>
<ul>
<li><code>submitBatch(sqls, maxConcurrent)</code> assigns an id to every query, in order, and returns the ids. Only the first <code>maxConcurrent</code> are started on the backend (state <code>"QUEUED"</code>). The rest wait in the client with state <code>"PENDING"</code> and are not sent to the backend yet.</li>
<li>Each batch has its own cap. A job is in flight from when it is started until it reaches <code>SUCCEEDED</code> or <code>FAILED</code>. Whenever a batch job finishes, through <code>poll</code> or <code>pollAll</code>, the batch's next pending job (lowest id) is started at once.</li>
<li><code>poll(id)</code> on a pending job returns <code>"PENDING"</code> without calling the backend. <code>result(id)</code> on it throws <code>"Job j4 is not finished (PENDING)"</code>.</li>
<li><code>pollAll()</code> polls, once each and in id order, every job that was in flight when the call began. Jobs started during the call are not polled until the next call. Transient errors leave a job's state unchanged, as in <code>poll</code>.</li>
<li><code>pollAll()</code> returns counts over all of the client's jobs, with all five keys: <code>{ PENDING, QUEUED, RUNNING, SUCCEEDED, FAILED }</code>.</li>
</ul>`,
      tests: [
        { name: 'Only the cap starts right away', src: `const fakeBackend = s => { const jobs = {}, started = []; return { started, start(sql) { started.push(sql); const k = 'q' + started.length; jobs[k] = { sql, steps: s[sql].slice() }; return k; }, status(k) { const j = jobs[k]; const st = j.steps.length > 1 ? j.steps.shift() : j.steps[0]; if (st === 'NET') throw { transient: true }; return st; }, rows(k) { return [{ sql: jobs[k].sql }]; } }; };
const be = fakeBackend({A: ['RUNNING'], B: ['RUNNING'], C: ['RUNNING'], D: ['RUNNING']});
const c = new JobClient(be);
const ids = c.submitBatch(['A', 'B', 'C', 'D'], 2);
return [[ids, be.started, c.poll('j3')], [['j1', 'j2', 'j3', 'j4'], ['A', 'B'], 'PENDING']];` },
        { name: 'Pending jobs start as others finish', src: `const fakeBackend = s => { const jobs = {}, started = []; return { started, start(sql) { started.push(sql); const k = 'q' + started.length; jobs[k] = { sql, steps: s[sql].slice() }; return k; }, status(k) { const j = jobs[k]; const st = j.steps.length > 1 ? j.steps.shift() : j.steps[0]; if (st === 'NET') throw { transient: true }; return st; }, rows(k) { return [{ sql: jobs[k].sql }]; } }; };
const be = fakeBackend({A: ['SUCCEEDED'], B: ['RUNNING', 'RUNNING', 'SUCCEEDED'], C: ['FAILED'], D: ['SUCCEEDED']});
const c = new JobClient(be);
c.submitBatch(['A', 'B', 'C', 'D'], 2);
const out = [];
for (let i = 0; i < 4; i++) out.push(c.pollAll());
return [[out, be.started], [[
  {PENDING: 1, QUEUED: 1, RUNNING: 1, SUCCEEDED: 1, FAILED: 0},
  {PENDING: 0, QUEUED: 1, RUNNING: 1, SUCCEEDED: 1, FAILED: 1},
  {PENDING: 0, QUEUED: 0, RUNNING: 0, SUCCEEDED: 3, FAILED: 1},
  {PENDING: 0, QUEUED: 0, RUNNING: 0, SUCCEEDED: 3, FAILED: 1}],
  ['A', 'B', 'C', 'D']]];` },
        { name: 'Finishing through poll frees a slot', src: `const fakeBackend = s => { const jobs = {}, started = []; return { started, start(sql) { started.push(sql); const k = 'q' + started.length; jobs[k] = { sql, steps: s[sql].slice() }; return k; }, status(k) { const j = jobs[k]; const st = j.steps.length > 1 ? j.steps.shift() : j.steps[0]; if (st === 'NET') throw { transient: true }; return st; }, rows(k) { return [{ sql: jobs[k].sql }]; } }; };
const be = fakeBackend({A: ['SUCCEEDED'], B: ['RUNNING']});
const c = new JobClient(be);
c.submitBatch(['A', 'B', 'B'], 1);
const before = be.started.length;
c.poll('j1');
return [[before, be.started, c.poll('j3'), c.poll('j2')], [1, ['A', 'B'], 'PENDING', 'RUNNING']];` },
        { name: 'Counts include single submits and transient errors', src: `const fakeBackend = s => { const jobs = {}, started = []; return { started, start(sql) { started.push(sql); const k = 'q' + started.length; jobs[k] = { sql, steps: s[sql].slice() }; return k; }, status(k) { const j = jobs[k]; const st = j.steps.length > 1 ? j.steps.shift() : j.steps[0]; if (st === 'NET') throw { transient: true }; return st; }, rows(k) { return [{ sql: jobs[k].sql }]; } }; };
const c = new JobClient(fakeBackend({S: ['NET', 'SUCCEEDED'], A: ['RUNNING'], B: ['NET', 'RUNNING']}));
const solo = c.submit('S');
c.submitBatch(['A', 'B', 'A'], 2);
return [[solo, c.pollAll(), c.pollAll()], ['j1',
  {PENDING: 1, QUEUED: 2, RUNNING: 1, SUCCEEDED: 0, FAILED: 0},
  {PENDING: 1, QUEUED: 0, RUNNING: 2, SUCCEEDED: 1, FAILED: 0}]];` },
      ],
      hidden: [
        { name: 'Cap larger than the batch', src: `const fakeBackend = s => { const jobs = {}, started = []; return { started, start(sql) { started.push(sql); const k = 'q' + started.length; jobs[k] = { sql, steps: s[sql].slice() }; return k; }, status(k) { const j = jobs[k]; const st = j.steps.length > 1 ? j.steps.shift() : j.steps[0]; if (st === 'NET') throw { transient: true }; return st; }, rows(k) { return [{ sql: jobs[k].sql }]; } }; };
const be = fakeBackend({A: ['SUCCEEDED']});
const c = new JobClient(be);
c.submitBatch(['A', 'A'], 10);
return [[be.started.length, c.pollAll()], [2, {PENDING: 0, QUEUED: 0, RUNNING: 0, SUCCEEDED: 2, FAILED: 0}]];` },
        { name: 'Batches have separate caps', src: `const fakeBackend = s => { const jobs = {}, started = []; return { started, start(sql) { started.push(sql); const k = 'q' + started.length; jobs[k] = { sql, steps: s[sql].slice() }; return k; }, status(k) { const j = jobs[k]; const st = j.steps.length > 1 ? j.steps.shift() : j.steps[0]; if (st === 'NET') throw { transient: true }; return st; }, rows(k) { return [{ sql: jobs[k].sql }]; } }; };
const be = fakeBackend({X: ['RUNNING'], Y: ['SUCCEEDED']});
const c = new JobClient(be);
const a = c.submitBatch(['X', 'X'], 1), b = c.submitBatch(['Y', 'Y', 'Y'], 1);
const r1 = c.pollAll(), r2 = c.pollAll();
return [[a, b, r1, r2, be.started], [['j1', 'j2'], ['j3', 'j4', 'j5'],
  {PENDING: 2, QUEUED: 1, RUNNING: 1, SUCCEEDED: 1, FAILED: 0},
  {PENDING: 1, QUEUED: 1, RUNNING: 1, SUCCEEDED: 2, FAILED: 0},
  ['X', 'Y', 'Y', 'Y']]];` },
        { name: 'Pending result error', src: `const be = { start: () => 'k', status: () => 'RUNNING', rows: () => [] };
const c = new JobClient(be); c.submitBatch(['a', 'b'], 1);
try { c.result('j2'); return ['no error', 'Job j2 is not finished (PENDING)']; } catch (e) { return [e.message, 'Job j2 is not finished (PENDING)']; }` },
        { name: '2000 jobs never exceed the cap', src: `let s = 5; const rnd = () => (s = (s * 48271) % 2147483647);
const steps = {}; const sqls = [];
for (let i = 0; i < 2000; i++) { const q = 'q' + i; sqls.push(q); const st = []; for (let k = rnd() % 4; k > 0; k--) st.push(rnd() % 3 ? 'RUNNING' : 'NET'); st.push(rnd() % 5 ? 'SUCCEEDED' : 'FAILED'); steps[q] = st; }
let inFlight = 0, peak = 0; const keys = {}; let n = 0;
const be = { start(sql) { inFlight++; peak = Math.max(peak, inFlight); const k = 'b' + (++n); keys[k] = steps[sql].slice(); return k; },
  status(k) { const q = keys[k]; const st = q.length > 1 ? q.shift() : q[0]; if (st === 'NET') throw { transient: true }; if (st === 'SUCCEEDED' || st === 'FAILED') inFlight--; return st; }, rows: () => [] };
const c = new JobClient(be); c.submitBatch(sqls, 25);
let r, rounds = 0;
do { r = c.pollAll(); rounds++; } while ((r.PENDING || r.QUEUED || r.RUNNING) && rounds < 5000);
return [[peak, n, r.SUCCEEDED + r.FAILED, r.PENDING + r.QUEUED + r.RUNNING], [25, 2000, 2000, 0]];` },
      ],
    },
  ],
  followUps: ['The real backend is async and rate-limits status calls. How would pollAll change, and how would you back off?', 'The client process restarts mid-batch. What would you persist so the batch can resume without rerunning finished queries?', 'Some transient errors are really outages. When would you stop retrying and mark a job as failed?'],
  rubric: 'Strong: a Map from id to a job record { sql, key, state, batch }; FINAL states short-circuit poll; transient detection via err && err.transient with everything else rethrown; one helper that runs when a job finishes and starts the next pending job of its batch; pollAll snapshots in-flight ids before polling; counts object always has all five keys; exact error messages. Weak: catching every error as transient, starting all batch jobs at once, letting pollAll poll jobs it just started (double-advancing), a global cap instead of per batch, recomputing counts with missing keys.',
  offline: {
    approach: 'Keep a `Map` from job id to a record `{ sql, key, state, batch }`. `poll` skips final and pending jobs, calls `backend.status` inside `try/catch`, and keeps the old state when the error has `transient: true`. For batches, store the cap and a queue of pending ids on a batch object; when any batch job reaches a final state, shift the next pending id and start it.',
    hints: ['Write a small `_start(job)` that calls `backend.start(job.sql)`, saves the key and sets the state to `QUEUED`.', 'Rethrow errors that are not transient: `if (!(err && err.transient)) throw err;`.', 'Put the "start the next pending job" logic in the place where a state becomes final, so both `poll` and `pollAll` get it for free.', 'In `pollAll`, collect the in-flight ids into an array first, then poll that list. Jobs started during the loop must wait for the next call.'],
    edge: ['A transient error on the very first poll (state stays `QUEUED`).', '`result` on a job that is still `PENDING`.', 'A failed job freeing its slot.', 'A cap larger than the batch.', 'Two batches with different caps at the same time.'],
    complexity: '`submit`, `poll` and `result` are **O(1)**. `submitBatch` is **O(b)** for b queries. `pollAll` is **O(j)** over all jobs, mainly for building the counts; tracking counts incrementally would make it O(in-flight).',
    skeleton: `const FINAL = new Set(['SUCCEEDED', 'FAILED']);

class JobClient {
  constructor(backend) {
    this.backend = backend;
    this.jobs = new Map(); // id -> { sql, key, state, batch }
    this.nextId = 1;
  }

  _job(id) {
    const job = this.jobs.get(id);
    if (!job) throw new Error('Unknown job: ' + id);
    return job;
  }

  submit(sql) {
    // TODO: create the job, start it on the backend
  }

  poll(id) {
    const job = this._job(id);
    // TODO: skip PENDING and final jobs; try backend.status; handle transient errors
  }

  result(id) {
    // TODO: three error messages, then backend.rows(job.key)
  }

  submitBatch(sqls, maxConcurrent) {
    // TODO: batch = { pending: [] }; start the first maxConcurrent
  }

  pollAll() {
    // TODO: snapshot in-flight ids, poll each, return all five counts
  }
}`,
  },
  solution: `const FINAL = new Set(['SUCCEEDED', 'FAILED']);

class JobClient {
  constructor(backend) {
    this.backend = backend;
    this.jobs = new Map(); // id -> { id, sql, key, state, batch }
    this.nextId = 1;
  }

  _create(sql, batch) {
    const job = { id: 'j' + this.nextId++, sql, key: null, state: 'PENDING', batch };
    this.jobs.set(job.id, job);
    return job;
  }

  _start(job) {
    job.key = this.backend.start(job.sql);
    job.state = 'QUEUED';
  }

  _job(id) {
    const job = this.jobs.get(id);
    if (!job) throw new Error('Unknown job: ' + id);
    return job;
  }

  // Called when a job reaches a final state: give its batch slot to the next pending job.
  _finished(job) {
    const batch = job.batch;
    if (batch && batch.pending.length) this._start(this.jobs.get(batch.pending.shift()));
  }

  submit(sql) {
    const job = this._create(sql, null);
    this._start(job);
    return job.id;
  }

  poll(id) {
    const job = this._job(id);
    if (job.state === 'PENDING' || FINAL.has(job.state)) return job.state;

    let state;
    try {
      state = this.backend.status(job.key);
    } catch (err) {
      if (err && err.transient) return job.state; // lost call: keep last known state
      throw err;
    }
    job.state = state;
    if (FINAL.has(state)) this._finished(job);
    return state;
  }

  result(id) {
    const job = this._job(id);
    if (job.state === 'FAILED') throw new Error('Job ' + id + ' failed');
    if (job.state !== 'SUCCEEDED') {
      throw new Error('Job ' + id + ' is not finished (' + job.state + ')');
    }
    return this.backend.rows(job.key);
  }

  submitBatch(sqls, maxConcurrent) {
    const batch = { pending: [] };
    const jobs = sqls.map(sql => this._create(sql, batch));
    jobs.forEach((job, i) => {
      if (i < maxConcurrent) this._start(job);
      else batch.pending.push(job.id);
    });
    return jobs.map(job => job.id);
  }

  pollAll() {
    // Snapshot first, so jobs started during this call wait for the next one.
    const inFlight = [];
    for (const job of this.jobs.values()) {
      if (job.state === 'QUEUED' || job.state === 'RUNNING') inFlight.push(job.id);
    }
    for (const id of inFlight) this.poll(id);

    const counts = { PENDING: 0, QUEUED: 0, RUNNING: 0, SUCCEEDED: 0, FAILED: 0 };
    for (const job of this.jobs.values()) counts[job.state]++;
    return counts;
  }
}
`,
});
