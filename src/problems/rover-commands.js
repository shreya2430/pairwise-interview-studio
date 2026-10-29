PROBLEMS.push({
  id: 'rover-commands',
  title: 'Greenhouse rover commands',
  team: 'Robotics',
  level: 'New grad',
  difficulty: 'Medium',
  minutes: 40,
  focus: ['Simulation', 'Parsing', 'Extending code'],
  format: 'Staged like Shopify’s reported 2025–26 AI-assisted pair-programming round: one simulator, with new requirements added each part while every earlier test keeps passing.',
  scenario: 'Small rovers drive between planting beds in a greenhouse to photograph seedlings. Operators send short command strings, and the control service works out where each rover ends up.',
  body: `
<p>The greenhouse floor is a grid <code>w</code> cells wide and <code>h</code> cells tall. Cells are <code>(x, y)</code> with <code>0 &lt;= x &lt; w</code> and <code>0 &lt;= y &lt; h</code>. North is <code>y + 1</code> and east is <code>x + 1</code>.</p>
<ul>
<li>A rover has a position and a direction: <code>"N"</code>, <code>"E"</code>, <code>"S"</code> or <code>"W"</code>.</li>
<li><code>L</code> and <code>R</code> turn 90° left or right in place. <code>F</code> moves one cell forward.</li>
<li>A move that would leave the grid is ignored, and the rover carries on with the next command.</li>
</ul>
<p>Everything goes through one function, <code>run(w, h, commands, options)</code>. Each part extends it; earlier calls must keep working unchanged.</p>`,
  examples: `run(5, 5, "FFRFF");
// { x: 2, y: 2, dir: "E" }

run(5, 5, "3F2R");                            // Part 2
// { x: 0, y: 3, dir: "S" }

run(5, 5, "FFF", { obstacles: [[0, 2]] });    // Part 2
// { x: 0, y: 1, dir: "N", blocked: true }`,
  constraints: ['1 ≤ w, h ≤ 1,000', 'Up to 300 rovers and 10⁵ command steps in total', 'Repeat counts are 0–999'],
  starter: `/**
 * @param {number} w  grid width
 * @param {number} h  grid height
 * @param {string | {x: number, y: number, dir: string, commands: string}[]} commands
 * @param {{obstacles?: number[][]}} [options]
 * @returns {{x: number, y: number, dir: string, blocked?: true} | {x: number, y: number, dir: string, blocked?: true}[]}
 */
function run(w, h, commands, options = {}) {
  // TODO
}
`,
  parts: [
    {
      title: 'Part 1: Drive one rover',
      body: `
<p>One rover starts at <code>(0, 0)</code> facing <code>"N"</code>. <code>commands</code> is a string of <code>F</code>, <code>L</code> and <code>R</code>. Return its final <code>{ x, y, dir }</code>.</p>`,
      tests: [
        { name: 'Example from the spec', src: `return [run(5, 5, 'FFRFF'), {x:2,y:2,dir:'E'}];` },
        { name: 'Turning wraps around', src: `return [[run(3, 3, 'L').dir, run(3, 3, 'LLLL').dir, run(3, 3, 'RRR').dir], ['W', 'N', 'W']];` },
        { name: 'Moves off the grid are ignored', src: `return [run(3, 3, 'LFFRFFFFF'), {x:0,y:2,dir:'N'}];` },
        { name: 'No commands', src: `return [run(4, 4, ''), {x:0,y:0,dir:'N'}];` },
      ],
      hidden: [
        { name: 'One-cell greenhouse', src: `return [run(1, 1, 'FRFRFRF'), {x:0,y:0,dir:'W'}];` },
        { name: 'Square loop returns home', src: `return [run(10, 10, 'FFFRFFFRFFFRFFFR'), {x:0,y:0,dir:'N'}];` },
        { name: 'Long drive along the edges', src: `return [run(1000, 1000, 'F'.repeat(1500) + 'R' + 'F'.repeat(1500) + 'R' + 'F'.repeat(20)), {x:999,y:979,dir:'S'}];` },
      ],
    },
    {
      title: 'Part 2: Obstacles and repeat counts',
      body: `
<p>Operators asked for two things.</p>
<ul>
<li><strong>Repeat counts.</strong> A number before a command repeats it: <code>"3F2R"</code> means <code>FFFRR</code>. Counts can have several digits, and <code>0</code> skips the command. A command without a number runs once.</li>
<li><strong>Obstacles.</strong> <code>options.obstacles</code> is a list of <code>[x, y]</code> cells holding plant beds. Obstacles are always inside the grid and never on the start cell. A move into an obstacle stops the rover: it stays where it is, ignores every remaining command, and the result gets <code>blocked: true</code> after <code>dir</code>. A rover that never hits an obstacle returns <code>{ x, y, dir }</code> exactly as before.</li>
</ul>`,
      tests: [
        { name: 'Repeat counts expand', src: `return [run(5, 5, '3F2R'), {x:0,y:3,dir:'S'}];` },
        { name: 'Counts can have several digits', src: `return [run(20, 20, 'R12FL2F'), {x:12,y:2,dir:'N'}];` },
        { name: 'Obstacle stops the rover', src: `return [run(5, 5, 'FFFRF', { obstacles: [[0, 2]] }), {x:0,y:1,dir:'N',blocked:true}];` },
        { name: 'A clear path is not blocked', src: `return [run(5, 5, 'RFF', { obstacles: [[0, 1], [3, 0]] }), {x:2,y:0,dir:'E'}];` },
      ],
      hidden: [
        { name: 'Zero count skips the command', src: `return [run(5, 5, '0F1R0LF'), {x:1,y:0,dir:'E'}];` },
        { name: 'Repeat counts on turns', src: `return [run(5, 5, '6R'), {x:0,y:0,dir:'S'}];` },
        { name: 'Blocked in the middle of a repeat', src: `return [run(10, 10, '9FR', { obstacles: [[0, 4]] }), {x:0,y:3,dir:'N',blocked:true}];` },
        { name: 'Edge moves are not blocked', src: `return [run(3, 3, 'LFRFF', { obstacles: [[1, 1]] }), {x:0,y:2,dir:'N'}];` },
      ],
    },
    {
      title: 'Part 3: A fleet of rovers',
      body: `
<p>Several rovers now share the floor. Instead of a string, <code>commands</code> may be an array of rovers <code>{ x, y, dir, commands }</code>, each with its own start and command string (repeat counts allowed). Start cells are distinct and free of obstacles. Return an array of final states in the same order.</p>
<ul>
<li>Rovers move in rounds. In each round, rover 0 runs its next single step (one <code>F</code>, <code>L</code> or <code>R</code> after expanding counts), then rover 1, and so on. A rover with no steps left, or a blocked rover, does nothing.</li>
<li>A rover cannot move into a cell another rover occupies at that moment. That step is skipped, and the rover continues with its next step next round. This is not <code>blocked</code>.</li>
<li>Grid edges and obstacles work as in Part 2. A blocked rover still occupies its cell.</li>
</ul>
<p>Calls with a string must behave exactly as before.</p>`,
      tests: [
        { name: 'Rovers that meet head-on wait', src: `return [run(5, 5, [{x:0,y:0,dir:'E',commands:'FFF'},{x:2,y:0,dir:'W',commands:'FFF'}]), [{x:1,y:0,dir:'E'},{x:2,y:0,dir:'W'}]];` },
        { name: 'Turn order decides who moves first', src: `return [run(5, 5, [{x:0,y:0,dir:'N',commands:'FF'},{x:0,y:1,dir:'N',commands:'FF'}]), [{x:0,y:1,dir:'N'},{x:0,y:3,dir:'N'}]];` },
        { name: 'Programs of different lengths', src: `return [run(5, 5, [{x:0,y:0,dir:'N',commands:'R3F'},{x:4,y:4,dir:'S',commands:'R'}]), [{x:3,y:0,dir:'E'},{x:4,y:4,dir:'W'}]];` },
        { name: 'A blocked rover still takes up its cell', src: `return [run(5, 5, [{x:0,y:0,dir:'N',commands:'FF'},{x:1,y:1,dir:'W',commands:'FFF'}], { obstacles: [[0, 2]] }), [{x:0,y:1,dir:'N',blocked:true},{x:1,y:1,dir:'W'}]];` },
      ],
      hidden: [
        { name: 'A freed cell can be entered later in the same round', src: `return [run(5, 5, [{x:0,y:1,dir:'N',commands:'F'},{x:0,y:0,dir:'N',commands:'F'}]), [{x:0,y:2,dir:'N'},{x:0,y:1,dir:'N'}]];` },
        { name: 'Single rover in a list', src: `return [run(5, 5, [{x:0,y:0,dir:'N',commands:'FFRFF'}]), [{x:2,y:2,dir:'E'}]];` },
        { name: 'String calls still work after the change', src: `return [[run(5, 5, 'FFRFF'), run(5, 5, 'FFF', { obstacles: [[0, 2]] })], [{x:2,y:2,dir:'E'},{x:0,y:1,dir:'N',blocked:true}]];` },
        { name: '300 rovers, 400 steps each', src: `let seed = 5; const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
const rovers = [];
for (let i = 0; i < 300; i++) { let c = ''; for (let k = 0; k < 400; k++) { const r = rnd(); c += r < 0.6 ? 'F' : r < 0.8 ? 'L' : 'R'; } rovers.push({ x: i % 60, y: Math.floor(i / 60) * 10, dir: 'N', commands: c }); }
const obs = []; for (let i = 0; i < 30; i++) obs.push([Math.floor(rnd() * 60), 5 + Math.floor(rnd() * 50)]);
const out = run(60, 60, rovers, { obstacles: obs });
return [[out.filter(s => s.blocked).length, out.reduce((a, s) => a + s.x * 7 + s.y, 0), out[0]], [111, 69249, {x:1,y:20,dir:'E'}]];` },
      ],
    },
  ],
  followUps: ['Rovers report their position over a lossy radio link. How would the service detect that its model has drifted from reality?', 'Operators want a dry-run that returns the full path of every rover. How would you change the return shape without breaking callers?', 'Two rovers keep blocking each other forever. How would you detect the deadlock and resolve it?'],
  rubric: 'Strong: direction as an index into ["N","E","S","W"] with modular turns; a small parser that expands counts (multi-digit, zero); edges ignored versus obstacles halting, checked in that order; blocked added only when it happens so Part 1 results keep their shape; for the fleet, expands each program into steps, round-robin by index, a Set of occupied cells updated on each move, string input treated as a one-rover fleet so there is one code path. Weak: parsing counts as single digits, treating edges as blocking, continuing after an obstacle, adding blocked:false to every result (breaks earlier tests), moving rovers simultaneously or running one rover’s whole program before the next.',
  offline: {
    approach: 'Normalize everything to the fleet case: a string becomes one rover at `(0, 0)` facing `N`, and you unwrap the single result at the end. Expand each command string into single steps (`"3F2R"` to `F F F R R`), then loop over rounds and over rovers in order. Keep obstacles and occupied cells in `Set`s keyed by `"x,y"`.',
    hints: ['Directions as `["N","E","S","W"]`: right is `(i + 1) % 4`, left is `(i + 3) % 4`.', 'Parse counts by collecting digit characters until a letter, then repeat the letter `Number(digits)` times (1 if there were none).', 'Check order for `F`: off the grid means ignore, obstacle means stop with `blocked = true`, another rover means skip this step.', 'Only set `blocked` when it happens, and update the occupied set by removing the old cell before adding the new one.'],
    edge: ['A multi-digit count like `12F`.', 'A count of `0`.', 'A rover on the grid edge facing outwards next to an obstacle.', 'Two rovers swapping places head-on (neither can move).', 'A cell freed earlier in the same round.'],
    complexity: 'With `Set` lookups each step is **O(1)**, so the whole run is **O(S)** for S expanded steps across all rovers, plus **O(O)** to load the obstacles.',
    skeleton: `const DIRS = ['N', 'E', 'S', 'W'];
const STEP = { N: [0, 1], E: [1, 0], S: [0, -1], W: [-1, 0] };

function expand(commands) {
  const steps = [];
  // TODO: "3F2R" -> ['F','F','F','R','R']
  return steps;
}

function run(w, h, commands, options = {}) {
  const multi = Array.isArray(commands);
  const rovers = (multi ? commands : [{ x: 0, y: 0, dir: 'N', commands }])
    .map(r => ({ state: { x: r.x, y: r.y, dir: r.dir }, steps: expand(r.commands) }));
  const obstacles = new Set((options.obstacles || []).map(([x, y]) => x + ',' + y));
  // TODO: occupied cells, then rounds: each rover runs its next step
  const out = rovers.map(r => r.state);
  return multi ? out : out[0];
}`,
  },
  solution: `const DIRS = ['N', 'E', 'S', 'W'];
const STEP = { N: [0, 1], E: [1, 0], S: [0, -1], W: [-1, 0] };

// "3F2RL" -> ['F', 'F', 'F', 'R', 'R', 'L']
function expand(commands) {
  const steps = [];
  let digits = '';
  for (const ch of commands) {
    if (ch >= '0' && ch <= '9') { digits += ch; continue; }
    const n = digits === '' ? 1 : Number(digits);
    for (let i = 0; i < n; i++) steps.push(ch);
    digits = '';
  }
  return steps;
}

function run(w, h, commands, options = {}) {
  const key = (x, y) => x + ',' + y;
  const obstacles = new Set((options.obstacles || []).map(([x, y]) => key(x, y)));

  // A plain string is a fleet of one rover starting at (0, 0) facing north.
  const multi = Array.isArray(commands);
  const rovers = (multi ? commands : [{ x: 0, y: 0, dir: 'N', commands }]).map(r => ({
    state: { x: r.x, y: r.y, dir: r.dir },
    steps: expand(r.commands),
  }));
  const occupied = new Set(rovers.map(r => key(r.state.x, r.state.y)));

  const rounds = Math.max(0, ...rovers.map(r => r.steps.length));
  for (let i = 0; i < rounds; i++) {
    for (const r of rovers) {
      const s = r.state;
      if (s.blocked || i >= r.steps.length) continue;
      const cmd = r.steps[i];

      if (cmd === 'L') s.dir = DIRS[(DIRS.indexOf(s.dir) + 3) % 4];
      else if (cmd === 'R') s.dir = DIRS[(DIRS.indexOf(s.dir) + 1) % 4];
      else if (cmd === 'F') {
        const nx = s.x + STEP[s.dir][0];
        const ny = s.y + STEP[s.dir][1];
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;   // edge: ignore this move
        if (obstacles.has(key(nx, ny))) { s.blocked = true; continue; } // obstacle: rover stops
        if (occupied.has(key(nx, ny))) continue;                 // another rover: skip this step
        occupied.delete(key(s.x, s.y));
        occupied.add(key(nx, ny));
        s.x = nx;
        s.y = ny;
      }
    }
  }

  const out = rovers.map(r => r.state);
  return multi ? out : out[0];
}
`,
});
