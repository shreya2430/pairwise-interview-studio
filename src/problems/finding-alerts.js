PROBLEMS.push({
  id: 'finding-alerts',
  title: 'Security finding notifications',
  team: 'Security Detection',
  level: 'Mid-level',
  difficulty: 'Medium',
  minutes: 60,
  focus: ['Debugging', 'Reading existing code', 'Extending code', 'Time windows'],
  format: 'Modeled on the 2026 Amazon AI-assisted repo task (followers of a movie\'s stars get notified): an existing service with store and service layers, failing tests, then a feature on top, then a change request.',
  scenario: 'Scanners report security findings on assets: hosts, buckets and services. Engineers follow tags like "payments" or "prod" and should hear about findings on any asset carrying those tags. Analysts say some people never get notified, the unread badge is wrong, and escalations go nowhere.',
  body: `
<p>The editor holds a small service, laid out like the real repo: stores (the repository layer), then services, then <code>createApp(clock)</code>, which wires them together. Tests only talk to the object <code>createApp</code> returns.</p>
<ul>
<li>An asset is <code>{ id, name, tags }</code>, where <code>tags</code> is an array of strings. A finding is <code>{ id, assetId, severity, title }</code>, and severity is one of <code>LOW</code>, <code>MEDIUM</code>, <code>HIGH</code>, <code>CRITICAL</code>.</li>
<li><code>clock.now()</code> returns the current time in seconds. Always read time from it.</li>
<li><b>Product rule:</b> a person gets at most one notification per event (one create, one escalation), however many of the asset's tags they follow.</li>
</ul>
<p>Keep the existing method names and return shapes; other teams call them.</p>`,
  examples: `const clock = { t: 0, now() { return this.t; } };
const app = createApp(clock);
app.assets.save({ id: "a1", name: "payments-db", tags: ["payments", "prod"] });
app.subs.save("alice", "payments");
app.subs.save("bob", "prod");

const f = app.findings.create("a1", "LOW", "Public snapshot");
app.notifications.notificationsFor("bob").length;        // 1
app.findings.escalate(f.id, "CRITICAL");
app.notifications.notificationsFor("bob").map(n => n.message);
// ["New finding: Public snapshot", "Escalated to CRITICAL: Public snapshot"]
app.notifications.unreadCount("alice");                  // 2`,
  constraints: ['Up to 10⁴ subscriptions and 10³ findings per test', 'Times are whole seconds from clock.now()', 'Tag and user ids are non-empty strings'],
  starter: `// ---------- repository layer ----------
class AssetStore {
  constructor() { this.byId = new Map(); }
  save(asset) { this.byId.set(asset.id, asset); }
  find(id) { return this.byId.get(id) || null; }
}

class SubscriptionStore {
  constructor() { this.rows = []; }
  save(userId, tag) { this.rows.push({ userId, tag }); }
  byTag(tag) { return this.rows.filter(r => r.tag === tag); }
}

// ---------- service layer ----------
const SEVERITY = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

class NotificationService {
  constructor(assets, subs, clock) {
    this.assets = assets;
    this.subs = subs;
    this.clock = clock;
    this.sent = [];
    this.nextId = 1;
    // Reserved for cross-channel dedup (email + Slack). Not used yet.
    this.dedupKeys = new Set();
  }

  /** Tells everyone who follows the finding's asset. prefix is e.g. "New finding". */
  notifySubscribers(finding, prefix) {
    const asset = this.assets.find(finding.assetId);
    if (!asset) throw new Error('Unknown asset: ' + finding.assetId);
    const tag = asset.tags[0];
    for (const s of this.subs.byTag(tag)) {
      this.sent.push({ id: 'n' + this.nextId++, userId: s.userId, findingId: finding.id,
        message: prefix + ': ' + finding.title, read: false });
    }
  }

  notificationsFor(userId) { return this.sent.filter(n => n.userId === userId); }

  unreadCount(userId) { return this.sent.filter(n => !n.read).length; }

  markRead(notificationId) {
    const n = this.sent.find(x => x.id === notificationId);
    if (n) n.read = true;
  }
}

class FindingService {
  constructor(assets, notifications) {
    this.assets = assets;
    this.notifications = notifications;
    this.byId = new Map();
    this.nextId = 1;
  }

  create(assetId, severity, title) {
    if (!this.assets.find(assetId)) throw new Error('Unknown asset: ' + assetId);
    const finding = { id: 'f' + this.nextId++, assetId, severity, title };
    this.byId.set(finding.id, finding);
    this.notifications.notifySubscribers(finding, 'New finding');
    return finding;
  }

  /** Raises severity. Lowering it or keeping it the same throws. */
  escalate(findingId, severity) {
    const finding = this.byId.get(findingId);
    if (!finding) throw new Error('Unknown finding: ' + findingId);
    if (SEVERITY.indexOf(severity) <= SEVERITY.indexOf(finding.severity)) {
      throw new Error('Escalation must raise severity');
    }
    finding.severity = severity;
    return finding;
  }
}

// ---------- wiring ----------
function createApp(clock) {
  const assets = new AssetStore();
  const subs = new SubscriptionStore();
  const notifications = new NotificationService(assets, subs, clock);
  const findings = new FindingService(assets, notifications);
  return { assets, subs, notifications, findings };
}
`,
  parts: [
    {
      title: 'Part 1: Fix notifications',
      body: `
<p>Analysts report three problems. Only some of them have tests; add your own for the rest.</p>
<ul>
<li>A finding on an asset tagged <code>payments</code> and <code>prod</code> reaches the followers of only one tag.</li>
<li>The unread badge, <code>unreadCount(userId)</code>, shows the wrong number.</li>
<li>Escalating a finding notifies nobody. It should notify the same people, with the message <code>"Escalated to &lt;SEVERITY&gt;: &lt;title&gt;"</code>.</li>
</ul>
<p>Remember the product rule: one notification per person per event.</p>`,
      tests: [
        { name: 'Followers of every tag are notified', src: `const clock = { t: 0, now() { return this.t; } };
const app = createApp(clock);
app.assets.save({ id: 'a1', name: 'payments-db', tags: ['payments', 'prod'] });
app.subs.save('alice', 'payments'); app.subs.save('bob', 'prod');
app.findings.create('a1', 'HIGH', 'Public snapshot');
return [[app.notifications.notificationsFor('alice').length, app.notifications.notificationsFor('bob').length], [1, 1]];` },
        { name: 'Unread count is per user', src: `const clock = { t: 0, now() { return this.t; } };
const app = createApp(clock);
app.assets.save({ id: 'a2', name: 'runner', tags: ['ci'] });
app.subs.save('dana', 'ci'); app.subs.save('erin', 'ci');
app.findings.create('a2', 'LOW', 'Weak cipher');
return [app.notifications.unreadCount('dana'), 1];` },
        { name: 'Single-tag follower is notified', src: `const clock = { t: 0, now() { return this.t; } };
const app = createApp(clock);
app.assets.save({ id: 'a2', name: 'runner', tags: ['ci'] });
app.subs.save('dana', 'ci');
app.findings.create('a2', 'MEDIUM', 'Old base image');
return [app.notifications.notificationsFor('dana').map(n => n.message), ['New finding: Old base image']];` },
      ],
      hidden: [
        { name: 'Follower of several tags gets one notification', src: `const clock = { t: 0, now() { return this.t; } };
const app = createApp(clock);
app.assets.save({ id: 'a1', name: 'db', tags: ['payments', 'prod', 'pci'] });
for (const t of ['payments', 'prod', 'pci']) app.subs.save('alice', t);
app.findings.create('a1', 'HIGH', 'x');
return [app.notifications.notificationsFor('alice').length, 1];` },
        { name: 'Duplicate subscription rows still give one', src: `const clock = { t: 0, now() { return this.t; } };
const app = createApp(clock);
app.assets.save({ id: 'a2', name: 'runner', tags: ['ci'] });
app.subs.save('dana', 'ci'); app.subs.save('dana', 'ci');
app.findings.create('a2', 'LOW', 'x');
return [app.notifications.notificationsFor('dana').length, 1];` },
        { name: 'Escalation notifies once per person with the right message', src: `const clock = { t: 0, now() { return this.t; } };
const app = createApp(clock);
app.assets.save({ id: 'a1', name: 'db', tags: ['payments', 'prod'] });
app.subs.save('alice', 'payments'); app.subs.save('alice', 'prod'); app.subs.save('bob', 'prod');
const f = app.findings.create('a1', 'LOW', 'Public snapshot');
app.findings.escalate(f.id, 'CRITICAL');
return [[app.notifications.notificationsFor('alice').length, app.notifications.notificationsFor('bob').map(n => n.message)],
  [2, ['New finding: Public snapshot', 'Escalated to CRITICAL: Public snapshot']]];` },
        { name: 'Rejected escalation sends nothing', src: `const clock = { t: 0, now() { return this.t; } };
const app = createApp(clock);
app.assets.save({ id: 'a2', name: 'runner', tags: ['ci'] });
app.subs.save('dana', 'ci');
const f = app.findings.create('a2', 'HIGH', 'x');
let threw = false; try { app.findings.escalate(f.id, 'HIGH'); } catch (e) { threw = true; }
return [[threw, app.notifications.notificationsFor('dana').length], [true, 1]];` },
        { name: 'markRead changes only that user', src: `const clock = { t: 0, now() { return this.t; } };
const app = createApp(clock);
app.assets.save({ id: 'a2', name: 'runner', tags: ['ci'] });
app.subs.save('dana', 'ci'); app.subs.save('erin', 'ci');
app.findings.create('a2', 'LOW', 'one'); app.findings.create('a2', 'LOW', 'two');
app.notifications.markRead(app.notifications.notificationsFor('dana')[0].id);
return [[app.notifications.unreadCount('dana'), app.notifications.unreadCount('erin'), app.notifications.unreadCount('nobody')], [1, 2, 0]];` },
        { name: '5000 followers across 50 tags', src: `const clock = { t: 0, now() { return this.t; } };
const app = createApp(clock);
const tags = []; for (let i = 0; i < 50; i++) tags.push('t' + i);
app.assets.save({ id: 'big', name: 'big', tags });
for (let u = 0; u < 1000; u++) for (let k = 0; k < 5; k++) app.subs.save('u' + u, 't' + ((u + k * 7) % 50));
app.findings.create('big', 'LOW', 'x');
return [[app.notifications.sent.length, app.notifications.notificationsFor('u7').length], [1000, 1]];` },
      ],
    },
    {
      title: 'Part 2: Mute an asset',
      body: `
<p>On-call engineers want quiet while they work on an asset. Add <code>notifications.mute(userId, assetId, seconds)</code>.</p>
<ul>
<li>While muted, that user gets nothing for findings on that asset, new or escalated.</li>
<li><b>CRITICAL always gets through.</b></li>
<li>The mute lasts <code>seconds</code>. At exactly that moment the user is notified again.</li>
<li><code>seconds</code> must be more than 0 and at most 86400 (24 hours); otherwise throw.</li>
<li>Muting one asset doesn't affect other assets. Muting again replaces the old end time.</li>
</ul>`,
      tests: [
        { name: 'Muted user skipped, others notified', src: `const clock = { t: 0, now() { return this.t; } };
const app = createApp(clock);
app.assets.save({ id: 'a2', name: 'runner', tags: ['ci'] });
app.subs.save('dana', 'ci'); app.subs.save('erin', 'ci');
app.notifications.mute('dana', 'a2', 3600);
app.findings.create('a2', 'HIGH', 'x');
return [[app.notifications.notificationsFor('dana').length, app.notifications.notificationsFor('erin').length], [0, 1]];` },
        { name: 'CRITICAL gets through a mute', src: `const clock = { t: 0, now() { return this.t; } };
const app = createApp(clock);
app.assets.save({ id: 'a2', name: 'runner', tags: ['ci'] });
app.subs.save('dana', 'ci');
app.notifications.mute('dana', 'a2', 3600);
app.findings.create('a2', 'CRITICAL', 'x');
return [app.notifications.notificationsFor('dana').length, 1];` },
        { name: 'Mute ends at exactly its duration', src: `const clock = { t: 1000, now() { return this.t; } };
const app = createApp(clock);
app.assets.save({ id: 'a2', name: 'runner', tags: ['ci'] });
app.subs.save('dana', 'ci');
app.notifications.mute('dana', 'a2', 1800);
clock.t = 2799; app.findings.create('a2', 'LOW', 'still muted');
clock.t = 2800; app.findings.create('a2', 'LOW', 'back');
return [app.notifications.notificationsFor('dana').map(n => n.message), ['New finding: back']];` },
      ],
      hidden: [
        { name: 'Mute is per asset', src: `const clock = { t: 0, now() { return this.t; } };
const app = createApp(clock);
app.assets.save({ id: 'a2', name: 'runner', tags: ['ci'] }); app.assets.save({ id: 'a3', name: 'bot', tags: ['ci'] });
app.subs.save('dana', 'ci');
app.notifications.mute('dana', 'a2', 3600);
app.findings.create('a3', 'LOW', 'x');
return [app.notifications.notificationsFor('dana').length, 1];` },
        { name: 'Escalation respects mute until CRITICAL', src: `const clock = { t: 0, now() { return this.t; } };
const app = createApp(clock);
app.assets.save({ id: 'a2', name: 'runner', tags: ['ci'] });
app.subs.save('dana', 'ci');
app.notifications.mute('dana', 'a2', 3600);
const f = app.findings.create('a2', 'LOW', 'x');
app.findings.escalate(f.id, 'HIGH');
const mid = app.notifications.notificationsFor('dana').length;
app.findings.escalate(f.id, 'CRITICAL');
return [[mid, app.notifications.notificationsFor('dana').map(n => n.message)], [0, ['Escalated to CRITICAL: x']]];` },
        { name: 'Mute duration is validated', src: `const clock = { t: 0, now() { return this.t; } };
const app = createApp(clock);
const throws = s => { try { app.notifications.mute('dana', 'a2', s); return false; } catch (e) { return true; } };
return [[throws(0), throws(-5), throws(86401), throws(86400)], [true, true, true, false]];` },
        { name: 'Muting again replaces the end time', src: `const clock = { t: 0, now() { return this.t; } };
const app = createApp(clock);
app.assets.save({ id: 'a2', name: 'runner', tags: ['ci'] });
app.subs.save('dana', 'ci');
app.notifications.mute('dana', 'a2', 600);
clock.t = 300; app.notifications.mute('dana', 'a2', 1800);
clock.t = 900; app.findings.create('a2', 'LOW', 'x');
return [app.notifications.notificationsFor('dana').length, 0];` },
        { name: 'A muted multi-tag follower still gets one CRITICAL', src: `const clock = { t: 0, now() { return this.t; } };
const app = createApp(clock);
app.assets.save({ id: 'a1', name: 'db', tags: ['payments', 'prod'] });
app.subs.save('alice', 'payments'); app.subs.save('alice', 'prod');
app.notifications.mute('alice', 'a1', 3600);
app.findings.create('a1', 'CRITICAL', 'x');
return [app.notifications.notificationsFor('alice').length, 1];` },
      ],
    },
    {
      title: 'Part 3: Follow a single asset',
      body: `
<p>Change request from product: people can now follow one asset directly, not only tags. Add <code>subs.followAsset(userId, assetId)</code>.</p>
<ul>
<li>Direct followers are notified about findings on that asset, new and escalated.</li>
<li>The one-notification-per-event rule still holds when someone follows both the asset and one of its tags.</li>
<li>Mutes and the CRITICAL rule apply to direct followers too.</li>
</ul>
<p>If Part 1 collected recipients in one place, this should be a small change.</p>`,
      tests: [
        { name: 'Direct follower is notified', src: `const clock = { t: 0, now() { return this.t; } };
const app = createApp(clock);
app.assets.save({ id: 'a1', name: 'db', tags: ['prod'] });
app.subs.followAsset('zoe', 'a1');
app.findings.create('a1', 'LOW', 'x');
return [app.notifications.notificationsFor('zoe').length, 1];` },
        { name: 'Asset and tag follower gets one', src: `const clock = { t: 0, now() { return this.t; } };
const app = createApp(clock);
app.assets.save({ id: 'a1', name: 'db', tags: ['prod'] });
app.subs.followAsset('zoe', 'a1'); app.subs.save('zoe', 'prod');
const f = app.findings.create('a1', 'LOW', 'x');
app.findings.escalate(f.id, 'HIGH');
return [app.notifications.notificationsFor('zoe').length, 2];` },
      ],
      hidden: [
        { name: 'Following another asset gives nothing', src: `const clock = { t: 0, now() { return this.t; } };
const app = createApp(clock);
app.assets.save({ id: 'a1', name: 'db', tags: ['prod'] }); app.assets.save({ id: 'a9', name: 'other', tags: ['dev'] });
app.subs.followAsset('zoe', 'a9');
app.findings.create('a1', 'HIGH', 'x');
return [app.notifications.notificationsFor('zoe').length, 0];` },
        { name: 'Mute applies to direct followers', src: `const clock = { t: 0, now() { return this.t; } };
const app = createApp(clock);
app.assets.save({ id: 'a1', name: 'db', tags: ['prod'] });
app.subs.followAsset('zoe', 'a1');
app.notifications.mute('zoe', 'a1', 600);
app.findings.create('a1', 'HIGH', 'quiet');
app.findings.create('a1', 'CRITICAL', 'loud');
return [app.notifications.notificationsFor('zoe').map(n => n.message), ['New finding: loud']];` },
        { name: 'Asset with no tags still reaches direct followers', src: `const clock = { t: 0, now() { return this.t; } };
const app = createApp(clock);
app.assets.save({ id: 'a5', name: 'lone', tags: [] });
app.subs.followAsset('zoe', 'a5');
app.findings.create('a5', 'MEDIUM', 'x');
return [app.notifications.notificationsFor('zoe').length, 1];` },
      ],
    },
  ],
  followUps: [
    'Notifications now go out by email and Slack. Where would the dedup key live, and what would it contain?',
    'A scanner floods 50,000 findings in a minute. What breaks first, and what would you change?',
    'Mutes must survive a restart and work across many service instances. Where do you store them?',
    'How would you test that CRITICAL bypass never regresses?',
  ],
  rubric: 'Bugs: (1) notifySubscribers reads only asset.tags[0]; (2) unreadCount ignores userId; (3) escalate never calls notifySubscribers. Trap: fixing (1) by looping over all tags without dedup sends duplicates, so recipients must be collected in a Set first. Second trap: the "reserved" dedupKeys field tempts a model change that is not needed. Strong: collects recipients into a Set in one place, skips muted users there so create and escalate both respect it, CRITICAL bypass, mute active while now < until, validates seconds, Part 3 is a few lines because recipient collection is centralized, writes tests for escalation and dedup since none were given. Weak: dedups by message text, checks mute only in create, reads Date.now() instead of clock.now(), copies the notify loop into escalate.',
  offline: {
    approach: 'Read the three layers before changing anything. In notifySubscribers, build a Set of user ids from every tag on the asset (and later from direct asset followers), then drop muted users unless the finding is CRITICAL, then send one notification per user. Filter unreadCount by userId. Call notifySubscribers from escalate with prefix "Escalated to " + severity. Mutes are a Map from "user|asset" to an end time read from clock.now().',
    hints: [
      'asset.tags[0] is only the first tag. What happens to followers of the second tag?',
      'If you loop over every tag, a person who follows two of them is pushed twice. Collect user ids in a Set first.',
      'unreadCount filters by read state only. Which user is it counting?',
      'escalate updates severity, but who tells the followers?',
      'Put the mute check where recipients are chosen, so both create and escalate respect it.',
    ],
    edge: [
      'A person follows two tags on the same asset.',
      'The same subscription row saved twice.',
      'A rejected escalation (same or lower severity) must send nothing.',
      'A mute check at exactly start + seconds.',
      'CRITICAL during a mute, both on create and on escalate.',
      'An asset with an empty tags array but a direct follower (Part 3).',
    ],
    complexity: 'Each event scans subscriptions per tag: **O(S)** with the array store, where S is the number of subscription rows, plus O(R) to send to R recipients. An index from tag to users would make it **O(T + R)**.',
    skeleton: `notifySubscribers(finding, prefix) {
  const asset = this.assets.find(finding.assetId);
  if (!asset) throw new Error('Unknown asset: ' + finding.assetId);
  const users = new Set();
  // TODO: every tag's followers (and, in Part 3, direct followers)
  for (const userId of users) {
    // TODO: skip muted users unless CRITICAL
    // TODO: push one notification
  }
}`,
  },
  solution: `class AssetStore {
  constructor() { this.byId = new Map(); }
  save(asset) { this.byId.set(asset.id, asset); }
  find(id) { return this.byId.get(id) || null; }
}

class SubscriptionStore {
  constructor() { this.rows = []; this.assetRows = []; }
  save(userId, tag) { this.rows.push({ userId, tag }); }
  byTag(tag) { return this.rows.filter(r => r.tag === tag); }
  followAsset(userId, assetId) { this.assetRows.push({ userId, assetId }); }
  byAsset(assetId) { return this.assetRows.filter(r => r.assetId === assetId); }
}

const SEVERITY = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
const MAX_MUTE = 86400;

class NotificationService {
  constructor(assets, subs, clock) {
    this.assets = assets;
    this.subs = subs;
    this.clock = clock;
    this.sent = [];
    this.nextId = 1;
    this.mutedUntil = new Map();
  }

  // One place decides who hears about an event, so every rule applies to create and escalate alike.
  notifySubscribers(finding, prefix) {
    const asset = this.assets.find(finding.assetId);
    if (!asset) throw new Error('Unknown asset: ' + finding.assetId);
    const users = new Set();
    for (const tag of asset.tags) for (const s of this.subs.byTag(tag)) users.add(s.userId);
    for (const s of this.subs.byAsset(asset.id)) users.add(s.userId);
    const now = this.clock.now();
    for (const userId of users) {
      const until = this.mutedUntil.get(userId + '|' + asset.id);
      if (until !== undefined && now < until && finding.severity !== 'CRITICAL') continue;
      this.sent.push({ id: 'n' + this.nextId++, userId, findingId: finding.id,
        message: prefix + ': ' + finding.title, read: false });
    }
  }

  mute(userId, assetId, seconds) {
    if (!(seconds > 0) || seconds > MAX_MUTE) throw new Error('Mute must be between 1 second and 24 hours');
    this.mutedUntil.set(userId + '|' + assetId, this.clock.now() + seconds);
  }

  notificationsFor(userId) { return this.sent.filter(n => n.userId === userId); }

  unreadCount(userId) { return this.sent.filter(n => n.userId === userId && !n.read).length; }

  markRead(notificationId) {
    const n = this.sent.find(x => x.id === notificationId);
    if (n) n.read = true;
  }
}

class FindingService {
  constructor(assets, notifications) {
    this.assets = assets;
    this.notifications = notifications;
    this.byId = new Map();
    this.nextId = 1;
  }

  create(assetId, severity, title) {
    if (!this.assets.find(assetId)) throw new Error('Unknown asset: ' + assetId);
    const finding = { id: 'f' + this.nextId++, assetId, severity, title };
    this.byId.set(finding.id, finding);
    this.notifications.notifySubscribers(finding, 'New finding');
    return finding;
  }

  escalate(findingId, severity) {
    const finding = this.byId.get(findingId);
    if (!finding) throw new Error('Unknown finding: ' + findingId);
    if (SEVERITY.indexOf(severity) <= SEVERITY.indexOf(finding.severity)) {
      throw new Error('Escalation must raise severity');
    }
    finding.severity = severity;
    this.notifications.notifySubscribers(finding, 'Escalated to ' + severity);
    return finding;
  }
}

function createApp(clock) {
  const assets = new AssetStore();
  const subs = new SubscriptionStore();
  const notifications = new NotificationService(assets, subs, clock);
  const findings = new FindingService(assets, notifications);
  return { assets, subs, notifications, findings };
}
`,
});
