PROBLEMS.push({
  id: 'refund-service',
  title: 'Idempotent refund service',
  team: 'Payments',
  level: 'Senior',
  difficulty: 'Hard',
  minutes: 50,
  focus: ['Idempotency', 'Failure handling', 'API design'],
  format: 'Two-part production-concerns round modelled on 2025–26 reports of senior AI-assisted interviews around payment workflows: build a correct idempotent API against a fake dependency, then make it survive that dependency failing.',
  scenario: 'Support agents issue refunds from a ticket tool that retries on every timeout, and a few customers were refunded twice last month. You are putting a refund service between the ticket tool and the card processor so that retries are safe.',
  body: `
<p>Implement <code>RefundService</code>. Its constructor takes <code>{ gateway, charges, sleep }</code>:</p>
<ul>
<li><code>charges</code> maps a charge id to the amount captured, in integer cents, e.g. <code>{ ch_1: 2000 }</code>.</li>
<li><code>gateway.refund({ key, chargeId, amountCents })</code> is the card processor. It returns <code>{ refundId }</code> or throws. Tests pass a fake gateway that records its calls and can be scripted to fail.</li>
<li><code>sleep(ms)</code> waits. It is synchronous, and tests pass a fake that only records the delay. It may be missing in Part 1.</li>
</ul>
<p>Everything is synchronous: no promises or <code>async</code>. Errors you throw yourself must be <code>Error</code>s whose message starts with the given prefix; the text after the prefix is up to you.</p>
<p><code>remaining(chargeId)</code> returns how many cents of the charge can still be refunded.</p>`,
  examples: `const calls = [];
const gateway = { refund(req) { calls.push(req); return { refundId: "rf_" + calls.length }; } };
const svc = new RefundService({ gateway, charges: { ch_1: 2000 }, sleep: ms => {} });

svc.refund({ key: "t-81", chargeId: "ch_1", amountCents: 500 });
// { refundId: "rf_1", chargeId: "ch_1", amountCents: 500 }
svc.refund({ key: "t-81", chargeId: "ch_1", amountCents: 500 });
// same result, gateway not called again (calls.length === 1)
svc.refund({ key: "t-81", chargeId: "ch_1", amountCents: 900 });
// throws Error("Idempotency key reused ...")
svc.remaining("ch_1");  // 1500`,
  constraints: ['Up to 10⁴ charges and 10⁵ refund calls per test', 'Amounts are integer cents', 'Each refund call should be O(1) apart from gateway calls'],
  starter: `class RefundService {
  /**
   * @param {{
   *   gateway: { refund(req: {key: string, chargeId: string, amountCents: number}): { refundId: string } },
   *   charges: Record<string, number>,
   *   sleep?: (ms: number) => void,
   * }} deps
   */
  constructor({ gateway, charges, sleep }) {
    // TODO
  }

  /** @returns {{ refundId: string, chargeId: string, amountCents: number }} */
  refund({ key, chargeId, amountCents }) {
    // TODO
  }

  /** @returns {number} cents still refundable on this charge */
  remaining(chargeId) {
    // TODO
  }
}
`,
  parts: [
    {
      title: 'Part 1: Idempotent refunds',
      body: `
<p>Implement <code>refund({ key, chargeId, amountCents })</code> and <code>remaining(chargeId)</code>.</p>
<ul>
<li>Validate first. A missing or empty <code>key</code>, or an <code>amountCents</code> that is not a positive integer, throws <code>"Invalid request"</code>. An unknown <code>chargeId</code> throws <code>"Unknown charge"</code> (from <code>remaining</code> too).</li>
<li>A new key calls <code>gateway.refund({ key, chargeId, amountCents })</code> once and returns <code>{ refundId, chargeId, amountCents }</code>.</li>
<li>The same key with the same <code>chargeId</code> and <code>amountCents</code> returns the original result again without calling the gateway. The same key with a different payload throws <code>"Idempotency key reused"</code>.</li>
<li>The total refunded on a charge can never exceed the charge. A refund that would go over throws <code>"Refund exceeds remaining balance"</code> without calling the gateway.</li>
<li>A request that throws does not claim its key: the key can be used again later.</li>
</ul>`,
      tests: [
        { name: 'A refund calls the gateway once', src: `const calls = []; const gateway = { refund(req) { calls.push(req); return { refundId: 'rf_' + calls.length }; } };
const svc = new RefundService({ gateway, charges: { ch_1: 2000 } });
const r = svc.refund({ key: 't-81', chargeId: 'ch_1', amountCents: 500 });
return [[r, calls, svc.remaining('ch_1')], [{refundId:'rf_1',chargeId:'ch_1',amountCents:500}, [{key:'t-81',chargeId:'ch_1',amountCents:500}], 1500]];` },
        { name: 'Same key and payload replays without a second call', src: `const calls = []; const gateway = { refund(req) { calls.push(req); return { refundId: 'rf_' + calls.length }; } };
const svc = new RefundService({ gateway, charges: { ch_1: 2000 } });
const a = svc.refund({ key: 't-81', chargeId: 'ch_1', amountCents: 500 });
const b = svc.refund({ key: 't-81', chargeId: 'ch_1', amountCents: 500 });
return [[a, b, calls.length, svc.remaining('ch_1')], [{refundId:'rf_1',chargeId:'ch_1',amountCents:500}, {refundId:'rf_1',chargeId:'ch_1',amountCents:500}, 1, 1500]];` },
        { name: 'Same key with a different payload throws', src: `const fails = (f, prefix) => { try { f(); return 'no error'; } catch (e) { const m = String(e && e.message); return m.startsWith(prefix) ? prefix : 'Error: ' + m; } };
const calls = []; const gateway = { refund(req) { calls.push(req); return { refundId: 'rf_' + calls.length }; } };
const svc = new RefundService({ gateway, charges: { ch_1: 2000, ch_2: 2000 } });
svc.refund({ key: 't-81', chargeId: 'ch_1', amountCents: 500 });
return [[fails(() => svc.refund({ key: 't-81', chargeId: 'ch_1', amountCents: 900 }), 'Idempotency key reused'), fails(() => svc.refund({ key: 't-81', chargeId: 'ch_2', amountCents: 500 }), 'Idempotency key reused'), calls.length], ['Idempotency key reused', 'Idempotency key reused', 1]];` },
        { name: 'Refunds cannot exceed the charge', src: `const fails = (f, prefix) => { try { f(); return 'no error'; } catch (e) { const m = String(e && e.message); return m.startsWith(prefix) ? prefix : 'Error: ' + m; } };
const calls = []; const gateway = { refund(req) { calls.push(req); return { refundId: 'rf_' + calls.length }; } };
const svc = new RefundService({ gateway, charges: { ch_1: 1000 } });
svc.refund({ key: 'a', chargeId: 'ch_1', amountCents: 600 });
const over = fails(() => svc.refund({ key: 'b', chargeId: 'ch_1', amountCents: 500 }), 'Refund exceeds remaining balance');
svc.refund({ key: 'c', chargeId: 'ch_1', amountCents: 400 });
return [[over, calls.length, svc.remaining('ch_1')], ['Refund exceeds remaining balance', 2, 0]];` },
      ],
      hidden: [
        { name: 'Malformed requests are rejected', src: `const fails = (f, prefix) => { try { f(); return 'no error'; } catch (e) { const m = String(e && e.message); return m.startsWith(prefix) ? prefix : 'Error: ' + m; } };
const calls = []; const gateway = { refund(req) { calls.push(req); return { refundId: 'rf_' + calls.length }; } };
const svc = new RefundService({ gateway, charges: { ch_1: 1000 } });
const bad = [{ key: 'k', chargeId: 'ch_1', amountCents: 0 }, { key: 'k', chargeId: 'ch_1', amountCents: -5 }, { key: 'k', chargeId: 'ch_1', amountCents: 1.5 }, { key: 'k', chargeId: 'ch_1', amountCents: '100' }, { key: '', chargeId: 'ch_1', amountCents: 100 }, { chargeId: 'ch_1', amountCents: 100 }];
return [[bad.map(b => fails(() => svc.refund(b), 'Invalid request')), fails(() => svc.refund({ key: 'k', chargeId: 'ch_404', amountCents: 1 }), 'Unknown charge'), fails(() => svc.remaining('ch_404'), 'Unknown charge'), calls.length], [Array(6).fill('Invalid request'), 'Unknown charge', 'Unknown charge', 0]];` },
        { name: 'A rejected request does not claim its key', src: `const calls = []; const gateway = { refund(req) { calls.push(req); return { refundId: 'rf_' + calls.length }; } };
const svc = new RefundService({ gateway, charges: { ch_1: 1000 } });
try { svc.refund({ key: 'k', chargeId: 'ch_1', amountCents: 5000 }); } catch (e) {}
const r = svc.refund({ key: 'k', chargeId: 'ch_1', amountCents: 300 });
return [[r, svc.remaining('ch_1')], [{refundId:'rf_1',chargeId:'ch_1',amountCents:300}, 700]];` },
        { name: 'Replay still works after the charge is fully refunded', src: `const calls = []; const gateway = { refund(req) { calls.push(req); return { refundId: 'rf_' + calls.length }; } };
const svc = new RefundService({ gateway, charges: { ch_1: 1000 } });
const a = svc.refund({ key: 'full', chargeId: 'ch_1', amountCents: 1000 });
const b = svc.refund({ key: 'full', chargeId: 'ch_1', amountCents: 1000 });
return [[a.refundId, b.refundId, calls.length, svc.remaining('ch_1')], ['rf_1', 'rf_1', 1, 0]];` },
        { name: 'Different keys are different refunds', src: `const calls = []; const gateway = { refund(req) { calls.push(req); return { refundId: 'rf_' + calls.length }; } };
const svc = new RefundService({ gateway, charges: { ch_1: 1000, ch_2: 50 } });
svc.refund({ key: 'x', chargeId: 'ch_1', amountCents: 100 }); svc.refund({ key: 'y', chargeId: 'ch_1', amountCents: 100 }); svc.refund({ key: 'z', chargeId: 'ch_2', amountCents: 50 });
return [[calls.map(c => c.key), svc.remaining('ch_1'), svc.remaining('ch_2')], [['x', 'y', 'z'], 800, 0]];` },
        { name: '100k refunds with replays', src: `let n = 0; const gateway = { refund() { n++; return { refundId: 'rf_' + n }; } };
const charges = {}; for (let i = 0; i < 10000; i++) charges['ch_' + i] = 1000;
const svc = new RefundService({ gateway, charges });
let over = 0;
for (let i = 0; i < 100000; i++) { try { svc.refund({ key: 'k' + (i % 60000), chargeId: 'ch_' + (i % 60000 % 10000), amountCents: 150 }); } catch (e) { over++; } }
let left = 0; for (let i = 0; i < 10000; i++) left += svc.remaining('ch_' + i);
return [[n, over, left], [60000, 0, 1000000]];` },
      ],
    },
    {
      title: 'Part 2: Survive a flaky processor',
      body: `
<p>The card processor times out under load. Make <code>refund</code> retry safely.</p>
<ul>
<li>If the gateway throws an error with <code>err.retryable === true</code>, retry the same request. Make at most 3 retries (4 gateway calls in total), calling <code>sleep(100)</code>, <code>sleep(200)</code> and <code>sleep(400)</code> before the first, second and third retry.</li>
<li>Any other error is final: do not retry and do not sleep.</li>
<li>When the gateway finally fails, rethrow the last gateway error unchanged. The refund did not happen, so it must not use up any of the charge, and the same key may be tried again later.</li>
<li>Successful results are stored as in Part 1, however many attempts they took.</li>
</ul>`,
      tests: [
        { name: 'Transient errors are retried with backoff', src: `const T = m => Object.assign(new Error(m), { retryable: true });
const script = [T('timeout 1'), T('timeout 2')]; const calls = [], slept = [];
const gateway = { refund(req) { calls.push(req); const s = script.shift(); if (s) throw s; return { refundId: 'rf_' + calls.length }; } };
const svc = new RefundService({ gateway, charges: { ch_1: 2000 }, sleep: ms => slept.push(ms) });
const r = svc.refund({ key: 'k', chargeId: 'ch_1', amountCents: 700 });
return [[r, calls.length, slept, svc.remaining('ch_1')], [{refundId:'rf_3',chargeId:'ch_1',amountCents:700}, 3, [100, 200], 1300]];` },
        { name: 'Gives up after three retries', src: `const T = m => Object.assign(new Error(m), { retryable: true });
const script = [T('timeout 1'), T('timeout 2'), T('timeout 3'), T('timeout 4'), T('timeout 5')]; const calls = [], slept = [];
const gateway = { refund(req) { calls.push(req); const s = script.shift(); if (s) throw s; return { refundId: 'rf_' + calls.length }; } };
const svc = new RefundService({ gateway, charges: { ch_1: 2000 }, sleep: ms => slept.push(ms) });
let msg = 'no error'; try { svc.refund({ key: 'k', chargeId: 'ch_1', amountCents: 700 }); } catch (e) { msg = e.message; }
return [[msg, calls.length, slept, svc.remaining('ch_1')], ['timeout 4', 4, [100, 200, 400], 2000]];` },
        { name: 'Non-retryable errors fail immediately', src: `const script = [new Error('card account closed')]; const calls = [], slept = [];
const gateway = { refund(req) { calls.push(req); const s = script.shift(); if (s) throw s; return { refundId: 'rf_' + calls.length }; } };
const svc = new RefundService({ gateway, charges: { ch_1: 2000 }, sleep: ms => slept.push(ms) });
let msg = 'no error'; try { svc.refund({ key: 'k', chargeId: 'ch_1', amountCents: 700 }); } catch (e) { msg = e.message; }
return [[msg, calls.length, slept, svc.remaining('ch_1')], ['card account closed', 1, [], 2000]];` },
        { name: 'A key that failed can be tried again', src: `const T = m => Object.assign(new Error(m), { retryable: true });
const script = [T('t1'), T('t2'), T('t3'), T('t4')]; const calls = [], slept = [];
const gateway = { refund(req) { calls.push(req); const s = script.shift(); if (s) throw s; return { refundId: 'rf_' + calls.length }; } };
const svc = new RefundService({ gateway, charges: { ch_1: 2000 }, sleep: ms => slept.push(ms) });
try { svc.refund({ key: 'k', chargeId: 'ch_1', amountCents: 700 }); } catch (e) {}
const r = svc.refund({ key: 'k', chargeId: 'ch_1', amountCents: 700 });
const again = svc.refund({ key: 'k', chargeId: 'ch_1', amountCents: 700 });
return [[r, again, calls.length, svc.remaining('ch_1')], [{refundId:'rf_5',chargeId:'ch_1',amountCents:700}, {refundId:'rf_5',chargeId:'ch_1',amountCents:700}, 5, 1300]];` },
      ],
      hidden: [
        { name: 'Only retryable === true is retried', src: `const script = [Object.assign(new Error('maybe'), { retryable: 'true' })]; const calls = [], slept = [];
const gateway = { refund(req) { calls.push(req); const s = script.shift(); if (s) throw s; return { refundId: 'rf_' + calls.length }; } };
const svc = new RefundService({ gateway, charges: { ch_1: 2000 }, sleep: ms => slept.push(ms) });
let msg = 'no error'; try { svc.refund({ key: 'k', chargeId: 'ch_1', amountCents: 1 }); } catch (e) { msg = e.message; }
return [[msg, calls.length, slept], ['maybe', 1, []]];` },
        { name: 'Retryable then final error stops early', src: `const T = m => Object.assign(new Error(m), { retryable: true });
const script = [T('timeout'), new Error('fraud hold')]; const calls = [], slept = [];
const gateway = { refund(req) { calls.push(req); const s = script.shift(); if (s) throw s; return { refundId: 'rf_' + calls.length }; } };
const svc = new RefundService({ gateway, charges: { ch_1: 2000 }, sleep: ms => slept.push(ms) });
let msg = 'no error'; try { svc.refund({ key: 'k', chargeId: 'ch_1', amountCents: 1 }); } catch (e) { msg = e.message; }
return [[msg, calls.length, slept, svc.remaining('ch_1')], ['fraud hold', 2, [100], 2000]];` },
        { name: 'A failed refund leaves the full balance for another key', src: `const script = [new Error('declined')]; const calls = [], slept = [];
const gateway = { refund(req) { calls.push(req); const s = script.shift(); if (s) throw s; return { refundId: 'rf_' + calls.length }; } };
const svc = new RefundService({ gateway, charges: { ch_1: 2000 }, sleep: ms => slept.push(ms) });
try { svc.refund({ key: 'first', chargeId: 'ch_1', amountCents: 2000 }); } catch (e) {}
const r = svc.refund({ key: 'second', chargeId: 'ch_1', amountCents: 2000 });
return [[r.refundId, svc.remaining('ch_1')], ['rf_2', 0]];` },
        { name: 'A retried success replays without new calls or sleeps', src: `const T = m => Object.assign(new Error(m), { retryable: true });
const script = [T('a'), T('b'), T('c')]; const calls = [], slept = [];
const gateway = { refund(req) { calls.push(req); const s = script.shift(); if (s) throw s; return { refundId: 'rf_' + calls.length }; } };
const svc = new RefundService({ gateway, charges: { ch_1: 2000 }, sleep: ms => slept.push(ms) });
const a = svc.refund({ key: 'k', chargeId: 'ch_1', amountCents: 10 });
const b = svc.refund({ key: 'k', chargeId: 'ch_1', amountCents: 10 });
return [[a.refundId, b.refundId, calls.length, slept, calls.every(c => c.key === 'k')], ['rf_4', 'rf_4', 4, [100, 200, 400], true]];` },
      ],
    },
  ],
  followUps: ['The gateway timed out but actually processed the refund. How do you avoid refunding twice when you retry, and what do you ask of the processor?', 'Run this on 10 instances behind a load balancer. Where do idempotency records and balances live, and how do two concurrent requests with the same key behave?', 'How long do you keep idempotency keys, and what happens when a client reuses one after it expires?'],
  rubric: 'Strong: validates input up front with clear errors; stores {payload, result} per key and compares payload before replaying; checks key reuse before the balance check so replays of a fully refunded charge still work; deducts balance and records the key only after the gateway succeeds; passes the key down to the gateway; a small retry loop with a delay table, strict retryable === true, rethrows the last error unchanged; no real timers. Raises in-flight state (a pending marker) and gateway-side idempotency as the real fix for ambiguous timeouts. Weak: caching failures under the key, deducting balance before the call without rolling back, replaying on key match without comparing payload, off-by-one retry counts, sleeping before the first attempt, swallowing or wrapping the gateway error.',
  offline: {
    approach: 'Keep two maps: `remaining` per charge and `byKey` from idempotency key to `{ chargeId, amountCents, result }`. On `refund`: validate, then check `byKey` (replay or reuse error), then the balance, then call the gateway through a retry helper. Only after success deduct the balance and store the key. The retry helper loops over attempts, catching errors with `retryable === true` and calling `sleep(delays[attempt])` until it runs out of delays.',
    hints: ['Check the idempotency key before the balance, otherwise replaying a refund that used the whole charge would fail.', 'Store the key only on success. A failure leaves no trace, so the same key can be tried again.', 'Retry loop: `for (let attempt = 0; ; attempt++) { try { return call(); } catch (e) { if (e.retryable !== true || attempt >= 3) throw e; sleep([100, 200, 400][attempt]); } }`.', 'Default `sleep` to a no-op in the constructor so Part 1 tests that do not pass it still work.'],
    edge: ['Same key, same amount, different charge (reuse error).', 'A replay after the charge is fully refunded.', '`retryable: "true"` as a string (not retryable).', 'A retryable error followed by a final error.', 'An amount like `1.5` or `"100"`.'],
    complexity: 'Each call does **O(1)** map work plus at most 4 gateway calls. Memory is **O(K + C)** for K stored keys and C charges.',
    skeleton: `class RefundService {
  constructor({ gateway, charges, sleep = () => {} }) {
    this.gateway = gateway;
    this.sleep = sleep;
    this.left = new Map(Object.entries(charges)); // chargeId -> cents still refundable
    this.byKey = new Map();                       // key -> { chargeId, amountCents, result }
  }

  remaining(chargeId) {
    // TODO: throw "Unknown charge" when missing
  }

  refund({ key, chargeId, amountCents }) {
    // TODO: validate, replay or reject key reuse, check balance,
    // call the gateway with retries, then record success
  }

  _callWithRetry(req) {
    const delays = [100, 200, 400];
    // TODO
  }
}`,
  },
  solution: `class RefundService {
  /**
   * @param {{ gateway: object, charges: Record<string, number>, sleep?: (ms: number) => void }} deps
   */
  constructor({ gateway, charges, sleep = () => {} }) {
    this.gateway = gateway;
    this.sleep = sleep;
    this.left = new Map(Object.entries(charges)); // chargeId -> cents still refundable
    this.byKey = new Map();                       // key -> { chargeId, amountCents, result }
  }

  remaining(chargeId) {
    if (!this.left.has(chargeId)) throw new Error('Unknown charge: ' + chargeId);
    return this.left.get(chargeId);
  }

  refund({ key, chargeId, amountCents }) {
    if (typeof key !== 'string' || key === '') {
      throw new Error('Invalid request: key is required');
    }
    if (!Number.isInteger(amountCents) || amountCents <= 0) {
      throw new Error('Invalid request: amountCents must be a positive integer');
    }

    // Replay before the balance check, so a refund that used the whole
    // charge can still be replayed.
    const seen = this.byKey.get(key);
    if (seen) {
      if (seen.chargeId !== chargeId || seen.amountCents !== amountCents) {
        throw new Error('Idempotency key reused with a different payload: ' + key);
      }
      return seen.result;
    }

    const left = this.remaining(chargeId);
    if (amountCents > left) {
      throw new Error('Refund exceeds remaining balance: ' + left + ' cents left');
    }

    // Throws on final failure; nothing below runs, so no balance is used
    // and the key stays free for a later attempt.
    const { refundId } = this._callWithRetry({ key, chargeId, amountCents });
    const result = { refundId, chargeId, amountCents };

    this.left.set(chargeId, left - amountCents);
    this.byKey.set(key, { chargeId, amountCents, result });
    return result;
  }

  // Up to 3 retries on errors marked retryable, with fixed backoff.
  _callWithRetry(req) {
    const delays = [100, 200, 400];
    for (let attempt = 0; ; attempt++) {
      try {
        return this.gateway.refund(req);
      } catch (err) {
        const retryable = err && err.retryable === true;
        if (!retryable || attempt >= delays.length) throw err;
        this.sleep(delays[attempt]);
      }
    }
  }
}
`,
});
