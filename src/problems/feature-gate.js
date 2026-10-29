PROBLEMS.push({
  id: 'feature-gate',
  title: 'Feature rollout gate',
  team: 'Mobile Platform',
  level: 'Mid-level',
  difficulty: 'Medium',
  minutes: 45,
  focus: ['Parsing', 'Recursion', 'Exact output'],
  format: 'Modeled on a 2026 online assessment where AI help was allowed and the code had to pass the provided unit tests exactly: rule checks first, then recursive dependencies, then cycle reporting.',
  scenario: 'The mobile app turns features on per user from a remote config. Support keeps getting tickets about features that switch on without the things they rely on, so you are writing the check that decides, and explains, whether a feature may be enabled.',
  body: `
<p>Write <code>canEnable(user, feature, config)</code>. It returns <code>{ ok, reason }</code>, where <code>reason</code> is <code>"OK"</code> when <code>ok</code> is <code>true</code> and an exact message otherwise.</p>
<pre class="inline-pre">user   = { country: "US", appVersion: "1.10.0", enabled: ["sync"] }
config = {
  allowedCountries: { "offline-maps": ["US", "CA"] },   // feature -> countries
  minVersion:       { "offline-maps": "1.9.0" },        // feature -> lowest app version
  deps:  ["offline-maps: sync, tiles", "tiles: storage"], // "feature: dep, dep"
  batch: ["tiles", "storage"],                          // features being enabled together
}</pre>
<ul>
<li>A feature with no entry in <code>allowedCountries</code> is allowed in every country. A feature with no entry in <code>minVersion</code> has no version floor.</li>
<li>Versions are dot-separated non-negative integers. Compare them part by part as numbers, so <code>1.10.0</code> is above <code>1.9.2</code>. A missing part counts as <code>0</code>, so <code>2</code> equals <code>2.0.0</code>.</li>
<li>Any of the <code>config</code> fields may be missing. Treat a missing field as empty.</li>
</ul>`,
  examples: `const user = { country: "DE", appVersion: "1.9.2", enabled: [] };
canEnable(user, "offline-maps", {
  allowedCountries: { "offline-maps": ["US"] },
  minVersion: { "offline-maps": "1.10.0" },
});
// { ok: false, reason: "country DE is not allowed; version 1.9.2 is below 1.10.0" }

canEnable({ country: "US", appVersion: "2.0", enabled: ["sync"] }, "offline-maps", {
  deps: ["offline-maps: sync, tiles"], batch: ["tiles"],
});
// { ok: true, reason: "OK" }`,
  constraints: ['Up to 500 features in a config', 'Dependency chains up to 200 deep', 'Feature names are lowercase letters, digits and hyphens', 'Reason strings must match exactly'],
  starter: `/**
 * @param {{country: string, appVersion: string, enabled: string[]}} user
 * @param {string} feature
 * @param {{allowedCountries?: Object, minVersion?: Object, deps?: string[], batch?: string[]}} config
 * @returns {{ok: boolean, reason: string}}
 */
function canEnable(user, feature, config) {
  // TODO
}
`,
  parts: [
    {
      title: 'Part 1: Country and version rules',
      body: `<p>Check the feature's own rules. Ignore <code>deps</code> and <code>batch</code> for now.</p>
<ul>
<li>Country fails: <code>"country DE is not allowed"</code> (with the user's country).</li>
<li>Version fails: <code>"version 1.9.2 is below 1.10.0"</code> (the user's version, then the floor, both exactly as written in the input).</li>
<li>Both fail: the country message, then <code>"; "</code>, then the version message, as one reason.</li>
<li>Otherwise <code>{ ok: true, reason: "OK" }</code>.</li>
</ul>`,
      tests: [
        { name: 'Allowed country and new enough version', src: `return [canEnable({country:'US', appVersion:'1.10.0', enabled:[]}, 'maps', {allowedCountries:{maps:['US','CA']}, minVersion:{maps:'1.9.0'}}), {ok:true, reason:'OK'}];` },
        { name: 'Blocked country', src: `return [canEnable({country:'FR', appVersion:'3.0.0', enabled:[]}, 'maps', {allowedCountries:{maps:['US']}}), {ok:false, reason:'country FR is not allowed'}];` },
        { name: 'Versions compare as numbers', src: `const c = {minVersion:{maps:'1.10.0'}};
return [[canEnable({country:'US', appVersion:'1.9.2', enabled:[]}, 'maps', c), canEnable({country:'US', appVersion:'1.10.1', enabled:[]}, 'maps', c)], [{ok:false, reason:'version 1.9.2 is below 1.10.0'}, {ok:true, reason:'OK'}]];` },
        { name: 'Both rules fail in one reason', src: `return [canEnable({country:'DE', appVersion:'1.9.2', enabled:[]}, 'maps', {allowedCountries:{maps:['US']}, minVersion:{maps:'1.10.0'}}), {ok:false, reason:'country DE is not allowed; version 1.9.2 is below 1.10.0'}];` },
      ],
      hidden: [
        { name: 'No rules means allowed', src: `return [canEnable({country:'JP', appVersion:'0.1', enabled:[]}, 'chat', {}), {ok:true, reason:'OK'}];` },
        { name: 'Versions with different lengths', src: `const u = v => ({country:'US', appVersion:v, enabled:[]});
const c = {minVersion:{chat:'2.0.0'}};
return [[canEnable(u('2'), 'chat', c).ok, canEnable(u('1.99'), 'chat', c).reason, canEnable(u('2.0.0.1'), 'chat', c).ok], [true, 'version 1.99 is below 2.0.0', true]];` },
        { name: 'Exactly the minimum version passes', src: `return [canEnable({country:'US', appVersion:'4.02.0', enabled:[]}, 'chat', {minVersion:{chat:'4.2'}}), {ok:true, reason:'OK'}];` },
        { name: 'Empty country list blocks everyone', src: `return [canEnable({country:'US', appVersion:'1.0', enabled:[]}, 'beta', {allowedCountries:{beta:[]}}).reason, 'country US is not allowed'];` },
      ],
    },
    {
      title: 'Part 2: Dependencies',
      body: `<p>Each <code>deps</code> entry is a string <code>"feature: depA, depB"</code>. Spaces around names are optional, and a feature may list no dependencies. Check dependencies only after the feature's own country and version rules pass.</p>
<ul>
<li>Check dependencies in the order they are listed and report the first one that fails.</li>
<li>A dependency in <code>user.enabled</code> is satisfied. Its own rules and dependencies are not rechecked.</li>
<li>A dependency that is not enabled and not in <code>config.batch</code> fails with <code>"missing dependency tiles"</code>.</li>
<li>A dependency in <code>config.batch</code> is satisfied if it can itself be enabled, using these same rules recursively. If it cannot, fail with <code>"dependency tiles blocked: "</code> followed by its reason.</li>
</ul>`,
      tests: [
        { name: 'Enabled dependency is satisfied', src: `return [canEnable({country:'US', appVersion:'1.0', enabled:['sync']}, 'maps', {deps:['maps: sync']}), {ok:true, reason:'OK'}];` },
        { name: 'Missing dependency', src: `return [canEnable({country:'US', appVersion:'1.0', enabled:['sync']}, 'maps', {deps:['maps: sync, tiles']}), {ok:false, reason:'missing dependency tiles'}];` },
        { name: 'Batch dependency that can be enabled', src: `return [canEnable({country:'US', appVersion:'1.0', enabled:[]}, 'maps', {deps:['maps: tiles', 'tiles: storage'], batch:['tiles', 'storage']}), {ok:true, reason:'OK'}];` },
        { name: 'Batch dependency blocked by its own rule', src: `return [canEnable({country:'US', appVersion:'1.0', enabled:[]}, 'maps', {deps:['maps: tiles'], batch:['tiles'], minVersion:{tiles:'1.2'}}), {ok:false, reason:'dependency tiles blocked: version 1.0 is below 1.2'}];` },
        { name: 'Own rules are checked before dependencies', src: `return [canEnable({country:'BR', appVersion:'1.0', enabled:[]}, 'maps', {deps:['maps: tiles'], allowedCountries:{maps:['US']}}), {ok:false, reason:'country BR is not allowed'}];` },
      ],
      hidden: [
        { name: 'Reasons nest down a chain', src: `return [canEnable({country:'IN', appVersion:'5.0', enabled:[]}, 'a', {deps:['a: b', 'b: c', 'c: d'], batch:['b', 'c']}), {ok:false, reason:'dependency b blocked: dependency c blocked: missing dependency d'}];` },
        { name: 'Loose spacing in dependency lines', src: `return [canEnable({country:'US', appVersion:'1.0', enabled:['x', 'y']}, 'z', {deps:['  z :x ,  y', 'y:']}), {ok:true, reason:'OK'}];` },
        { name: 'Enabled dependency is not rechecked', src: `return [canEnable({country:'US', appVersion:'1.0', enabled:['old']}, 'new', {deps:['new: old', 'old: gone'], allowedCountries:{old:['CA']}}), {ok:true, reason:'OK'}];` },
        { name: 'First failing dependency in listed order wins', src: `return [canEnable({country:'US', appVersion:'1.0', enabled:[]}, 'app', {deps:['app: p, q'], batch:['p'], allowedCountries:{p:['CA']}}).reason, 'dependency p blocked: country US is not allowed'];` },
      ],
    },
    {
      title: 'Part 3: Dependency cycles',
      body: `<p>Configs are hand-edited, and some now contain cycles, which currently overflow the stack. While following dependencies, if you reach a feature that is already on the current path from the requested feature, fail with a reason that lists the cycle:</p>
<pre class="inline-pre">"CYCLE: a -> b -> a"</pre>
<ul>
<li>The path starts at the first occurrence of the repeated feature on the current path and ends with that feature again. A feature that depends on itself gives <code>"CYCLE: a -> a"</code>.</li>
<li>A cycle reason is returned as is, without any <code>"dependency x blocked: "</code> prefix.</li>
<li>Enabled features are not followed, so they never form part of a cycle. Two branches that share a dependency are not a cycle.</li>
</ul>`,
      tests: [
        { name: 'Two features depend on each other', src: `return [canEnable({country:'US', appVersion:'1.0', enabled:[]}, 'a', {deps:['a: b', 'b: a'], batch:['b']}), {ok:false, reason:'CYCLE: a -> b -> a'}];` },
        { name: 'Feature depends on itself', src: `return [canEnable({country:'US', appVersion:'1.0', enabled:[]}, 'loop', {deps:['loop: loop']}), {ok:false, reason:'CYCLE: loop -> loop'}];` },
        { name: 'Cycle further down the path', src: `return [canEnable({country:'US', appVersion:'1.0', enabled:[]}, 'app', {deps:['app: a', 'a: b', 'b: c', 'c: a'], batch:['a', 'b', 'c']}), {ok:false, reason:'CYCLE: a -> b -> c -> a'}];` },
        { name: 'Shared dependency is not a cycle', src: `return [canEnable({country:'US', appVersion:'1.0', enabled:[]}, 'top', {deps:['top: left, right', 'left: base', 'right: base'], batch:['left', 'right', 'base']}), {ok:true, reason:'OK'}];` },
      ],
      hidden: [
        { name: 'Enabled feature breaks the cycle', src: `return [canEnable({country:'US', appVersion:'1.0', enabled:['b']}, 'a', {deps:['a: b', 'b: a']}), {ok:true, reason:'OK'}];` },
        { name: 'Earlier dependency fails before the cycle is reached', src: `return [canEnable({country:'US', appVersion:'1.0', enabled:[]}, 'a', {deps:['a: m, b', 'b: a'], batch:['b']}).reason, 'missing dependency m'];` },
        { name: 'Long chain that closes on itself', src: `const deps = [], batch = [];
for (let i = 0; i < 150; i++) { deps.push('f' + i + ': f' + (i + 1)); batch.push('f' + (i + 1)); }
deps.push('f150: f100');
const r = canEnable({country:'US', appVersion:'1.0', enabled:[]}, 'f0', {deps, batch});
const want = []; for (let i = 100; i <= 150; i++) want.push('f' + i); want.push('f100');
return [r, {ok:false, reason:'CYCLE: ' + want.join(' -> ')}];` },
        { name: 'Long chain without a cycle', src: `const deps = [], batch = [];
for (let i = 0; i < 199; i++) { deps.push('g' + i + ': g' + (i + 1)); batch.push('g' + (i + 1)); }
return [canEnable({country:'US', appVersion:'1.0', enabled:[]}, 'g0', {deps, batch}), {ok:true, reason:'OK'}];` },
      ],
    },
  ],
  followUps: ['The same dependency is reachable through thousands of branches. How do you avoid rechecking it each time?', 'Product wants every failing reason, not just the first. How would you change the return shape without breaking old clients?', 'How would you validate a config for cycles once, at publish time, instead of on every check?'],
  rubric: 'Strong: numeric part-by-part version compare with missing parts as 0; exact reason strings built in one place; deps parsed once into a Map with trimming; recursion carries the current path (array or stack) and detects a cycle only against that path, slicing from the first occurrence; cycle reason propagated unwrapped; enabled deps short-circuit; checks own rules before deps. Weak: string comparison of versions, a global visited set that flags diamonds as cycles, wrapping the CYCLE reason, rechecking enabled deps, parsing deps on every recursive call without noticing.',
  offline: {
    approach: 'Write one recursive helper `check(name, path)`. It first checks the country and version rules for `name` and joins any failures with `"; "`. Then it walks the parsed dependency list in order: enabled deps pass, a dep already on `path` is a cycle, a dep outside `batch` is missing, and anything else recurses with `path` extended. Wrap a failing child reason with `"dependency x blocked: "` unless it is a cycle.',
    hints: ['Split versions on `.`, map to `Number`, and compare index by index, using `0` when one side runs out.', 'Parse `deps` once into a `Map` from feature to an array of trimmed names, filtering out empty strings.', 'Keep the current path as an array. `path.indexOf(dep)` tells you both that there is a cycle and where it starts: `path.slice(at).concat(dep).join(" -> ")`.', 'A visited set shared across branches is wrong here: two features that both depend on `base` would look like a cycle. Only the current path counts.'],
    edge: ['Versions with different numbers of parts (`2` vs `2.0.0`).', 'Both country and version failing.', 'A feature listed with no dependencies (`"y:"`).', 'A feature that depends on itself.', 'Diamond-shaped dependencies.'],
    complexity: 'Parsing is **O(total dependency text)**. Each check walks the reachable dependency tree, **O(V + E)** for chains and trees. Without memoization, heavily shared sub-graphs can be revisited many times; caching results per feature fixes that.',
    skeleton: `function canEnable(user, feature, config) {
  const deps = new Map(); // feature -> [dep, ...]
  // TODO: parse config.deps lines "name: a, b"

  function check(name, path) {
    const problems = [];
    // TODO: country rule, version rule (numeric compare)
    if (problems.length) return { ok: false, reason: problems.join('; ') };

    for (const dep of deps.get(name) || []) {
      // TODO: enabled -> continue; on path -> CYCLE; not in batch -> missing; else recurse
    }
    return { ok: true, reason: 'OK' };
  }
  return check(feature, [feature]);
}`,
  },
  solution: `// Returns -1, 0 or 1. Missing parts count as 0, so "2" equals "2.0.0".
function compareVersions(a, b) {
  const x = a.split('.').map(Number);
  const y = b.split('.').map(Number);
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    const diff = (x[i] || 0) - (y[i] || 0);
    if (diff !== 0) return diff < 0 ? -1 : 1;
  }
  return 0;
}

// "feature: depA, depB" -> Map { feature => [depA, depB] }
function parseDeps(lines) {
  const deps = new Map();
  for (const line of lines || []) {
    const colon = line.indexOf(':');
    const name = line.slice(0, colon).trim();
    const list = line.slice(colon + 1).split(',').map(s => s.trim()).filter(Boolean);
    deps.set(name, list);
  }
  return deps;
}

function canEnable(user, feature, config) {
  const deps = parseDeps(config.deps);
  const enabled = new Set(user.enabled || []);
  const batch = new Set(config.batch || []);
  const allowed = config.allowedCountries || {};
  const floors = config.minVersion || {};

  function check(name, path) {
    // 1. The feature's own rules.
    const problems = [];
    const countries = allowed[name];
    if (countries && !countries.includes(user.country)) {
      problems.push('country ' + user.country + ' is not allowed');
    }
    const min = floors[name];
    if (min && compareVersions(user.appVersion, min) < 0) {
      problems.push('version ' + user.appVersion + ' is below ' + min);
    }
    if (problems.length) return { ok: false, reason: problems.join('; ') };

    // 2. Dependencies, in listed order.
    for (const dep of deps.get(name) || []) {
      if (enabled.has(dep)) continue;

      const at = path.indexOf(dep);
      if (at !== -1) {
        return { ok: false, reason: 'CYCLE: ' + path.slice(at).concat(dep).join(' -> ') };
      }
      if (!batch.has(dep)) return { ok: false, reason: 'missing dependency ' + dep };

      const sub = check(dep, path.concat(dep));
      if (!sub.ok) {
        if (sub.reason.startsWith('CYCLE: ')) return sub;
        return { ok: false, reason: 'dependency ' + dep + ' blocked: ' + sub.reason };
      }
    }
    return { ok: true, reason: 'OK' };
  }

  return check(feature, [feature]);
}
`,
});
