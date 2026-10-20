/* FORGE — app UI. Vanilla JS, data stored on-device (localStorage). */
(function () {
  'use strict';
  const F = window.Forge;
  const KEY = 'forge.v1';
  const $ = (s, el = document) => el.querySelector(s);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const pad = n => String(n).padStart(2, '0');
  const dstr = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const today = () => dstr(new Date());
  const addDays = (s, n) => { const d = new Date(s + 'T12:00:00'); d.setDate(d.getDate() + n); return dstr(d); };
  const fmtDay = (s, opt) => new Date(s + 'T12:00:00').toLocaleDateString('en-GB', opt || { weekday: 'short', day: 'numeric', month: 'short' });
  const kg = x => (Math.round(x * 2) / 2).toString().replace(/\.0+$/, '');
  const signed = x => (x > 0 ? '+' : x < 0 ? '−' : '') + kg(Math.abs(x));
  const RPE_TXT = { 6: '4+ left', 6.5: '3–4 left', 7: '3 left', 7.5: '2–3 left', 8: '2 left', 8.5: '1–2 left', 9: '1 left', 9.5: 'maybe 1', 10: 'max' };
  const rpeClass = r => r == null ? '' : r <= 7 ? 'r7' : r <= 8.5 ? 'r8' : r < 10 ? 'r9' : 'r10';

  // ---------- state ----------
  function defaults() {
    const ex = (n, l, rpe) => Array.from({ length: 5 }, () => ({ treps: 3, trpe: 7, reps: 3, load: l, rpe, done: true }));
    return {
      v: 1,
      settings: { bw: 70, basePull: 40, baseDip: 60, goalPull: 70, goalDip: 80, inc: 2.5, mindTarget: 30, startLoads: {} },
      logs: [
        { id: 'seed1', date: '2026-10-18', pos: { c: 1, w: 1, d: 1 }, bw: 70, title: 'Heavy Pull', readiness: null,
          note: 'Logged before the app. Edit the RPE if it felt different.',
          ex: [{ key: 'wpu', name: 'Weighted Pull-up', type: 'main', summary: '5×3', sets: ex(5, 30, 9.5) }] },
        { id: 'seed2', date: '2026-10-19', pos: { c: 1, w: 1, d: 2 }, bw: 70, title: 'Handstand Strength', readiness: null,
          note: 'HSPU + 90° attempts (before the app).', ex: [] }
      ],
      todos: [],
      mind: {},
      active: null,
      nextOverride: null,
      tab: 'today'
    };
  }
  let S;
  try { S = JSON.parse(localStorage.getItem(KEY)) || defaults(); } catch (e) { S = defaults(); }
  S.settings = Object.assign(defaults().settings, S.settings || {});
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { toast('Could not save — storage full?'); } };

  function lastPos() {
    let best = null;
    for (const l of S.logs) if (l.pos && (!best || F.posIndex(l.pos) > F.posIndex(best))) best = l.pos;
    return best;
  }
  function nextPos() {
    if (S.nextOverride) return S.nextOverride;
    const lp = lastPos();
    return lp ? F.posFrom(F.posIndex(lp) + 1) : { c: 1, w: 1, d: 1 };
  }
  const posLabel = p => `${p.c > 1 ? 'C' + p.c + ' · ' : ''}Week ${p.w} · Day ${p.d}`;
  const posDone = p => S.logs.some(l => l.pos && F.posIndex(l.pos) === F.posIndex(p));

  // ---------- toast / timer ----------
  let toastT;
  function toast(msg) {
    const t = $('#toast'); t.textContent = msg; t.hidden = false;
    clearTimeout(toastT); toastT = setTimeout(() => (t.hidden = true), 2600);
  }
  let timerEnd = 0, timerI = null;
  function startTimer(sec) {
    if (!sec) return;
    timerEnd = Date.now() + sec * 1000;
    clearInterval(timerI); timerI = setInterval(tick, 250); tick();
  }
  function tick() {
    const el = $('#timer');
    const left = Math.round((timerEnd - Date.now()) / 1000);
    el.hidden = false;
    if (left <= 0) {
      el.classList.add('end');
      el.innerHTML = `<b class="num">Go</b><span>Rest done</span><button data-act="timer-close">OK</button>`;
      if (!el.dataset.buzzed) { try { navigator.vibrate && navigator.vibrate([200, 100, 200]); } catch (e) {} el.dataset.buzzed = 1; }
      if (left < -20) stopTimer();
      return;
    }
    el.classList.remove('end'); delete el.dataset.buzzed;
    el.innerHTML = `<b class="num">${Math.floor(left / 60)}:${pad(left % 60)}</b><span class="small muted">rest</span><button data-act="timer-add">+30s</button><button data-act="timer-close">Skip</button>`;
  }
  function stopTimer() { clearInterval(timerI); $('#timer').hidden = true; }

  // ---------- render root ----------
  function setTab(t) { S.tab = t; save(); render(); window.scrollTo(0, 0); }
  function render() {
    document.querySelectorAll('.tab').forEach(b => b.classList.toggle('on', b.dataset.tab === S.tab));
    const v = $('#view');
    v.innerHTML = ({ today: viewToday, train: viewTrain, mind: viewMind, plan: viewPlan }[S.tab] || viewToday)();
    if (S.active && $('#sheet').hidden) renderSession();
  }

  // ---------- TODAY ----------
  function dayTasks(d) {
    const list = S.todos.filter(t => t.date === d);
    const trainedToday = S.logs.some(l => l.date === d && !l.skipped && l.pos);
    const m = S.mind[d];
    const auto = [
      { id: '_train', text: 'Train — ' + F.dayTemplate(nextPos().w, nextPos().d).title, done: trainedToday, auto: 'train' },
      { id: '_mind', text: `Study psychology ${S.settings.mindTarget} min`, done: !!(m && m.min >= S.settings.mindTarget), auto: 'mind' }
    ];
    if (trainedToday) auto[0].text = 'Train — done';
    return { auto, list };
  }
  function viewToday() {
    const d = today();
    const p = nextPos();
    const rep = F.replay(S);
    const sess = F.buildSession(S, p, null, rep);
    const { auto, list } = dayTasks(d);
    const all = [...auto, ...list];
    const done = all.filter(t => t.done).length;
    const m = S.mind[d];
    const trainedToday = auto[0].done;
    const pull = rep.lifts.pull.e1 - S.settings.bw, dip = rep.lifts.dip.e1 - S.settings.bw;
    const b = sess.block;
    const lines = sess.ex.map(e => `<div class="ex-line"><span>${esc(e.name)}</span><span class="num">${esc(exPreview(e))}</span></div>`).join('');
    return `
      <div class="page-h"><div class="eyebrow">${fmtDay(d, { weekday: 'long', day: 'numeric', month: 'long' })}</div><h1>${greet()}</h1></div>
      <div class="card">
        <div class="row between"><span class="label">Today</span><span class="small muted num">${done}/${all.length} done</span></div>
        <div class="progress" style="margin-top:10px"><i style="width:${all.length ? (done / all.length) * 100 : 0}%"></i></div>
      </div>
      ${S.active ? `<div class="card hero"><span class="pill acc"><span class="dot"></span>In progress</span>
        <div class="hero-title">${esc(S.active.session.title)}</div><p class="muted small">${posLabel(S.active.session.pos)}</p>
        <button class="btn primary block" data-act="resume">Resume workout</button></div>` : `
      <div class="card hero">
        <div class="row between"><span class="pill ${b.tone === 'calm' ? 'calm' : 'acc'}"><span class="dot"></span>${b.name}</span><span class="small muted">${posLabel(p)}</span></div>
        ${trainedToday ? '<div class="small" style="color:var(--good);margin-top:10px;font-weight:700">✓ Trained today — this is your next one</div>' : ''}<div class="hero-title">${esc(sess.title)}</div>
        <div class="muted small">${esc(sess.focus)}</div>
        <div class="ex-list">${lines}</div>
        <div class="row"><button class="btn primary" style="flex:1" data-act="start">Start workout</button><button class="btn ghost" data-act="skip">Skip</button></div>
      </div>`}
      <div class="grid2">
        <button class="stat" data-act="tab" data-tab="train" style="text-align:left"><span>Pull-up e1RM</span><b class="num">${signed(pull)} kg</b><span>goal +${S.settings.goalPull}</span></button>
        <button class="stat" data-act="tab" data-tab="train" style="text-align:left"><span>Dip e1RM</span><b class="num">${signed(dip)} kg</b><span>goal +${S.settings.goalDip}</span></button>
      </div>
      <div class="sect"><h2>To do</h2><a href="#" data-act="tab" data-tab="plan">Open plan</a></div>
      <div class="card">${todoList(all)}${addRow()}</div>
      <div class="sect"><h2>Mind</h2><a href="#" data-act="tab" data-tab="mind">Open</a></div>
      <div class="card">${m ? `<div class="row between"><div><div class="big num">${m.min}<small>/ ${S.settings.mindTarget} min</small></div><div class="muted small">${esc(m.topic || '')}</div></div><span class="pill ${m.min >= S.settings.mindTarget ? 'acc' : 'warn'}">${m.min >= S.settings.mindTarget ? 'Target hit' : 'Below target'}</span></div>`
        : `<div class="row between"><div><h3>No study logged yet</h3><div class="muted small">Target ${S.settings.mindTarget} min · be honest</div></div><button class="btn sm primary" data-act="tab" data-tab="mind">Log</button></div>`}</div>
      ${weekStrip()}`;
  }
  function greet() { const h = new Date().getHours(); return h < 5 ? 'Late night.' : h < 12 ? 'Morning.' : h < 18 ? 'Afternoon.' : 'Evening.'; }
  function exPreview(e) {
    if (e.type === 'main') {
      const loads = [...new Set(e.sets.map(s => s.load))];
      return `${e.summary} · ${loads.map(l => l ? '+' + kg(l) : 'BW').join('/')}`;
    }
    return e.summary;
  }
  function weekStrip() {
    const d = today(); const days = [];
    for (let i = 6; i >= 0; i--) days.push(addDays(d, -i));
    const cells = days.map(x => {
      const tr = S.logs.some(l => l.date === x && !l.skipped);
      const mm = S.mind[x] && S.mind[x].min >= S.settings.mindTarget;
      return `<div style="text-align:center"><div class="small muted">${fmtDay(x, { weekday: 'narrow' })}</div>
        <div style="margin-top:6px;display:grid;gap:4px;justify-items:center">
        <span style="width:22px;height:22px;border-radius:7px;background:${tr ? 'var(--acc)' : 'var(--s3)'}"></span>
        <span style="width:22px;height:6px;border-radius:3px;background:${mm ? 'var(--blue)' : 'var(--s3)'}"></span></div></div>`;
    }).join('');
    return `<div class="sect"><h2>Last 7 days</h2><span class="small muted"><span style="color:var(--acc)">■</span> trained <span style="color:var(--blue)">▬</span> studied</span></div>
      <div class="card" style="display:grid;grid-template-columns:repeat(7,1fr)">${cells}</div>`;
  }

  // ---------- PLAN ----------
  function todoList(items) {
    if (!items.length) return `<div class="empty">Nothing yet. What pushes you past your limit today?</div>`;
    const sorted = [...items].sort((a, b) => (a.done - b.done) || ((b.star ? 1 : 0) - (a.star ? 1 : 0)));
    return sorted.map(t => `<div class="todo ${t.done ? 'done' : ''}">
      <button class="check ${t.done ? 'on' : ''}" data-act="${t.auto ? 'auto-' + t.auto : 'todo-toggle'}" data-id="${t.id}" aria-label="toggle"></button>
      <div class="txt">${esc(t.text)}${t.auto ? ' <span class="pill" style="margin-left:4px">auto</span>' : ''}</div>
      ${t.auto ? '' : `<button class="star ${t.star ? 'on' : ''}" data-act="todo-star" data-id="${t.id}" aria-label="priority">★</button><button class="del" data-act="todo-del" data-id="${t.id}" aria-label="delete">×</button>`}
    </div>`).join('');
  }
  const addRow = () => `<form class="add-row" data-form="todo" style="margin:12px 0 0"><input class="input" name="t" placeholder="Add a task for today…" autocomplete="off"><button class="btn primary" aria-label="Add">+</button></form>`;
  function viewPlan() {
    const d = today();
    const { auto, list } = dayTasks(d);
    const all = [...auto, ...list];
    const done = all.filter(t => t.done).length;
    const over = S.todos.filter(t => t.date < d && !t.done);
    const tomorrow = S.todos.filter(t => t.date === addDays(d, 1));
    const last7 = []; for (let i = 6; i >= 0; i--) { const x = addDays(d, -i); const ts = S.todos.filter(t => t.date === x); last7.push(ts.length ? ts.filter(t => t.done).length / ts.length : null); }
    const valid = last7.filter(x => x != null);
    const rate = valid.length ? Math.round(valid.reduce((a, b) => a + b, 0) / valid.length * 100) : null;
    return `
      <div class="page-h"><div class="eyebrow">${fmtDay(d, { weekday: 'long', day: 'numeric', month: 'long' })}</div><h1>Today's plan</h1></div>
      <div class="grid2" style="margin-bottom:12px">
        <div class="stat"><span>Done today</span><b class="num">${done}/${all.length}</b></div>
        <div class="stat"><span>Tasks done (7d)</span><b class="num">${rate == null ? '—' : rate + '%'}</b></div>
      </div>
      ${over.length ? `<div class="card" style="border-color:#4a3a1c"><div class="row between"><div><h3>${over.length} unfinished from before</h3><div class="muted small">Move them to today or let them go.</div></div></div>
        <div style="margin-top:8px">${over.map(t => `<div class="todo"><div class="txt">${esc(t.text)} <span class="small muted">· ${fmtDay(t.date)}</span></div><button class="btn sm ghost" data-act="todo-move" data-id="${t.id}">Today</button><button class="del" data-act="todo-del" data-id="${t.id}">×</button></div>`).join('')}</div>
        <button class="btn sm primary" data-act="todo-move-all" style="margin-top:10px">Move all to today</button></div>` : ''}
      <div class="card">${todoList(all)}${addRow()}<p class="small muted" style="margin:10px 2px 0">★ = must-do. Keep it to 3–5 things that actually move you forward.</p></div>
      <div class="sect"><h2>Tomorrow</h2></div>
      <div class="card">${tomorrow.length ? tomorrow.map(t => `<div class="todo"><div class="txt">${esc(t.text)}</div><button class="del" data-act="todo-del" data-id="${t.id}">×</button></div>`).join('') : '<div class="empty">Plan tomorrow tonight — it takes 1 minute.</div>'}
        <form class="add-row" data-form="todo-tmr" style="margin:12px 0 0"><input class="input" name="t" placeholder="Add for tomorrow…" autocomplete="off"><button class="btn" aria-label="Add">+</button></form></div>`;
  }

  // ---------- MIND ----------
  function viewMind() {
    const d = today();
    const m = S.mind[d] || {};
    const tgt = S.settings.mindTarget;
    const days = []; for (let i = 6; i >= 0; i--) days.push(addDays(d, -i));
    const mx = Math.max(tgt, ...days.map(x => (S.mind[x] || {}).min || 0));
    const bars = days.map(x => { const v = (S.mind[x] || {}).min || 0; return `<div><i class="${v >= tgt ? 'hit' : ''}" style="height:${Math.max(4, v / mx * 70)}px"></i><span>${fmtDay(x, { weekday: 'narrow' })}</span></div>`; }).join('');
    let streak = 0; for (let i = 0; ; i++) { const x = addDays(d, -i); const e = S.mind[x]; if (e && e.min >= tgt) streak++; else if (i === 0) continue; else break; if (i > 999) break; }
    const keys = Object.keys(S.mind).sort();
    const totalMin = keys.reduce((a, k) => a + (S.mind[k].min || 0), 0);
    let hit30 = 0; for (let i = 0; i < 30; i++) { const e = S.mind[addDays(d, -i)]; if (e && e.min >= tgt) hit30++; }
    const honestN = keys.filter(k => S.mind[k].honest).length;
    const honestYes = keys.filter(k => S.mind[k].honest === 'yes').length;
    const appliedN = keys.filter(k => S.mind[k].applied).length;
    // recall check: an insight older than 3 days
    const older = keys.filter(k => k <= addDays(d, -3) && S.mind[k].insight);
    const rk = older.length ? older[(new Date().getDate() * 7) % older.length] : null;
    const recalls = keys.flatMap(k => S.mind[k].recall || []);
    const recallRate = recalls.length ? Math.round(recalls.filter(r => r.ok).length / recalls.length * 100) : null;
    const recent = keys.filter(k => S.mind[k].insight).reverse().slice(0, 10);
    return `
      <div class="page-h"><div class="eyebrow">Psychology</div><h1>Mind log</h1></div>
      <div class="grid3" style="margin-bottom:12px">
        <div class="stat"><span>Streak</span><b class="num">${streak}d</b></div>
        <div class="stat"><span>Last 30d</span><b class="num">${hit30}/30</b></div>
        <div class="stat"><span>Total</span><b class="num">${(totalMin / 60).toFixed(1)}h</b></div>
      </div>
      <div class="card"><div class="row between"><span class="label">This week</span><span class="small muted">target ${tgt} min</span></div><div class="bars">${bars}</div></div>
      <div class="sect"><h2>Today</h2>${S.mind[d] ? '<span class="pill acc">Saved</span>' : ''}</div>
      <form class="card" data-form="mind">
        <div class="field"><label>Minutes actually studied</label>
          <div class="stepper"><button type="button" data-act="mstep" data-v="-5">−</button><input name="min" inputmode="numeric" class="num" value="${m.min ?? 0}"><button type="button" data-act="mstep" data-v="5">+</button></div></div>
        <div class="field"><label>Topic / source</label><input class="input" name="topic" value="${esc(m.topic || '')}" placeholder="e.g. Cialdini — reciprocity, ch. 2"></div>
        <div class="field"><label>Explain what you learned in your own words</label><textarea class="input" name="insight" placeholder="If you can't explain it simply, you didn't learn it yet.">${esc(m.insight || '')}</textarea></div>
        <div class="field"><label>Did you use it today? (a conversation, a sale, on yourself)</label><input class="input" name="appliedNote" value="${esc(m.appliedNote || '')}" placeholder="Leave empty if not — that's fine, just be honest"></div>
        <div class="field"><label>Honest check: did you do what you planned?</label>
          <div class="honest">${['yes', 'partly', 'no'].map(h => `<button type="button" data-act="honest" data-v="${h}" class="${m.honest === h ? 'on' : ''}">${h[0].toUpperCase() + h.slice(1)}</button>`).join('')}</div><input type="hidden" name="honest" value="${esc(m.honest || '')}"></div>
        <button class="btn primary block">Save today</button>
      </form>
      ${rk ? `<div class="card hero"><span class="label">Recall check</span><p style="margin:8px 0 4px">Can you still explain this without looking?</p>
        <p class="muted small" style="margin:0 0 12px">${fmtDay(rk)} · ${esc(S.mind[rk].topic || 'untitled')}</p>
        <details><summary class="small muted" style="margin-bottom:10px">Reveal your note</summary><p class="small">${esc(S.mind[rk].insight)}</p></details>
        <div class="row"><button class="btn sm primary" data-act="recall" data-k="${rk}" data-v="1">Yes, clearly</button><button class="btn sm ghost" data-act="recall" data-k="${rk}" data-v="0">Fuzzy</button></div></div>` : ''}
      <div class="grid3" style="margin:12px 0">
        <div class="stat"><span>Did as planned</span><b class="num">${honestN ? Math.round(honestYes / honestN * 100) + '%' : '—'}</b></div>
        <div class="stat"><span>Applied</span><b class="num">${appliedN}×</b></div>
        <div class="stat"><span>Recall</span><b class="num">${recallRate == null ? '—' : recallRate + '%'}</b></div>
      </div>
      <div class="sect"><h2>Your insights</h2></div>
      <div class="card">${recent.length ? recent.map(k => `<div class="insight"><div class="row between"><span class="small muted">${fmtDay(k)} · ${S.mind[k].min} min</span>${S.mind[k].applied ? '<span class="pill acc">applied</span>' : ''}</div><b>${esc(S.mind[k].topic || '')}</b><p class="small">${esc(S.mind[k].insight)}</p></div>`).join('') : '<div class="empty">Your explained insights will collect here.</div>'}</div>`;
  }

  // ---------- TRAIN ----------
  let viewWeek = null;
  function spark(hist, bw) {
    if (hist.length < 2) return '<div class="small muted" style="margin-top:8px">Log a couple of sessions to see the trend.</div>';
    const ys = hist.map(h => h.e1 - bw);
    const lo = Math.min(...ys) - 1, hi = Math.max(...ys) + 1;
    const pts = ys.map((y, i) => `${(i / (ys.length - 1)) * 300},${52 - ((y - lo) / (hi - lo)) * 46}`).join(' ');
    return `<svg class="spark" viewBox="0 0 300 56" preserveAspectRatio="none"><polyline points="${pts}" fill="none" stroke="var(--acc)" stroke-width="2.5" vector-effect="non-scaling-stroke" stroke-linejoin="round"/></svg>`;
  }
  function liftCard(name, L, goal, allTime) {
    const bw = S.settings.bw;
    const added = L.e1 - bw;
    const pctGoal = Math.max(0, Math.min(100, (added / goal) * 100));
    return `<div class="card"><div class="lift-top"><div><span class="label">${name}</span><div class="big num">${signed(added)}<small>kg e1RM</small></div>
      <div class="small muted num">Total ${kg(L.e1)} kg · best est. ${signed(L.best - bw)}</div></div>
      <span class="pill acc">${Math.round(pctGoal)}% to +${goal}</span></div>
      <div class="progress" style="margin-top:12px"><i style="width:${pctGoal}%"></i></div>
      ${spark(L.hist, bw)}</div>`;
  }
  function viewTrain() {
    const rep = F.replay(S);
    const p = nextPos();
    if (viewWeek == null) viewWeek = p.w;
    const b = F.block(p.w);
    const chips = Array.from({ length: F.WEEKS }, (_, i) => i + 1).map(w => `<button class="chip ${w === viewWeek ? 'on' : ''} ${w === p.w ? 'cur' : ''}" data-act="week" data-w="${w}">W${w}</button>`).join('');
    const days = Array.from({ length: 7 }, (_, i) => i + 1).map(d => {
      const pos = { c: p.c, w: viewWeek, d };
      const s = F.buildSession(S, pos, null, rep);
      const cur = F.posIndex(pos) === F.posIndex(p);
      const dn = posDone(pos);
      return `<button class="day ${cur ? 'cur' : ''}" style="display:block;width:100%;text-align:left" data-act="preview" data-w="${viewWeek}" data-d="${d}" data-c="${p.c}">
        <div class="day-h"><b>D${d} · ${esc(s.title)}</b>${dn ? '<span class="done-mark">✓ done</span>' : cur ? '<span class="pill acc">next</span>' : ''}</div>
        <p>${s.ex.map(e => esc(e.type === 'main' ? e.name.replace('Weighted ', '') + ' ' + exPreview(e) : e.name)).join(' · ')}</p></button>`;
    }).join('');
    const hist = [...S.logs].sort((a, b) => (b.date + b.id).localeCompare(a.date + a.id)).slice(0, 30);
    return `
      <div class="page-h"><div class="eyebrow">${posLabel(p)} · ${b.name}</div><h1>Training</h1></div>
      ${liftCard('Weighted pull-up', rep.lifts.pull, S.settings.goalPull)}
      ${liftCard('Weighted dip', rep.lifts.dip, S.settings.goalDip)}
      <div class="card"><span class="label">How the coach works</span>
        <p class="small muted" style="margin:8px 0 0">Every main set you log (load × reps × RPE) re-estimates your max. Next session's weights come from that estimate. Went harder than planned → it pulls back a set. Felt easier → weights go up. Mid-workout, a set that's ≥1 RPE off retunes the remaining sets.</p></div>
      <div class="sect"><h2>Program</h2><span class="small muted">12 weeks</span></div>
      <div class="chips">${chips}</div>
      <div class="card" style="padding-top:4px;padding-bottom:4px">${days}</div>
      <div class="sect"><h2>History</h2><span class="small muted">tap to edit</span></div>
      <div class="card" style="padding-top:4px;padding-bottom:4px">${hist.length ? hist.map(l => `<button class="hist" style="width:100%;text-align:left" data-act="edit-log" data-id="${l.id}">
        <div><b>${esc(l.skipped ? 'Skipped — ' + l.title : l.title)}</b><div class="small muted">${fmtDay(l.date)} · ${l.pos ? posLabel(l.pos) : ''}</div></div>
        <span class="small muted num">${histSummary(l)}</span></button>`).join('') : '<div class="empty">No sessions yet.</div>'}</div>`;
  }
  function histSummary(l) {
    const m = (l.ex || []).find(e => e.type === 'main');
    if (m) { const d = m.sets.filter(s => s.done); if (d.length) { const top = d.reduce((a, b) => (+b.load > +a.load ? b : a)); return `+${kg(+top.load)}×${top.reps}${top.rpe != null ? ' @' + top.rpe : ''}`; } }
    const r = (l.ex || []).find(e => e.type === 'run'); if (r && r.sets[0] && r.sets[0].done) return r.sets[0].min + ' min run';
    return '';
  }

  // ---------- SESSION ----------
  function askReadiness(pos) {
    const q = (k, t, opts) => `<div><div class="small muted" style="margin-bottom:6px">${t}</div><div class="seg" data-q="${k}">${opts.map((o, i) => `<button type="button" data-act="rq" data-k="${k}" data-v="${i + 1}" class="${i === 1 ? 'on' : ''}">${o}</button>`).join('')}</div></div>`;
    openModal(`<h2>Quick check-in</h2><p class="muted small" style="margin:0 0 16px">10 seconds. The coach adjusts today's load to how you actually feel.</p>
      <div class="ready-q" id="rq">${q('sleep', 'Sleep last night', ['Bad', 'OK', 'Great'])}${q('sore', 'Soreness', ['Very', 'Some', 'None'])}${q('energy', 'Energy / motivation', ['Low', 'Normal', 'High'])}</div>
      <button class="btn primary block" style="margin-top:20px" data-act="ready-go" data-pos='${JSON.stringify(pos)}'>Start</button>
      <button class="btn block" style="margin-top:8px;background:none;color:var(--muted)" data-act="ready-skip" data-pos='${JSON.stringify(pos)}'>Skip check-in</button>`);
  }
  function startSession(pos, readiness) {
    const sess = F.buildSession(S, pos, readiness);
    S.active = { session: sess, readiness, editId: null, date: today(), started: Date.now() };
    save(); closeModal(); renderSession();
  }
  function renderSession() {
    const A = S.active; if (!A) return;
    const s = A.session;
    const sh = $('#sheet'); sh.hidden = false; document.body.style.overflow = 'hidden';
    const scroll = sh.scrollTop;
    sh.innerHTML = `<div class="sheet-inner">
      <div class="sheet-head"><button class="icon-btn" data-act="close-session" aria-label="Close">
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
        <div style="text-align:center"><div class="small muted">${A.editId ? 'Editing · ' + fmtDay(A.date) : posLabel(s.pos)}</div><b>${esc(s.title)}</b></div>
        <button class="icon-btn" data-act="timer-start" aria-label="Rest timer"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2 2M9 2h6"/></svg></button></div>
      ${s.coach && s.coach.length ? `<div class="flag" style="margin:0 0 12px">${s.coach.map(esc).join('<br>')}</div>` : ''}
      ${s.note ? `<div class="flag" style="margin:0 0 12px;color:var(--muted);background:var(--s1)">${esc(s.note)}</div>` : ''}
      ${s.ex.map((e, i) => exCard(e, i)).join('')}
      ${A.editId ? `<button class="btn ghost block" style="color:var(--bad);margin-top:8px" data-act="delete-log">Delete this session</button>` : ''}
      </div>
      <div class="sheet-foot"><div class="inner"><button class="btn primary" style="flex:1" data-act="finish">${A.editId ? 'Save changes' : 'Finish workout'}</button></div></div>`;
    sh.scrollTop = scroll;
  }
  const tick2 = '<svg viewBox="0 0 24 24"><path d="M5 12l5 5L20 7"/></svg>';
  function exCard(e, i) {
    const all = e.sets.length && e.sets.every(s => s.done);
    let head = '', rows = '';
    if (e.type === 'run') {
      head = `<div class="set-head run"><span>#</span><span>min</span><span>km (opt.)</span><span></span></div>`;
      rows = e.sets.map((s, j) => `<div class="set run ${s.done ? 'done' : ''}"><span class="n">${j + 1}</span>
        <div class="cell"><input inputmode="decimal" data-ex="${i}" data-set="${j}" data-f="min" value="${esc(s.min)}"></div>
        <div class="cell"><input inputmode="decimal" data-ex="${i}" data-set="${j}" data-f="km" value="${esc(s.km)}" placeholder="—"></div>
        <button class="done-btn" data-act="done" data-ex="${i}" data-set="${j}">${tick2}</button></div>`).join('');
    } else if (e.type === 'check') {
      rows = e.sets.map((s, j) => `<div class="set check-row ${s.done ? 'done' : ''}"><span class="n">✓</span>
        <div class="cell"><input inputmode="numeric" data-ex="${i}" data-set="${j}" data-f="min" value="${esc(s.min)}"><em>min</em></div>
        <button class="done-btn" data-act="done" data-ex="${i}" data-set="${j}">${tick2}</button></div>`).join('');
    } else {
      const isHold = e.type === 'hold', hasLoad = e.type === 'main' || e.type === 'load';
      head = `<div class="set-head"><span>#</span><span>${isHold ? 'sec' : 'reps'}</span><span>${hasLoad ? '+kg' : ''}</span><span>RPE</span><span></span></div>`;
      rows = e.sets.map((s, j) => `<div class="set ${s.done ? 'done' : ''}"><span class="n">${j + 1}</span>
        <div class="cell"><input inputmode="numeric" data-ex="${i}" data-set="${j}" data-f="${isHold ? 'sec' : 'reps'}" value="${esc(isHold ? s.sec : s.reps)}"><em>${isHold ? 's' : '×'}</em></div>
        <div class="cell">${hasLoad ? `<input inputmode="decimal" data-ex="${i}" data-set="${j}" data-f="load" value="${esc(s.load)}"><em>kg</em>` : `<div class="small muted" style="text-align:center">${s.trpe ? '@' + s.trpe : ''}</div>`}</div>
        <button class="rpe-btn ${s.rpe != null ? 'set-v ' + rpeClass(s.rpe) : ''}" data-act="rpe" data-ex="${i}" data-set="${j}">${s.rpe != null ? s.rpe : (s.trpe ? '@' + s.trpe : 'RPE')}</button>
        <button class="done-btn" data-act="done" data-ex="${i}" data-set="${j}">${tick2}</button></div>`).join('');
    }
    return `<div class="ex-card ${all ? 'complete' : ''}">
      <div class="ex-head"><div><h3>${esc(e.name)}</h3><div class="ex-sum num">${esc(e.type === 'main' ? e.summary + ' · e1RM ' + signed(e.e1 - S.settings.bw) + ' kg' : e.summary)}${e.lvl ? ' · level ' + (e.lvl + 1) : ''}</div></div>
        <button class="info-btn" data-act="cue" data-ex="${i}">i</button></div>
      ${e.showCue ? `<div class="cue">${esc(e.cue)}</div>` : ''}
      ${e.note ? `<div class="cue" style="color:var(--text)">${esc(e.note)}</div>` : ''}
      ${e.flag ? `<div class="flag">${esc(e.flag)}</div>` : ''}
      <div class="sets">${head}${rows}</div></div>`;
  }
  function pickRpe(i, j) {
    const st = S.active.session.ex[i].sets[j];
    const vals = [6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10];
    openModal(`<div class="grab"></div><h2>How hard was that set?</h2><p class="muted small" style="margin:0">RPE = how many more reps you could have done with good form.${st.trpe ? ' Target: <b style="color:var(--acc)">@' + st.trpe + '</b>' : ''}</p>
      <div class="rpe-grid">${vals.map(v => `<button class="rpe-opt ${st.rpe === v ? 'on' : ''}" data-act="rpe-set" data-ex="${i}" data-set="${j}" data-v="${v}"><b class="num">${v}</b><span>${RPE_TXT[v]}</span></button>`).join('')}</div>
      <button class="btn block ghost" data-act="close-modal">Cancel</button>`);
  }
  function onSetDone(i, j) {
    const e = S.active.session.ex[i];
    const st = e.sets[j];
    st.done = !st.done;
    if (st.done && (e.type === 'main' || e.type === 'load' || e.type === 'bw' || e.type === 'hold') && st.rpe == null) {
      save(); renderSession(); pickRpe(i, j); return;
    }
    if (st.done) startTimer(e.rest);
    save(); renderSession();
  }
  function onRpe(i, j, v) {
    const e = S.active.session.ex[i];
    const st = e.sets[j];
    st.rpe = v; st.done = true;
    closeModal();
    if (e.type === 'main') {
      const r = F.adjustRemaining(e, j, S.settings);
      if (r) toast(r.harder ? `Felt easy — next sets → +${kg(r.load)} kg` : `Too heavy — next sets → +${kg(r.load)} kg`);
      else if (st.trpe && v - st.trpe >= 1.5) toast('That was way over target. Stop the set earlier next time.');
    }
    startTimer(e.rest);
    save(); renderSession();
  }

  function finishSession() {
    const A = S.active;
    const s = A.session;
    const any = s.ex.some(e => e.sets.some(x => x.done));
    if (!any && !A.editId) { toast('Mark at least one set done (or close to cancel).'); return; }
    const before = F.replay(S);
    const log = {
      id: A.editId || uid(), date: A.date, pos: s.pos, bw: S.settings.bw, title: s.title, readiness: A.readiness,
      ex: s.ex.map(e => ({ key: e.key, name: e.name, type: e.type, summary: e.summary, target: e.target, sets: e.sets.map(x => { const y = { ...x }; delete y.edited; return y; }) }))
    };
    if (A.editId) {
      const k = S.logs.findIndex(l => l.id === A.editId);
      const old = S.logs[k]; log.bw = old.bw; log.note = old.note;
      S.logs[k] = log;
    } else { S.logs.push(log); S.nextOverride = null; }
    S.active = null; save();
    closeSheet(); stopTimer();
    const after = F.replay(S);
    summary(log, before, after);
    render();
  }
  function nextFor(lift, fromPos, rep) {
    for (let k = 1; k <= 14; k++) {
      const p = F.posFrom(F.posIndex(fromPos) + k);
      const sess = F.buildSession(S, p, null, rep);
      const e = sess.ex.find(x => x.lift === lift);
      if (e) return { sess, e };
    }
  }
  function summary(log, before, after) {
    const lines = [];
    for (const lift of ['pull', 'dip']) {
      if (!log.ex.some(e => e.type === 'main' && F.EX[e.key].lift === lift && e.sets.some(x => x.done))) continue;
      const b = before.lifts[lift].e1 - S.settings.bw, a = after.lifts[lift].e1 - S.settings.bw;
      const n = nextFor(lift, log.pos, after);
      const nm = lift === 'pull' ? 'Pull-up' : 'Dip';
      const delta = a - b;
      let txt = `<b>${nm} e1RM ${signed(a)} kg</b> <span class="muted">(${delta >= 0 ? '+' : '−'}${kg(Math.abs(delta))})</span>`;
      if (n) txt += `<br><span class="small muted">Next: ${esc(n.sess.title)} — ${esc(exPreview(n.e))}</span>`;
      if (after.lifts[lift].flag === 'hard') txt += `<br><span class="small" style="color:var(--warn)">You went harder than planned. Next time: one set less, RPE −0.5. Leave reps in the tank — that's how strength builds fast without frying you.</span>`;
      lines.push([delta >= 0 ? '↑' : '↓', txt]);
    }
    for (const e of log.ex) {
      const def = F.EX[e.key];
      if (!['bw', 'load', 'hold'].includes(def.type) || !e.sets.some(x => x.done)) continue;
      const pb = before.prog[e.key], pa = after.prog[e.key];
      const ot = pb ? pb.t : def.lo, nt = pa ? pa.t : def.lo;
      const u = def.type === 'hold' ? 's' : ' reps';
      let t = nt > ot ? `next time ${nt}${u} per set ↑` : nt < ot ? `next time ${nt}${u} — consolidate` : `repeat ${nt}${u}, own it`;
      if (after.msgs[e.key] && (!before.msgs[e.key] || (pa && pb && (pa.lvl !== pb.lvl || pa.load !== pb.load)))) t = after.msgs[e.key] + (def.type === 'load' ? ` → ${kg(pa.load)} kg` : '');
      lines.push(['•', `<b>${esc(e.name)}</b><br><span class="small muted">${t}</span>`]);
    }
    const run = log.ex.find(e => e.type === 'run' && e.sets[0] && e.sets[0].done);
    if (run) lines.push(['🏃', `<b>Run ${esc(run.sets[0].min)} min${run.sets[0].km ? ' · ' + esc(run.sets[0].km) + ' km' : ''}</b>`]);
    openModal(`<div class="grab"></div><span class="pill acc"><span class="dot"></span>Logged</span><h2 style="margin-top:10px">${esc(log.title)} done.</h2>
      <p class="muted small" style="margin:0 0 8px">Here's what the coach changed for you.</p>
      <div>${lines.map(([ic, t]) => `<div class="coach-line"><div class="coach-ic">${ic}</div><div>${t}</div></div>`).join('') || '<div class="empty">Nice work.</div>'}</div>
      <button class="btn primary block" style="margin-top:16px" data-act="close-modal">Got it</button>`);
  }
  function editLog(id) {
    const l = S.logs.find(x => x.id === id); if (!l) return;
    if (S.active) { toast('Finish or close the current workout first.'); return; }
    const base = l.pos ? F.buildSession(S, l.pos, null) : { title: l.title, ex: [] };
    const ex = l.ex.map(e => ({ ...e, cue: F.EX[e.key]?.cue || '', rest: F.EX[e.key]?.rest || 0, e1: F.replay(S).lifts[F.EX[e.key]?.lift]?.e1, lift: F.EX[e.key]?.lift, sets: e.sets.map(x => ({ ...x })) }));
    S.active = { editId: id, date: l.date, readiness: l.readiness, session: { pos: l.pos || base.pos, title: l.title, ex, note: l.note || (l.skipped ? 'Skipped session' : '') } };
    renderSession();
  }

  // ---------- SETTINGS ----------
  function openSettings() {
    const st = S.settings; const p = nextPos();
    const f = (k, l, v, step) => `<div class="field"><label>${l}</label><input class="input num" name="${k}" inputmode="decimal" value="${esc(v)}"></div>`;
    openModal(`<div class="grab"></div><h2>Settings</h2><p class="muted small" style="margin:0 0 16px">All data lives on this device. Export a backup now and then.</p>
      <form data-form="settings">
        <div class="grid2">${f('bw', 'Bodyweight (kg)', st.bw)}${f('inc', 'Smallest plate jump (kg)', st.inc)}</div>
        <div class="grid2">${f('basePull', 'Pull-up 1RM, added kg (start)', st.basePull)}${f('baseDip', 'Dip 1RM, added kg (start)', st.baseDip)}</div>
        <div class="grid2">${f('goalPull', 'Pull-up goal (+kg)', st.goalPull)}${f('goalDip', 'Dip goal (+kg)', st.goalDip)}</div>
        <div class="grid2">${f('mindTarget', 'Daily study target (min)', st.mindTarget)}${f('rowStart', 'Row start weight (kg)', st.startLoads.row ?? 40)}</div>
        <button class="btn primary block">Save</button>
      </form>
      <hr class="sep"><span class="label">Program position</span>
      <p class="small muted" style="margin:6px 0 10px">Next session: ${posLabel(p)}. Jump if you need to.</p>
      <div class="grid3"><input class="input num" id="jw" inputmode="numeric" value="${p.w}" aria-label="week"><input class="input num" id="jd" inputmode="numeric" value="${p.d}" aria-label="day"><button class="btn" data-act="jump">Jump</button></div>
      <hr class="sep"><span class="label">Backup</span>
      <div class="grid2" style="margin-top:10px"><button class="btn" data-act="export">Export</button><label class="btn" style="cursor:pointer">Import<input type="file" accept="application/json" id="imp" hidden></label></div>
      <button class="btn ghost block" style="margin-top:14px;color:var(--bad)" data-act="reset">Reset everything</button>
      <button class="btn block" style="margin-top:8px;background:none;color:var(--muted)" data-act="close-modal">Close</button>`);
  }

  // ---------- modal / sheet ----------
  function openModal(html) { const m = $('#modal'); m.innerHTML = `<div class="modal-box">${html}</div>`; m.hidden = false; }
  function closeModal() { $('#modal').hidden = true; $('#modal').innerHTML = ''; }
  function closeSheet() { $('#sheet').hidden = true; $('#sheet').innerHTML = ''; document.body.style.overflow = ''; }

  // ---------- events ----------
  document.addEventListener('click', ev => {
    const t = ev.target.closest('[data-act],[data-tab]');
    if (!t) { if (ev.target.id === 'modal') closeModal(); return; }
    const a = t.dataset.act;
    if (!a && t.dataset.tab) { setTab(t.dataset.tab); return; }
    const d = t.dataset;
    switch (a) {
      case 'tab': ev.preventDefault(); setTab(d.tab); break;
      case 'settings': openSettings(); break;
      case 'start': askReadiness(nextPos()); break;
      case 'resume': renderSession(); break;
      case 'skip': {
        const p = nextPos();
        S.logs.push({ id: uid(), date: today(), pos: p, bw: S.settings.bw, title: F.dayTemplate(p.w, p.d).title, skipped: true, ex: [] });
        S.nextOverride = null; save(); render(); toast('Skipped. Next session is ready.'); break;
      }
      case 'rq': t.parentElement.querySelectorAll('button').forEach(b => b.classList.toggle('on', b === t)); break;
      case 'ready-go': {
        const v = k => +($(`#rq [data-q="${k}"] .on`)?.dataset.v || 2);
        const score = v('sleep') + v('sore') + v('energy');
        startSession(JSON.parse(d.pos), score <= 4 ? 'low' : score >= 8 ? 'high' : 'ok');
        if (score >= 8) toast('Feeling strong — hit the targets, no ego reps.');
        break;
      }
      case 'ready-skip': startSession(JSON.parse(d.pos), null); break;
      case 'close-session':
        if (S.active.editId) { S.active = null; save(); closeSheet(); render(); }
        else { closeSheet(); render(); toast('Workout saved as draft — resume from Today.'); }
        break;
      case 'cue': { const e = S.active.session.ex[+d.ex]; e.showCue = !e.showCue; renderSession(); break; }
      case 'done': onSetDone(+d.ex, +d.set); break;
      case 'rpe': pickRpe(+d.ex, +d.set); break;
      case 'rpe-set': onRpe(+d.ex, +d.set, +d.v); break;
      case 'finish': finishSession(); break;
      case 'delete-log':
        if (confirm('Delete this session?')) { S.logs = S.logs.filter(l => l.id !== S.active.editId); S.active = null; save(); closeSheet(); render(); toast('Deleted.'); }
        break;
      case 'timer-start': startTimer(180); break;
      case 'timer-add': timerEnd += 30000; tick(); break;
      case 'timer-close': stopTimer(); break;
      case 'close-modal': closeModal(); break;
      case 'week': viewWeek = +d.w; render(); break;
      case 'preview': {
        const pos = { c: +d.c, w: +d.w, d: +d.d };
        const s = F.buildSession(S, pos, null);
        openModal(`<div class="grab"></div><span class="pill ${s.block.tone === 'calm' ? 'calm' : 'acc'}">${s.block.name}</span><h2 style="margin-top:10px">${esc(s.title)}</h2><p class="muted small" style="margin:0">${posLabel(pos)}</p>
          <div class="ex-list">${s.ex.map(e => `<div class="ex-line"><span>${esc(e.name)}</span><span class="num">${esc(exPreview(e))}</span></div>`).join('')}</div>
          <p class="small muted">Loads update automatically as you log.</p>
          <button class="btn primary block" data-act="start-at" data-pos='${JSON.stringify(pos)}'>Do this session next</button>
          <button class="btn block" style="margin-top:8px;background:none;color:var(--muted)" data-act="close-modal">Close</button>`);
        break;
      }
      case 'start-at': S.nextOverride = JSON.parse(d.pos); save(); closeModal(); setTab('today'); break;
      case 'edit-log': editLog(d.id); break;
      case 'todo-toggle': { const x = S.todos.find(q => q.id === d.id); if (x) x.done = !x.done; save(); render(); break; }
      case 'todo-star': { const x = S.todos.find(q => q.id === d.id); if (x) x.star = !x.star; save(); render(); break; }
      case 'todo-del': S.todos = S.todos.filter(q => q.id !== d.id); save(); render(); break;
      case 'todo-move': { const x = S.todos.find(q => q.id === d.id); if (x) x.date = today(); save(); render(); break; }
      case 'todo-move-all': S.todos.forEach(q => { if (q.date < today() && !q.done) q.date = today(); }); save(); render(); break;
      case 'auto-train': if (!t.classList.contains('on')) askReadiness(nextPos()); break;
      case 'auto-mind': setTab('mind'); break;
      case 'mstep': { const inp = t.parentElement.querySelector('input'); inp.value = Math.max(0, (+inp.value || 0) + +d.v); break; }
      case 'honest': { t.parentElement.querySelectorAll('button').forEach(b => b.classList.toggle('on', b === t)); t.closest('form').honest.value = d.v; break; }
      case 'recall': { const e = S.mind[d.k]; (e.recall = e.recall || []).push({ date: today(), ok: d.v === '1' }); save(); render(); toast(d.v === '1' ? 'Locked in.' : 'Re-read it today — that\'s how it sticks.'); break; }
      case 'jump': {
        const w = Math.min(F.WEEKS, Math.max(1, +$('#jw').value || 1)), dd = Math.min(7, Math.max(1, +$('#jd').value || 1));
        S.nextOverride = { c: nextPos().c, w, d: dd }; save(); closeModal(); render(); toast(`Next: Week ${w} · Day ${dd}`); break;
      }
      case 'export': {
        const blob = new Blob([JSON.stringify(S, null, 1)], { type: 'application/json' });
        const u = URL.createObjectURL(blob); const a2 = document.createElement('a'); a2.href = u; a2.download = `forge-backup-${today()}.json`; a2.click(); setTimeout(() => URL.revokeObjectURL(u), 1000); break;
      }
      case 'reset': if (confirm('Erase all data on this device?')) { S = defaults(); save(); closeModal(); closeSheet(); render(); } break;
    }
  });
  document.addEventListener('change', ev => {
    if (ev.target.id === 'imp' && ev.target.files[0]) {
      const r = new FileReader();
      r.onload = () => { try { const x = JSON.parse(r.result); if (!x.settings || !x.logs) throw 0; S = x; save(); closeModal(); render(); toast('Backup restored.'); } catch (e) { toast('Not a valid Forge backup.'); } };
      r.readAsText(ev.target.files[0]);
    }
  });
  document.addEventListener('input', ev => {
    const t = ev.target;
    if (t.dataset.ex != null && S.active) {
      const st = S.active.session.ex[+t.dataset.ex].sets[+t.dataset.set];
      const f = t.dataset.f;
      st[f] = f === 'km' ? t.value : (t.value === '' ? '' : Number(t.value.replace(',', '.')));
      if (f === 'load') st.edited = true;
      save();
    }
  });
  document.addEventListener('submit', ev => {
    ev.preventDefault();
    const f = ev.target, kind = f.dataset.form;
    if (kind === 'todo' || kind === 'todo-tmr') {
      const v = f.t.value.trim(); if (!v) return;
      S.todos.push({ id: uid(), text: v, date: kind === 'todo' ? today() : addDays(today(), 1), done: false, star: false });
      save(); render();
      const inp = document.querySelector(`[data-form="${kind}"] input`); if (inp) inp.focus();
    } else if (kind === 'mind') {
      const min = Math.max(0, +f.min.value || 0);
      const prev = S.mind[today()] || {};
      S.mind[today()] = { ...prev, min, topic: f.topic.value.trim(), insight: f.insight.value.trim(), appliedNote: f.appliedNote.value.trim(), applied: !!f.appliedNote.value.trim(), honest: f.honest.value || null };
      save(); render(); toast(min >= S.settings.mindTarget ? 'Saved. Target hit.' : 'Saved. Honest beats impressive.');
    } else if (kind === 'settings') {
      const n = k => { const v = parseFloat(String(f[k].value).replace(',', '.')); return isFinite(v) ? v : S.settings[k]; };
      Object.assign(S.settings, { bw: n('bw'), inc: n('inc') || 2.5, basePull: n('basePull'), baseDip: n('baseDip'), goalPull: n('goalPull'), goalDip: n('goalDip'), mindTarget: n('mindTarget') });
      const rs = parseFloat(f.rowStart.value); if (isFinite(rs)) S.settings.startLoads.row = rs;
      save(); closeModal(); render(); toast('Settings saved.');
    }
  });

  render();
  if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => {});
})();
