PROBLEMS.push({
  id: 'poll-tally',
  title: 'Tally the street-tree vote',
  team: 'Civic Engagement',
  level: 'New grad',
  difficulty: 'Easy',
  minutes: 30,
  focus: ['Hash maps', 'Sorting', 'Event ordering'],
  format: 'Two-part build-then-extend task in the style of reported 2025–26 AI-assisted new-grad rounds: get the core aggregation right, then answer follow-up queries over the same data.',
  scenario: 'Residents vote on which tree species the city plants on their block, and they can change their mind until the poll closes. Vote events reach the backend from several app servers, so they arrive out of order.',
  body: `
<p>Each vote event is <code>{ voter, option, time }</code>. <code>time</code> is an integer; events can arrive in any order, so array order is not time order.</p>
<ul>
<li>A voter may vote many times. Only their <strong>latest</strong> vote (largest <code>time</code>) counts.</li>
<li>If one voter has two events with the same <code>time</code>, the one that appears later in the array wins.</li>
<li>Option and voter names are non-empty strings. Sort strings with plain <code>&lt;</code> comparison.</li>
</ul>
<p>You will write <code>tally</code> first, then <code>flips</code> and <code>leaderAt</code>.</p>`,
  examples: `const events = [
  { voter: "ana", option: "oak", time: 5 },
  { voter: "ben", option: "elm", time: 2 },
  { voter: "ana", option: "elm", time: 1 },
  { voter: "cy",  option: "elm", time: 3 },
  { voter: "ben", option: "oak", time: 9 },
];
tally(events);        // [{ option: "oak", votes: 2 }, { option: "elm", votes: 1 }]
leaderAt(events, 4);  // "elm" (ana: elm, ben: elm, cy: elm at that point)
leaderAt(events, 0);  // null`,
  constraints: ['Up to 2 × 10⁵ events and 2 × 10⁴ voters', '0 ≤ time ≤ 10⁹', 'Each function should run in O(n log n)'],
  starter: `/**
 * @param {{voter: string, option: string, time: number}[]} events
 * @returns {{option: string, votes: number}[]}
 */
function tally(events) {
  // TODO
}

/**
 * @returns {{voter: string, changes: number}[]}
 */
function flips(events) {
  // TODO
}

/**
 * @param {number} t
 * @returns {string|null}
 */
function leaderAt(events, t) {
  // TODO
}
`,
  parts: [
    {
      title: 'Part 1: Count the latest votes',
      body: `
<p>Write <code>tally(events)</code>. Count one vote per voter, using that voter's latest event. Return <code>[{ option, votes }]</code> sorted by <code>votes</code> descending, then <code>option</code> ascending. Leave out options that end with no votes.</p>`,
      tests: [
        { name: 'Example from the spec', src: `return [tally([{voter:'ana',option:'oak',time:5},{voter:'ben',option:'elm',time:2},{voter:'ana',option:'elm',time:1},{voter:'cy',option:'elm',time:3},{voter:'ben',option:'oak',time:9}]), [{option:'oak',votes:2},{option:'elm',votes:1}]];` },
        { name: 'Later time wins even when it arrives first', src: `return [tally([{voter:'ana',option:'oak',time:10},{voter:'ana',option:'elm',time:4}]), [{option:'oak',votes:1}]];` },
        { name: 'Equal votes sort by option name', src: `return [tally([{voter:'a',option:'pine',time:1},{voter:'b',option:'ash',time:1},{voter:'c',option:'elm',time:1}]), [{option:'ash',votes:1},{option:'elm',votes:1},{option:'pine',votes:1}]];` },
        { name: 'No events', src: `return [tally([]), []];` },
      ],
      hidden: [
        { name: 'Same time: later in the array wins', src: `return [tally([{voter:'ana',option:'oak',time:7},{voter:'ana',option:'elm',time:7}]), [{option:'elm',votes:1}]];` },
        { name: 'Options with no current votes are left out', src: `return [tally([{voter:'a',option:'yew',time:1},{voter:'b',option:'yew',time:2},{voter:'a',option:'oak',time:3},{voter:'b',option:'oak',time:4}]), [{option:'oak',votes:2}]];` },
        { name: '200k events', src: `let seed = 11; const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
const opts = ['oak','elm','fir','ash','yew'];
const ev = []; for (let i = 0; i < 200000; i++) ev.push({ voter: 'v' + Math.floor(rnd() * 20000), option: opts[Math.floor(rnd() * 5)], time: Math.floor(rnd() * 1e6) });
return [tally(ev), [{option:'elm',votes:1871},{option:'oak',votes:1858},{option:'fir',votes:1812},{option:'yew',votes:1798},{option:'ash',votes:1758}]];` },
      ],
    },
    {
      title: 'Part 2: Flip-floppers and the leader over time',
      body: `
<p>The community team wants two more views.</p>
<ul>
<li><code>flips(events)</code>: walk each voter's events in time order (array order breaks time ties). A <em>change</em> is an event whose option differs from that voter's previous event. Return <code>[{ voter, changes }]</code> for voters with at least 2 changes, sorted by <code>voter</code> ascending.</li>
<li><code>leaderAt(events, t)</code>: the leading option if only events with <code>time &lt;= t</code> had happened. Use the same rules as <code>tally</code>; on a tie, return the alphabetically smallest option. Return <code>null</code> when no vote counts yet.</li>
</ul>`,
      tests: [
        { name: 'Two changes make a flip-flopper', src: `return [flips([{voter:'x',option:'oak',time:1},{voter:'x',option:'elm',time:2},{voter:'x',option:'oak',time:3},{voter:'y',option:'oak',time:1},{voter:'y',option:'elm',time:2}]), [{voter:'x',changes:2}]];` },
        { name: 'Flips follow time, not arrival order', src: `return [flips([{voter:'x',option:'oak',time:3},{voter:'x',option:'oak',time:1},{voter:'x',option:'elm',time:2}]), [{voter:'x',changes:2}]];` },
        { name: 'Leader at a point in time', src: `const ev = [{voter:'ana',option:'oak',time:5},{voter:'ben',option:'elm',time:2},{voter:'ana',option:'elm',time:1},{voter:'cy',option:'elm',time:3},{voter:'ben',option:'oak',time:9}];
return [[leaderAt(ev, 4), leaderAt(ev, 5), leaderAt(ev, 9)], ['elm', 'elm', 'oak']];` },
        { name: 'No leader before the first vote', src: `return [leaderAt([{voter:'a',option:'oak',time:10}], 9), null];` },
      ],
      hidden: [
        { name: 'Repeating the same option is not a change', src: `return [flips([{voter:'z',option:'oak',time:1},{voter:'z',option:'oak',time:2},{voter:'z',option:'elm',time:3},{voter:'z',option:'elm',time:4},{voter:'z',option:'oak',time:5},{voter:'w',option:'ash',time:1},{voter:'w',option:'ash',time:2}]), [{voter:'z',changes:2}]];` },
        { name: 'Flip-floppers sorted by voter', src: `const ev = []; for (const v of ['m','b','t']) for (let i = 0; i < 4; i++) ev.push({voter:v, option: i % 2 ? 'elm' : 'oak', time: i});
return [flips(ev), [{voter:'b',changes:3},{voter:'m',changes:3},{voter:'t',changes:3}]];` },
        { name: 'Leader tie goes to the smaller option', src: `return [leaderAt([{voter:'a',option:'yew',time:1},{voter:'b',option:'ash',time:2},{voter:'c',option:'yew',time:8}], 5), 'ash'];` },
        { name: '200k events, flips and leader', src: `let seed = 11; const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
const opts = ['oak','elm','fir','ash','yew'];
const ev = []; for (let i = 0; i < 200000; i++) ev.push({ voter: 'v' + Math.floor(rnd() * 20000), option: opts[Math.floor(rnd() * 5)], time: Math.floor(rnd() * 1e6) });
const f = flips(ev);
return [[f.length, f[0], leaderAt(ev, 500000)], [349, {voter:'v10048',changes:2}, 'elm']];` },
      ],
    },
  ],
  followUps: ['Votes stream in continuously. How do you keep the tally current without recomputing from scratch?', 'leaderAt is called thousands of times for a results timeline. How would you precompute it?', 'A voter’s phone clock is wrong by an hour. How would you order events from devices you do not trust?'],
  rubric: 'Strong: one Map from voter to latest event, comparing time with >= so array order breaks ties; counts in a second Map; comparator that sorts votes desc then option asc; flips sorts by time with a stable tie-break (index) before walking each voter; leaderAt filters by time and reuses the tally logic. Weak: trusting array order as time order, counting every event instead of the latest, string-number sort mistakes, counting repeated identical votes as changes, returning undefined instead of null.',
  offline: {
    approach: 'Keep a `Map` from voter to their latest `{ option, time }`, replacing it when a new event has `time >=` the stored one. Then count options in a second `Map` and sort. `leaderAt` is the same with events after `t` skipped. `flips` needs real time order: sort a copy of the events by time (index as tie-break), then compare each event with the voter\'s previous option.',
    hints: ['Use `e.time >= prev.time` when updating the latest vote, so the later array entry wins a time tie.', 'Sort with `(a, b) => b.votes - a.votes || (a.option < b.option ? -1 : 1)`.', 'For `flips`, sort `events.map((e, i) => [e, i])` by time, then by `i`, so equal times keep array order.', 'Write one helper that builds the latest-vote map with an optional cutoff time; `tally` and `leaderAt` can share it.'],
    edge: ['Two events from one voter with the same time.', 'A voter whose earlier vote arrives after their later one.', 'An option that loses all its votes.', '`leaderAt` before any event (`null`).', 'A voter who repeats the same option (not a change).'],
    complexity: 'Building the latest-vote map is **O(n)**; sorting the options is **O(k log k)** for k options. `flips` sorts all events: **O(n log n)** time, **O(n)** space.',
    skeleton: `function latestVotes(events, upTo = Infinity) {
  const latest = new Map(); // voter -> { option, time }
  for (const e of events) {
    if (e.time > upTo) continue;
    // TODO: keep the event with the largest time (later in array wins ties)
  }
  return latest;
}

function tally(events) {
  const counts = new Map();
  // TODO: count options from latestVotes(events), sort votes desc, option asc
}

function flips(events) {
  // TODO: sort by time (index breaks ties), count option changes per voter
}

function leaderAt(events, t) {
  // TODO: reuse the tally logic with a cutoff, return null when empty
}`,
  },
  solution: `// The latest event per voter, ignoring events after upTo.
// Ties on time go to the event that appears later in the array.
function latestVotes(events, upTo = Infinity) {
  const latest = new Map(); // voter -> { option, time }
  for (const e of events) {
    if (e.time > upTo) continue;
    const prev = latest.get(e.voter);
    if (!prev || e.time >= prev.time) latest.set(e.voter, { option: e.option, time: e.time });
  }
  return latest;
}

// Count options and sort by votes desc, then option asc.
function rank(latest) {
  const counts = new Map();
  for (const { option } of latest.values()) counts.set(option, (counts.get(option) || 0) + 1);
  return [...counts]
    .map(([option, votes]) => ({ option, votes }))
    .sort((a, b) => b.votes - a.votes || (a.option < b.option ? -1 : a.option > b.option ? 1 : 0));
}

function tally(events) {
  return rank(latestVotes(events));
}

function flips(events) {
  // Sort by time; the original index keeps array order for equal times.
  const ordered = events
    .map((e, i) => [e, i])
    .sort((a, b) => a[0].time - b[0].time || a[1] - b[1]);

  const lastOption = new Map(); // voter -> option of their previous event
  const changes = new Map();    // voter -> number of changes
  for (const [e] of ordered) {
    const prev = lastOption.get(e.voter);
    if (prev !== undefined && prev !== e.option) changes.set(e.voter, (changes.get(e.voter) || 0) + 1);
    lastOption.set(e.voter, e.option);
  }

  return [...changes]
    .filter(([, n]) => n >= 2)
    .map(([voter, n]) => ({ voter, changes: n }))
    .sort((a, b) => (a.voter < b.voter ? -1 : 1));
}

function leaderAt(events, t) {
  const ranked = rank(latestVotes(events, t));
  return ranked.length ? ranked[0].option : null;
}
`,
});
