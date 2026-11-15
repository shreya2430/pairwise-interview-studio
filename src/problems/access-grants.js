PROBLEMS.push({
  id: 'access-grants',
  title: 'Temporary access and break-glass',
  team: 'Security Engineering',
  level: 'Mid-level',
  difficulty: 'Medium',
  minutes: 60,
  focus: ['Debugging', 'Time boundaries', 'Extending code', 'Security rules'],
  format: 'Modeled on 2026 Amazon AI-assisted repo tasks: an existing access service with a passing test that passes for the wrong reason, then a feature, then a policy change request.',
  scenario: 'Engineers get temporary roles such as prod-read from a lead, and the service checks access on every request. People say a grant they just received does not work, and a security review found someone who kept prod-admin after it was revoked.',
  body: `
<p>The editor holds the access service: stores, a service, and <code>createApp(clock)</code>. Tests only use the object it returns.</p>
<ul>
<li>A grant is <code>{ id, userId, role, expiresAt, grantedBy, reason }</code>. Times are whole seconds from <code>clock.now()</code>.</li>
<li>A grant is valid while <code>now &lt; expiresAt</code>. At exactly <code>expiresAt</code>, access is gone.</li>
<li>Groups give standing roles with no expiry. Revoking a direct grant never touches group roles.</li>
<li>Every successful change writes one entry to <code>audit.entries</code>: <code>{ actor, action, details, at }</code>.</li>
</ul>`,
  examples: `const clock = { t: 1000, now() { return this.t; } };
const app = createApp(clock);
app.access.grant("alice", "prod-read", 3600, "lead");
app.access.hasAccess("alice", "prod-read");   // true
clock.t = 4600;
app.access.hasAccess("alice", "prod-read");   // false (exactly at expiry)

app.groups.addMember("sre", "bob");
app.groups.addRole("sre", "prod-read");
app.access.hasAccess("bob", "prod-read");     // true`,
  constraints: ['Durations are whole seconds', '30 days = 2,592,000 seconds', 'Up to 10⁴ grants per test'],
  starter: `// ---------- repository layer ----------
class GrantStore {
  constructor() { this.rows = []; }
  save(grant) { this.rows.push(grant); }
  byUser(userId) { return this.rows.filter(g => g.userId === userId); }
  remove(grant) { const i = this.rows.indexOf(grant); if (i >= 0) this.rows.splice(i, 1); }
}

class GroupStore {
  constructor() { this.members = new Map(); this.roles = new Map(); }
  addMember(group, userId) { if (!this.members.has(group)) this.members.set(group, new Set()); this.members.get(group).add(userId); }
  addRole(group, role) { if (!this.roles.has(group)) this.roles.set(group, new Set()); this.roles.get(group).add(role); }
  groupsOf(userId) { return [...this.members].filter(([, users]) => users.has(userId)).map(([g]) => g); }
  rolesOf(group) { return this.roles.get(group) || new Set(); }
}

class AuditLog {
  constructor() { this.entries = []; }
  append(actor, action, details, at) { this.entries.push({ actor, action, details, at }); }
}

// ---------- service layer ----------
class AccessService {
  constructor(grants, groups, audit, clock) {
    this.grants = grants;
    this.groups = groups;
    this.audit = audit;
    this.clock = clock;
    this.nextId = 1;
  }

  /** Gives userId the role for seconds. Nobody can grant a role to themselves. */
  grant(userId, role, seconds, grantedBy) {
    if (userId === grantedBy) throw new Error('Self-grant is not allowed');
    if (!(seconds > 0)) throw new Error('Duration must be positive');
    const now = this.clock.now();
    const grant = { id: 'g' + this.nextId++, userId, role, expiresAt: now + seconds, grantedBy, reason: null };
    this.grants.save(grant);
    this.audit.append(grantedBy, 'GRANT', userId + ' ' + role, now);
    return grant;
  }

  /** True if the user holds the role through an unexpired grant or one of their groups. */
  hasAccess(userId, role) {
    const now = Math.floor(Date.now() / 1000);
    const direct = this.grants.byUser(userId).some(g => g.role === role && g.expiresAt > now);
    if (direct) return true;
    return this.groups.groupsOf(userId).some(g => this.groups.rolesOf(g).has(role));
  }

  /** Removes the user's direct grants for the role. */
  revoke(userId, role, actor) {
    const g = this.grants.byUser(userId).find(x => x.role === role);
    if (g) this.grants.remove(g);
    this.audit.append(actor, 'REVOKE', userId + ' ' + role, this.clock.now());
  }
}

// ---------- wiring ----------
function createApp(clock) {
  const grants = new GrantStore();
  const groups = new GroupStore();
  const audit = new AuditLog();
  const access = new AccessService(grants, groups, audit, clock);
  return { grants, groups, audit, access };
}
`,
  parts: [
    {
      title: 'Part 1: Fix access checks',
      body: `
<p>Three problems, and only some have tests.</p>
<ul>
<li>A grant someone just received doesn't work at all.</li>
<li>A user granted <code>prod-admin</code> twice (an extension) still had it after <code>revoke</code>. After revoke, the user must have no direct grant for that role.</li>
<li>New policy: no grant may last longer than 30 days. Longer requests throw. Exactly 30 days is allowed.</li>
</ul>
<p>One visible test passes today. Check whether it passes for the right reason.</p>`,
      tests: [
        { name: 'A new grant gives access', src: `const clock = { t: 1000, now() { return this.t; } };
const app = createApp(clock);
app.access.grant('alice', 'prod-read', 3600, 'lead');
return [app.access.hasAccess('alice', 'prod-read'), true];` },
        { name: 'A grant expires', src: `const clock = { t: 1000, now() { return this.t; } };
const app = createApp(clock);
app.access.grant('alice', 'prod-read', 3600, 'lead');
clock.t = 9000;
return [app.access.hasAccess('alice', 'prod-read'), false];` },
        { name: 'Group role gives access', src: `const clock = { t: 1000, now() { return this.t; } };
const app = createApp(clock);
app.groups.addMember('soc', 'alice'); app.groups.addRole('soc', 'read-alerts');
return [app.access.hasAccess('alice', 'read-alerts'), true];` },
      ],
      hidden: [
        { name: 'Access ends exactly at expiry', src: `const clock = { t: 1000, now() { return this.t; } };
const app = createApp(clock);
app.access.grant('alice', 'r', 3600, 'lead');
clock.t = 4599; const before = app.access.hasAccess('alice', 'r');
clock.t = 4600; const at = app.access.hasAccess('alice', 'r');
return [[before, at], [true, false]];` },
        { name: 'Works with a clock far in the future', src: `const clock = { t: 4000000000, now() { return this.t; } };
const app = createApp(clock);
app.access.grant('alice', 'r', 60, 'lead');
clock.t += 61;
return [app.access.hasAccess('alice', 'r'), false];` },
        { name: 'Revoke removes every direct grant', src: `const clock = { t: 1000, now() { return this.t; } };
const app = createApp(clock);
app.access.grant('alice', 'prod-admin', 3600, 'lead');
app.access.grant('alice', 'prod-admin', 28800, 'lead');
app.access.grant('alice', 'prod-admin', 86400, 'lead2');
app.access.revoke('alice', 'prod-admin', 'secops');
return [app.access.hasAccess('alice', 'prod-admin'), false];` },
        { name: 'Revoke keeps other roles and group roles', src: `const clock = { t: 1000, now() { return this.t; } };
const app = createApp(clock);
app.access.grant('alice', 'prod-admin', 3600, 'lead');
app.access.grant('alice', 'prod-read', 3600, 'lead');
app.groups.addMember('sre', 'alice'); app.groups.addRole('sre', 'prod-admin');
app.access.revoke('alice', 'prod-admin', 'secops');
return [[app.access.hasAccess('alice', 'prod-read'), app.access.hasAccess('alice', 'prod-admin')], [true, true]];` },
        { name: 'Thirty-day cap', src: `const clock = { t: 1000, now() { return this.t; } };
const app = createApp(clock);
const throws = s => { try { app.access.grant('alice', 'r', s, 'lead'); return false; } catch (e) { return true; } };
return [[throws(2592000), throws(2592001)], [false, true]];` },
        { name: 'A refused grant is not audited', src: `const clock = { t: 1000, now() { return this.t; } };
const app = createApp(clock);
try { app.access.grant('alice', 'r', 2592001, 'lead'); } catch (e) {}
return [app.audit.entries.length, 0];` },
      ],
    },
    {
      title: 'Part 2: Break-glass access',
      body: `
<p>During an incident, on-call needs admin access right away, without waiting for a lead. Add <code>access.breakGlass(userId, reason, seconds)</code>, which returns the new grant.</p>
<ul>
<li>It gives the role <code>admin</code>, with <code>grantedBy: "break-glass"</code> and the reason stored on the grant.</li>
<li><code>reason</code> is required: null, empty or only spaces throws.</li>
<li><code>seconds</code> must be more than 0 and at most 3600; otherwise throw.</li>
<li>Only one active break-glass grant per user. A second one while the first is active throws. After it expires, they can break glass again. A normal admin grant from a lead doesn't count.</li>
<li>Audit it: actor is the user, action <code>BREAK_GLASS</code>, details is the reason. Nothing is audited when the request is refused.</li>
</ul>`,
      tests: [
        { name: 'Break-glass gives admin and keeps the reason', src: `const clock = { t: 1000, now() { return this.t; } };
const app = createApp(clock);
const g = app.access.breakGlass('oncall', 'SEV1 key leak', 1800);
return [[app.access.hasAccess('oncall', 'admin'), g.role, g.grantedBy, g.reason], [true, 'admin', 'break-glass', 'SEV1 key leak']];` },
        { name: 'Reason is required', src: `const clock = { t: 1000, now() { return this.t; } };
const app = createApp(clock);
const throws = r => { try { app.access.breakGlass('oncall', r, 60); return false; } catch (e) { return true; } };
return [[throws(null), throws(''), throws('   ')], [true, true, true]];` },
        { name: 'One active break-glass at a time', src: `const clock = { t: 1000, now() { return this.t; } };
const app = createApp(clock);
app.access.breakGlass('oncall', 'SEV1', 1800);
clock.t = 1600;
let threw = false; try { app.access.breakGlass('oncall', 'again', 600); } catch (e) { threw = true; }
return [threw, true];` },
      ],
      hidden: [
        { name: 'Break-glass expires', src: `const clock = { t: 1000, now() { return this.t; } };
const app = createApp(clock);
app.access.breakGlass('oncall', 'SEV1', 1800);
clock.t = 2800;
return [app.access.hasAccess('oncall', 'admin'), false];` },
        { name: 'After expiry they can break glass again', src: `const clock = { t: 1000, now() { return this.t; } };
const app = createApp(clock);
app.access.breakGlass('oncall', 'SEV1', 1800);
clock.t = 2800;
let ok = true; try { app.access.breakGlass('oncall', 'SEV1 follow-up', 600); } catch (e) { ok = false; }
return [ok, true];` },
        { name: 'Duration bounds', src: `const clock = { t: 1000, now() { return this.t; } };
const app = createApp(clock);
const throws = (u, s) => { try { app.access.breakGlass(u, 'r', s); return false; } catch (e) { return true; } };
return [[throws('u1', 0), throws('u2', 3601), throws('u3', 3600)], [true, true, false]];` },
        { name: 'A lead-granted admin role does not block it', src: `const clock = { t: 1000, now() { return this.t; } };
const app = createApp(clock);
app.access.grant('oncall', 'admin', 7200, 'lead');
let ok = true; try { app.access.breakGlass('oncall', 'SEV1', 600); } catch (e) { ok = false; }
return [ok, true];` },
        { name: 'Audited, and refusals are not', src: `const clock = { t: 1000, now() { return this.t; } };
const app = createApp(clock);
try { app.access.breakGlass('oncall', '', 60); } catch (e) {}
const before = app.audit.entries.length;
app.access.breakGlass('oncall', 'SEV1 key leak', 60);
const e = app.audit.entries[app.audit.entries.length - 1];
return [[before, e.actor, e.action, e.details], [0, 'oncall', 'BREAK_GLASS', 'SEV1 key leak']];` },
      ],
    },
    {
      title: 'Part 3: Two-person rule',
      body: `
<p>Change request from the security review: any role whose name ends in <code>-admin</code> now needs a second person's approval. Add <code>access.approve(grantId, approver)</code>.</p>
<ul>
<li>A lead-granted <code>-admin</code> grant gives no access until it is approved. Other roles work as before.</li>
<li>The approver can be neither the grantee nor the person who granted it; that throws. An unknown grant id throws.</li>
<li>Audit approvals: actor is the approver, action <code>APPROVE</code>, details is the grant id.</li>
<li>Break-glass (role <code>admin</code>, no suffix) is not affected.</li>
</ul>`,
      tests: [
        { name: 'Admin grant waits for approval', src: `const clock = { t: 1000, now() { return this.t; } };
const app = createApp(clock);
const g = app.access.grant('alice', 'prod-admin', 3600, 'lead');
const before = app.access.hasAccess('alice', 'prod-admin');
app.access.approve(g.id, 'secops');
return [[before, app.access.hasAccess('alice', 'prod-admin')], [false, true]];` },
        { name: 'Granter cannot approve', src: `const clock = { t: 1000, now() { return this.t; } };
const app = createApp(clock);
const g = app.access.grant('alice', 'prod-admin', 3600, 'lead');
let threw = false; try { app.access.approve(g.id, 'lead'); } catch (e) { threw = true; }
return [[threw, app.access.hasAccess('alice', 'prod-admin')], [true, false]];` },
      ],
      hidden: [
        { name: 'Grantee cannot approve', src: `const clock = { t: 1000, now() { return this.t; } };
const app = createApp(clock);
const g = app.access.grant('alice', 'db-admin', 3600, 'lead');
let threw = false; try { app.access.approve(g.id, 'alice'); } catch (e) { threw = true; }
return [threw, true];` },
        { name: 'Other roles need no approval', src: `const clock = { t: 1000, now() { return this.t; } };
const app = createApp(clock);
app.access.grant('alice', 'prod-read', 3600, 'lead');
app.access.grant('alice', 'administrator-view', 3600, 'lead');
return [[app.access.hasAccess('alice', 'prod-read'), app.access.hasAccess('alice', 'administrator-view')], [true, true]];` },
        { name: 'Break-glass still works', src: `const clock = { t: 1000, now() { return this.t; } };
const app = createApp(clock);
app.access.breakGlass('oncall', 'SEV1', 600);
return [app.access.hasAccess('oncall', 'admin'), true];` },
        { name: 'Approval does not outlive the grant', src: `const clock = { t: 1000, now() { return this.t; } };
const app = createApp(clock);
const g = app.access.grant('alice', 'prod-admin', 3600, 'lead');
app.access.approve(g.id, 'secops');
clock.t = 4600;
return [app.access.hasAccess('alice', 'prod-admin'), false];` },
        { name: 'Unknown grant id throws and approvals are audited', src: `const clock = { t: 1000, now() { return this.t; } };
const app = createApp(clock);
let threw = false; try { app.access.approve('g999', 'secops'); } catch (e) { threw = true; }
const g = app.access.grant('alice', 'prod-admin', 3600, 'lead');
app.access.approve(g.id, 'secops');
const e = app.audit.entries[app.audit.entries.length - 1];
return [[threw, e.actor, e.action, e.details], [true, 'secops', 'APPROVE', g.id]];` },
      ],
    },
  ],
  followUps: [
    'hasAccess runs on every request at 50k requests per second. What would you cache, and how do revokes take effect fast?',
    'How would you alert the security team on every break-glass use, and review it afterwards?',
    'Grants live in a database shared by many service instances. How do you make "one active break-glass per user" safe under concurrent requests?',
    'Why is reading Date.now() inside the service a problem beyond tests?',
  ],
  rubric: 'Bugs: (1) hasAccess reads Date.now() instead of clock.now(), so in tests (small clock values) every new grant looks expired; the visible "A grant expires" test passes for the wrong reason; (2) revoke removes only the first matching grant; (3) no 30-day cap. Strong: uses clock.now() and now < expiresAt, says out loud why the expiry test was misleading, removes all matching direct grants without mutating the array it iterates, validates before saving or auditing, break-glass active check looks only at grantedBy === "break-glass" grants, Part 3 keeps approval state on the grant and checks it in hasAccess. Weak: changes the tests to use Date.now(), uses <= at the boundary, audits refused requests, counts a lead-granted admin grant as an active break-glass, matches "-admin" with includes() so "administrator-view" needs approval.',
  offline: {
    approach: 'Start by asking why "A grant expires" passes while "A new grant gives access" fails: both read the wall clock, which is far ahead of the test clock. Switch hasAccess to this.clock.now() with now < expiresAt. In revoke, filter all matching grants first, then remove each. Add the cap check before saving. Break-glass validates reason and duration, checks for an active break-glass grant, then saves and audits. For Part 3, store approvedBy on the grant and require it for roles that end with "-admin".',
    hints: [
      'Which clock does hasAccess read, and which clock do the tests control?',
      'Why does the expiry test pass while the "new grant" test fails? Both have the same root cause.',
      'find() returns only the first match. What if the user has two grants for the same role?',
      'Validate everything before you save or audit, so a refused request leaves no trace.',
      'Use endsWith("-admin"), not includes.',
    ],
    edge: [
      'Checking access at exactly expiresAt.',
      'Three grants for the same role, then one revoke.',
      'A group role and a direct grant for the same role.',
      'Exactly 30 days, and 30 days plus one second.',
      'Reason made of spaces only.',
      'A lead-granted admin grant while breaking glass.',
      'Role names like "administrator-view" that contain "admin" without the suffix.',
    ],
    complexity: 'hasAccess scans the user\'s grants and groups: **O(G + M)**, where G is grants in the store (the array filter) and M is group memberships. An index from user to grants would make it **O(g)** per user.',
    skeleton: `hasAccess(userId, role) {
  const now = this.clock.now();
  // TODO: any direct grant for role with now < expiresAt (and approved if role ends with -admin)
  // TODO: otherwise, any group role
}

breakGlass(userId, reason, seconds) {
  // TODO: validate reason and seconds first
  // TODO: refuse if an unexpired break-glass grant exists
  // TODO: save the grant, audit BREAK_GLASS, return it
}`,
  },
  solution: `class GrantStore {
  constructor() { this.rows = []; }
  save(grant) { this.rows.push(grant); }
  byUser(userId) { return this.rows.filter(g => g.userId === userId); }
  byId(id) { return this.rows.find(g => g.id === id) || null; }
  remove(grant) { const i = this.rows.indexOf(grant); if (i >= 0) this.rows.splice(i, 1); }
}

class GroupStore {
  constructor() { this.members = new Map(); this.roles = new Map(); }
  addMember(group, userId) { if (!this.members.has(group)) this.members.set(group, new Set()); this.members.get(group).add(userId); }
  addRole(group, role) { if (!this.roles.has(group)) this.roles.set(group, new Set()); this.roles.get(group).add(role); }
  groupsOf(userId) { return [...this.members].filter(([, users]) => users.has(userId)).map(([g]) => g); }
  rolesOf(group) { return this.roles.get(group) || new Set(); }
}

class AuditLog {
  constructor() { this.entries = []; }
  append(actor, action, details, at) { this.entries.push({ actor, action, details, at }); }
}

const MAX_GRANT = 30 * 24 * 3600;
const MAX_BREAK_GLASS = 3600;
const needsApproval = role => role.endsWith('-admin');

class AccessService {
  constructor(grants, groups, audit, clock) {
    this.grants = grants;
    this.groups = groups;
    this.audit = audit;
    this.clock = clock;
    this.nextId = 1;
  }

  grant(userId, role, seconds, grantedBy) {
    if (userId === grantedBy) throw new Error('Self-grant is not allowed');
    if (!(seconds > 0)) throw new Error('Duration must be positive');
    if (seconds > MAX_GRANT) throw new Error('Grants are limited to 30 days');
    const now = this.clock.now();
    const grant = { id: 'g' + this.nextId++, userId, role, expiresAt: now + seconds, grantedBy, reason: null, approvedBy: null };
    this.grants.save(grant);
    this.audit.append(grantedBy, 'GRANT', userId + ' ' + role, now);
    return grant;
  }

  // Time always comes from the injected clock: valid while now < expiresAt.
  hasAccess(userId, role) {
    const now = this.clock.now();
    const direct = this.grants.byUser(userId).some(g =>
      g.role === role && now < g.expiresAt && (!needsApproval(g.role) || g.approvedBy !== null));
    if (direct) return true;
    return this.groups.groupsOf(userId).some(g => this.groups.rolesOf(g).has(role));
  }

  revoke(userId, role, actor) {
    for (const g of this.grants.byUser(userId).filter(x => x.role === role)) this.grants.remove(g);
    this.audit.append(actor, 'REVOKE', userId + ' ' + role, this.clock.now());
  }

  breakGlass(userId, reason, seconds) {
    if (reason == null || String(reason).trim() === '') throw new Error('Reason is required');
    if (!(seconds > 0) || seconds > MAX_BREAK_GLASS) throw new Error('Break-glass lasts at most 1 hour');
    const now = this.clock.now();
    const active = this.grants.byUser(userId).some(g => g.grantedBy === 'break-glass' && now < g.expiresAt);
    if (active) throw new Error('Break-glass already active');
    const grant = { id: 'g' + this.nextId++, userId, role: 'admin', expiresAt: now + seconds, grantedBy: 'break-glass', reason, approvedBy: null };
    this.grants.save(grant);
    this.audit.append(userId, 'BREAK_GLASS', reason, now);
    return grant;
  }

  approve(grantId, approver) {
    const g = this.grants.byId(grantId);
    if (!g) throw new Error('Unknown grant: ' + grantId);
    if (approver === g.userId || approver === g.grantedBy) throw new Error('Approver must be a third person');
    g.approvedBy = approver;
    this.audit.append(approver, 'APPROVE', grantId, this.clock.now());
  }
}

function createApp(clock) {
  const grants = new GrantStore();
  const groups = new GroupStore();
  const audit = new AuditLog();
  const access = new AccessService(grants, groups, audit, clock);
  return { grants, groups, audit, access };
}
`,
});
