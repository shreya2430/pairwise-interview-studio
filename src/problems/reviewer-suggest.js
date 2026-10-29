PROBLEMS.push({
  id: 'reviewer-suggest',
  title: 'Suggest code reviewers',
  team: 'Developer Productivity',
  level: 'Mid-level',
  difficulty: 'Medium',
  minutes: 40,
  focus: ['Hash maps', 'Ranking', 'Spec reading'],
  format: 'Modeled on a repo-automation task reported from 2025–26 AI-assisted coding rounds: score people from commit history, then layer on weighting and fallback rules.',
  scenario: 'Pull requests in the monorepo sit for days because nobody is tagged. The bot that opens each PR should suggest reviewers who know the files being changed.',
  body: `
<p>Write <code>suggestReviewers(history, change, k, load)</code>.</p>
<ul>
<li><code>history</code> is a list of commits <code>{ author, time, files }</code>. <code>time</code> is Unix seconds and <code>files</code> is a list of distinct repo paths such as <code>"billing/invoice.js"</code>. Every commit's time is at or before <code>change.time</code>.</li>
<li><code>change</code> is the pull request: <code>{ author, time, files }</code>. If <code>change.files</code> lists a path twice, it counts once.</li>
<li><code>load</code> is optional and maps a person to their number of open reviews. A missing person has <code>0</code>.</li>
<li>Return up to <code>k</code> entries <code>{ name, score }</code>, sorted by <code>score</code> descending, then <code>name</code> ascending. People with nothing counted are left out. The change's author is never suggested.</li>
</ul>`,
  examples: `const T = 1720000000;
const history = [
  { author: "maya", time: T, files: ["billing/invoice.js", "billing/tax.js"] },
  { author: "jon",  time: T, files: ["billing/invoice.js"] },
  { author: "jon",  time: T, files: ["billing/invoice.js", "README.md"] },
  { author: "ana",  time: T, files: ["billing/tax.js"] },
];
const change = { author: "maya", time: T, files: ["billing/invoice.js", "billing/tax.js"] };

suggestReviewers(history, change, 5);
// [{ name: "jon", score: 2 }, { name: "ana", score: 1 }]`,
  constraints: ['Up to 2 × 10⁴ commits, each touching up to 20 files', 'Up to 200 files in a change', '1 ≤ k ≤ 50', 'Paths use "/" and never start or end with it'],
  starter: `/**
 * @param {{author: string, time: number, files: string[]}[]} history
 * @param {{author: string, time: number, files: string[]}} change
 * @param {number} k
 * @param {Record<string, number>} [load]  open reviews per person
 * @returns {{name: string, score: number}[]}
 */
function suggestReviewers(history, change, k, load = {}) {
  // TODO
}
`,
  parts: [
    {
      title: 'Part 1: Count file touches',
      body: `
<p>Score each person by how often they touched the changed files.</p>
<ul>
<li>For each file in <code>change.files</code>, every commit by that person whose <code>files</code> include it adds <code>1</code>. A commit that touches two of the changed files adds <code>2</code>.</li>
<li>Skip commits by <code>change.author</code>.</li>
<li>Ignore <code>time</code> and <code>load</code> for now. In this part's tests every commit happens at the change's time and no one has open reviews, so Part 2's rules do not change these answers.</li>
</ul>`,
      tests: [
        { name: 'Example ranking', src: `const T = 1720000000;
const history = [
  {author:'maya', time:T, files:['billing/invoice.js','billing/tax.js']},
  {author:'jon', time:T, files:['billing/invoice.js']},
  {author:'jon', time:T, files:['billing/invoice.js','README.md']},
  {author:'ana', time:T, files:['billing/tax.js']}];
return [suggestReviewers(history, {author:'maya', time:T, files:['billing/invoice.js','billing/tax.js']}, 5), [{name:'jon',score:2},{name:'ana',score:1}]];` },
        { name: 'Ties go to the alphabetically first name, and k caps the list', src: `const T = 100;
const history = [
  {author:'cy', time:T, files:['app/main.js']},
  {author:'bo', time:T, files:['app/main.js']},
  {author:'al', time:T, files:['app/main.js']}];
return [suggestReviewers(history, {author:'zed', time:T, files:['app/main.js']}, 2), [{name:'al',score:1},{name:'bo',score:1}]];` },
        { name: 'One commit touching two changed files counts twice', src: `const T = 100;
const history = [
  {author:'lin', time:T, files:['api/a.go','api/b.go']},
  {author:'raj', time:T, files:['api/a.go']},
  {author:'raj', time:T, files:['web/x.ts']}];
return [suggestReviewers(history, {author:'kim', time:T, files:['api/a.go','api/b.go']}, 3), [{name:'lin',score:2},{name:'raj',score:1}]];` },
        { name: 'Nobody relevant gives an empty list', src: `const T = 100;
const history = [{author:'lin', time:T, files:['docs/intro.md']}, {author:'kim', time:T, files:['src/x.js']}];
return [suggestReviewers(history, {author:'kim', time:T, files:['src/x.js']}, 3), []];` },
      ],
      hidden: [
        { name: 'k larger than the number of people', src: `const T = 9;
const history = [{author:'a', time:T, files:['f/x']}, {author:'b', time:T, files:['f/x']}, {author:'b', time:T, files:['f/x']}];
return [suggestReviewers(history, {author:'c', time:T, files:['f/x']}, 10), [{name:'b',score:2},{name:'a',score:1}]];` },
        { name: 'Duplicate paths in the change count once', src: `const T = 9;
const history = [{author:'a', time:T, files:['f/x']}];
return [suggestReviewers(history, {author:'c', time:T, files:['f/x','f/x','f/x']}, 3), [{name:'a',score:1}]];` },
        { name: 'Names compare as plain strings', src: `const T = 9;
const history = [{author:'bob', time:T, files:['p/q']}, {author:'Bea', time:T, files:['p/q']}, {author:'al', time:T, files:['p/q']}];
return [suggestReviewers(history, {author:'z', time:T, files:['p/q']}, 3).map(r => r.name), ['Bea','al','bob']];` },
        { name: '20k commits', src: `const T = 1000000; let s = 1;
const next = () => (s = (s * 48271) % 2147483647);
const history = [];
for (let i = 0; i < 20000; i++) { const files = []; for (let j = 0; j < 10; j++) files.push('mod' + (next() % 40) + '/f' + (next() % 25) + '.js'); history.push({author:'dev' + (next() % 300), time:T, files:[...new Set(files)]}); }
const change = {author:'dev0', time:T, files:[]};
for (let i = 0; i < 100; i++) change.files.push('mod' + (i % 40) + '/f' + (i % 25) + '.js');
const r = suggestReviewers(history, change, 3);
return [r, [{name:'dev30',score:98},{name:'dev77',score:97},{name:'dev110',score:92}]];` },
      ],
    },
    {
      title: 'Part 2: Recency, directories and load',
      body: `
<p>Old commits matter less, new files need a fallback, and busy people should be left alone.</p>
<ul>
<li><strong>Recency.</strong> Each counted touch is now worth <code>0.5 ** (ageDays / 30)</code>, where <code>ageDays = (change.time - commit.time) / 86400</code> (not rounded). A touch from today is worth 1, one from 30 days ago 0.5.</li>
<li><strong>Directory fallback.</strong> Work file by file. If no eligible person touched a changed file exactly, count instead every touch of a file in the same parent directory, at half weight. The parent directory is everything before the last <code>/</code>, or <code>""</code> for a file at the repo root. Only the direct parent counts: <code>billing/v2/a.js</code> is not in <code>billing</code>.</li>
<li><strong>Load.</strong> People with <code>load[name] &gt;= 3</code> are not eligible, like the change's author. Their commits count for nobody.</li>
<li>Round each final score to 4 decimal places with <code>Math.round(score * 10000) / 10000</code> and sort by the rounded score.</li>
</ul>
<pre class="inline-pre">DAY = 86400, T = 200 * DAY
history: jon edits pay/a.js at T - 30*DAY, ana edits pay/a.js at T
change:  { author: "kim", time: T, files: ["pay/a.js", "pay/new.js"] }
pay/a.js:   jon 0.5, ana 1
pay/new.js: nobody touched it, so pay/ touches count at half weight:
            jon 0.25, ana 0.5
result: [{ name: "ana", score: 1.5 }, { name: "jon", score: 0.75 }]</pre>`,
      tests: [
        { name: 'Example with fallback', src: `const DAY = 86400, T = 200 * DAY;
const history = [{author:'jon', time:T - 30 * DAY, files:['pay/a.js']}, {author:'ana', time:T, files:['pay/a.js']}];
return [suggestReviewers(history, {author:'kim', time:T, files:['pay/a.js','pay/new.js']}, 5), [{name:'ana',score:1.5},{name:'jon',score:0.75}]];` },
        { name: 'Older touches are worth less', src: `const DAY = 86400, T = 400 * DAY;
const history = [
  {author:'old', time:T - 90 * DAY, files:['x/y.py']}, {author:'old', time:T - 90 * DAY, files:['x/y.py']},
  {author:'old', time:T - 90 * DAY, files:['x/y.py']}, {author:'mid', time:T - 30 * DAY, files:['x/y.py']},
  {author:'new', time:T - 10 * DAY, files:['x/y.py']}];
return [suggestReviewers(history, {author:'me', time:T, files:['x/y.py']}, 3), [{name:'new',score:0.7937},{name:'mid',score:0.5},{name:'old',score:0.375}]];` },
        { name: 'Fallback only applies to files nobody touched', src: `const T = 5000000;
const history = [
  {author:'ana', time:T, files:['svc/a.rs']},
  {author:'bo', time:T, files:['svc/b.rs','svc/c.rs']},
  {author:'cy', time:T, files:['other/z.rs']}];
return [suggestReviewers(history, {author:'me', time:T, files:['svc/a.rs','svc/new.rs']}, 5), [{name:'ana',score:1.5},{name:'bo',score:1}]];` },
        { name: 'Busy reviewers are skipped', src: `const T = 5000000;
const history = [
  {author:'ana', time:T, files:['ui/btn.tsx']}, {author:'ana', time:T, files:['ui/btn.tsx']},
  {author:'bo', time:T, files:['ui/btn.tsx']}, {author:'cy', time:T, files:['ui/btn.tsx']}];
return [suggestReviewers(history, {author:'me', time:T, files:['ui/btn.tsx']}, 5, {ana:3, bo:2}), [{name:'bo',score:1},{name:'cy',score:1}]];` },
      ],
      hidden: [
        { name: 'Root-level files fall back to the repo root', src: `const T = 1000;
const history = [{author:'ana', time:T, files:['README.md']}, {author:'bo', time:T, files:['src/README.md']}];
return [suggestReviewers(history, {author:'me', time:T, files:['LICENSE']}, 5), [{name:'ana',score:0.5}]];` },
        { name: 'Only the direct parent directory counts', src: `const T = 1000;
const history = [{author:'ana', time:T, files:['billing/v2/a.js']}, {author:'bo', time:T, files:['billing/b.js']}, {author:'cy', time:T, files:['billing/c.js', 'billing/d.js']}];
return [suggestReviewers(history, {author:'me', time:T, files:['billing/new.js']}, 5), [{name:'cy',score:1},{name:'bo',score:0.5}]];` },
        { name: 'Ineligible touches do not block the fallback', src: `const T = 1000;
const history = [{author:'me', time:T, files:['lib/a.c']}, {author:'busy', time:T, files:['lib/a.c']}, {author:'ana', time:T, files:['lib/b.c']}];
return [suggestReviewers(history, {author:'me', time:T, files:['lib/a.c']}, 5, {busy:7}), [{name:'ana',score:0.5}]];` },
        { name: 'Fractional ages and rounding', src: `const DAY = 86400, T = 1000 * DAY;
const history = [{author:'ana', time:T - 1, files:['q/r']}, {author:'bo', time:T - Math.round(45.5 * DAY), files:['q/r']}, {author:'bo', time:T - 7 * DAY, files:['q/s']}];
return [suggestReviewers(history, {author:'me', time:T, files:['q/r','q/s']}, 5), [{name:'bo',score:1.2002},{name:'ana',score:1}]];` },
        { name: '20k commits with ages and load', src: `const DAY = 86400, T = 3000 * DAY; let s = 2;
const next = () => (s = (s * 48271) % 2147483647);
const history = [];
for (let i = 0; i < 20000; i++) { const files = []; for (let j = 0; j < 10; j++) files.push('mod' + (next() % 40) + '/f' + (next() % 25) + '.js'); history.push({author:'dev' + (next() % 300), time:T - next() % (365 * DAY), files:[...new Set(files)]}); }
const load = {}; for (let i = 0; i < 300; i += 7) load['dev' + i] = 3;
const change = {author:'dev1', time:T, files:[]};
for (let i = 0; i < 150; i++) change.files.push('mod' + (i % 45) + '/g' + (i % 30) + '.js');
const r = suggestReviewers(history, change, 3, load);
return [r, [{name:'dev288',score:131.1361},{name:'dev15',score:130.8301},{name:'dev38',score:130.801}]];` },
      ],
    },
  ],
  followUps: [
    'The repo has 5 million commits. What would you precompute so each PR is scored in milliseconds?',
    'Files get renamed and moved. How would you keep someone\'s history attached to the new path?',
    'One person is suggested on every PR in their area. How would you spread the load more fairly over a week?',
  ],
  rubric: 'Strong: builds a map from path to touches (and from directory to touches) once instead of rescanning history per file; dedupes change.files; filters ineligible authors before deciding whether a file needs the fallback; weight computed from exact seconds with 0.5 ** (age / 30 / 86400 ...); rounds only at the end, then sorts by rounded score with a string tie-break; handles the root directory as "". Weak: counting commits instead of (commit, file) touches, applying the fallback to the whole change instead of per file, using startsWith for the directory check so nested folders match, rounding each touch, letting the author or overloaded people block the fallback, or sorting names with localeCompare (which puts "al" before "Bea").',
  offline: {
    approach: 'Index the history once: `byFile` maps a path to the commits that touched it, and `byDir` maps a parent directory to one entry per (commit, file) touch inside it. For each distinct changed file, take the eligible touches from `byFile`. If there are none, take the eligible touches from `byDir` at half weight. Add `weight(commit)` into a `Map` of scores, round, sort and slice.',
    hints: [
      'Score is per (commit, changed file) pair, so loop over changed files and then over the commits that touched each one.',
      'Parent directory: `path.lastIndexOf("/")`; if it is `-1` the parent is `""`.',
      'Decide eligibility first (`name !== change.author && (load[name] || 0) < 3`), then check whether any eligible touch exists for the file.',
      'Round with `Math.round(score * 10000) / 10000` once, at the end, then sort with `b.score - a.score || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0)`.',
    ],
    edge: [
      'Only the change author touched a file, so the fallback applies.',
      'A root-level file such as `LICENSE`.',
      'A nested directory that shares a prefix with the parent directory.',
      'The same path listed twice in `change.files`.',
      'Names that differ only in case, such as `Bea` and `bob`.',
    ],
    complexity: 'Indexing is **O(H)** for H total (commit, file) pairs. Scoring is O(touches of the changed files and their directories), and sorting people is **O(P log P)**. Memory is **O(H)**.',
    skeleton: `function parentDir(path) {
  const i = path.lastIndexOf('/');
  return i < 0 ? '' : path.slice(0, i);
}

function suggestReviewers(history, change, k, load = {}) {
  const eligible = name => name !== change.author && (load[name] || 0) < 3;
  const weight = commit => Math.pow(0.5, (change.time - commit.time) / 86400 / 30);

  const byFile = new Map(); // path -> commits
  const byDir = new Map();  // dir -> commits, once per file touched in that dir
  // TODO: build both indexes, skipping ineligible authors

  const scores = new Map();
  for (const file of new Set(change.files)) {
    // TODO: exact touches, or half-weight directory touches when there are none
  }
  // TODO: round, sort, slice to k
}`,
  },
  solution: `const DAY_SEC = 86400;

function parentDir(path) {
  const i = path.lastIndexOf('/');
  return i < 0 ? '' : path.slice(0, i);
}

function suggestReviewers(history, change, k, load = {}) {
  const eligible = name => name !== change.author && (load[name] || 0) < 3;
  const weight = commit => Math.pow(0.5, (change.time - commit.time) / DAY_SEC / 30);

  // Index eligible touches once: by exact path and by parent directory.
  const byFile = new Map();
  const byDir = new Map();
  const push = (map, key, value) => {
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(value);
  };
  for (const commit of history) {
    if (!eligible(commit.author)) continue;
    for (const path of commit.files) {
      push(byFile, path, commit);
      push(byDir, parentDir(path), commit);
    }
  }

  const scores = new Map();
  const add = (name, value) => scores.set(name, (scores.get(name) || 0) + value);
  for (const file of new Set(change.files)) {
    const exact = byFile.get(file);
    if (exact) {
      for (const commit of exact) add(commit.author, weight(commit));
    } else {
      for (const commit of byDir.get(parentDir(file)) || []) add(commit.author, 0.5 * weight(commit));
    }
  }

  return [...scores]
    .map(([name, score]) => ({ name, score: Math.round(score * 10000) / 10000 }))
    .sort((a, b) => b.score - a.score || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
    .slice(0, k);
}
`,
});
