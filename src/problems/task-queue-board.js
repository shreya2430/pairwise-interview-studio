PROBLEMS.push({
  id: 'task-queue-board',
  title: 'Onboarding task board',
  team: 'IT Onboarding',
  level: 'Mid-level',
  difficulty: 'Medium',
  minutes: 45,
  focus: ['Object design', 'Sorting', 'Graphs'],
  format: 'Staged like Rippling\'s AI-assisted coding round (reported 2025–26): one class grown over three incremental questions, where most candidates finish about two.',
  scenario: 'Every new hire gets a board of setup tasks: ship a laptop, create accounts, book the security training. The IT team wants one in-memory board that orders the work, tracks owners and knows what is unblocked.',
  body: `
<p>Implement <code>TaskBoard</code>. Each task has a string <code>id</code>, a <code>title</code>, an integer <code>priority</code> (higher is more urgent) and an integer <code>due</code> day.</p>
<ul>
<li>Every method that returns tasks returns their <strong>ids</strong>, sorted by <code>priority</code> descending, then <code>due</code> ascending, then <code>id</code> ascending (plain string comparison).</li>
<li>Methods that receive an id that was never added throw an <code>Error</code> whose message starts with <code>"Unknown task"</code>.</li>
<li>Adding an id that already exists throws an <code>Error</code> whose message starts with <code>"Duplicate task"</code>.</li>
</ul>
<p>The work comes in three parts. Later parts extend the same class, and earlier tests keep running.</p>`,
  examples: `const b = new TaskBoard();
b.add({ id: "laptop", title: "Ship laptop", priority: 3, due: 2 });
b.add({ id: "badge", title: "Print badge", priority: 1, due: 1 });
b.add({ id: "email", title: "Create email", priority: 3, due: 1 });
b.list();                          // ["email", "laptop", "badge"]

b.assign("laptop", "dana");
b.complete("email");
b.list({ assignee: "dana" });      // ["laptop"]
b.list({ status: "open" });        // ["laptop", "badge"]

b.add({ id: "vpn", title: "Set up VPN", priority: 2, due: 3, dependsOn: ["laptop"] });
b.ready();                         // ["laptop", "badge"]  (vpn waits for laptop)`,
  constraints: ['Up to 10⁴ tasks per board', 'Ids, titles and names are non-empty strings', 'priority and due are integers', 'Up to 3 × 10⁴ dependency edges'],
  starter: `class TaskBoard {
  constructor() {
    // TODO
  }

  /**
   * @param {{id: string, title: string, priority: number, due: number, dependsOn?: string[]}} task
   */
  add(task) {
    // TODO
  }

  /**
   * @param {{assignee?: string, status?: "open" | "done"}} [filter]
   * @returns {string[]} task ids
   */
  list(filter) {
    // TODO
  }

  assign(id, person) {
    // TODO
  }

  complete(id) {
    // TODO
  }

  /** @returns {string[]} ids of open tasks whose dependencies are all done */
  ready() {
    // TODO
  }
}
`,
  parts: [
    {
      title: 'Part 1: Add and list tasks',
      body: `
<p>Implement <code>add(task)</code> and <code>list()</code>.</p>
<ul>
<li><code>add</code> stores the task. A new task is <code>"open"</code> and has no assignee.</li>
<li><code>list()</code> returns every task id in board order: <code>priority</code> descending, then <code>due</code> ascending, then <code>id</code> ascending.</li>
<li>Adding an id twice throws <code>"Duplicate task ..."</code> and leaves the board unchanged.</li>
</ul>`,
      tests: [
        { name: 'Example board order', src: `const b = new TaskBoard();
b.add({id:'laptop', title:'Ship laptop', priority:3, due:2});
b.add({id:'badge', title:'Print badge', priority:1, due:1});
b.add({id:'email', title:'Create email', priority:3, due:1});
return [b.list(), ['email','laptop','badge']];` },
        { name: 'Ties fall back to due, then id', src: `const b = new TaskBoard();
b.add({id:'d', title:'D', priority:2, due:3});
b.add({id:'a', title:'A', priority:2, due:5});
b.add({id:'c', title:'C', priority:2, due:3});
b.add({id:'b', title:'B', priority:4, due:9});
return [b.list(), ['b','c','d','a']];` },
        { name: 'Empty board lists nothing', src: `return [new TaskBoard().list(), []];` },
        { name: 'Duplicate id throws', src: `const b = new TaskBoard();
b.add({id:'x', title:'X', priority:1, due:1});
let msg = '';
try { b.add({id:'x', title:'Again', priority:9, due:0}); } catch (e) { msg = e.message; }
return [[msg.startsWith('Duplicate task'), b.list()], [true, ['x']]];` },
      ],
      hidden: [
        { name: 'Negative priorities and ids that sort as strings', src: `const b = new TaskBoard();
b.add({id:'t10', title:'', priority:-1, due:0});
b.add({id:'t9', title:'', priority:-1, due:0});
b.add({id:'t2', title:'', priority:0, due:7});
return [b.list(), ['t2','t10','t9']];` },
        { name: 'Mutating the returned list does not change the board', src: `const b = new TaskBoard();
b.add({id:'a', title:'A', priority:1, due:1});
b.list().push('ghost');
return [b.list(), ['a']];` },
        { name: '10k tasks stay ordered', src: `const b = new TaskBoard();
let seed = 7;
for (let i = 0; i < 10000; i++) { seed = (seed * 1103515245 + 12345) % 2147483648; b.add({id:'t' + i, title:'', priority: seed % 5, due: (seed >> 8) % 30}); }
const l = b.list();
return [[l.length, l.slice(0, 3), l[l.length - 1]], [10000, ['t1205','t140','t1496'], 't9568']];` },
      ],
    },
    {
      title: 'Part 2: Owners and status',
      body: `
<p>Add ownership and completion.</p>
<ul>
<li><code>assign(id, person)</code> sets the task's assignee. Assigning again replaces the previous one.</li>
<li><code>complete(id)</code> sets the task's status to <code>"done"</code>. Completing a done task is a no-op.</li>
<li><code>list({ assignee, status })</code> keeps only tasks matching every filter that is given. Both keys are optional, and <code>list()</code> with no filter still returns every task, done or not.</li>
<li><code>assign</code> and <code>complete</code> throw <code>"Unknown task ..."</code> for ids that were never added.</li>
</ul>`,
      tests: [
        { name: 'Filter by assignee', src: `const b = new TaskBoard();
b.add({id:'laptop', title:'', priority:3, due:2});
b.add({id:'email', title:'', priority:3, due:1});
b.add({id:'badge', title:'', priority:1, due:1});
b.assign('laptop', 'dana'); b.assign('badge', 'dana'); b.assign('email', 'omar');
return [[b.list({assignee:'dana'}), b.list({assignee:'omar'}), b.list({assignee:'zoe'})], [['laptop','badge'], ['email'], []]];` },
        { name: 'Filter by status', src: `const b = new TaskBoard();
b.add({id:'a', title:'', priority:1, due:1});
b.add({id:'b', title:'', priority:2, due:1});
b.add({id:'c', title:'', priority:3, due:1});
b.complete('b');
return [[b.list({status:'open'}), b.list({status:'done'}), b.list()], [['c','a'], ['b'], ['c','b','a']]];` },
        { name: 'Filters combine', src: `const b = new TaskBoard();
['a','b','c','d'].forEach((id, i) => b.add({id, title:'', priority:i, due:0}));
b.assign('a', 'kim'); b.assign('b', 'kim'); b.assign('c', 'lee');
b.complete('a'); b.complete('c');
return [[b.list({assignee:'kim', status:'open'}), b.list({assignee:'kim', status:'done'})], [['b'], ['a']]];` },
        { name: 'Unknown ids throw', src: `const b = new TaskBoard();
b.add({id:'a', title:'', priority:1, due:1});
const msg = f => { try { f(); return 'no error'; } catch (e) { return e.message.startsWith('Unknown task'); } };
return [[msg(() => b.assign('zzz', 'kim')), msg(() => b.complete('nope'))], [true, true]];` },
      ],
      hidden: [
        { name: 'Reassigning replaces the owner', src: `const b = new TaskBoard();
b.add({id:'a', title:'', priority:1, due:1});
b.assign('a', 'kim'); b.assign('a', 'lee');
return [[b.list({assignee:'kim'}), b.list({assignee:'lee'})], [[], ['a']]];` },
        { name: 'Completing twice is harmless', src: `const b = new TaskBoard();
b.add({id:'a', title:'', priority:1, due:1});
b.complete('a'); b.complete('a');
return [[b.list({status:'done'}), b.list({status:'open'})], [['a'], []]];` },
        { name: 'Unassigned tasks never match an assignee filter', src: `const b = new TaskBoard();
b.add({id:'a', title:'', priority:1, due:1});
b.add({id:'b', title:'', priority:1, due:1});
b.assign('b', 'undefined');
return [b.list({assignee:'undefined'}), ['b']];` },
      ],
    },
    {
      title: 'Part 3: Dependencies',
      body: `
<p><code>add</code> now accepts an optional <code>dependsOn</code> array of task ids.</p>
<ul>
<li>A dependency may name a task that has not been added yet. Such a task blocks its dependents until it is added and completed.</li>
<li><code>ready()</code> returns the open tasks whose dependencies are all done, in board order.</li>
<li>If adding a task would create a dependency cycle (including a task that depends on itself), throw an <code>Error</code> whose message starts with <code>"Cycle detected"</code> and do not add the task.</li>
<li>Duplicate entries in <code>dependsOn</code> count once.</li>
</ul>`,
      tests: [
        { name: 'Blocked tasks wait for their dependencies', src: `const b = new TaskBoard();
b.add({id:'laptop', title:'', priority:3, due:2});
b.add({id:'badge', title:'', priority:1, due:1});
b.add({id:'vpn', title:'', priority:2, due:3, dependsOn:['laptop']});
const before = b.ready();
b.complete('laptop');
return [[before, b.ready()], [['laptop','badge'], ['vpn','badge']]];` },
        { name: 'Every dependency must be done', src: `const b = new TaskBoard();
b.add({id:'a', title:'', priority:1, due:1});
b.add({id:'b', title:'', priority:1, due:2});
b.add({id:'c', title:'', priority:5, due:1, dependsOn:['a','b']});
b.complete('a');
const mid = b.ready();
b.complete('b');
return [[mid, b.ready()], [['b'], ['c']]];` },
        { name: 'A cycle throws and the task is not added', src: `const b = new TaskBoard();
b.add({id:'a', title:'', priority:1, due:1, dependsOn:['b']});
let msg = '';
try { b.add({id:'b', title:'', priority:1, due:1, dependsOn:['a']}); } catch (e) { msg = e.message; }
return [[msg.startsWith('Cycle detected'), b.list()], [true, ['a']]];` },
        { name: 'A dependency that does not exist yet blocks', src: `const b = new TaskBoard();
b.add({id:'deploy', title:'', priority:9, due:1, dependsOn:['review']});
const before = b.ready();
b.add({id:'review', title:'', priority:1, due:1});
b.complete('review');
return [[before, b.ready()], [[], ['deploy']]];` },
      ],
      hidden: [
        { name: 'Self dependency is a cycle', src: `const b = new TaskBoard();
let msg = '';
try { b.add({id:'a', title:'', priority:1, due:1, dependsOn:['a']}); } catch (e) { msg = e.message; }
return [[msg.startsWith('Cycle detected'), b.list()], [true, []]];` },
        { name: 'Diamond is not a cycle', src: `const b = new TaskBoard();
b.add({id:'root', title:'', priority:1, due:1});
b.add({id:'l', title:'', priority:1, due:2, dependsOn:['root']});
b.add({id:'r', title:'', priority:1, due:3, dependsOn:['root','root']});
b.add({id:'top', title:'', priority:1, due:4, dependsOn:['l','r']});
b.complete('root'); b.complete('l');
return [b.ready(), ['r']];` },
        { name: 'Long chain closing into a cycle (3000 tasks)', src: `const b = new TaskBoard();
b.add({id:'t0', title:'', priority:0, due:0, dependsOn:['t2999']});
for (let i = 1; i < 2999; i++) b.add({id:'t' + i, title:'', priority:0, due:i, dependsOn:['t' + (i - 1)]});
let msg = '';
try { b.add({id:'t2999', title:'', priority:0, due:0, dependsOn:['t2998']}); } catch (e) { msg = e.message; }
b.add({id:'t2999', title:'', priority:0, due:0});
const r1 = b.ready();
b.complete('t2999');
return [[msg.startsWith('Cycle detected'), r1, b.ready()], [true, ['t2999'], ['t0']]];` },
        { name: 'Done tasks never appear in ready', src: `const b = new TaskBoard();
b.add({id:'a', title:'', priority:1, due:1});
b.add({id:'b', title:'', priority:2, due:1, dependsOn:['a']});
b.complete('a'); b.complete('b');
return [b.ready(), []];` },
      ],
    },
  ],
  followUps: [
    'The board grows to a million tasks and ready() is called on every page load. How would you avoid rescanning everything?',
    'Two admins complete and reassign tasks at the same time through an API. What breaks, and how would you guard it?',
    'Product wants "delete task". What should happen to tasks that depend on it?',
  ],
  rubric: 'Strong: one Map of task records; a single comparator reused by list and ready; filters applied only when the key is present; dedicated "Unknown task" check shared by assign/complete; cycle check is a DFS/BFS from the new task\'s dependencies looking for the new id, done before mutating state, with a visited set so diamonds stay linear; forward references handled without special cases. Weak: comparing ids with subtraction, sorting in place on stored arrays and leaking them, treating a missing dependency as satisfied, detecting cycles only for already-added tasks, or inserting the task before checking for a cycle and forgetting to roll back.',
  offline: {
    approach: 'Keep a `Map` from id to a task record `{ id, priority, due, dependsOn, assignee, status }`. `list` filters the values, sorts with one comparator and maps to ids. `ready` filters open tasks whose dependencies all exist and are done. For cycles, a new task `X` closes a cycle exactly when one of its dependencies can already reach `X` by following `dependsOn` edges, so walk from its dependencies before storing it.',
    hints: [
      'Write the comparator once: `b.priority - a.priority || a.due - b.due || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)`.',
      'Filters are optional: only compare `assignee` when `filter.assignee !== undefined`.',
      'A dependency that is not in the map yet is not done, so the dependent is blocked.',
      'Cycle check: DFS from the new task\'s `dependsOn` through stored tasks, with a `seen` set. If you reach the new id, throw before adding anything.',
    ],
    edge: [
      'A task that depends on itself.',
      'A dependency added after its dependent (forward reference).',
      'Ids like `t10` and `t9`, which must compare as strings.',
      'Diamond dependencies, which share a node but are not a cycle.',
      'Adding a duplicate id must not overwrite the existing task.',
    ],
    complexity: '`add` is **O(V + E)** in the worst case because of the cycle walk. `list` and `ready` are **O(n log n)** for the sort (plus O(E) to check dependencies in `ready`). Memory is **O(V + E)**.',
    skeleton: `class TaskBoard {
  constructor() {
    this.tasks = new Map(); // id -> { id, title, priority, due, dependsOn, assignee, status }
  }

  _get(id) {
    const t = this.tasks.get(id);
    if (!t) throw new Error('Unknown task: ' + id);
    return t;
  }

  _sorted(tasks) {
    // TODO: priority desc, due asc, id asc; return ids
  }

  add({ id, title, priority, due, dependsOn = [] }) {
    // TODO: duplicate check, cycle check, then store
  }

  list(filter = {}) {
    // TODO
  }

  assign(id, person) { this._get(id).assignee = person; }
  complete(id) { this._get(id).status = 'done'; }

  ready() {
    // TODO: open tasks whose dependencies exist and are done
  }
}`,
  },
  solution: `class TaskBoard {
  constructor() {
    this.tasks = new Map(); // id -> task record
  }

  _get(id) {
    const task = this.tasks.get(id);
    if (!task) throw new Error('Unknown task: ' + id);
    return task;
  }

  // Board order: priority desc, due asc, id asc. Returns ids.
  _sorted(tasks) {
    return tasks
      .slice()
      .sort((a, b) =>
        b.priority - a.priority ||
        a.due - b.due ||
        (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
      .map(t => t.id);
  }

  // Can we reach \`target\` by following dependsOn edges from \`start\`?
  _reaches(start, target) {
    const seen = new Set();
    const stack = [...start];
    while (stack.length) {
      const id = stack.pop();
      if (id === target) return true;
      if (seen.has(id)) continue;
      seen.add(id);
      const task = this.tasks.get(id);
      if (task) stack.push(...task.dependsOn);
    }
    return false;
  }

  add({ id, title, priority, due, dependsOn = [] }) {
    if (this.tasks.has(id)) throw new Error('Duplicate task: ' + id);
    const deps = [...new Set(dependsOn)];
    if (this._reaches(deps, id)) throw new Error('Cycle detected at ' + id);
    this.tasks.set(id, { id, title, priority, due, dependsOn: deps, assignee: null, status: 'open' });
  }

  list({ assignee, status } = {}) {
    const rows = [...this.tasks.values()].filter(t =>
      (assignee === undefined || t.assignee === assignee) &&
      (status === undefined || t.status === status));
    return this._sorted(rows);
  }

  assign(id, person) {
    this._get(id).assignee = person;
  }

  complete(id) {
    this._get(id).status = 'done';
  }

  ready() {
    const isDone = id => {
      const dep = this.tasks.get(id);
      return dep !== undefined && dep.status === 'done';
    };
    const rows = [...this.tasks.values()].filter(t => t.status === 'open' && t.dependsOn.every(isDone));
    return this._sorted(rows);
  }
}
`,
});
