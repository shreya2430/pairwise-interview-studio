(function () {
  'use strict';

  // ---------- Utilities ----------
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const est = s => Math.ceil(String(s || '').length / 4);
  const fmt = n => Math.round(n).toLocaleString('en-US');
  const kfmt = n => n >= 1000 ? (n / 1000).toFixed(n % 1000 ? 1 : 0).replace(/\.0$/, '') + 'k' : String(n);
  const pl = (n, w, p) => n + ' ' + (n === 1 ? w : (p || w + 's'));
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const FENCE = '```';
  const mmss = ms => { const s = Math.max(0, Math.round(ms / 1000)); return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); };
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (_) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) { /* storage unavailable */ } },
    del(k) { try { localStorage.removeItem(k); } catch (_) { /* storage unavailable */ } },
  };
  const uid = () => Math.random().toString(36).slice(2, 6).toUpperCase() + '-' + Date.now().toString(36).slice(-4).toUpperCase();
  const stripHtml = h => h.replace(/<li>/g, '\n- ').replace(/<[^>]+>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/\n{3,}/g, '\n\n').trim();

  const K_ACTIVE = 'pairwise.active.v1';
  const K_HISTORY = 'pairwise.history.v1';
  const K_PREFS = 'pairwise.prefs.v1';

  const BUDGETS = [
    { v: 5000, label: '5k', note: 'Tight' },
    { v: 10000, label: '10k', note: 'Standard' },
    { v: 20000, label: '20k', note: 'Roomy' },
    { v: 40000, label: '40k', note: 'Open' },
  ];
  const DURATIONS = [{ v: 30, label: '30 min' }, { v: 45, label: '45 min' }, { v: 60, label: '60 min' }];
  const TIERS = [
    { v: 'quick', label: 'Fast', note: 'Instant replies' },
    { v: 'default', label: 'Balanced', note: 'Recommended' },
    { v: 'complex', label: 'Deep', note: 'Slower, thinks longer' },
  ];
  const DIMS = [
    { id: 'correctness', label: 'Correctness', weight: 0.25, desc: 'Visible and hidden tests' },
    { id: 'problem_solving', label: 'Problem decomposition', weight: 0.15, desc: 'Understanding, planning, approach' },
    { id: 'ai_collaboration', label: 'Working with the assistant', weight: 0.2, desc: 'Prompt quality, judgment, ownership' },
    { id: 'verification', label: 'Verification and testing', weight: 0.15, desc: 'Running tests, probing edge cases' },
    { id: 'code_quality', label: 'Code quality', weight: 0.1, desc: 'Readability, structure, complexity' },
    { id: 'efficiency', label: 'Token and time management', weight: 0.15, desc: 'Budget and clock use' },
  ];
  const VERDICTS = {
    strong_hire: 'Strong hire', hire: 'Hire', lean_hire: 'Lean hire', lean_no_hire: 'Lean no hire', no_hire: 'No hire',
  };
  const SCORE_WORDS = { 1: 'Below bar', 2: 'Mixed', 3: 'Meets bar', 4: 'Exceeds' };
  const LEVELS = ['New grad', 'Mid-level', 'Senior'];
  const byLevel = list => list.map((p, i) => [p, i]).sort((a, b) => LEVELS.indexOf(a[0].level) - LEVELS.indexOf(b[0].level) || a[1] - b[1]).map(x => x[0]);
  const levelClass = l => 'lv-' + String(l || '').toLowerCase().replace(/[^a-z]+/g, '');
  const MAX_HISTORY_TURNS = 8;
  // Outside claude.ai, visitors connect Claude with their own Anthropic API key.
  const SDK_URL = 'https://cdn.jsdelivr.net/npm/@anthropic-ai/sdk@0.133.0/+esm';
  const K_KEY = 'pairwise.anthropicKey.v1';
  const BYOK_MODELS = {
    quick: { model: 'claude-haiku-5-5', effort: 'low', label: 'Haiku 5.5' },
    default: { model: 'claude-opus-5-5', effort: 'low', label: 'Opus 5.5' },
    complex: { model: 'claude-opus-5-5', effort: 'high', label: 'Opus 5.5, high effort' },
  };
  const hostHasClaude = !!(window.claude && typeof window.claude.use === 'function');
  const NO_KEY_REASON = 'Claude is not connected, so the built-in practice assistant is answering. Connect your Anthropic API key to use Claude.';

  // ---------- App state ----------
  const prefs = Object.assign({ problemId: PROBLEMS[0].id, budget: 10000, duration: 45, tier: 'default', name: '', level: 'All' }, store.get(K_PREFS, {}));
  let sess = null;           // active session
  let editor = null;         // editor adapter
  let sample = null;         // Claude sampling function, or null
  let byok = null;           // { client, Anthropic } when the visitor connected an API key
  let SDK = null;            // the Anthropic SDK class, once loaded
  let agentMode = 'checking'; // 'checking' | 'claude' | 'byok' | 'offline'
  let offlineReason = '';
  let streaming = null;      // { ctl, turn }
  let timerHandle = null;
  let saveHandle = null;
  const codeStore = new Map();

  const problem = id => PROBLEMS.find(p => p.id === id) || PROBLEMS[0];

  // ---------- Claude capability ----------
  function initAgent() {
    const cl = window.claude;
    if (!cl || typeof cl.use !== 'function') {
      const k = loadKey();
      if (!k) { setAgentMode('offline', NO_KEY_REASON); return; }
      connectKey(k, null).catch(() => setAgentMode('offline', 'Your saved API key could not be used, so the built-in practice assistant is answering. Reconnect it to use Claude.'));
      return;
    }
    cl.use('sample').then(s => {
      if (s) { sample = s; setAgentMode('claude'); }
      else setAgentMode('offline', 'Claude is not available in this view, so the built-in practice assistant is answering.');
    }).catch(() => setAgentMode('offline', 'Claude could not be reached, so the built-in practice assistant is answering.'));
  }
  function setAgentMode(mode, reason) {
    agentMode = mode;
    if (reason) offlineReason = reason;
    const lobby = $('#lobby-agent-status');
    lobby.dataset.mode = mode;
    lobby.lastElementChild.textContent = mode === 'claude' ? 'Assistant: Claude, connected' : mode === 'byok' ? 'Assistant: Claude via your API key' : mode === 'offline' ? 'Assistant: built-in practice mode' : 'Connecting to the assistant…';
    lobby.title = mode === 'offline' ? offlineReason : '';
    const badge = $('#agent-badge');
    badge.dataset.mode = mode;
    const tier = TIERS.find(t => t.v === (sess ? sess.tier : prefs.tier));
    const bm = BYOK_MODELS[sess ? sess.tier : prefs.tier] || BYOK_MODELS.default;
    $('#agent-badge-text').textContent = mode === 'claude' ? 'Claude · ' + tier.label : mode === 'byok' ? 'Claude · ' + bm.label : mode === 'offline' ? 'Practice mode' : 'Connecting…';
    badge.title = mode === 'offline' ? offlineReason : mode === 'byok' ? 'Using your Anthropic API key' : '';
    $('#btn-key-agent').hidden = hostHasClaude || mode === 'byok' || mode === 'checking';
    renderConn();
    renderSetupNotes();
  }

  // ---------- Bring your own API key ----------
  function loadKey() { try { return sessionStorage.getItem(K_KEY) || localStorage.getItem(K_KEY) || ''; } catch (_) { return ''; } }
  function saveKey(k, remember) {
    try { sessionStorage.setItem(K_KEY, k); } catch (_) { /* storage unavailable */ }
    try { if (remember) localStorage.setItem(K_KEY, k); else localStorage.removeItem(K_KEY); } catch (_) { /* storage unavailable */ }
  }
  function clearKey() {
    try { sessionStorage.removeItem(K_KEY); } catch (_) { /* storage unavailable */ }
    try { localStorage.removeItem(K_KEY); } catch (_) { /* storage unavailable */ }
  }
  async function connectKey(key, remember) {
    const mod = await import(SDK_URL);
    const Anthropic = mod.default || mod.Anthropic;
    SDK = Anthropic;
    const client = new Anthropic({ apiKey: key, dangerouslyAllowBrowser: true, maxRetries: 1 });
    // Token counting is free and, unlike the models endpoint, answers a bad key with CORS headers.
    await client.messages.countTokens({ model: 'claude-haiku-5-5', messages: [{ role: 'user', content: 'ping' }] });
    byok = { client, Anthropic };
    if (remember !== null) saveKey(key, remember);
    setAgentMode('byok');
  }
  function disconnectKey() {
    clearKey(); byok = null;
    setAgentMode('offline', NO_KEY_REASON);
    toast('API key removed from this browser');
  }
  function renderConn() {
    const sec = $('#conn-sec');
    if (!sec) return;
    sec.hidden = hostHasClaude;
    if (hostHasClaude) return;
    const on = agentMode === 'byok';
    $('#conn-state').textContent = on ? 'Connected' : 'Not connected';
    $('#btn-key').textContent = on ? 'Change or remove key' : 'Connect your API key';
    $('#conn-note').textContent = on
      ? 'Claude answers with your key. Usage is billed to your Anthropic account.'
      : 'Without a key, a built-in practice assistant answers and a rubric grades you.';
  }
  function splitInput(input) {
    const messages = input.slice(1);
    while (messages.length && messages[0].role !== 'user') messages.shift();
    return { system: input[0].content, messages };
  }
  function mapApiError(e, text, signal) {
    if (e && e.code && !(e instanceof Error)) return Object.assign({ text }, e);
    const A = SDK;
    let code = 'upstream_error';
    if ((signal && signal.aborted) || (A && A.APIUserAbortError && e instanceof A.APIUserAbortError)) code = 'cancelled';
    else if (A && (e instanceof A.AuthenticationError || e instanceof A.PermissionDeniedError)) code = 'bad_key';
    else if (A && e instanceof A.RateLimitError) code = 'rate_limited';
    else if (A && e instanceof A.BadRequestError) code = 'bad_request';
    return { code, message: (e && e.message) || String(e), text };
  }
  async function byokStream(params, onText, signal) {
    if (params.model === 'claude-opus-5-5') { params.betas = ['server-side-fallback-2026-07-01']; params.fallbacks = 'default'; }
    let text = '';
    try {
      const stream = byok.client.beta.messages.stream(params, { signal });
      stream.on('text', d => { text += d; if (onText) onText({ text }); });
      const msg = await stream.finalMessage();
      if (msg.stop_reason === 'refusal') throw { code: 'refused' };
      return { text, usage: msg.usage };
    } catch (e) { throw mapApiError(e, text, signal); }
  }
  function byokChat(input, tier, onText, signal) {
    const M = BYOK_MODELS[tier] || BYOK_MODELS.default;
    const { system, messages } = splitInput(input);
    return byokStream({ model: M.model, max_tokens: 16000, system, messages, output_config: { effort: M.effort } }, onText, signal);
  }
  async function byokJson(prompt) {
    const r = await byokStream({ model: 'claude-opus-5-5', max_tokens: 16000, messages: [{ role: 'user', content: prompt }], output_config: { effort: 'medium' } }, null, null);
    return parseJsonLoose(r.text);
  }
  function parseJsonLoose(t) {
    try { return JSON.parse(t); } catch (_) { /* try the fenced or embedded object next */ }
    const f = t.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (f) { try { return JSON.parse(f[1]); } catch (_) { /* fall through */ } }
    const a = t.indexOf('{'), b = t.lastIndexOf('}');
    if (a >= 0 && b > a) { try { return JSON.parse(t.slice(a, b + 1)); } catch (_) { /* fall through */ } }
    throw { code: 'invalid_json', text: t };
  }
  function openKeyModal() {
    const on = agentMode === 'byok';
    openModal({
      title: on ? 'Your Claude connection' : 'Connect Claude',
      sub: 'Use your own Anthropic API key for the assistant and the scorecard.',
      body: `
        <label class="setup-label" for="key-input"><span>Anthropic API key</span></label>
        <input id="key-input" class="field" type="password" placeholder="sk-ant-…" autocomplete="off" spellcheck="false">
        <label class="check"><input type="checkbox" id="key-remember"> Remember on this device</label>
        <p class="hint">Create a key at <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener">console.anthropic.com</a>. Usage is billed to your Anthropic account. The key stays in this browser and is sent only to api.anthropic.com. Without “Remember”, it is forgotten when you close the tab.</p>
        <p class="msg-error" id="key-err" hidden></p>`,
      actions: [{ label: 'Cancel' }].concat(on ? [{ label: 'Remove key', kind: 'danger', onClick: disconnectKey }] : [], [{ label: 'Connect', kind: 'primary', id: 'key-go', keepOpen: true, onClick: async () => {
        const key = $('#key-input').value.trim();
        const err = $('#key-err');
        if (!key) { err.hidden = false; err.textContent = 'Paste your API key first.'; return; }
        const go = $('#key-go'); go.disabled = true; go.textContent = 'Checking key…'; err.hidden = true;
        try {
          await connectKey(key, $('#key-remember').checked);
          closeModal(); toast('Connected. Claude will answer with your key.');
          if (sess) renderThread(); renderCost();
        } catch (e) {
          const m = mapApiError(e, '', null);
          err.hidden = false;
          err.textContent = m.code === 'bad_key' ? 'That key was rejected. Check that you copied the whole key and that it is active.' : 'Could not reach the Anthropic API: ' + (m.message || 'network error') + '.';
          go.disabled = false; go.textContent = 'Connect';
        }
      } }]),
      onOpen: () => { const i = $('#key-input'); i.focus(); i.onkeydown = e => { if (e.key === 'Enter') $('#key-go').click(); }; },
    });
  }
  $('#btn-key').onclick = openKeyModal;
  $('#btn-key-agent').onclick = openKeyModal;

  // ---------- Lobby ----------
  function renderLobby() {
    const shown = byLevel(PROBLEMS).filter(p => prefs.level === 'All' || p.level === prefs.level);
    $('#problem-count').textContent = shown.length === PROBLEMS.length ? PROBLEMS.length + ' problems' : shown.length + ' of ' + PROBLEMS.length + ' problems';
    renderSeg('#seg-level', ['All'].concat(LEVELS).map(l => ({ v: l, html: l === 'All' ? 'All levels' : l })), prefs.level, v => { prefs.level = v; savePrefs(); renderLobby(); });
    if (!shown.some(p => p.id === prefs.problemId) && shown.length) { prefs.problemId = shown[0].id; savePrefs(); }
    $('#problem-list').innerHTML = shown.map(p => `
      <button class="problem-row" role="radio" aria-checked="${p.id === prefs.problemId}" data-pid="${p.id}">
        <span class="radio" aria-hidden="true"></span>
        <span class="pr-main">
          <span class="pr-title">${esc(p.title)} <span class="pr-team">· ${esc(p.team)}</span></span>
          <span class="pr-scn">${esc(p.scenario)}</span>
          <span class="pr-tags">${p.focus.map(f => `<span class="chip">${esc(f)}</span>`).join('')}</span>
        </span>
        <span class="pr-side"><span class="chip level ${levelClass(p.level)}">${esc(p.level)}</span><span class="chip ${p.difficulty.toLowerCase()}">${p.difficulty}</span><span class="num">~${p.minutes} min</span><span class="num">${p.parts.length > 1 ? p.parts.length + ' parts · ' : ''}${p.tests.length} + ${p.hidden.length} tests</span></span>
      </button>`).join('');
    renderSeg('#seg-budget', BUDGETS.map(b => ({ v: b.v, html: `${b.label}<small>${b.note}</small>` })), prefs.budget, v => { prefs.budget = v; savePrefs(); renderSetupNotes(); });
    renderSeg('#seg-time', DURATIONS.map(d => ({ v: d.v, html: d.label })), prefs.duration, v => { prefs.duration = v; savePrefs(); renderSetupNotes(); });
    renderSeg('#seg-tier', TIERS.map(t => ({ v: t.v, html: t.label })), prefs.tier, v => { prefs.tier = v; savePrefs(); renderSetupNotes(); });
    $('#cand-name').value = prefs.name || '';
    renderSetupNotes();
    renderResume();
    renderHistory();
  }
  function renderSeg(sel, items, current, onPick) {
    const host = $(sel);
    host.innerHTML = items.map(it => `<button role="radio" aria-checked="${it.v === current}" data-v="${it.v}">${it.html}</button>`).join('');
    host.onclick = e => {
      const b = e.target.closest('button'); if (!b) return;
      const v = isNaN(+b.dataset.v) ? b.dataset.v : +b.dataset.v;
      $$('button', host).forEach(x => x.setAttribute('aria-checked', String(x === b)));
      onPick(v);
    };
  }
  function renderSetupNotes() {
    const P = problem(prefs.problemId);
    const per = est(buildPreamble(P)) + est(P.starter) + 380;
    $('#budget-note').textContent = '≈ ' + Math.max(1, Math.floor(prefs.budget / per)) + ' exchanges with code attached';
    $('#time-note').textContent = 'Suggested ' + P.minutes + ' min';
    $('#tier-note').textContent = agentMode === 'byok' ? (BYOK_MODELS[prefs.tier] || BYOK_MODELS.default).label : TIERS.find(t => t.v === prefs.tier).note;
    $('#start-note').textContent = agentMode === 'offline'
      ? offlineReason + ' Everything else works the same.'
      : P.title + ' · ' + kfmt(prefs.budget) + ' tokens · ' + prefs.duration + ' min';
  }
  function savePrefs() { store.set(K_PREFS, prefs); }

  function renderResume() {
    const a = store.get(K_ACTIVE, null);
    const slot = $('#resume-slot');
    if (!a || a.status !== 'active') { slot.innerHTML = ''; return; }
    const P = problem(a.problemId);
    const left = a.endsAt - Date.now();
    slot.innerHTML = `<div class="resume-bar"><p><b>Interview in progress:</b> ${esc(P.title)}. ${left > 0 ? mmss(left) + ' left on the clock' : 'Time is up; it will be submitted when you resume'}, ${fmt(a.budget - a.used)} tokens left.</p>
      <button class="btn btn-sm btn-ghost" id="btn-discard">Discard</button><button class="btn btn-sm btn-primary" id="btn-resume">Resume interview</button></div>`;
    $('#btn-resume').onclick = () => startSession(a);
    $('#btn-discard').onclick = () => openModal({
      title: 'Discard this interview?',
      sub: 'Your code, notes and assistant conversation for ' + P.title + ' will be deleted. This cannot be undone.',
      actions: [{ label: 'Keep it' }, { label: 'Discard interview', kind: 'danger', onClick: () => { store.del(K_ACTIVE); renderResume(); toast('Interview discarded'); } }],
    });
  }

  function renderHistory() {
    const h = store.get(K_HISTORY, []);
    const host = $('#history');
    if (!h.length) { host.innerHTML = '<p class="history-empty">No sessions yet. Your scorecards will be listed here after you submit.</p>'; return; }
    host.innerHTML = h.slice(0, 15).map((r, i) => `
      <button class="history-row" data-hi="${i}">
        <span><b>${esc(r.title)}</b><br><span class="faint" style="font-size:12.5px">${new Date(r.date).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}${r.name ? ' · ' + esc(r.name) : ''}</span></span>
        <span class="h-hide muted num" style="font-size:13px">${fmt(r.used)} / ${kfmt(r.budget)} tokens · ${r.testsPassed}/${r.testsTotal} tests</span>
        <span class="num h-hide" style="font-weight:600">${r.overall.toFixed(1)}</span>
        <span class="verdict v-${r.verdict}">${VERDICTS[r.verdict]}</span>
      </button>`).join('');
    host.onclick = e => {
      const b = e.target.closest('[data-hi]'); if (!b) return;
      const rec = store.get(K_HISTORY, [])[+b.dataset.hi];
      if (rec && rec.report) { showReport(rec.report); } else toast('This scorecard is no longer stored in this browser.');
    };
  }

  $('#problem-list').addEventListener('click', e => {
    const b = e.target.closest('[data-pid]'); if (!b) return;
    prefs.problemId = b.dataset.pid; savePrefs();
    $$('#problem-list [data-pid]').forEach(x => x.setAttribute('aria-checked', String(x === b)));
    renderSetupNotes();
  });
  $('#cand-name').addEventListener('input', e => { prefs.name = e.target.value.slice(0, 60); savePrefs(); });

  $('#btn-start').onclick = () => {
    if (store.get(K_ACTIVE, null)) {
      openModal({
        title: 'Replace the interview in progress?',
        sub: 'You have an unfinished interview. Starting a new one discards it.',
        actions: [{ label: 'Cancel' }, { label: 'Discard and continue', kind: 'danger', onClick: () => { store.del(K_ACTIVE); renderResume(); setTimeout(openBriefing, 0); } }],
      });
      return;
    }
    openBriefing();
  };

  function openBriefing() {
    const P = problem(prefs.problemId);
    openModal({
      title: 'Before you begin',
      sub: P.title + ' · ' + P.team,
      body: `
        <div class="modal-facts"><div><small>Time limit</small><b>${prefs.duration} min</b></div><div><small>Token budget</small><b>${fmt(prefs.budget)}</b></div><div><small>${P.parts.length > 1 ? 'Parts' : 'Tests'}</small><b>${P.parts.length > 1 ? P.parts.length + ' parts' : P.tests.length + ' visible, ' + P.hidden.length + ' hidden'}</b></div></div>
        <ul>
          ${P.parts.length > 1 ? `<li><b>This problem comes in ${P.parts.length} parts.</b> You see Part 1 first. When all visible tests for your current part pass, you can continue to the next one. Hidden tests for every part run on submit, so how far you get counts.</li>` : ''}
          <li><b>Use the assistant however you like.</b> You are assessed on how you direct and check its work, as well as on the final code.</li>
          <li><b>Every message spends tokens:</b> the instructions and problem, your message, whatever you attach, recent history and the reply. A reply that would overrun the budget is cut off.</li>
          <li><b>Run the visible tests anytime.</b> Hidden tests, including large inputs, run when you submit.</li>
          <li><b>The clock starts when you press Begin.</b> At zero, your code is submitted as it stands.</li>
          <li>Prompts, test runs, applied suggestions and pastes are recorded for the scorecard.</li>
        </ul>
        <label class="check"><input type="checkbox" id="brief-ack"> I understand that this session is timed and recorded.</label>`,
      actions: [{ label: 'Cancel' }, { label: 'Begin interview', kind: 'primary', id: 'brief-go', disabled: true, onClick: () => startSession(null) }],
      onOpen: () => { const c = $('#brief-ack'); c.onchange = () => { $('#brief-go').disabled = !c.checked; }; c.focus(); },
    });
  }

  // ---------- Session lifecycle ----------
  function newSession() {
    const P = problem(prefs.problemId);
    const now = Date.now();
    return {
      id: uid(), problemId: P.id, budget: prefs.budget, duration: prefs.duration, tier: prefs.tier, name: (prefs.name || '').trim(),
      startedAt: now, endsAt: now + prefs.duration * 60000, code: P.starter, notes: '', used: 0,
      turns: [], events: [{ t: 0, type: 'start', text: 'Interview started' }], runs: [], lastRun: null,
      ctx: { code: true, tests: false, hist: true }, offlineHint: 0, status: 'active', agentModes: [], part: 0,
    };
  }
  function startSession(existing) {
    sess = existing || newSession();
    showView('session');
    const P = problem(sess.problemId);
    $('#tb-title').textContent = P.title;
    sess.part = sess.part || 0;
    $('#tb-sub').textContent = P.team + ' · ' + P.level + ' · ' + P.difficulty + ' · Session ' + sess.id;
    renderBrief(P);
    $('#notes').value = sess.notes || '';
    mountEditor(sess.code);
    renderThread();
    renderCtxToggles();
    renderGauge();
    renderConsole();
    tickTimer();
    clearInterval(timerHandle);
    timerHandle = setInterval(tickTimer, 1000);
    setAgentMode(agentMode);
    persist();
    setMobileTab('pane-editor');
  }
  function persist(now) {
    if (!sess || sess.status !== 'active') return;
    clearTimeout(saveHandle);
    const go = () => { store.set(K_ACTIVE, sess); $('#save-state').textContent = 'Saved ' + new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }); };
    if (now) go(); else saveHandle = setTimeout(go, 600);
  }
  const elapsed = () => Date.now() - sess.startedAt;
  function logEvent(type, text, extra) { sess.events.push(Object.assign({ t: elapsed(), type, text }, extra || {})); persist(); }

  function tickTimer() {
    if (!sess || sess.status !== 'active') return;
    const left = sess.endsAt - Date.now();
    $('#t-left').textContent = mmss(left);
    $('#timer').dataset.state = left <= 60000 ? 'bad' : left <= 5 * 60000 ? 'warn' : 'ok';
    if (left <= 0) { clearInterval(timerHandle); logEvent('timeout', 'Time ran out'); closeModal(); submit(true); }
  }

  // ---------- Problem brief ----------
  const curPart = () => (sess && sess.part) || 0;
  const unlockedTests = P => P.tests.filter(t => t.part <= curPart());
  function renderBrief(P) {
    const multi = P.parts.length > 1;
    const k = curPart();
    const partsHTML = multi ? `<section class="parts">${P.parts.map((pt, i) => i <= k
      ? `<div class="part${i === k ? ' current' : ' done'}"><h3><span class="part-n">${i < k ? '✓' : i + 1}</span>${esc(pt.title)}</h3><div class="brief-body">${pt.body}</div></div>`
      : `<div class="part locked"><h3><span class="part-n">${i + 1}</span>Part ${i + 1}</h3><p class="faint">Unlocks when every visible test for Part ${i} passes.</p></div>`).join('')}</section>` : '';
    const vis = unlockedTests(P);
    const hiddenNote = multi ? P.hidden.length + ' hidden tests across all ' + P.parts.length + ' parts run when you submit' : P.hidden.length + ' hidden tests run when you submit';
    $('#brief-body').innerHTML = `<div class="brief">
      <div style="display:grid;gap:8px"><h2>${esc(P.title)}</h2>
      <div class="brief-meta"><span class="chip level ${levelClass(P.level)}">${esc(P.level)}</span><span class="chip ${P.difficulty.toLowerCase()}">${P.difficulty}</span><span class="chip">${esc(P.team)}</span>${P.focus.map(f => `<span class="chip">${esc(f)}</span>`).join('')}</div></div>
      <p class="scenario">${esc(P.scenario)}</p>
      ${P.format ? `<p class="format-note">${esc(P.format)}</p>` : ''}
      <div class="brief-body">${P.body}</div>
      ${partsHTML}
      <section><h3>Example</h3><pre class="example">${esc(P.examples)}</pre></section>
      <section><h3>Constraints</h3><ul class="constraints">${P.constraints.map(c => `<li>${esc(c)}</li>`).join('')}</ul></section>
      <section><h3>Tests</h3><div class="test-list">${vis.map(t => `<div><span class="dot faint"></span>${multi ? '<span class="faint">P' + (t.part + 1) + '</span> ' : ''}${esc(t.name)}</div>`).join('')}<div class="hidden-note"><span class="dot"></span>${hiddenNote}</div></div></section>
      <details class="followups"><summary>Questions your interviewer may ask</summary><ul>${P.followUps.map(f => `<li>${esc(f)}</li>`).join('')}</ul></details>
    </div>`;
  }
  function advancePart() {
    const P = problem(sess.problemId);
    if (curPart() >= P.parts.length - 1) return;
    sess.part = curPart() + 1;
    logEvent('part', 'Unlocked ' + (/^part \d/i.test(P.parts[sess.part].title) ? P.parts[sess.part].title : 'Part ' + (sess.part + 1) + ': ' + P.parts[sess.part].title));
    renderBrief(P);
    renderConsole();
    renderCost();
    toast('Part ' + (sess.part + 1) + ' unlocked. Read the new requirements in the problem pane.');
    if (window.matchMedia('(max-width: 760px)').matches) setMobileTab('pane-brief');
    else $('#workbench').classList.add('show-brief');
    const cur = $('#brief-body .part.current'); if (cur) cur.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }
  $$('[data-btab]').forEach(b => b.onclick = () => {
    $$('[data-btab]').forEach(x => x.setAttribute('aria-selected', String(x === b)));
    $('#brief-body').hidden = b.dataset.btab !== 'brief';
    $('#notes-body').hidden = b.dataset.btab !== 'notes';
  });
  $('#notes').addEventListener('input', e => {
    if (!sess) return;
    const had = (sess.notes || '').trim().length > 0;
    sess.notes = e.target.value;
    if (!had && sess.notes.trim()) logEvent('notes', 'Started writing notes');
    persist();
  });
  $('#btn-brief').onclick = () => $('#workbench').classList.toggle('show-brief');

  // ---------- Editor ----------
  function mountEditor(code) {
    const host = $('#editor-host');
    host.innerHTML = '';
    if (window.CodeMirror) {
      const cm = window.CodeMirror(host, {
        value: code, mode: 'javascript', lineNumbers: true, indentUnit: 2, tabSize: 2, autoCloseBrackets: true, matchBrackets: true, lineWrapping: false,
        extraKeys: {
          Tab: c => c.somethingSelected() ? c.indentSelection('add') : c.replaceSelection('  '),
          'Shift-Tab': c => c.indentSelection('subtract'),
          'Cmd-Enter': () => runVisible(), 'Ctrl-Enter': () => runVisible(),
        },
      });
      cm.on('change', (c, ch) => {
        if (!sess) return;
        sess.code = c.getValue();
        if (ch.origin === 'paste') { const n = ch.text.join('\n').length; if (n >= 40) logEvent('paste', 'Pasted ' + n + ' characters into the editor', { chars: n }); }
        renderCtxToggles(); persist();
      });
      editor = {
        get: () => cm.getValue(),
        set: v => { cm.setValue(v); cm.focus(); flash(cm, 0, cm.lineCount()); },
        insert: v => { const from = cm.getCursor(); cm.replaceSelection(v, 'end', 'apply'); const to = cm.getCursor(); cm.focus(); flash(cm, from.line, to.line + 1); },
        refresh: () => cm.refresh(),
      };
      setTimeout(() => cm.refresh(), 0);
    } else {
      const ta = document.createElement('textarea');
      ta.className = 'fallback-editor'; ta.id = 'code-fallback'; ta.spellcheck = false; ta.value = code;
      ta.addEventListener('keydown', e => {
        if (e.key === 'Tab') { e.preventDefault(); const s = ta.selectionStart; ta.setRangeText('  ', s, ta.selectionEnd, 'end'); ta.dispatchEvent(new Event('input')); }
        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); runVisible(); }
      });
      ta.addEventListener('paste', e => { const n = (e.clipboardData && e.clipboardData.getData('text') || '').length; if (n >= 40) logEvent('paste', 'Pasted ' + n + ' characters into the editor', { chars: n }); });
      ta.addEventListener('input', () => { if (!sess) return; sess.code = ta.value; renderCtxToggles(); persist(); });
      host.appendChild(ta);
      editor = {
        get: () => ta.value,
        set: v => { ta.value = v; ta.dispatchEvent(new Event('input')); ta.focus(); },
        insert: v => { ta.setRangeText(v, ta.selectionStart, ta.selectionEnd, 'end'); ta.dispatchEvent(new Event('input')); ta.focus(); },
        refresh: () => {},
      };
    }
  }
  function flash(cm, a, b) {
    const mark = cm.markText({ line: a, ch: 0 }, { line: Math.max(a, b - 1), ch: 9999 }, { className: 'cm-flash' });
    setTimeout(() => mark.clear(), 1400);
  }
  let resetArmed = null;
  $('#btn-reset').onclick = () => {
    const b = $('#btn-reset');
    if (!resetArmed) {
      b.textContent = 'Click again to reset'; b.classList.add('btn-danger');
      resetArmed = setTimeout(() => { resetArmed = null; b.textContent = 'Reset code'; b.classList.remove('btn-danger'); }, 3000);
      return;
    }
    clearTimeout(resetArmed); resetArmed = null; b.textContent = 'Reset code'; b.classList.remove('btn-danger');
    editor.set(problem(sess.problemId).starter);
    logEvent('reset', 'Reset the code to the starter');
    toast('Code reset to the starter');
  };

  // ---------- Test runner (Web Worker) ----------
  function workerMain() {
    self.onmessage = function (e) {
      var code = e.data.code, tests = e.data.tests, logs = [];
      function show(v) {
        try {
          if (typeof v === 'string') return v;
          if (v === undefined) return 'undefined';
          if (typeof v === 'function') return '[Function]';
          if (typeof v === 'number' && !isFinite(v)) return String(v);
          return JSON.stringify(v, function (k, x) { return x instanceof Map ? { Map: Array.from(x) } : x instanceof Set ? { Set: Array.from(x) } : x === undefined ? '__undefined__' : x; }).replace(/"__undefined__"/g, 'undefined');
        } catch (_) { return String(v); }
      }
      function cap() { if (logs.length < 300) logs.push(Array.prototype.map.call(arguments, show).join(' ')); }
      try { console.log = cap; console.info = cap; console.warn = cap; console.error = cap; console.debug = cap; } catch (_) { self.console = { log: cap, info: cap, warn: cap, error: cap, debug: cap }; }
      function eq(a, b) {
        if (a === b) return true;
        if (typeof a === 'number' && typeof b === 'number') return a !== a && b !== b;
        if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false;
        if (Array.isArray(a) !== Array.isArray(b)) return false;
        var ka = Object.keys(a), kb = Object.keys(b);
        if (ka.length !== kb.length) return false;
        for (var i = 0; i < ka.length; i++) if (!Object.prototype.hasOwnProperty.call(b, ka[i]) || !eq(a[ka[i]], b[ka[i]])) return false;
        return true;
      }
      var RUN = '\n;return __tests.map(function (__t) { var __s = performance.now(); try { var __r = eval("(function(){" + __t.src + "\\n})")(); return { name: __t.name, pass: __eq(__r[0], __r[1]), got: __show(__r[0]), expected: __show(__r[1]), ms: performance.now() - __s }; } catch (__e) { return { name: __t.name, pass: false, error: (__e && __e.name ? __e.name + ": " : "") + (__e && __e.message !== undefined ? __e.message : String(__e)), ms: performance.now() - __s }; } });';
      var runner;
      try { runner = new Function('__tests', '__eq', '__show', code + RUN); }
      catch (err) { self.postMessage({ compileError: (err && err.name ? err.name + ': ' : '') + (err && err.message || err), logs: logs }); return; }
      try { var results = runner(tests, eq, show); self.postMessage({ results: results, logs: logs }); }
      catch (err2) { self.postMessage({ compileError: 'Your code threw while loading: ' + (err2 && err2.name ? err2.name + ': ' : '') + (err2 && err2.message || err2), logs: logs }); }
    };
  }
  const WORKER_URL = URL.createObjectURL(new Blob(['(' + workerMain.toString() + ')()'], { type: 'text/javascript' }));

  function runTests(code, tests, limitMs) {
    return new Promise(resolve => {
      const t0 = performance.now();
      let w;
      try { w = new Worker(WORKER_URL); } catch (e) { resolve({ compileError: 'The test runner could not start in this browser: ' + e.message, logs: [], ms: 0 }); return; }
      const kill = setTimeout(() => { w.terminate(); resolve({ timeout: true, logs: [], ms: limitMs, results: tests.map(t => ({ name: t.name, pass: false, error: 'Timed out: the run exceeded ' + limitMs / 1000 + ' s (infinite loop or too slow)' })) }); }, limitMs);
      w.onmessage = e => { clearTimeout(kill); w.terminate(); resolve(Object.assign({ ms: performance.now() - t0 }, e.data)); };
      w.onerror = e => { clearTimeout(kill); w.terminate(); e.preventDefault && e.preventDefault(); resolve({ compileError: e.message || 'The code failed to run', logs: [], ms: performance.now() - t0 }); };
      w.postMessage({ code, tests: tests.map(t => ({ name: t.name, src: t.src })) });
    });
  }
  function summarizeRun(r, total) {
    if (r.compileError) return { passed: 0, total, error: r.compileError };
    const passed = (r.results || []).filter(x => x.pass).length;
    return { passed, total };
  }

  let running = false;
  async function runVisible() {
    if (!sess || running || sess.status !== 'active') return;
    running = true;
    const btn = $('#btn-run'); btn.disabled = true;
    $('#run-meta').textContent = 'Running…';
    const P = problem(sess.problemId);
    const tests = unlockedTests(P);
    const r = await runTests(editor.get(), tests, 6000);
    running = false; btn.disabled = false;
    const s = summarizeRun(r, tests.length);
    sess.lastRun = { t: elapsed(), part: curPart(), passed: s.passed, total: s.total, compileError: r.compileError || null, timeout: !!r.timeout, results: (r.results || []).map(x => ({ name: x.name, pass: x.pass, got: x.got, expected: x.expected, error: x.error, ms: x.ms })), logs: (r.logs || []).slice(0, 100), ms: r.ms };
    sess.runs.push({ t: sess.lastRun.t, passed: s.passed, total: s.total });
    logEvent(s.passed === s.total ? 'run' : 'runfail', r.compileError ? 'Ran tests: code did not load' : 'Ran tests: ' + s.passed + ' of ' + s.total + ' passed', { passed: s.passed, total: s.total });
    renderConsole();
    renderCtxToggles();
    showConsoleTab('tests');
    if (window.matchMedia('(max-width: 760px)').matches) setMobileTab('pane-editor');
  }
  $('#btn-run').onclick = runVisible;

  function renderConsole() {
    const r = sess && sess.lastRun;
    const host = $('#console-tests');
    if (!r) {
      host.innerHTML = '<p class="console-empty">Run the visible tests to see results here. Hidden tests run when you submit.</p>';
      $('#console-logs').innerHTML = '<p class="console-empty">console.log output from your code appears here.</p>';
      $('#run-meta').textContent = '';
      return;
    }
    $('#run-meta').textContent = 'Last run ' + mmss(r.t) + ' · ' + Math.round(r.ms) + ' ms';
    if (r.compileError) {
      host.innerHTML = `<div class="run-summary bad">Your code did not load</div><div class="compile-err">${esc(r.compileError)}</div>`;
    } else {
      const ok = r.passed === r.total;
      const P = problem(sess.problemId);
      const canAdvance = ok && (r.part || 0) === curPart() && curPart() < P.parts.length - 1 && sess.status === 'active';
      host.innerHTML = `<div class="run-summary ${ok ? 'ok' : 'bad'}">${ok ? 'All ' + r.total + ' visible tests passed' : r.passed + ' of ' + r.total + ' visible tests passed'}${ok && !canAdvance ? '<span class="faint" style="font-weight:400"> · hidden tests run on submit</span>' : ''}${canAdvance ? `<button class="btn btn-primary btn-sm" id="btn-next-part">Continue to Part ${curPart() + 2}</button>` : ''}</div>` +
        r.results.map(x => `<div class="result ${x.pass ? 'pass' : 'fail'}"><span class="mark">${x.pass ? '✓' : '✕'}</span><span>${esc(x.name)}</span><span class="ms">${x.ms != null ? x.ms.toFixed(1) + ' ms' : ''}</span>
          ${x.pass ? '' : `<div class="detail">${x.error ? `<span>${esc(x.error)}</span>` : `<span><em>expected </em>${esc(x.expected)}</span><span><em>received </em>${esc(x.got)}</span>`}</div>`}</div>`).join('');
    }
    const nb = $('#btn-next-part'); if (nb) nb.onclick = advancePart;
    $('#console-logs').innerHTML = r.logs.length ? r.logs.map(l => `<div class="log-line">${esc(l)}</div>`).join('') : '<p class="console-empty">Your code did not log anything on the last run.</p>';
  }
  function showConsoleTab(which) {
    $$('[data-ctab]').forEach(x => x.setAttribute('aria-selected', String(x.dataset.ctab === which)));
    $('#console-tests').hidden = which !== 'tests';
    $('#console-logs').hidden = which !== 'logs';
  }
  $$('[data-ctab]').forEach(b => b.onclick = () => showConsoleTab(b.dataset.ctab));

  // ---------- Assistant: context and cost ----------
  function buildPreamble(P) {
    return [
      'You are the AI coding assistant built into a live, timed technical interview. The candidate is solving the problem below in JavaScript and may use you freely, as they would a capable pair programmer. The interviewer evaluates how well the candidate directs, questions and verifies your work.',
      '',
      'How to respond:',
      '- Be concise. The candidate pays for every token you read and write from a fixed budget. No preamble, no recap of the question.',
      '- Answer exactly what was asked. If the request is ambiguous, ask one short clarifying question instead of guessing.',
      '- When you write code, put it in a single ' + FENCE + 'js fenced block. If they ask for a full solution, give a complete, runnable function or class with the exact name and signature from the starter code.',
      '- You cannot run code. Never claim that you ran tests. Never guess what hidden tests contain.',
      '- Use plain markdown: short paragraphs, bullet lists, inline code.',
      '',
      'PROBLEM: ' + P.title,
      'Context: ' + P.scenario,
      stripHtml(P.body),
      P.parts.length > 1 ? '\nThis problem has ' + P.parts.length + ' parts and the candidate is on Part ' + (curPart() + 1) + '. Later parts are not revealed yet; do not speculate about them.\n' + P.parts.slice(0, curPart() + 1).map((pt, i) => pt.title + (i < curPart() ? ' (done)' : ' (current)') + '\n' + stripHtml(pt.body)).join('\n\n') : '',
      '',
      'Example:',
      P.examples,
      '',
      'Constraints: ' + P.constraints.join('; '),
      '',
      'Starter signature:',
      P.starter.replace(/\n\s*\/\/ TODO\n/g, '\n').slice(0, 900),
    ].join('\n');
  }
  function lastRunText() {
    const r = sess.lastRun;
    if (!r) return '';
    if (r.compileError) return 'Code failed to load: ' + r.compileError;
    return r.passed + '/' + r.total + ' visible tests passed.\n' + r.results.filter(x => !x.pass).map(x => '- FAIL ' + x.name + ': ' + (x.error ? x.error : 'expected ' + x.expected + ', received ' + x.got)).join('\n').slice(0, 1500);
  }
  function buildRequest(message) {
    const P = problem(sess.problemId);
    const pre = buildPreamble(P);
    const done = sess.turns.filter(t => !t.live && !t.failed);
    const hist = sess.ctx.hist ? done.slice(-MAX_HISTORY_TURNS).map(t => ({ role: t.role, content: t.role === 'user' ? t.message : t.content })) : [];
    let content = message;
    const att = [];
    if (sess.ctx.code) { content += '\n\n[Candidate\'s current code, solution.js]\n' + FENCE + 'js\n' + editor.get() + '\n' + FENCE; att.push('code'); }
    if (sess.ctx.tests && sess.lastRun) { content += '\n\n[Latest visible test run]\n' + lastRunText(); att.push('tests'); }
    const input = [{ role: 'user', content: pre }].concat(hist, [{ role: 'user', content }]);
    const parts = {
      setup: est(pre),
      history: hist.reduce((a, t) => a + est(t.content) + 4, 0),
      code: sess.ctx.code ? est(editor.get()) + 12 : 0,
      tests: sess.ctx.tests && sess.lastRun ? est(lastRunText()) + 8 : 0,
      message: est(message) + 4,
    };
    const inTok = parts.setup + parts.history + parts.code + parts.tests + parts.message;
    return { input, content, inTok, parts, att };
  }
  const remaining = () => Math.max(0, sess.budget - sess.used);
  const MIN_REPLY = 120;

  function renderCtxToggles() {
    if (!sess) return;
    $('#ctx-code').setAttribute('aria-pressed', String(sess.ctx.code));
    $('#ctx-tests').setAttribute('aria-pressed', String(sess.ctx.tests && !!sess.lastRun));
    $('#ctx-tests').disabled = !sess.lastRun;
    $('#ctx-code-n').textContent = '≈' + fmt(est(editor ? editor.get() : sess.code) + 12);
    $('#ctx-tests-n').textContent = sess.lastRun ? '≈' + fmt(est(lastRunText()) + 8) : 'none yet';
    const hb = $('#ctx-hist');
    if (hb) {
      hb.setAttribute('aria-pressed', String(sess.ctx.hist));
      const done = sess.turns.filter(t => !t.live && !t.failed).slice(-MAX_HISTORY_TURNS);
      $('#ctx-hist-n').textContent = done.length ? '≈' + fmt(done.reduce((a, t) => a + est(t.role === 'user' ? t.message : t.content) + 4, 0)) : 'empty';
    }
    renderCost();
  }
  $('#ctx-code').onclick = () => { sess.ctx.code = !sess.ctx.code; renderCtxToggles(); persist(); };
  $('#ctx-tests').onclick = () => { if (!sess.lastRun) return; sess.ctx.tests = !sess.ctx.tests; renderCtxToggles(); persist(); };
  document.addEventListener('click', e => { if (e.target.closest('#ctx-hist')) { sess.ctx.hist = !sess.ctx.hist; renderCtxToggles(); persist(); } });

  function renderCost() {
    if (!sess) return;
    const msg = $('#prompt').value;
    const left = remaining();
    const send = $('#btn-send');
    const cost = $('#cost');
    if (streaming) { send.hidden = true; $('#btn-stop').hidden = false; cost.innerHTML = 'Replying… <b>' + fmt(liveTotal()) + '</b> tokens on this exchange'; cost.classList.remove('over'); renderGauge(0); return; }
    send.hidden = false; $('#btn-stop').hidden = true;
    if (sess.status !== 'active') { send.disabled = true; return; }
    if (left <= 0) {
      cost.innerHTML = ''; send.disabled = true;
      if (!$('#locked-note')) $('#composer').insertAdjacentHTML('afterbegin', '<p class="locked" id="locked-note">Your token budget is spent. The assistant is locked; keep going on your own, then submit.</p>');
      $('#prompt').disabled = true;
      renderGauge(0);
      return;
    }
    const req = buildRequest(msg.trim() || ' ');
    const need = req.inTok + MIN_REPLY;
    const over = need > left;
    cost.classList.toggle('over', over);
    cost.title = 'Instructions and problem ' + fmt(req.parts.setup) + ' · history ' + fmt(req.parts.history) + ' · code ' + fmt(req.parts.code) + ' · test output ' + fmt(req.parts.tests) + ' · message ' + fmt(req.parts.message);
    cost.innerHTML = msg.trim()
      ? (over ? '<b>Needs ≈' + fmt(need) + '</b> with a short reply; ' + fmt(left) + ' left. Detach context to fit.' : 'Sends <b>≈' + fmt(req.inTok) + '</b> tokens + the reply · ' + fmt(left) + ' left')
      : 'Context alone is ≈' + fmt(req.inTok - req.parts.message) + ' tokens · ' + fmt(left) + ' left';
    send.disabled = !msg.trim() || over || agentMode === 'checking';
    renderGauge(msg.trim() && !over ? req.inTok : 0);
  }
  $('#prompt').addEventListener('input', renderCost);
  $('#prompt').addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); if (!$('#btn-send').disabled) sendPrompt(); }
  });
  $('#btn-send').onclick = sendPrompt;
  $('#btn-stop').onclick = () => { if (streaming) streaming.ctl.abort(); };

  function liveTotal() { return streaming ? streaming.turn.inTok + est(streaming.turn.content) : 0; }

  // ---------- Token gauge ----------
  function renderGauge(preview) {
    if (!sess) return;
    const used = sess.used + liveTotal();
    const left = Math.max(0, sess.budget - used);
    $('#g-left').textContent = fmt(left);
    $('#g-of').textContent = 'tokens left of ' + fmt(sess.budget);
    const pct = left / sess.budget;
    $('#gauge').dataset.state = pct <= 0.1 ? 'bad' : pct <= 0.25 ? 'warn' : 'ok';
    const track = $('#g-track');
    track.setAttribute('aria-valuenow', String(used)); track.setAttribute('aria-valuemin', '0'); track.setAttribute('aria-valuemax', String(sess.budget));
    track.setAttribute('aria-valuetext', fmt(left) + ' tokens left of ' + fmt(sess.budget));
    const W = v => clamp(v / sess.budget * 100, 0, 100).toFixed(3) + '%';
    const segs = [];
    const asst = sess.turns.filter(t => t.role === 'assistant' && !t.failed);
    for (const t of asst) {
      const out = t.live ? est(t.content) : t.outTok;
      segs.push(`<span class="gauge-seg${t.live ? ' live' : ''}" style="width:${W(t.inTok + out)}" title="Exchange ${t.n}: ${fmt(t.inTok)} sent, ${fmt(out)} reply"><i class="in" style="width:${(t.inTok / Math.max(1, t.inTok + out) * 100).toFixed(2)}%"></i><i class="out" style="flex:1"></i></span>`);
    }
    if (preview && !streaming) segs.push(`<span class="gauge-preview" style="width:${W(Math.min(preview, left))}" title="This message would send ≈${fmt(preview)} tokens"></span>`);
    track.innerHTML = segs.join('');
  }

  // ---------- Assistant: thread rendering ----------
  function mdInline(s) { return s.replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>'); }
  function mdText(t) {
    const lines = esc(t).split('\n');
    let out = '', list = null, para = [];
    const flushP = () => { if (para.length) { out += '<p>' + mdInline(para.join(' ')) + '</p>'; para = []; } };
    const flushL = () => { if (list) { out += '</' + list + '>'; list = null; } };
    for (const raw of lines) {
      const l = raw.trim(); let m;
      if (!l) { flushP(); flushL(); continue; }
      if ((m = l.match(/^#{1,6}\s+(.*)/))) { flushP(); flushL(); out += '<h4>' + mdInline(m[1]) + '</h4>'; continue; }
      if ((m = l.match(/^[-*•]\s+(.*)/))) { flushP(); if (list !== 'ul') { flushL(); out += '<ul>'; list = 'ul'; } out += '<li>' + mdInline(m[1]) + '</li>'; continue; }
      if ((m = l.match(/^\d+[.)]\s+(.*)/))) { flushP(); if (list !== 'ol') { flushL(); out += '<ol>'; list = 'ol'; } out += '<li>' + mdInline(m[1]) + '</li>'; continue; }
      flushL(); para.push(l);
    }
    flushP(); flushL();
    return out;
  }
  function md(src, key, interactive) {
    const parts = String(src).split(FENCE);
    let html = '';
    parts.forEach((p, i) => {
      if (i % 2 === 1) {
        const nl = p.indexOf('\n');
        const lang = nl >= 0 ? p.slice(0, nl).trim() : '';
        const code = (nl >= 0 ? p.slice(nl + 1) : p).replace(/\n$/, '');
        const id = key + '-' + i;
        codeStore.set(id, code);
        const closed = i < parts.length - 1;
        const dis = !interactive || !closed ? ' disabled' : '';
        html += `<div class="cb"><div class="cb-bar"><span>${esc(lang || 'code')}</span>${interactive ? `<button data-cb="insert" data-id="${id}"${dis}>Insert at cursor</button><button data-cb="replace" data-id="${id}"${dis}>Replace file</button>` : ''}<button data-cb="copy" data-id="${id}"${closed ? '' : ' disabled'}>Copy</button></div><pre><code>${esc(code)}</code></pre></div>`;
      } else if (p.trim()) html += mdText(p);
    });
    return html;
  }
  function turnHTML(t, idx, interactive) {
    if (t.role === 'user') {
      const att = (t.att || []).map(a => `<span class="chip">${a === 'code' ? 'Code attached' : 'Test run attached'}</span>`).join('');
      return `<div class="msg user"><div class="msg-meta"><b>You</b><span>${mmss(t.t)}</span></div><div class="msg-text">${esc(t.message)}</div>${att ? `<div class="msg-attach">${att}</div>` : ''}</div>`;
    }
    const meta = t.live ? 'writing…' : t.failed ? '' : fmt(t.inTok) + ' sent · ' + fmt(t.outTok) + ' reply' + (t.exact ? ' (exact)' : '');
    let body;
    if (t.live && !t.content) body = '<div class="thinking">Thinking</div>';
    else body = `<div class="msg-text">${md(t.content, 'm' + idx, interactive && !t.live)}</div>`;
    const who = t.mode === 'offline' ? 'Practice assistant' : 'Assistant';
    return `<div class="msg agent"><div class="msg-meta"><b>${who}</b><span>${mmss(t.t)}</span><span>${meta}</span></div>${body}${t.note ? `<p class="msg-error">${esc(t.note)}</p>` : ''}</div>`;
  }
  function renderThread() {
    const host = $('#thread');
    if (!sess.turns.length) {
      const P = problem(sess.problemId);
      const S = [
        { text: 'Restate the problem in your own words and list the edge cases I need to handle. No code yet.', code: false },
        { text: 'Propose an approach with its time and space complexity. Keep it to a few bullets.', code: false },
        { text: P.id === 'reconcile' ? 'Review this code against the spec and list every bug you find, with line references. Do not fix them yet.' : 'Review my code for bugs and missed edge cases. Point to lines; do not rewrite it.', code: true },
      ];
      host.innerHTML = `<div class="starters"><p>${agentMode === 'offline' ? esc(offlineReason) + ' ' : ''}The assistant can see the problem. Attach your code when you want it reviewed. Some ways to start:</p>${S.map(s => `<button data-starter="${esc(s.text)}" data-code="${s.code}"><span>${esc(s.text)}</span></button>`).join('')}</div>`;
      $$('[data-starter]', host).forEach(b => b.onclick = () => {
        sess.ctx.code = b.dataset.code === 'true'; renderCtxToggles();
        const p = $('#prompt'); p.value = b.dataset.starter; p.focus(); renderCost();
      });
      return;
    }
    host.innerHTML = sess.turns.map((t, i) => turnHTML(t, i, true)).join('');
    const sc = $('#thread-scroll'); sc.scrollTop = sc.scrollHeight;
  }
  function updateLiveTurn() {
    const last = $('#thread').lastElementChild;
    const i = sess.turns.length - 1;
    if (last) last.outerHTML = turnHTML(sess.turns[i], i, true);
    const sc = $('#thread-scroll');
    if (sc.scrollHeight - sc.scrollTop - sc.clientHeight < 160) sc.scrollTop = sc.scrollHeight;
    renderGauge(0);
    renderCost();
  }
  $('#thread').addEventListener('click', e => {
    const b = e.target.closest('[data-cb]'); if (!b) return;
    const code = codeStore.get(b.dataset.id) || '';
    if (b.dataset.cb === 'copy') {
      navigator.clipboard.writeText(code).then(() => toast('Copied to clipboard'), () => toast('Copy is blocked here. Select the code and copy it manually.'));
      return;
    }
    if (!sess || sess.status !== 'active') return;
    const lines = code.split('\n').length;
    if (b.dataset.cb === 'insert') { editor.insert(code); logEvent('apply', 'Inserted ' + lines + ' lines from the assistant', { lines, mode: 'insert' }); toast('Inserted ' + lines + ' lines at the cursor'); }
    else { editor.set(code); logEvent('apply', 'Replaced the file with ' + lines + ' lines from the assistant', { lines, mode: 'replace' }); toast('Replaced solution.js with the assistant’s code'); }
    if (window.matchMedia('(max-width: 760px)').matches) setMobileTab('pane-editor');
  });

  // ---------- Assistant: sending ----------
  async function sendPrompt() {
    if (!sess || streaming || sess.status !== 'active') return;
    const message = $('#prompt').value.trim();
    if (!message) return;
    const req = buildRequest(message);
    if (req.inTok + MIN_REPLY > remaining()) { renderCost(); return; }
    const P = problem(sess.problemId);
    const n = sess.turns.filter(t => t.role === 'user').length + 1;
    const userTurn = { role: 'user', message, att: req.att, t: elapsed(), n };
    const turn = { role: 'assistant', content: '', inTok: req.inTok, outTok: 0, t: elapsed(), n, live: true, mode: agentMode === 'claude' || agentMode === 'byok' ? agentMode : 'offline', parts: req.parts };
    sess.turns.push(userTurn, turn);
    logEvent('prompt', message.length > 90 ? message.slice(0, 90) + '…' : message, { n, chars: message.length, att: req.att });
    $('#prompt').value = '';
    const ctl = new AbortController();
    streaming = { ctl, turn };
    let budgetCut = false;
    renderThread();
    renderCost();
    const cap = remaining() - req.inTok;
    const onText = ({ text }) => {
      turn.content = text;
      if (est(text) >= cap) { budgetCut = true; ctl.abort(); }
      updateLiveTurn();
    };
    try {
      if (turn.mode === 'claude') {
        await sample(req.input, { onText, signal: ctl.signal, cache: false, modelTier: sess.tier });
      } else if (turn.mode === 'byok') {
        const r = await byokChat(req.input, sess.tier, onText, ctl.signal);
        turn.usage = r.usage;
      } else {
        await offlineStream(offlineReply(message, P), onText, ctl.signal);
      }
    } catch (e) {
      const code = e && e.code;
      if (e && typeof e.text === 'string') turn.content = e.text;
      if (code === 'cancelled') {
        turn.note = budgetCut ? 'Cut off: the token budget ran out mid-reply.' : 'Stopped. Tokens for the part already written were still charged.';
      } else if (['not_granted', 'sampling_disabled', 'not_declared', 'capability_disabled', 'capability_removed', 'session_expired'].includes(code)) {
        setAgentMode('offline', code === 'not_granted' ? 'Claude access was declined for this page, so the built-in practice assistant is answering.' : 'Claude is unavailable for this account, so the built-in practice assistant is answering.');
        turn.mode = 'offline'; turn.content = '';
        try { await offlineStream(offlineReply(message, P), onText, ctl.signal); } catch (_) { /* stopped */ }
        if (!turn.note) turn.note = 'Answered by the practice assistant because Claude was not available.';
      } else if (code === 'bad_key') {
        clearKey(); byok = null;
        setAgentMode('offline', 'Your API key was rejected, so the built-in practice assistant is answering. Reconnect a valid key to use Claude.');
        turn.mode = 'offline'; turn.content = '';
        try { await offlineStream(offlineReply(message, P), onText, ctl.signal); } catch (_) { /* stopped */ }
        turn.note = 'Answered by the practice assistant because your API key was rejected.';
      } else if (code === 'bad_request') {
        turn.note = 'The API rejected the request: ' + ((e && e.message) || 'bad request') + '. No tokens were charged.';
        if (!turn.content) turn.failed = true;
      } else if (code === 'rate_limited') {
        turn.note = 'Claude is rate-limited right now. Wait a minute, then send again. No tokens were charged for the unwritten part.';
        if (!turn.content) turn.failed = true;
      } else if (code === 'refused') {
        turn.content = ''; turn.failed = true; turn.note = 'Claude declined this request. Rephrase it and send again. No tokens were charged.';
      } else {
        turn.note = 'The reply was interrupted (' + (code || 'network error') + '). Send again to retry.';
        if (!turn.content) turn.failed = true;
      }
    }
    turn.live = false;
    if (turn.failed) {
      turn.inTok = 0; turn.outTok = 0;
      sess.turns.splice(sess.turns.indexOf(userTurn), 1);
      $('#prompt').value = message;
    } else {
      if (turn.usage && Number.isFinite(turn.usage.input_tokens)) {
        turn.inTok = (turn.usage.input_tokens || 0) + (turn.usage.cache_read_input_tokens || 0) + (turn.usage.cache_creation_input_tokens || 0);
        turn.outTok = turn.usage.output_tokens || est(turn.content);
        turn.exact = true;
        delete turn.usage;
      } else turn.outTok = est(turn.content);
      sess.used = Math.min(sess.budget, sess.used + turn.inTok + turn.outTok);
      logEvent('reply', 'Assistant replied (' + fmt(turn.inTok + turn.outTok) + ' tokens)', { n, inTok: turn.inTok, outTok: turn.outTok, codeBlocks: (turn.content.split(FENCE).length - 1) >> 1 });
    }
    streaming = null;
    renderThread();
    if (turn.failed) $('#thread').insertAdjacentHTML('beforeend', `<p class="msg-error">${esc(turn.note)}</p>`);
    renderCtxToggles();
    persist(true);
  }

  // ---------- Practice assistant (no Claude available) ----------
  function offlineStream(text, onText, signal) {
    return new Promise((resolve, reject) => {
      let i = 0;
      const step = () => {
        if (signal.aborted) { reject({ code: 'cancelled', text: text.slice(0, i) }); return; }
        i = Math.min(text.length, i + 6 + Math.floor(Math.random() * 18));
        onText({ text: text.slice(0, i) });
        if (signal.aborted) { reject({ code: 'cancelled', text: text.slice(0, i) }); return; }
        if (i >= text.length) resolve({ text }); else setTimeout(step, 22);
      };
      setTimeout(step, 450);
    });
  }
  function offlineReply(msg, P) {
    const m = msg.toLowerCase();
    const o = P.offline;
    const nextHint = () => o.hints[(sess.offlineHint++) % o.hints.length];
    const code = editor.get();
    const failing = sess.lastRun && sess.lastRun.results ? sess.lastRun.results.filter(r => !r.pass) : [];
    if (/(review|look at|check my|feedback|list every bug|find.*bugs?)/.test(m)) {
      const notes = [];
      if (/TODO/.test(code)) notes.push('There are still `TODO` markers, so some methods return `undefined`.');
      if (/\.sort\(\)/.test(code)) notes.push('`.sort()` without a comparator sorts numbers as strings. Use `(a, b) => a - b` for numbers.');
      if (/\.(find|indexOf|includes|filter)\(/.test(code) && /for\s*\(/.test(code)) notes.push('A linear search inside a loop is O(n²) at the stated input sizes. A `Map` or `Set` lookup keeps it linear.');
      if (/console\.log/.test(code)) notes.push('Remove leftover `console.log` calls before you submit.');
      if (/===\s*o\.total|\.amount\s*===|total\s*===/.test(code)) notes.push('Comparing money with `===` on floats is fragile. Convert to integer cents first.');
      if (!notes.length) notes.push('Nothing obviously wrong at a glance. Run the visible tests and probe the edge cases below.');
      return 'A quick review:\n\n' + notes.map(n => '- ' + n).join('\n') + '\n\nEdge cases to check:\n' + o.edge.slice(0, 3).map(e => '- ' + e).join('\n');
    }
    if (/(fail|error|bug|wrong|broken|debug|why does|why is|not work)/.test(m) && (failing.length || (sess.lastRun && sess.lastRun.compileError))) {
      if (sess.lastRun.compileError) return 'Your code does not load yet:\n\n`' + sess.lastRun.compileError + '`\n\nFix that first; nothing else runs until it parses.';
      const f = failing[0];
      return 'The first failing test is **' + f.name + '**. ' + (f.error ? 'It throws `' + f.error + '`.' : 'It expected `' + String(f.expected).slice(0, 160) + '` and received `' + String(f.got).slice(0, 160) + '`.') + '\n\nA likely cause: ' + nextHint();
    }
    if (/(edge|corner|test case|what tests|cases)/.test(m)) return 'Edge cases worth a test:\n\n' + o.edge.map(e => '- ' + e).join('\n') + '\n\nYou can add a quick check with `console.log` and look at the Console tab after a run.';
    if (/(complex|big.?o|performance|faster|slow|optimi|scale)/.test(m)) return o.complexity;
    if (/(write|implement|full|solution|scaffold|skeleton|code for|give me code|starter)/.test(m)) return 'Here is a scaffold that sets up the data structures. The core logic is left as TODOs; tell me which part you want next.\n\n' + FENCE + 'js\n' + o.skeleton + '\n' + FENCE;
    if (/(restate|own words|understand|clarif|summar)/.test(m)) return 'In short: ' + P.scenario + '\n\nWhat matters for correctness:\n' + o.edge.map(e => '- ' + e).join('\n');
    if (/(hint|stuck|approach|idea|how should|how do|plan|start)/.test(m)) return o.approach + '\n\nNext step: ' + nextHint();
    return o.approach + '\n\nI can list edge cases, explain the complexity, review your code, or draft a scaffold. Say which.';
  }

  // ---------- Submission ----------
  $('#btn-submit').onclick = () => {
    if (!sess || sess.status !== 'active') return;
    const P = problem(sess.problemId);
    const lr = sess.lastRun;
    openModal({
      title: 'Submit your solution?',
      sub: 'You cannot edit the code after you submit.',
      body: `<div class="modal-facts"><div><small>Time left</small><b>${mmss(sess.endsAt - Date.now())}</b></div><div><small>Tokens left</small><b>${fmt(remaining())}</b></div><div><small>Last visible run</small><b>${lr ? (lr.compileError ? 'Did not load' : lr.passed + ' / ' + lr.total) : 'Not run'}</b></div></div>
        <p class="muted" style="font-size:14px">${P.hidden.length} hidden tests run next, then the assessment is written.${lr ? '' : ' You have not run the visible tests yet.'}</p>`,
      actions: [{ label: 'Keep working' }, { label: 'Submit solution', kind: 'primary', onClick: () => submit(false) }],
    });
  };

  async function submit(auto) {
    if (!sess || sess.status !== 'active') return;
    if (streaming) streaming.ctl.abort();
    clearInterval(timerHandle);
    sess.status = 'submitted';
    sess.code = editor.get();
    sess.submittedAt = Date.now();
    logEvent('submit', auto ? 'Submitted automatically when time ran out' : 'Submitted the solution');
    store.set(K_ACTIVE, sess);
    const s = sess;
    const P = problem(s.problemId);
    showView('eval');
    const steps = [
      { id: 'vis', label: 'Running visible tests' },
      { id: 'hid', label: 'Running ' + P.hidden.length + ' hidden tests' },
      { id: 'ana', label: 'Measuring how you worked with the assistant' },
      { id: 'ai', label: 'Writing the assessment' },
    ];
    $('#eval-steps').innerHTML = steps.map(x => `<div class="eval-step" data-step="${x.id}" data-s="wait"><span class="st"></span><span>${x.label}</span><span class="st-note"></span></div>`).join('');
    const mark = (id, st, note) => { const el = $(`[data-step="${id}"]`); el.dataset.s = st; if (st === 'done') el.querySelector('.st').textContent = '✓'; if (note != null) el.querySelector('.st-note').textContent = note; };

    mark('vis', 'run');
    const vis = await runTests(s.code, P.tests, 8000);
    const visRes = normResults(vis, P.tests);
    mark('vis', 'done', visRes.filter(r => r.pass).length + ' / ' + P.tests.length);
    mark('hid', 'run');
    const hid = await runTests(s.code, P.hidden, 15000);
    const hidRes = normResults(hid, P.hidden);
    mark('hid', 'done', hidRes.filter(r => r.pass).length + ' / ' + P.hidden.length);
    mark('ana', 'run');
    const metrics = computeMetrics(s, P, visRes, hidRes, vis.compileError || hid.compileError);
    const heur = heuristicAssessment(s, P, metrics);
    await new Promise(r => setTimeout(r, 350));
    mark('ana', 'done');
    mark('ai', 'run');
    let ai = null, source = 'rubric';
    if ((sample && agentMode === 'claude') || (byok && agentMode === 'byok')) {
      $('#eval-note').textContent = 'Claude is reviewing your code, prompts and test results. This usually takes 20 to 60 seconds.';
      try {
        const prompt = buildAssessmentPrompt(s, P, metrics, visRes, hidRes);
        ai = agentMode === 'claude' ? await sample.json(prompt, { modelTier: 'default', cache: false }) : await byokJson(prompt);
        source = 'claude';
      } catch (e) {
        $('#eval-note').textContent = 'Claude could not write the assessment (' + ((e && e.code) || 'error') + '), so the built-in rubric scored it.';
      }
    } else {
      $('#eval-note').textContent = 'Scored with the built-in rubric because Claude is not connected.';
      await new Promise(r => setTimeout(r, 500));
    }
    mark('ai', 'done', source === 'claude' ? 'Claude' : 'Rubric');
    const report = buildReport(s, P, metrics, heur, ai, source, visRes, hidRes, vis.compileError || hid.compileError);
    saveHistory(report);
    store.del(K_ACTIVE);
    sess = null;
    await new Promise(r => setTimeout(r, 400));
    showReport(report);
  }
  function normResults(r, tests) {
    if (r.compileError) return tests.map(t => ({ name: t.name, part: t.part || 0, pass: false, error: r.compileError }));
    return (r.results || []).map((x, i) => ({ name: x.name, part: (tests[i] && tests[i].part) || 0, pass: !!x.pass, got: x.got, expected: x.expected, error: x.error, ms: x.ms }));
  }

  // ---------- Metrics and scoring ----------
  function codeLines(code) {
    return code.split('\n').map(l => l.trim()).filter(l => l.length >= 6 && !/^(\/\/|\/\*|\*|\})/.test(l) && !/^[{}()[\];,]+$/.test(l));
  }
  function computeMetrics(s, P, visRes, hidRes, compileError) {
    const userTurns = s.turns.filter(t => t.role === 'user');
    const asstTurns = s.turns.filter(t => t.role === 'assistant' && !t.failed);
    const prompts = userTurns.map(t => t.message);
    const aiCode = new Set();
    asstTurns.forEach(t => t.content.split(FENCE).forEach((p, i) => { if (i % 2) codeLines(p.replace(/^[^\n]*\n/, '')).forEach(l => aiCode.add(l)); }));
    const finalLines = codeLines(s.code);
    const starterLines = new Set(codeLines(P.starter));
    const authored = finalLines.filter(l => !starterLines.has(l));
    const aiLines = authored.filter(l => aiCode.has(l)).length;
    const applies = s.events.filter(e => e.type === 'apply');
    const runs = s.runs;
    const lastApply = applies.length ? applies[applies.length - 1].t : -1;
    const ranAfterApply = applies.length ? runs.some(r => r.t > lastApply) : runs.length > 0;
    const firstPrompt = userTurns.length ? userTurns[0].t : null;
    const firstApply = applies.length ? applies[0].t : null;
    const rx = (re) => prompts.filter(p => re.test(p.toLowerCase())).length;
    const visPass = visRes.filter(r => r.pass).length;
    const hidPass = hidRes.filter(r => r.pass).length;
    const timeUsed = (s.submittedAt || Date.now()) - s.startedAt;
    const all = visRes.concat(hidRes);
    const partsPassed = P.parts.filter((pt, i) => all.filter(r => r.part === i).every(r => r.pass)).length;
    return {
      partsTotal: P.parts.length, partsReached: Math.min(P.parts.length, (s.part || 0) + 1), partsPassed,
      visPass, visTotal: visRes.length, hidPass, hidTotal: hidRes.length,
      passRate: (visPass + hidPass) / Math.max(1, visRes.length + hidRes.length),
      // Multi-part rounds expect most parts done, not all: two of three fully passing meets the bar.
      gateRate: P.parts.length > 1 && partsPassed / P.parts.length >= 2 / 3 ? Math.max(0.85, (visPass + hidPass) / Math.max(1, visRes.length + hidRes.length)) : (visPass + hidPass) / Math.max(1, visRes.length + hidRes.length),
      compileError: compileError || null,
      prompts: prompts.length,
      avgPromptChars: prompts.length ? Math.round(prompts.reduce((a, p) => a + p.length, 0) / prompts.length) : 0,
      planningPrompts: rx(/(approach|plan|clarif|constraint|edge|complex|trade.?off|restate|understand|why|explain|design)/),
      verifyPrompts: rx(/(test|edge|review|bug|verify|check|wrong|fail|correct)/),
      delegatePrompts: rx(/(write|implement|solve|full solution|complete solution|give me the code|code for)/),
      tokensUsed: s.used, budget: s.budget, tokenPct: s.used / s.budget,
      codeAttachments: userTurns.filter(t => (t.att || []).includes('code')).length,
      applies: applies.length, replaceApplies: applies.filter(a => a.mode === 'replace').length,
      aiLines, authoredLines: authored.length, aiShare: authored.length ? aiLines / authored.length : 0,
      runs: runs.length, ranAfterApply,
      pastes: s.events.filter(e => e.type === 'paste').length,
      notesChars: (s.notes || '').trim().length,
      firstPromptMin: firstPrompt == null ? null : firstPrompt / 60000,
      firstApplyMin: firstApply == null ? null : firstApply / 60000,
      timeUsedMin: timeUsed / 60000, durationMin: s.duration,
      timedOut: s.events.some(e => e.type === 'timeout'),
      codeLines: s.code.split('\n').length,
      hasTodo: /TODO/.test(s.code), hasLogs: /console\.log/.test(s.code),
      tokensPerPass: (visPass + hidPass) ? s.used / (visPass + hidPass) : null,
    };
  }

  function heuristicAssessment(s, P, m) {
    const pct = x => Math.round(x * 100) + '%';
    const d = {};
    // Correctness
    const total = m.visTotal + m.hidTotal, passed = m.visPass + m.hidPass;
    let c = m.passRate >= 1 ? 4 : m.gateRate >= 0.8 ? 3 : m.passRate >= 0.45 ? 2 : 1;
    d.correctness = { score: c, evidence: m.compileError ? 'The submitted code did not load: ' + m.compileError.slice(0, 140) : passed + ' of ' + total + ' tests passed (' + m.visPass + '/' + m.visTotal + ' visible, ' + m.hidPass + '/' + m.hidTotal + ' hidden).' + (m.partsTotal > 1 ? ' Reached Part ' + m.partsReached + ' of ' + m.partsTotal + '; ' + m.partsPassed + ' fully passing.' : ''), improve: c >= 4 ? 'Keep it up: mention the edge cases you covered when you present the solution.' : 'Before submitting, ask which inputs the visible tests do not cover (large inputs, boundaries) and test those yourself.' };
    // Problem decomposition
    let p = 2;
    if (m.notesChars > 60) p++;
    if (m.planningPrompts > 0 && (m.firstApplyMin == null || m.planningPrompts >= 1)) p++;
    if (m.prompts && m.delegatePrompts === m.prompts && m.planningPrompts === 0) p--;
    if (c <= 1) p = Math.min(p, 2);
    p = clamp(p, 1, 4);
    d.problem_solving = { score: p, evidence: [m.notesChars > 60 ? 'Wrote ' + m.notesChars + ' characters of planning notes.' : 'No planning notes.', m.planningPrompts ? (m.planningPrompts === 1 ? '1 prompt was' : m.planningPrompts + ' prompts were') + ' about understanding or approach.' : 'No prompts about approach or constraints before asking for code.', m.firstPromptMin != null ? 'First prompt at ' + m.firstPromptMin.toFixed(1) + ' min.' : ''].join(' ').trim(), improve: 'Spend the first few minutes restating the problem, listing edge cases and choosing a data structure, then ask the assistant to implement a specific plan.' };
    // AI collaboration
    let a;
    if (!m.prompts) a = 2;
    else {
      a = 2;
      if (m.avgPromptChars >= 70) a++;
      if (m.verifyPrompts > 0 || m.planningPrompts > 0) a++;
      if (m.replaceApplies > 0 && m.runs === 0) a--;
      if (m.aiShare > 0.9 && m.prompts <= 1) a--;
    }
    a = clamp(a, 1, 4);
    d.ai_collaboration = { score: a, evidence: m.prompts ? pl(m.prompts, 'prompt') + ' averaging ' + m.avgPromptChars + ' characters; ' + pl(m.applies, 'suggestion') + ' applied; about ' + pct(m.aiShare) + ' of the new lines match assistant code.' : 'The assistant was not used, so this area has little evidence either way.', improve: m.prompts ? 'Give the assistant specific instructions (signature, constraints, the approach you chose) and ask it to justify or test its output instead of accepting it whole.' : 'Try using the assistant for the parts it is good at (boilerplate, edge-case lists, reviews) while you keep ownership of the design.' };
    // Verification
    let v = m.runs >= 3 ? 3 : m.runs >= 1 ? 2 : 1;
    if (m.ranAfterApply && m.verifyPrompts > 0) v++;
    if (m.applies && !m.ranAfterApply) v = Math.min(v, 2);
    v = clamp(v, 1, 4);
    d.verification = { score: v, evidence: 'Ran the visible tests ' + pl(m.runs, 'time') + (m.applies ? (m.ranAfterApply ? ', including after applying assistant code.' : ', but not after the last applied suggestion.') : '.') + (m.verifyPrompts ? ' Asked about tests, edge cases or bugs ' + pl(m.verifyPrompts, 'time') + '.' : ''), improve: 'Run tests after every applied change and add one or two quick checks of your own for the cases the visible tests skip.' };
    // Code quality
    let q = 3;
    if (m.hasTodo) q--;
    if (m.hasLogs) q--;
    if (m.codeLines > 140) q--;
    if (c === 4 && !m.hasTodo && !m.hasLogs && m.codeLines <= 80) q++;
    q = clamp(q, 1, 4);
    d.code_quality = { score: q, evidence: m.codeLines + ' lines submitted' + (m.hasTodo ? ', with TODO markers left in' : '') + (m.hasLogs ? ', with console.log calls left in' : '') + '.', improve: 'Remove debugging output and TODOs, name helpers by what they do, and keep each method short enough to explain out loud.' };
    // Efficiency
    let e = m.tokenPct <= 0.6 ? 4 : m.tokenPct <= 0.85 ? 3 : m.tokenPct < 1 ? 2 : 1;
    if (c <= 2) e = Math.min(e, 2);
    if (m.timedOut) e = Math.max(1, e - 1);
    d.efficiency = { score: e, evidence: 'Used ' + fmt(m.tokensUsed) + ' of ' + fmt(m.budget) + ' tokens (' + pct(m.tokenPct) + ') and ' + m.timeUsedMin.toFixed(1) + ' of ' + m.durationMin + ' minutes' + (m.timedOut ? '; the session timed out.' : '.') + (m.codeAttachments ? ' Attached the full code ' + pl(m.codeAttachments, 'time') + '.' : ''), improve: 'Attach code only when you need a review, turn off history for one-off questions, and ask for short answers. Context is the biggest cost.' };

    const strengths = [], risks = [];
    if (c >= 3) strengths.push('Solution passes ' + passed + ' of ' + total + ' tests, including hidden ones.');
    if (m.notesChars > 60 || m.planningPrompts) strengths.push('Planned before generating code.');
    if (m.ranAfterApply && m.runs >= 2) strengths.push('Verified changes by running the tests repeatedly.');
    if (m.tokenPct <= 0.6 && c >= 3) strengths.push('Finished well inside the token budget.');
    if (!strengths.length) strengths.push('Completed the session and submitted a solution.');
    if (m.hidPass < m.hidTotal) risks.push(pl(m.hidTotal - m.hidPass, 'hidden test') + ' failed: review boundaries and large inputs.');
    if (m.applies && !m.ranAfterApply) risks.push('Applied assistant code without re-running the tests.');
    if (m.aiShare > 0.85 && m.prompts) risks.push('Most of the code came straight from the assistant; be ready to explain every line.');
    if (m.tokenPct >= 0.95) risks.push('Ran out of (or nearly out of) tokens.');
    if (m.pastes) risks.push(pl(m.pastes, 'large paste') + ' from outside the session ' + (m.pastes === 1 ? 'was' : 'were') + ' recorded.');
    return {
      headline: c >= 3 ? 'Working solution with ' + (a >= 3 ? 'deliberate' : 'some') + ' use of the assistant.' : 'The solution is incomplete; ' + (m.prompts ? 'the assistant helped but the result was not fully verified.' : 'more time on verification would help.'),
      summary: 'You passed ' + passed + ' of ' + total + ' tests and used ' + pct(m.tokenPct) + ' of your token budget across ' + pl(m.prompts, 'prompt') + ' in ' + pl(Math.max(1, Math.round(m.timeUsedMin)), 'minute') + '. ' + (m.runs ? 'You ran the visible tests ' + pl(m.runs, 'time') + '.' : 'You never ran the visible tests before submitting.'),
      dims: d, strengths, risks,
      next: ['Re-attempt this problem with half the token budget.', 'Before prompting, write the approach and two edge cases in Notes.', 'Ask the assistant to list inputs that would break your solution, then test them.'],
      codeNotes: [],
    };
  }

  function buildAssessmentPrompt(s, P, m, visRes, hidRes) {
    const transcript = s.turns.filter(t => !t.failed).map(t => t.role === 'user'
      ? '[' + mmss(t.t) + '] CANDIDATE' + ((t.att || []).length ? ' (attached: ' + t.att.join(', ') + ')' : '') + ': ' + t.message.slice(0, 900)
      : '[' + mmss(t.t) + '] ASSISTANT (' + t.inTok + ' in / ' + t.outTok + ' out): ' + t.content.slice(0, 1100)).join('\n\n').slice(-14000);
    const events = s.events.map(e => '[' + mmss(e.t) + '] ' + e.type + ': ' + e.text).join('\n').slice(-3500);
    const tests = visRes.map(r => (P.parts.length > 1 ? 'P' + (r.part + 1) + ' ' : '') + 'visible ' + (r.pass ? 'PASS' : 'FAIL') + ' ' + r.name + (r.pass ? '' : ' :: ' + (r.error || ('expected ' + r.expected + ' got ' + r.got)).slice(0, 200))).concat(hidRes.map(r => (P.parts.length > 1 ? 'P' + (r.part + 1) + ' ' : '') + 'hidden ' + (r.pass ? 'PASS' : 'FAIL') + ' ' + r.name + (r.pass ? '' : ' :: ' + (r.error || ('expected ' + r.expected + ' got ' + r.got)).slice(0, 200)))).join('\n');
    const numbered = s.code.split('\n').map((l, i) => String(i + 1).padStart(3) + '  ' + l).join('\n').slice(0, 12000);
    return [
      'You are a senior engineering interviewer at a large tech company writing the scorecard for an AI-assisted coding interview. The candidate had a coding assistant and a fixed token budget. Judge both the result and how they worked: did they understand and plan, direct the assistant precisely, critically review and verify its output, and manage tokens and time? Rely only on the evidence below. Be direct and specific, cite moments (timestamps, line numbers, prompt wording). Write to the candidate in second person.',
      '',
      'PROBLEM: ' + P.title + ' (' + P.level + ' level, ' + P.difficulty + ')' + (P.format ? '\nFormat: ' + P.format : ''),
      stripHtml(P.body).slice(0, 1800),
      P.parts.length > 1 ? 'PARTS (the candidate unlocks each part by passing the previous part\'s visible tests; reached Part ' + m.partsReached + ' of ' + m.partsTotal + ', ' + m.partsPassed + ' fully passing including hidden tests):\n' + P.parts.map(pt => '- ' + pt.title + ': ' + stripHtml(pt.body).slice(0, 500)).join('\n') : '',
      'Calibrate expectations to the ' + P.level + ' level: ' + (P.level === 'Senior' ? 'expect production judgement (failure modes, scale, design trade-offs) and disciplined use of the assistant.' : P.level === 'New grad' ? 'weight fundamentals, clear reasoning and verification over speed.' : 'expect a working, tested solution and deliberate, well-scoped prompts.'),
      '',
      'WHAT GOOD LOOKS LIKE (interviewer notes): ' + P.rubric,
      '',
      'SESSION: ' + mmss(m.timeUsedMin * 60000) + ' used of ' + s.duration + ' min. Tokens ' + m.tokensUsed + ' of ' + m.budget + '. Prompts ' + m.prompts + '. Test runs ' + m.runs + '. Suggestions applied ' + m.applies + ' (' + m.replaceApplies + ' full-file replacements). New lines matching assistant code: ' + Math.round(m.aiShare * 100) + '%. Planning notes: ' + m.notesChars + ' chars. External pastes: ' + m.pastes + '.' + (m.timedOut ? ' The session timed out.' : ''),
      s.notes && s.notes.trim() ? '\nCANDIDATE NOTES:\n' + s.notes.trim().slice(0, 1500) : '',
      '',
      'TEST RESULTS (' + (m.visPass + m.hidPass) + '/' + (m.visTotal + m.hidTotal) + '):',
      tests,
      '',
      'FINAL CODE (line-numbered):',
      numbered,
      '',
      'EVENT LOG:',
      events,
      '',
      'TRANSCRIPT:',
      transcript || '(The candidate did not use the assistant.)',
      '',
      'Reply with only one JSON object of this shape:',
      '{"headline": "one sentence verdict-style takeaway", "summary": "3-4 sentences", "dimensions": [{"id": "correctness" | "problem_solving" | "ai_collaboration" | "verification" | "code_quality" | "efficiency", "score": 1-4, "evidence": "1-2 sentences citing specifics", "improve": "one concrete action"}], "strengths": ["..."], "risks": ["..."], "next_steps": ["3 concrete practice actions"], "code_notes": [{"line": 12, "note": "specific review comment"}]}',
      'Include all six dimension ids exactly once. Scores: 1 below bar, 2 mixed, 3 meets bar, 4 exceeds. Give 2-4 strengths, 1-4 risks, 2-5 code_notes.',
    ].join('\n');
  }

  function buildReport(s, P, m, heur, ai, source, visRes, hidRes, compileError) {
    const dims = {};
    DIMS.forEach(D => {
      const h = heur.dims[D.id];
      const a = ai && Array.isArray(ai.dimensions) ? ai.dimensions.find(x => x && x.id === D.id) : null;
      let score = a && Number.isFinite(+a.score) ? clamp(Math.round(+a.score), 1, 4) : h.score;
      if (D.id === 'correctness') score = clamp(score, h.score - 1, h.score + 1);
      if (D.id === 'correctness' && m.gateRate < 0.45) score = Math.min(score, 1);
      dims[D.id] = { score, evidence: (a && a.evidence) || h.evidence, improve: (a && a.improve) || h.improve };
    });
    const overall = DIMS.reduce((acc, D) => acc + dims[D.id].score * D.weight, 0);
    let verdict = overall >= 3.5 ? 'strong_hire' : overall >= 3.0 ? 'hire' : overall >= 2.5 ? 'lean_hire' : overall >= 1.8 ? 'lean_no_hire' : 'no_hire';
    const rank = ['no_hire', 'lean_no_hire', 'lean_hire', 'hire', 'strong_hire'];
    if (m.gateRate < 0.5 && rank.indexOf(verdict) > 1) verdict = 'lean_no_hire';
    if (m.gateRate < 0.2) verdict = 'no_hire';
    if (m.gateRate < 0.85 && rank.indexOf(verdict) > 2) verdict = 'lean_hire';
    const arr = (x, f) => Array.isArray(x) && x.length ? x.filter(v => typeof v === 'string' && v.trim()).slice(0, 5) : f;
    return {
      id: s.id, date: s.submittedAt || Date.now(), name: s.name, problemId: P.id, title: P.title, team: P.team, difficulty: P.difficulty, level: P.level,
      budget: s.budget, used: s.used, duration: s.duration, tier: s.tier, source,
      verdict, overall,
      headline: (ai && typeof ai.headline === 'string' && ai.headline) || heur.headline,
      summary: (ai && typeof ai.summary === 'string' && ai.summary) || heur.summary,
      dims, metrics: m,
      strengths: arr(ai && ai.strengths, heur.strengths),
      risks: arr(ai && ai.risks, heur.risks),
      next: arr(ai && ai.next_steps, heur.next),
      codeNotes: ai && Array.isArray(ai.code_notes) ? ai.code_notes.filter(n => n && typeof n.note === 'string').slice(0, 6) : [],
      tests: { visible: visRes, hidden: hidRes, compileError: compileError || null },
      turns: s.turns.filter(t => !t.failed).map(t => ({ role: t.role, message: t.message, content: t.content, att: t.att, t: t.t, n: t.n, inTok: t.inTok, outTok: t.outTok, mode: t.mode, note: t.note })),
      events: s.events, runs: s.runs, code: s.code, notes: s.notes || '',
    };
  }
  function saveHistory(r) {
    const h = store.get(K_HISTORY, []);
    h.unshift({ id: r.id, date: r.date, title: r.title, problemId: r.problemId, level: r.level, name: r.name, verdict: r.verdict, overall: r.overall, budget: r.budget, used: r.used, testsPassed: r.metrics.visPass + r.metrics.hidPass, testsTotal: r.metrics.visTotal + r.metrics.hidTotal, report: r });
    // Full reports for the latest 15 sessions; older ones keep a compact summary for the progress view.
    store.set(K_HISTORY, h.slice(0, 60).map((x, i) => i < 15 ? x : compactRecord(x)));
  }

  function compactRecord(x) {
    if (!x.report) return x;
    const r = x.report, c = Object.assign({}, x);
    delete c.report;
    c.dims = {}; Object.keys(r.dims).forEach(k => { c.dims[k] = { score: r.dims[k].score }; });
    c.metrics = r.metrics;
    c.problemId = r.problemId; c.level = r.level;
    return c;
  }

  // ---------- Report ----------
  function showReport(r) {
    showView('report');
    const m = r.metrics;
    const D = r.dims;
    const tok = r.turns.filter(t => t.role === 'assistant');
    const pct = x => Math.round(x * 100) + '%';
    $('#report').innerHTML = `
      <div class="report-head">
        <div>
          <div class="meta"><span>${esc(r.name || 'Candidate')}</span><span>${esc(r.title)} · ${esc(r.team)} · ${r.level ? esc(r.level) + ' · ' : ''}${r.difficulty}</span><span>${new Date(r.date).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}</span><span>Session ${esc(r.id)}</span></div>
          <h1>${esc(r.headline)}</h1>
          <p class="summary">${esc(r.summary)}</p>
        </div>
        <div class="score-block">
          <span class="verdict big v-${r.verdict}">${VERDICTS[r.verdict]}</span>
          <div class="score-big">${r.overall.toFixed(1)}<small> / 4</small></div>
          <p class="source-note">${r.source === 'claude' ? 'Evidence written by Claude; scores weighted by the rubric below.' : 'Scored by the built-in rubric (Claude was not connected).'}</p>
        </div>
      </div>

      <div class="stat-row" style="--cols:${m.partsTotal > 1 ? 6 : 5}">
        <div class="stat"><small>Tests passed</small><b>${m.visPass + m.hidPass}<span class="faint" style="font-size:15px"> / ${m.visTotal + m.hidTotal}</span></b><span>${m.hidPass}/${m.hidTotal} hidden</span></div>
        ${m.partsTotal > 1 ? `<div class="stat"><small>Parts</small><b>${m.partsPassed}<span class="faint" style="font-size:15px"> / ${m.partsTotal}</span></b><span>fully passing · reached Part ${m.partsReached}</span></div>` : ''}
        <div class="stat"><small>Tokens used</small><b>${fmt(r.used)}</b><span>${pct(m.tokenPct)} of ${kfmt(r.budget)}</span></div>
        <div class="stat"><small>Time used</small><b>${mmss(m.timeUsedMin * 60000)}</b><span>of ${r.duration}:00${m.timedOut ? ', timed out' : ''}</span></div>
        <div class="stat"><small>Prompts</small><b>${m.prompts}</b><span>${m.applies} applied · ${pct(m.aiShare)} AI lines</span></div>
        <div class="stat"><small>Test runs</small><b>${m.runs}</b><span>${m.ranAfterApply ? 'verified after changes' : m.applies ? 'not re-run after last apply' : 'before submitting'}</span></div>
      </div>

      <section class="r-section">
        <h2>Scorecard</h2>
        <div class="rubric">${DIMS.map(x => `
          <div class="rubric-row">
            <div><h3>${x.label}</h3><span class="weight">${x.desc} · ${Math.round(x.weight * 100)}% weight</span></div>
            <div><div class="pips" data-s="${D[x.id].score}" aria-label="${D[x.id].score} of 4"><i></i><i></i><i></i><i></i></div><span class="pips-label">${D[x.id].score} · ${SCORE_WORDS[D[x.id].score]}</span></div>
            <div class="ev"><p>${esc(D[x.id].evidence)}</p><p class="imp"><b>Next time:</b> ${esc(D[x.id].improve)}</p></div>
          </div>`).join('')}
        </div>
      </section>

      <div class="two-col">
        <div class="listbox"><h3>Strengths</h3><ul>${r.strengths.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>
        <div class="listbox"><h3>Risks an interviewer would flag</h3><ul>${(r.risks.length ? r.risks : ['None stood out.']).map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>
      </div>

      <section class="r-section">
        <h2>Token budget over the session</h2>
        <div class="chart-box">
          ${tokenChart(r)}
          <div class="chart-legend"><span><i style="background:var(--accent)"></i>Cumulative tokens</span><span><i style="background:var(--bad);height:2px"></i>Budget</span><span><i style="background:var(--ink-3);height:2px"></i>Submitted at ${mmss(r.metrics.timeUsedMin * 60000)} of ${r.duration}:00</span></div>
          ${tok.length ? `<div class="tbl-wrap"><table class="turn-table"><thead><tr><th>#</th><th>Time</th><th>Prompt</th><th class="n">Sent</th><th class="n">Reply</th><th class="n">Total</th></tr></thead><tbody>
            ${tok.map(t => { const u = r.turns.find(x => x.role === 'user' && x.n === t.n); return `<tr><td class="n">${t.n}</td><td class="n">${mmss(t.t)}</td><td>${esc((u && u.message || '').slice(0, 110))}${u && u.message.length > 110 ? '…' : ''}${u && (u.att || []).length ? ' <span class="chip">' + u.att.join(' + ') + '</span>' : ''}</td><td class="n">${fmt(t.inTok)}</td><td class="n">${fmt(t.outTok)}</td><td class="n">${fmt(t.inTok + t.outTok)}</td></tr>`; }).join('')}
          </tbody></table></div>` : '<p class="muted" style="font-size:14px">The assistant was not used in this session.</p>'}
        </div>
      </section>

      <div class="tests-grid">
        <section class="r-section"><h2>Tests</h2>${testTable(r)}</section>
        <section class="r-section"><h2>Timeline</h2><div class="timeline">${r.events.map(e => `<div class="tl-row"><time>${mmss(e.t)}</time><i class="${e.type}"></i><span>${esc(e.text)}</span></div>`).join('')}</div></section>
      </div>

      <section class="r-section">
        <h2>Submitted code</h2>
        ${r.codeNotes.length ? `<ul class="code-notes">${r.codeNotes.map(n => `<li>${n.line ? '<b>Line ' + esc(n.line) + ':</b> ' : ''}${esc(n.note)}</li>`).join('')}</ul>` : ''}
        <pre class="code-out"><code>${esc(r.code)}</code></pre>
      </section>

      <div class="two-col">
        <div class="listbox"><h3>What to practise next</h3><ul>${r.next.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>
        <div class="listbox"><h3>Interviewer follow-ups for this problem</h3><ul>${problem(r.problemId).followUps.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>
      </div>

      <section class="r-section">
        <h2>Debrief</h2>
        <div class="debrief" id="debrief"></div>
      </section>

      ${refSolutionHTML(r)}

      ${r.turns.length ? `<details class="transcript"><summary>Assistant transcript (${tok.length} exchanges)</summary><div class="thread">${r.turns.map((t, i) => turnHTML(Object.assign({ live: false }, t), 'r' + i, false)).join('')}</div></details>` : ''}

      <div class="report-actions">
        <button class="btn btn-primary" id="btn-again">Try this problem again</button>
        <button class="btn" id="btn-lobby">Choose another problem</button>
      </div>`;
    $('#btn-again').onclick = () => { prefs.problemId = r.problemId; savePrefs(); showView('lobby'); renderLobby(); openBriefing(); };
    $('#btn-lobby').onclick = () => { showView('lobby'); renderLobby(); };
    renderDebrief(r);
    window.scrollTo(0, 0);
  }
  // ---------- Shared AI helper for the debrief and practice plan (not metered) ----------
  const aiReady = () => (agentMode === 'claude' && sample) || (agentMode === 'byok' && byok);
  async function aiText(system, messages, onText, signal) {
    const input = [{ role: 'user', content: system }].concat(messages);
    if (agentMode === 'claude' && sample) {
      const r = await sample(input, { onText: onText ? (x => onText(x.text)) : undefined, signal, cache: false, modelTier: 'default' });
      return r.text;
    }
    if (agentMode === 'byok' && byok) {
      const r = await byokChat(input, 'default', onText ? (x => onText(x.text)) : null, signal);
      return r.text;
    }
    return null;
  }

  // ---------- Debrief (scorecard follow-up chat) ----------
  function debriefContext(r) {
    const P = problem(r.problemId);
    const failing = r.tests.visible.concat(r.tests.hidden).filter(x => !x.pass).slice(0, 12)
      .map(x => '- ' + (r.metrics.partsTotal > 1 ? 'P' + ((x.part || 0) + 1) + ' ' : '') + x.name + ': ' + (x.error || ('expected ' + String(x.expected).slice(0, 120) + ', got ' + String(x.got).slice(0, 120))));
    const prompts = r.turns.filter(t => t.role === 'user').map(t => '[' + mmss(t.t) + '] ' + t.message.slice(0, 300)).join('\n').slice(-3000);
    return [
      'You are the interviewer, now debriefing the candidate after an AI-assisted coding interview you scored. Be candid, specific and kind. Cite evidence from the session (timestamps, prompts, test names, code lines). Keep answers under 180 words unless they ask for more. When useful, end with one concrete drill.',
      '',
      'PROBLEM: ' + P.title + ' (' + (r.level || P.level) + ', ' + r.difficulty + ')',
      stripHtml(P.body).slice(0, 1200),
      P.parts.length > 1 ? 'Parts: ' + P.parts.map(pt => pt.title).join(' | ') + '. Reached Part ' + r.metrics.partsReached + ', fully passed ' + r.metrics.partsPassed + '.' : '',
      'REFERENCE APPROACH: ' + P.offline.approach + ' ' + P.offline.complexity,
      '',
      'SCORECARD: verdict ' + VERDICTS[r.verdict] + ', overall ' + r.overall.toFixed(1) + '/4. ' + r.headline,
      DIMS.map(D => D.label + ': ' + r.dims[D.id].score + '/4. ' + r.dims[D.id].evidence).join('\n'),
      'Tests: ' + (r.metrics.visPass + r.metrics.hidPass) + '/' + (r.metrics.visTotal + r.metrics.hidTotal) + ' passed.' + (failing.length ? '\nFailing:\n' + failing.join('\n') : ''),
      'Tokens ' + r.used + '/' + r.budget + ', ' + r.metrics.prompts + ' prompts, ' + r.metrics.runs + ' test runs, ' + Math.round(r.metrics.aiShare * 100) + '% of new lines from the assistant.',
      '',
      'CANDIDATE PROMPTS:', prompts || '(none)',
      '',
      'SUBMITTED CODE:', r.code.slice(0, 6000),
    ].join('\n');
  }
  function offlineDebrief(r, q) {
    const m = q.toLowerCase();
    const P = problem(r.problemId);
    const weakest = DIMS.slice().sort((a, b) => r.dims[a.id].score - r.dims[b.id].score || b.weight - a.weight).slice(0, 2);
    const failing = r.tests.visible.concat(r.tests.hidden).filter(x => !x.pass);
    if (/(fail|test|bug|wrong|hidden)/.test(m)) {
      if (!failing.length) return 'Every test passed. The interesting question is whether you could explain why: walk through ' + P.offline.edge.slice(0, 2).map(e => '`' + e + '`').join(' and ') + ' out loud.';
      return 'Failing tests:\n\n' + failing.slice(0, 6).map(x => '- **' + x.name + '**: ' + (x.error || 'expected `' + String(x.expected).slice(0, 80) + '`, got `' + String(x.got).slice(0, 80) + '`')).join('\n') + '\n\nEdge cases this problem is known for:\n' + P.offline.edge.map(e => '- ' + e).join('\n');
    }
    if (/(solution|approach|optimal|reference|how would|strong candidate)/.test(m)) return P.offline.approach + '\n\n' + P.offline.complexity + '\n\nThe full reference solution is in the section above.';
    return 'Your two weakest areas this session:\n\n' + weakest.map(D => '- **' + D.label + '** (' + r.dims[D.id].score + '/4): ' + r.dims[D.id].improve).join('\n') + '\n\nDrill: ' + DRILLS[weakest[0].id][0] + '\n\nConnect Claude for a conversational debrief that reads your transcript and code.';
  }
  let debriefStream = null;
  function renderDebrief(r) {
    const host = $('#debrief'); if (!host) return;
    const turns = r.debrief || [];
    const S = ['What should I work on first?', 'Why did my failing tests fail?', 'How would a strong candidate have used the assistant here?', 'Walk me through the reference approach.'];
    host.innerHTML = `<div class="thread">${turns.length ? turns.map((t, i) => t.role === 'user'
      ? `<div class="msg user"><div class="msg-meta"><b>You</b></div><div class="msg-text">${esc(t.content)}</div></div>`
      : `<div class="msg agent"><div class="msg-meta"><b>Interviewer</b><span>${t.live ? 'writing…' : t.mode === 'offline' ? 'from your scorecard' : ''}</span></div><div class="msg-text">${t.content ? md(t.content, 'd' + i, false) : '<div class="thinking">Thinking</div>'}</div></div>`).join('')
      : `<div class="starters"><p>Ask about your session. ${aiReady() ? 'Claude has your scorecard, prompts, tests and code.' : 'Claude is not connected, so answers come from your scorecard.'} This does not use your interview budget.</p>${S.map(x => `<button data-dq="${esc(x)}"><span>${esc(x)}</span></button>`).join('')}</div>`}</div>
      <form class="debrief-form" id="debrief-form"><input class="field" id="debrief-q" placeholder="Ask the interviewer about this session" autocomplete="off"${debriefStream ? ' disabled' : ''}><button class="btn btn-primary" ${debriefStream ? 'disabled' : ''}>Ask</button></form>`;
    $$('[data-dq]', host).forEach(b => b.onclick = () => askDebrief(r, b.dataset.dq));
    $('#debrief-form').onsubmit = e => { e.preventDefault(); const q = $('#debrief-q').value.trim(); if (q) askDebrief(r, q); };
  }
  async function askDebrief(r, q) {
    if (debriefStream) return;
    r.debrief = r.debrief || [];
    r.debrief.push({ role: 'user', content: q.slice(0, 1500) });
    const turn = { role: 'assistant', content: '', live: true, mode: aiReady() ? agentMode : 'offline' };
    r.debrief.push(turn);
    const ctl = new AbortController();
    debriefStream = ctl;
    renderDebrief(r);
    const paint = text => { turn.content = text; const el = $$('#debrief .msg.agent .msg-text').pop(); if (el) el.innerHTML = md(text, 'dl', false); };
    try {
      if (turn.mode === 'offline') await offlineStream(offlineDebrief(r, q), x => paint(x.text), ctl.signal);
      else {
        const msgs = r.debrief.slice(0, -1).slice(-10).map(t => ({ role: t.role, content: t.content }));
        turn.content = await aiText(debriefContext(r), msgs, paint, ctl.signal) || turn.content;
      }
    } catch (e) {
      turn.content = (e && e.text) || '';
      if (!turn.content) { turn.mode = 'offline'; turn.content = offlineDebrief(r, q) + '\n\n(Claude could not answer: ' + ((e && e.code) || 'error') + '.)'; }
    }
    turn.live = false;
    debriefStream = null;
    const h = store.get(K_HISTORY, []);
    const rec = h.find(x => x.id === r.id);
    if (rec && rec.report) { rec.report.debrief = r.debrief.slice(-20); store.set(K_HISTORY, h); }
    renderDebrief(r);
    const f = $('#debrief-q'); if (f) f.focus();
  }

  // ---------- Progress review across sessions ----------
  const DRILLS = {
    correctness: ['Before you submit, write three inputs the visible tests skip (empty, boundary, largest size) and check them with console.log.', 'On multi-part problems, re-run the earlier parts after every change; later parts often break them.', 'Read the constraints first and name the complexity you need before choosing a data structure.'],
    problem_solving: ['Spend the first three to five minutes in Notes: restate the task, list edge cases, pick the data structure.', 'Ask the assistant to critique your plan before you ask it for code.', 'Split the work into named steps and prompt for one step at a time.'],
    ai_collaboration: ['Put the signature, the constraints and your chosen approach in one precise prompt.', 'Ask for one function at a time instead of the whole file.', 'Before applying a reply, ask what input would break it.'],
    verification: ['Run the tests after every applied suggestion, no exceptions.', 'Add one check of your own for each bug you fix.', 'Ask the assistant for edge cases, then test them yourself instead of trusting its answer.'],
    code_quality: ['Remove console.log calls and TODOs before you submit.', 'Name helpers by what they return and keep methods short enough to explain out loud.', 'Read assistant code line by line and rename anything unclear.'],
    efficiency: ['Redo a problem you solved with a 5k budget.', 'Detach History and Code for questions that do not need them.', 'Ask for short answers: "bullets only, no code".'],
  };
  function historyRows() {
    return store.get(K_HISTORY, []).map(x => {
      const r = x.report;
      const pid = x.problemId || (r && r.problemId) || (PROBLEMS.find(p => p.title === x.title) || {}).id;
      const P = PROBLEMS.find(p => p.id === pid);
      return {
        id: x.id, date: x.date, title: x.title, problemId: pid, level: x.level || (r && r.level) || (P && P.level) || '',
        verdict: x.verdict, overall: x.overall, used: x.used, budget: x.budget,
        dims: (r && r.dims) || x.dims || {}, m: (r && r.metrics) || x.metrics || {}, hasReport: !!r,
      };
    }).filter(x => x.dims && Object.keys(x.dims).length).reverse(); // oldest first
  }
  const avg = a => a.length ? a.reduce((s, v) => s + v, 0) / a.length : null;
  function progressStats(rows) {
    const dimStats = DIMS.map(D => {
      const all = rows.map(r => r.dims[D.id] && r.dims[D.id].score).filter(v => v != null);
      const recent = all.slice(-3), earlier = all.slice(0, -3);
      return { D, all: avg(all), recent: avg(recent), earlier: avg(earlier), n: all.length };
    });
    const focus = dimStats.slice().sort((a, b) => (a.recent - b.recent) || (b.D.weight - a.D.weight)).filter(d => d.recent != null && d.recent < 3.5).slice(0, 2);
    const pctOf = (f, list) => list.length ? list.filter(f).length / list.length : null;
    const ms = rows.map(r => r.m);
    const withApply = ms.filter(m => m.applies);
    const habits = [
      { label: 'Wrote planning notes', v: pctOf(m => m.notesChars > 60, ms), fmt: 'pct', target: 0.8, good: v => v >= 0.8, tip: 'Plan in Notes before prompting.' },
      { label: 'Asked about the approach before code', v: pctOf(m => m.planningPrompts > 0, ms), fmt: 'pct', target: 0.8, good: v => v >= 0.8, tip: 'Open with a plan or edge-case prompt.' },
      { label: 'Re-ran tests after applying assistant code', v: pctOf(m => m.ranAfterApply, withApply), fmt: 'pct', target: 1, good: v => v >= 0.99, tip: 'Run tests after every apply.' },
      { label: 'Test runs per session', v: avg(ms.map(m => m.runs || 0)), fmt: 'num', target: 3, good: v => v >= 3, tip: 'Run early and often.' },
      { label: 'Share of the token budget used', v: avg(ms.map(m => m.tokenPct || 0)), fmt: 'pct', target: 0.7, good: v => v <= 0.7, tip: 'Attach less context; ask for shorter replies.', lower: true },
      { label: 'New lines taken from the assistant', v: avg(ms.filter(m => m.authoredLines).map(m => m.aiShare)), fmt: 'pct', target: 0.7, good: v => v <= 0.7, tip: 'Fine if you can explain every line; otherwise write more yourself.', lower: true },
      { label: 'Minutes before the first prompt', v: avg(ms.filter(m => m.firstPromptMin != null).map(m => m.firstPromptMin)), fmt: 'min', target: 2, good: v => v >= 2, tip: 'Read and plan for a couple of minutes first.' },
    ];
    const used = new Set();
    focus.forEach(f => { f.rec = recommendFor(rows, f.D.id, used); used.add(f.rec.P.id); });
    return { dimStats, focus, habits };
  }
  function recommendFor(rows, dimId, exclude) {
    const ok = p => !exclude || !exclude.has(p.id);
    const tried = new Map();
    rows.forEach(r => { const b = tried.get(r.problemId); if (!b || r.overall > b) tried.set(r.problemId, r.overall); });
    const levelCounts = {};
    rows.forEach(r => { if (r.level) levelCounts[r.level] = (levelCounts[r.level] || 0) + 1; });
    const myLevel = Object.keys(levelCounts).sort((a, b) => levelCounts[b] - levelCounts[a])[0] || 'Mid-level';
    const fresh = PROBLEMS.filter(p => !tried.has(p.id) && ok(p));
    const sameLevel = fresh.filter(p => p.level === myLevel);
    // Verification and correctness drills suit staged problems; efficiency suits a redo on a tight budget.
    if (dimId === 'efficiency') {
      const best = [...tried.entries()].filter(e => ok(problem(e[0]))).sort((a, b) => b[1] - a[1])[0];
      if (best) return { P: problem(best[0]), budget: 5000, why: 'Redo a problem you know on a 5k budget.' };
    }
    const pool = (dimId === 'verification' || dimId === 'correctness') ? sameLevel.filter(p => p.parts.length > 1).concat(sameLevel) : sameLevel;
    if (pool.length) return { P: pool[0], why: 'Not tried yet, at your usual level (' + myLevel + ').' };
    if (fresh.length) return { P: fresh[0], why: 'Not tried yet.' };
    const worst = [...tried.entries()].sort((a, b) => a[1] - b[1])[0] || [PROBLEMS[0].id];
    return { P: problem(worst[0]), why: 'Your lowest score so far.' };
  }
  function trendChart(rows) {
    const W = 720, H = 200, L = 40, R = 16, T = 14, B = 26;
    const n = rows.length;
    const x = i => n === 1 ? (L + W - R) / 2 : L + i * (W - L - R) / (n - 1);
    const y = v => T + (1 - (v - 1) / 3) * (H - T - B);
    const grid = [1, 2, 3, 4].map(v => `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="var(--line-2)"></line><text x="${L - 8}" y="${y(v) + 4}" text-anchor="end" font-size="11" fill="var(--ink-3)">${v}</text>`).join('');
    const bar = `<line x1="${L}" x2="${W - R}" y1="${y(3)}" y2="${y(3)}" stroke="var(--ok)" stroke-dasharray="5 4" stroke-width="1.5"></line><text x="${W - R}" y="${y(3) - 6}" text-anchor="end" font-size="11" fill="var(--ok)">Hire bar</text>`;
    const path = rows.map((r, i) => (i ? 'L' : 'M') + x(i).toFixed(1) + ',' + y(r.overall).toFixed(1)).join(' ');
    const dots = rows.map((r, i) => `<circle cx="${x(i).toFixed(1)}" cy="${y(r.overall).toFixed(1)}" r="4.5" class="dot-${r.verdict}"><title>${esc(r.title)}: ${r.overall.toFixed(1)} (${VERDICTS[r.verdict]}), ${new Date(r.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</title></circle>`).join('');
    return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Overall score for each of your last ${n} sessions">${grid}${bar}<path d="${path}" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linejoin="round"></path>${dots}</svg>`;
  }
  function offlinePlan(rows, st) {
    const lines = ['**Your next week**', ''];
    st.focus.forEach((f, i) => {
      const rec = f.rec;
      lines.push('- **Session ' + (i + 1) + ':** ' + rec.P.title + (rec.budget ? ' on a ' + kfmt(rec.budget) + ' budget' : '') + '. Focus on ' + f.D.label.toLowerCase() + ': ' + DRILLS[f.D.id][0]);
    });
    const weakHabit = st.habits.find(h => h.v != null && !h.good(h.v));
    if (weakHabit) lines.push('- **Every session:** ' + weakHabit.tip);
    lines.push('- **Then:** redo your lowest-scoring problem and compare the two scorecards.');
    return lines.join('\n');
  }
  function renderProgress() {
    showView('progress');
    const rows = historyRows();
    const host = $('#progress');
    if (!rows.length) {
      host.innerHTML = `<div class="report-head"><div><h1>Your progress</h1><p class="summary">Finish an interview and this page will show your score trend, your rubric averages, the habits that cost you points and what to practise next.</p></div></div><div class="report-actions"><button class="btn btn-primary" id="pg-start">Choose a problem</button></div>`;
      $('#pg-start').onclick = () => { showView('lobby'); renderLobby(); };
      window.scrollTo(0, 0);
      return;
    }
    const st = progressStats(rows);
    const recent = rows.slice(-5), prior = rows.slice(-10, -5);
    const recentAvg = avg(recent.map(r => r.overall)), priorAvg = avg(prior.map(r => r.overall));
    const covered = new Set(rows.map(r => r.problemId));
    const hires = rows.filter(r => r.verdict === 'hire' || r.verdict === 'strong_hire').length;
    const fmtV = (h, v) => v == null ? '–' : h.fmt === 'pct' ? Math.round(v * 100) + '%' : h.fmt === 'min' ? v.toFixed(1) + ' min' : v.toFixed(1);
    const fmtT = h => h.target === 1 && h.fmt === 'pct' ? '100%' : (h.lower ? '≤ ' : '≥ ') + (h.fmt === 'pct' ? Math.round(h.target * 100) + '%' : h.fmt === 'min' ? h.target + ' min' : h.target);
    const byProblem = new Map();
    rows.forEach(r => { const a = byProblem.get(r.problemId) || []; a.push(r); byProblem.set(r.problemId, a); });
    host.innerHTML = `
      <div class="report-head">
        <div>
          <div class="meta"><span>${pl(rows.length, 'session')}</span><span>Stored in this browser</span></div>
          <h1>${st.focus.length ? 'Work on ' + st.focus.map(f => f.D.label.toLowerCase()).join(' and ') + ' next.' : 'You are meeting the bar in every area. Raise the level.'}</h1>
          <p class="summary">${st.focus.length ? 'These are your lowest-scoring rubric areas over your last three sessions. Each comes with drills and a problem to practise them on.' : 'Your recent sessions meet the bar everywhere. Try a harder level or a tighter budget.'}</p>
        </div>
        <div class="score-block">
          <div class="score-big">${recentAvg.toFixed(1)}<small> / 4</small></div>
          <p class="source-note">Average of your last ${pl(recent.length, 'session')}${priorAvg != null ? ', ' + (recentAvg - priorAvg >= 0 ? 'up ' : 'down ') + Math.abs(recentAvg - priorAvg).toFixed(1) + ' on the five before' : ''}.</p>
        </div>
      </div>

      <div class="stat-row" style="--cols:4">
        <div class="stat"><small>Sessions</small><b>${rows.length}</b><span>${hires} at hire or above</span></div>
        <div class="stat"><small>Problems tried</small><b>${covered.size}<span class="faint" style="font-size:15px"> / ${PROBLEMS.length}</span></b><span>${LEVELS.map(l => rows.filter(r => r.level === l).length + ' ' + l.toLowerCase()).join(', ')}</span></div>
        <div class="stat"><small>Best score</small><b>${Math.max(...rows.map(r => r.overall)).toFixed(1)}</b><span>${esc(rows.slice().sort((a, b) => b.overall - a.overall)[0].title)}</span></div>
        <div class="stat"><small>Average tokens</small><b>${Math.round(avg(rows.map(r => (r.m.tokenPct || 0))) * 100)}%</b><span>of the budget</span></div>
      </div>

      ${st.focus.length ? `<section class="r-section"><h2>Focus areas</h2><div class="focus-grid">${st.focus.map(f => {
        const rec = f.rec;
        const last = rows.slice().reverse().find(r => r.hasReport);
        const lastRep = last ? (store.get(K_HISTORY, []).find(x => x.id === last.id) || {}).report : null;
        const ev = lastRep && lastRep.dims[f.D.id] ? lastRep.dims[f.D.id].evidence : '';
        return `<div class="focus-card">
          <div class="focus-top"><h3>${f.D.label}</h3><span class="pips" data-s="${Math.floor(f.recent)}"><i></i><i></i><i></i><i></i></span></div>
          <p class="muted">Recent average ${f.recent.toFixed(1)} / 4${f.earlier != null ? ' (was ' + f.earlier.toFixed(1) + ')' : ''}. ${f.D.desc}.</p>
          ${ev ? `<p class="focus-ev"><b>Last time:</b> ${esc(ev)}</p>` : ''}
          <ul>${DRILLS[f.D.id].map(d => `<li>${esc(d)}</li>`).join('')}</ul>
          <div class="focus-rec"><span><b>${esc(rec.P.title)}</b> <span class="chip level ${levelClass(rec.P.level)}">${esc(rec.P.level)}</span>${rec.budget ? ' <span class="chip">' + kfmt(rec.budget) + ' budget</span>' : ''}<br><span class="faint">${esc(rec.why)}</span></span><button class="btn btn-sm btn-primary" data-practise="${rec.P.id}" data-budget="${rec.budget || ''}">Practise</button></div>
        </div>`; }).join('')}</div></section>` : ''}

      <section class="r-section">
        <h2>Score over time</h2>
        <div class="chart-box">${trendChart(rows.slice(-20))}<div class="chart-legend"><span><i style="background:var(--accent)"></i>Overall score per session, oldest on the left</span><span><i style="background:var(--ok);height:2px"></i>Hire bar (3.0)</span></div></div>
      </section>

      <section class="r-section">
        <h2>Rubric areas</h2>
        <div class="dim-bars">${st.dimStats.map(d => `<div class="dim-bar">
          <span>${d.D.label}</span>
          <span class="bar-track"><i style="width:${((d.all || 0) / 4 * 100).toFixed(1)}%"></i><b style="left:${(3 / 4 * 100)}%"></b></span>
          <span class="num">${d.all == null ? '–' : d.all.toFixed(1)}</span>
          <span class="num ${d.recent != null && d.earlier != null ? (d.recent > d.earlier + 0.05 ? 'up' : d.recent < d.earlier - 0.05 ? 'down' : '') : ''}">${d.recent != null && d.earlier != null ? (d.recent >= d.earlier ? '+' : '−') + Math.abs(d.recent - d.earlier).toFixed(1) : ''}</span>
        </div>`).join('')}</div>
        <p class="hint">Bars show your average across all sessions; the mark is the bar (3). The last column compares your last three sessions with the ones before.</p>
      </section>

      <section class="r-section">
        <h2>Habits</h2>
        <div class="tbl-wrap"><table class="turn-table habits"><thead><tr><th>Habit</th><th class="n">You</th><th class="n">Aim</th><th></th></tr></thead><tbody>
          ${st.habits.map(h => `<tr><td>${h.label}<br><span class="faint">${esc(h.tip)}</span></td><td class="n">${fmtV(h, h.v)}</td><td class="n">${fmtT(h)}</td><td>${h.v == null ? '' : h.good(h.v) ? '<span class="chip ok">On track</span>' : '<span class="chip warn">Work on it</span>'}</td></tr>`).join('')}
        </tbody></table></div>
      </section>

      <section class="r-section">
        <h2>Practice plan</h2>
        <div class="plan-box" id="plan-box"><p class="muted">${aiReady() ? 'Claude reads your rubric scores, habits and history and writes a plan for your next five sessions.' : 'Connect Claude for a written plan; without it you get one built from your scores.'}</p><button class="btn btn-primary" id="btn-plan">Write my practice plan</button></div>
      </section>

      <section class="r-section">
        <h2>Problems</h2>
        <div class="tbl-wrap"><table class="turn-table"><thead><tr><th>Problem</th><th class="m-hide">Level</th><th class="n m-hide">Attempts</th><th class="n">Best</th><th>Last result</th><th></th></tr></thead><tbody>
          ${byLevel(PROBLEMS).map(p => { const a = byProblem.get(p.id) || []; const last = a[a.length - 1]; return `<tr><td>${esc(p.title)}${p.parts.length > 1 ? ' <span class="faint">· ' + p.parts.length + ' parts</span>' : ''}</td><td class="m-hide"><span class="chip level ${levelClass(p.level)}">${esc(p.level)}</span></td><td class="n m-hide">${a.length || '–'}</td><td class="n">${a.length ? Math.max(...a.map(r => r.overall)).toFixed(1) : '–'}</td><td>${last ? `<span class="verdict v-${last.verdict}">${VERDICTS[last.verdict]}</span>` : '<span class="faint">Not tried</span>'}</td><td><button class="btn btn-sm" data-practise="${p.id}">Practise</button></td></tr>`; }).join('')}
        </tbody></table></div>
      </section>`;
    $$('[data-practise]', host).forEach(b => b.onclick = () => {
      prefs.problemId = b.dataset.practise;
      if (b.dataset.budget) prefs.budget = +b.dataset.budget;
      prefs.level = 'All';
      savePrefs(); showView('lobby'); renderLobby(); openBriefing();
    });
    $('#btn-plan').onclick = () => writePlan(rows, st);
    window.scrollTo(0, 0);
  }
  async function writePlan(rows, st) {
    const box = $('#plan-box');
    const btn = $('#btn-plan'); btn.disabled = true; btn.textContent = 'Writing…';
    const out = document.createElement('div'); out.className = 'msg-text';
    box.innerHTML = ''; box.appendChild(out);
    const paint = t => { out.innerHTML = md(t, 'plan', false); };
    if (!aiReady()) { paint(offlinePlan(rows, st)); return; }
    out.innerHTML = '<div class="thinking">Thinking</div>';
    const summary = [
      'Sessions (oldest first): ' + rows.slice(-12).map(r => r.title + ' [' + r.level + '] ' + r.overall.toFixed(1) + ' ' + VERDICTS[r.verdict]).join('; '),
      'Rubric averages (all / last 3): ' + st.dimStats.map(d => d.D.label + ' ' + (d.all || 0).toFixed(1) + '/' + (d.recent || 0).toFixed(1)).join('; '),
      'Habits: ' + st.habits.map(h => h.label + ' = ' + (h.v == null ? 'n/a' : h.fmt === 'pct' ? Math.round(h.v * 100) + '%' : h.v.toFixed(1))).join('; '),
      'Available problems: ' + PROBLEMS.map(p => p.title + ' (' + p.level + ', ' + p.difficulty + (p.parts.length > 1 ? ', ' + p.parts.length + ' parts' : '') + ')').join('; '),
    ].join('\n');
    try {
      const t = await aiText('You coach engineers for AI-assisted coding interviews, where candidates solve a problem with an AI assistant on a token budget and are scored on correctness, decomposition, working with the assistant, verification, code quality, and token/time management (scores 1-4, 3 is the bar). Using the data, write a plan for the next five practice sessions. For each: which problem (only from the list), budget and time settings, the one habit to practise and how to tell it worked. Then two sentences on the pattern you see. Markdown, under 250 words, second person, no preamble.', [{ role: 'user', content: summary }], paint, null);
      paint(t);
    } catch (e) {
      paint(offlinePlan(rows, st) + '\n\n(Claude could not write the plan: ' + ((e && e.code) || 'error') + '.)');
    }
  }
  $('#btn-progress').onclick = renderProgress;
  $('#btn-report-progress').onclick = renderProgress;
  $('#btn-progress-back').onclick = () => { showView('lobby'); renderLobby(); };

  function refSolutionHTML(r) {
    const P = problem(r.problemId);
    if (P.id !== r.problemId || !P.solution) return '';
    return `<details class="transcript ref-solution"><summary>Reference solution and approach</summary><div class="msg-text">${md(P.offline.approach + '\n\n' + P.offline.complexity + '\n\n' + FENCE + 'js\n' + P.solution.trim() + '\n' + FENCE, 'ref', false)}</div></details>`;
  }
  function testTable(r) {
    if (r.tests.compileError) return `<div class="compile-err" style="margin:0">${esc(r.tests.compileError)}</div>`;
    const row = (x, kind) => `<div class="result ${x.pass ? 'pass' : 'fail'}"><span class="mark">${x.pass ? '✓' : '✕'}</span><span>${esc(x.name)} <span class="faint" style="font-size:12px">${kind}</span></span><span class="ms">${x.ms != null ? x.ms.toFixed(1) + ' ms' : ''}</span>${x.pass ? '' : `<div class="detail">${x.error ? `<span>${esc(x.error)}</span>` : `<span><em>expected </em>${esc(String(x.expected).slice(0, 300))}</span><span><em>received </em>${esc(String(x.got).slice(0, 300))}</span>`}</div>`}</div>`;
    const all = r.tests.visible.map(x => [x, 'visible']).concat(r.tests.hidden.map(x => [x, 'hidden']));
    if (!r.metrics.partsTotal || r.metrics.partsTotal < 2) return `<div class="timeline" style="padding:0">${all.map(([x, k]) => row(x, k)).join('')}</div>`;
    const P = problem(r.problemId);
    let out = '';
    for (let i = 0; i < r.metrics.partsTotal; i++) {
      const g = all.filter(([x]) => (x.part || 0) === i);
      const ok = g.filter(([x]) => x.pass).length;
      out += `<div class="part-group"><h3>${esc((P.parts[i] && P.parts[i].title) || 'Part ' + (i + 1))} <span class="faint">${ok}/${g.length}${i >= r.metrics.partsReached ? ' · not reached' : ''}</span></h3>${g.map(([x, k]) => row(x, k)).join('')}</div>`;
    }
    return `<div class="timeline" style="padding:0">${out}</div>`;
  }
  function tokenChart(r) {
    const W = 720, H = 220, L = 52, R = 16, T = 14, B = 30;
    const endMin = Math.max(1, r.metrics.timeUsedMin);
    const xMax = endMin <= 10 ? Math.max(2, Math.ceil(endMin)) : Math.ceil(endMin / 5) * 5;
    const x = min => L + (min / xMax) * (W - L - R);
    const y = tk => T + (1 - tk / r.budget) * (H - T - B);
    const asst = r.turns.filter(t => t.role === 'assistant');
    let cum = 0;
    let path = `M${x(0)},${y(0)}`;
    const dots = [];
    for (const t of asst) {
      const mn = t.t / 60000;
      path += ` L${x(mn).toFixed(1)},${y(cum).toFixed(1)}`;
      cum = Math.min(r.budget, cum + t.inTok + t.outTok);
      path += ` L${x(mn).toFixed(1)},${y(cum).toFixed(1)}`;
      dots.push(`<circle cx="${x(mn).toFixed(1)}" cy="${y(cum).toFixed(1)}" r="3.5" fill="var(--accent)"><title>Exchange ${t.n} at ${mmss(t.t)}: +${fmt(t.inTok + t.outTok)} (total ${fmt(cum)})</title></circle>`);
    }
    path += ` L${x(endMin).toFixed(1)},${y(cum).toFixed(1)}`;
    const area = path + ` L${x(endMin).toFixed(1)},${y(0)} Z`;
    const yt = [0, 0.25, 0.5, 0.75, 1].map(f => { const v = r.budget * f; return `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="var(--line-2)" stroke-width="1"></line><text x="${L - 8}" y="${y(v) + 4}" text-anchor="end" font-size="11" fill="var(--ink-3)">${kfmt(v)}</text>`; }).join('');
    const step = xMax <= 10 ? 1 : xMax <= 30 ? 5 : 10;
    let xt = '';
    for (let mn = 0; mn <= xMax; mn += step) xt += `<text x="${x(mn)}" y="${H - 10}" text-anchor="middle" font-size="11" fill="var(--ink-3)">${mn}m</text>`;
    return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Cumulative tokens used over time, ${fmt(r.used)} of ${fmt(r.budget)}">
      ${yt}${xt}
      <line x1="${L}" x2="${W - R}" y1="${y(r.budget)}" y2="${y(r.budget)}" stroke="var(--bad)" stroke-width="1.5" stroke-dasharray="5 4"></line>
      <line x1="${x(endMin)}" x2="${x(endMin)}" y1="${T}" y2="${H - B}" stroke="var(--ink-3)" stroke-width="1" stroke-dasharray="3 3"></line>
      <path d="${area}" fill="var(--accent-soft)" stroke="none"></path>
      <path d="${path}" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linejoin="round"></path>
      ${dots.join('')}
    </svg>`;
  }

  // ---------- Views, modal, toast ----------
  function showView(name) {
    ['lobby', 'session', 'eval', 'report', 'progress'].forEach(v => { $('#view-' + v).hidden = v !== name; });
    document.documentElement.style.overflow = name === 'session' ? 'hidden' : '';
    if (name === 'session' && editor) setTimeout(() => editor.refresh(), 0);
  }
  let modalClose = null;
  function openModal({ title, sub, body, actions, onOpen }) {
    closeModal();
    const root = $('#modal-root');
    root.innerHTML = `<div class="modal-back"><div class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <div class="modal-head"><h2 id="modal-title">${esc(title)}</h2>${sub ? `<p class="muted">${esc(sub)}</p>` : ''}</div>
      ${body ? `<div class="modal-body">${body}</div>` : ''}
      <div class="modal-foot">${actions.map((a, i) => `<button class="btn ${a.kind === 'primary' ? 'btn-primary' : a.kind === 'danger' ? 'btn-danger' : ''}" data-mi="${i}"${a.id ? ` id="${a.id}"` : ''}${a.disabled ? ' disabled' : ''}>${esc(a.label)}</button>`).join('')}</div>
    </div></div>`;
    const back = root.firstElementChild;
    back.addEventListener('click', e => {
      if (e.target === back) { closeModal(); return; }
      const b = e.target.closest('[data-mi]'); if (!b) return;
      const a = actions[+b.dataset.mi];
      if (!a.keepOpen) closeModal();
      if (a.onClick) a.onClick();
    });
    const onKey = e => { if (e.key === 'Escape') closeModal(); };
    document.addEventListener('keydown', onKey);
    modalClose = () => document.removeEventListener('keydown', onKey);
    if (onOpen) onOpen(); else { const p = back.querySelector('.btn-primary, .btn-danger'); if (p) p.focus(); }
  }
  function closeModal() { if (modalClose) { modalClose(); modalClose = null; } $('#modal-root').innerHTML = ''; }
  let toastT = null;
  function toast(text) {
    const root = $('#toast-root');
    root.innerHTML = `<div class="toast" role="status">${esc(text)}</div>`;
    clearTimeout(toastT); toastT = setTimeout(() => { root.innerHTML = ''; }, 2600);
  }

  // Mobile pane tabs
  function setMobileTab(id) {
    $$('.workbench .pane').forEach(p => p.classList.toggle('m-active', p.id === id));
    $$('[data-mtab]').forEach(b => b.setAttribute('aria-selected', String(b.dataset.mtab === id)));
    if (id === 'pane-editor' && editor) setTimeout(() => editor.refresh(), 0);
  }
  $$('[data-mtab]').forEach(b => b.onclick = () => setMobileTab(b.dataset.mtab));

  $('#report').addEventListener('click', e => {
    const b = e.target.closest('[data-cb="copy"]'); if (!b) return;
    navigator.clipboard.writeText(codeStore.get(b.dataset.id) || '').then(() => toast('Copied to clipboard'), () => toast('Copy is blocked here. Select the code and copy it manually.'));
  });
  $('#btn-back-lobby').onclick = () => { showView('lobby'); renderLobby(); };
  document.addEventListener('keydown', e => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && sess && sess.status === 'active' && !$('#view-session').hidden && document.activeElement !== $('#prompt')) { e.preventDefault(); runVisible(); }
  });
  window.addEventListener('beforeunload', () => { if (sess && sess.status === 'active') store.set(K_ACTIVE, sess); });

  // ---------- Boot ----------
  renderLobby();
  showView('lobby');
  initAgent();
  // A resumed interview whose page was reloaded mid-submit: grade it now.
  const pending = store.get(K_ACTIVE, null);
  if (pending && pending.status === 'submitted') { sess = pending; sess.status = 'active'; mountEditor(sess.code); submit(false); }
})();
