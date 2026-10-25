/* FORGE — program + autoregulation engine
 * Loads for weighted pull-ups / dips are calculated on TOTAL system load
 * (bodyweight + added weight), because both move. RPE → %1RM uses the
 * Tuchscherer / RTS chart (RPE 10 = 0 reps left, 9 = 1 left, 8 = 2 left …).
 */
(function (global) {
  'use strict';

  // %1RM by "effective reps" = reps + reps-in-reserve  (RTS chart, RPE 10 column + half steps)
  const PCT = {
    1: 100, 1.5: 97.8, 2: 95.5, 2.5: 93.9, 3: 92.2, 3.5: 90.7, 4: 89.2, 4.5: 87.8,
    5: 86.3, 5.5: 85.0, 6: 83.7, 6.5: 82.4, 7: 81.1, 7.5: 79.9, 8: 78.6, 8.5: 77.4,
    9: 76.2, 9.5: 75.1, 10: 73.9, 10.5: 72.3, 11: 70.7, 11.5: 69.4, 12: 68.0,
    12.5: 66.7, 13: 65.3, 13.5: 64.0
  };
  function pct(reps, rpe) {
    let e = Math.max(1, reps + (10 - (rpe == null ? 8 : rpe)));
    e = Math.round(e * 2) / 2;
    if (PCT[e] != null) return PCT[e] / 100;
    // extrapolate past the chart (~1.35% per rep)
    return Math.max(0.4, (64.0 - (e - 13.5) * 1.35) / 100);
  }

  // ---------- Exercise library ----------
  // type: main = e1RM-driven weighted lift · load = weighted accessory (double progression)
  //       bw = bodyweight reps · hold = seconds · run / check
  // hyp: true = physique (hypertrophy) accessory — trimmed by 1 set in the peak block
  // inc: weight jump for that exercise (dumbbells usually move 1–2 kg)
  const EX = {
    wpu:   { name: 'Weighted Pull-up', type: 'main', lift: 'pull', rest: 210,
             cue: 'Dead hang start, chin clearly over bar. Same depth every rep.' },
    wdip:  { name: 'Weighted Dip', type: 'main', lift: 'dip', rest: 210,
             cue: 'Shoulders just below elbows at the bottom, full lockout on top. Lower chest.' },

    // back & biceps (physique: 2 sets to ~10 reps, or 3 sets, all close to failure)
    row:   { name: 'Barbell Row', type: 'load', lo: 8, hi: 12, rpe: 9, rest: 120, start: 60, inc: 2.5, hyp: true,
             cue: 'Hinge ~45°, bar to lower chest, pause 1 s on top. Close to failure. Upper-back thickness.' },
    pulldown: { name: 'Lat Pulldown', type: 'load', lo: 8, hi: 12, rpe: 9, rest: 90, start: 50, inc: 2.5, hyp: true,
             cue: 'Full stretch at the top, pull elbows to your sides. Lat width.' },
    sarow: { name: 'Single-arm DB Row', type: 'load', lo: 8, hi: 12, rpe: 9, rest: 90, start: 26, inc: 2, hyp: true,
             cue: 'Per arm, weight = one dumbbell. Reach long at the bottom, drive elbow to the hip.' },
    preacher: { name: 'Preacher Curl', type: 'load', lo: 8, hi: 12, rpe: 9, rest: 90, start: 20, inc: 1.25, hyp: true,
             cue: 'Control the bottom — the stretched position is where this grows the arm. Weight = total on the bar.' },
    hammer:{ name: 'Hammer Curl', type: 'load', lo: 8, hi: 12, rpe: 9, rest: 75, start: 12, inc: 2, hyp: true,
             cue: 'Weight = one dumbbell. Brachialis and forearm.' },
    face:  { name: 'Face Pull', type: 'bw', lo: 15, hi: 25, rpe: 8, rest: 45,
             cue: 'Cable or band. Rear delts and external rotation — keeps shoulders healthy under heavy pressing.' },

    // chest & triceps (chest day = dip lower + incline DB upper + DB fly middle/stretch)
    incdb: { name: 'Incline DB Press', type: 'load', lo: 8, hi: 12, rpe: 9, rest: 120, start: 22, inc: 2, hyp: true,
             cue: 'Bench ~30°. Weight = one dumbbell. Deep stretch at the bottom. Upper chest.' },
    fly:   { name: 'Dumbbell Fly', type: 'load', lo: 8, hi: 12, rpe: 9, rest: 75, start: 12, inc: 2, hyp: true,
             cue: 'Slight elbow bend, lower to a deep stretch across the chest, squeeze over the midline. Middle chest and the big stretch.' },
    ohext: { name: 'Overhead Triceps Extension', type: 'load', lo: 10, hi: 15, rpe: 9, rest: 90, start: 20, inc: 2.5, hyp: true,
             cue: 'Cable or DB behind the head. Overhead = long head stretched; grew ~40% more than pushdowns in a 12-week study.' },

    // skills
    hshold:{ name: 'Freestanding Handstand Hold', type: 'hold', lo: 20, hi: 60, rpe: 7, rest: 60,
             cue: 'Stacked line, push tall. Kick up fresh each set. First in the session.' },
    neg90: { name: '90° Negatives', type: 'bw', lo: 2, hi: 5, rpe: 8, rest: 150,
             cue: 'From handstand lower 3–5 s into the 90° position, hold 1–2 s. Hardest skill first, so it gets your freshest rep.' },
    fshspu:{ name: 'Freestanding HSPU', type: 'bw', lo: 1, hi: 5, rpe: 8, rest: 120,
             cue: 'Quality singles/doubles. Stop before balance breaks down.' },
    dhspu: { name: 'Deficit Wall HSPU', type: 'bw', lo: 3, hi: 8, rpe: 8, rest: 150,
             cue: 'Hands on parallettes/plates, 5–10 cm deficit. When you hit 4×8, raise the deficit.' },
    whspu: { name: 'Wall HSPU (strict)', type: 'bw', lo: 4, hi: 10, rpe: 8, rest: 120,
             cue: 'Head to floor (or deficit), elbows ~45°. Controlled 2s down.' },
    hlr:   { name: 'Hanging Leg Raise', type: 'bw', lo: 8, hi: 15, rpe: 9, rest: 75, hyp: true,
             cue: 'No swing. Close to failure. Toes to bar when range is easy.' },

    // legs
    rdl:   { name: 'Romanian Deadlift', type: 'load', lo: 8, hi: 12, rpe: 9, rest: 150, start: 60, inc: 2.5, hyp: true,
             cue: 'Soft knees, hips back, bar close, flat back. Stop at a full hamstring stretch. Hamstrings and glutes.' },
    slp:   { name: 'Single-leg Press', type: 'load', lo: 8, hi: 12, rpe: 9, rest: 90, start: 60, inc: 5, hyp: true,
             cue: 'Machine, one leg at a time. Full depth without the lower back rounding, drive through the whole foot. Quads and glutes.' },
    calf:  { name: 'Standing Calf Raise', type: 'load', lo: 10, hi: 15, rpe: 9, rest: 60, start: 40, inc: 5, hyp: true,
             cue: 'Pause 2 s in the deep stretch at the bottom, full rise on top.' },

    // legacy entries kept so old logs still display (not in the program any more)
    lateral: { name: 'Lateral Raise (legacy)', type: 'load', lo: 12, hi: 20, rpe: 9, rest: 60, start: 8, inc: 1, hyp: true, cue: '' },
    plean: { name: 'Planche Lean (legacy)', type: 'hold', lo: 10, hi: 30, rpe: 8, rest: 90, cue: '' },
    lsit:  { name: 'L-sit (legacy)', type: 'hold', lo: 10, hi: 30, rpe: 8, rest: 60, cue: '' },
    bss:   { name: 'Bulgarian Split Squat (legacy)', type: 'load', lo: 8, hi: 12, rpe: 8, rest: 90, start: 0, inc: 2, hyp: true, cue: '' },

    mob:   { name: 'Shoulder & Wrist Mobility', type: 'check', min: 10, rest: 0,
             cue: 'Wrist rocks, shoulder dislocates, thoracic opener, pec stretch.' },
    run:   { name: 'Easy Run', type: 'run', rest: 0,
             cue: 'Conversational pace (you can talk in full sentences). Run after lifting or 3+ h apart.' }
  };

  // ---------- Periodization ----------
  const g = (n, reps, rpe) => ({ n, reps, rpe });
  const HEAVY = {
    1: [g(5, 3, 7)], 2: [g(5, 3, 8)], 3: [g(5, 3, 8.5)], 4: [g(1, 1, 8), g(2, 3, 7)],
    5: [g(1, 1, 8), g(4, 3, 8)], 6: [g(1, 1, 8.5), g(4, 3, 8)], 7: [g(1, 1, 9), g(3, 2, 8.5)],
    8: [g(1, 1, 8), g(2, 3, 7)], 9: [g(1, 1, 8.5), g(4, 2, 8.5)], 10: [g(1, 1, 9), g(3, 2, 9)],
    11: [g(1, 1, 9), g(2, 1, 9)], 12: [g(1, 1, 8), g(1, 1, 9), g(1, 1, 10)]
  };
  const VOLUME = {
    1: [g(4, 6, 7)], 2: [g(4, 6, 7.5)], 3: [g(4, 6, 8)], 4: [g(3, 5, 6)],
    5: [g(4, 5, 7.5)], 6: [g(5, 5, 8)], 7: [g(4, 4, 8)], 8: [g(3, 4, 6)],
    9: [g(4, 4, 8)], 10: [g(3, 3, 8)], 11: [g(3, 3, 7.5)], 12: [g(2, 3, 6)]
  };
  function block(w) {
    if (w === 4 || w === 8) return { name: 'Deload', tone: 'calm' };
    if (w <= 3) return { name: 'Rebuild', tone: 'build' };
    if (w <= 7) return { name: 'Strength + Size', tone: 'build' };
    if (w <= 11) return { name: 'Peak', tone: 'hard' };
    return { name: 'Test week', tone: 'hard' };
  }
  function runMin(w, d) {
    const base = w <= 2 ? 20 : w <= 5 ? 25 : 30;
    if (d === 4) return base + 5;
    return base;
  }
  const isDeload = w => w === 4 || w === 8 || w === 12;
  const isPeak = w => w >= 9 && w <= 11;

  function acc(key, sets, w) {
    let s = sets;
    if (isDeload(w)) s = Math.max(2, sets - 1);
    else if (isPeak(w) && EX[key].hyp) s = Math.max(2, sets - 1); // free up recovery for heavy singles
    return { key, sets: s };
  }

  // day templates → list of {key, groups? (main), sets? (other), note}
  // Order inside a day = order of work. Skills go first, hardest first.
  function dayTemplate(w, d) {
    const run = (extra) => ({ key: 'run', minutes: runMin(w, d), note: extra || '' });
    switch (d) {
      case 1: return { title: w === 12 ? 'Pull-up Max Test' : 'Heavy Pull + Back & Biceps', focus: 'Pull strength · back width & thickness · biceps', items: [
        { key: 'wpu', groups: HEAVY[w], note: w === 12 ? 'Work up: single @8, @9, then a true max attempt. Full 4–5 min rest.' : '' },
        acc('row', 2, w), acc('pulldown', 3, w), acc('preacher', 3, w), acc('face', 2, w), acc('hlr', 3, w), run()] };
      case 2: return { title: 'Handstand + Shoulders', focus: 'Handstand hold → 90° negatives → HSPU → deficit HSPU', items: [
        acc('hshold', 5, w), acc('neg90', 4, w), acc('fshspu', 5, w), acc('dhspu', 4, w), run()] };
      case 3: return { title: w === 12 ? 'Dip Max Test' : 'Heavy Dip + Chest, Triceps, Legs', focus: 'Chest: dip (lower) · incline DB (upper) · DB fly (middle + stretch)', items: [
        { key: 'wdip', groups: HEAVY[w], note: w === 12 ? 'Work up: single @8, @9, then a true max attempt.' : '' },
        acc('incdb', 3, w), acc('fly', 3, w), acc('ohext', 3, w), acc('rdl', 3, w), acc('hlr', 3, w), run('Keep it truly easy today — legs worked.')] };
      case 4: return { title: 'Recovery', focus: 'Aerobic base', items: [
        run('Longest run of the week — still easy.'), { key: 'mob', sets: 1 }, acc('hshold', 4, w)] };
      case 5: return { title: 'Volume Pull + Arms', focus: 'Pull volume · lats · arms', items: [
        { key: 'wpu', groups: VOLUME[w] }, acc('whspu', 3, w), acc('sarow', 3, w), acc('hammer', 3, w), run()] };
      case 6: return { title: 'Volume Dip + Chest & Legs', focus: 'Chest: dip (lower) · incline DB (upper) · DB fly (middle + stretch) · quads & glutes', items: [
        { key: 'wdip', groups: VOLUME[w] }, acc('neg90', 4, w), acc('incdb', 3, w), acc('fly', 3, w), acc('slp', 3, w), acc('calf', 3, w),
        run(w >= 3 && !isDeload(w) ? 'Finish with 6 × 15 s relaxed strides.' : '')] };
      case 7: return { title: 'Rest', focus: 'Recover', items: [
        { key: 'run', minutes: 20, note: 'Optional. If readiness is low, walk instead.' }, { key: 'mob', sets: 1 }] };
    }
  }

  // ---------- Positions ----------
  const WEEKS = 12;
  const posIndex = p => (p.c - 1) * WEEKS * 7 + (p.w - 1) * 7 + (p.d - 1);
  const posFrom = i => ({ c: Math.floor(i / (WEEKS * 7)) + 1, w: Math.floor((i % (WEEKS * 7)) / 7) + 1, d: (i % 7) + 1 });

  // ---------- Replay: derive all progress from logs ----------
  function replay(state) {
    const s = state.settings;
    const lifts = {
      pull: { e1: s.bw + s.basePull, best: s.bw + s.basePull, hist: [], flag: null },
      dip:  { e1: s.bw + s.baseDip,  best: s.bw + s.baseDip,  hist: [], flag: null }
    };
    const prog = {};
    const msgs = {};
    const logs = [...state.logs].filter(l => !l.skipped).sort((a, b) => (a.date + a.id).localeCompare(b.date + b.id));
    for (const log of logs) {
      for (const ex of (log.ex || [])) {
        const def = EX[ex.key];
        if (!def) continue;
        const done = (ex.sets || []).filter(x => x.done);
        if (!done.length) continue;
        if (def.type === 'main') {
          const L = lifts[def.lift];
          let best = 0, hard = false;
          for (const st of done) {
            const rpe = st.rpe != null ? st.rpe : st.trpe;
            const est = (Number(st.load) + Number(log.bw || s.bw)) / pct(Number(st.reps), rpe);
            best = Math.max(best, est);
            if ((st.rpe != null && st.trpe != null && st.rpe - st.trpe >= 1.5) || (st.treps && st.reps < st.treps)) hard = true;
          }
          if (best > 0) {
            const before = L.e1;
            if (best >= L.e1) L.e1 = Math.min(best, L.e1 * 1.04);
            else L.e1 = L.e1 * 0.5 + best * 0.5;
            L.best = Math.max(L.best, L.e1);
            L.hist.push({ date: log.date, e1: L.e1, bw: Number(log.bw || s.bw) });
            L.flag = hard ? 'hard' : null;
            L.last = { before, after: L.e1, date: log.date };
          }
        } else if (def.type === 'bw' || def.type === 'load' || def.type === 'hold') {
          const P = prog[ex.key] || (prog[ex.key] = {
            t: def.lo, load: def.type === 'load' ? (s.startLoads?.[ex.key] ?? def.start) : 0, lvl: 0
          });
          const val = st => def.type === 'hold' ? Number(st.sec || 0) : Number(st.reps || 0);
          const tgt = Number(ex.target ?? P.t);
          const maxRpe = Math.max(...done.map(x => x.rpe ?? x.trpe ?? def.rpe));
          const allHit = done.length >= (ex.sets || []).length && done.every(x => val(x) >= tgt);
          const missed = done.some(x => val(x) <= tgt - (def.type === 'hold' ? 8 : 2));
          if (def.type === 'load' && done[0] && done[0].load != null && done[0].load !== '') P.load = Number(done[0].load);
          const step = def.type === 'hold' ? 5 : 1;
          if (allHit && maxRpe <= (def.rpe + 0.5)) {
            // if you clearly did more than prescribed, jump the target to what you actually did
            const minDone = Math.min(...done.map(val));
            P.t = Math.max(tgt + step, Math.min(minDone, def.hi + step));
            if (P.t > def.hi) {
              if (def.type === 'load') { P.load = Number(P.load) + (def.inc || s.inc); P.t = def.lo; msgs[ex.key] = 'Weight up'; }
              else if (def.type === 'bw') { P.t = def.lo; P.lvl++; msgs[ex.key] = 'Level up — make it harder'; }
              else { P.t = def.hi; msgs[ex.key] = 'Maxed — progress the variation'; }
            }
          } else if (missed || maxRpe >= 10) {
            P.t = Math.max(def.lo, tgt - step);
          } else P.t = tgt;
        }
      }
    }
    return { lifts, prog, msgs };
  }

  function roundLoad(x, inc) {
    return Math.max(0, Math.floor(x / inc + 0.4) * inc);
  }
  function loadFor(e1, reps, rpe, bw, inc) {
    const total = e1 * pct(reps, rpe);
    const added = total - bw;
    if (added <= 0) return 0;
    return roundLoad(added, inc);
  }

  // ---------- Build a session prescription ----------
  // readiness: 'low' | 'ok' | 'high' | null
  function buildSession(state, pos, readiness, rep) {
    rep = rep || replay(state);
    const s = state.settings;
    const t = dayTemplate(pos.w, pos.d);
    const out = { pos, title: t.title, focus: t.focus, block: block(pos.w), deload: isDeload(pos.w), ex: [], coach: [] };
    if (readiness === 'low') out.coach.push('Low readiness: target RPE −0.5 and one less set on main lifts. Still show up — a good session beats a perfect plan.');
    for (const it of t.items) {
      const def = EX[it.key];
      const e = { key: it.key, name: def.name, type: def.type, cue: def.cue, note: it.note || '', rest: def.rest, sets: [] };
      if (def.type === 'main') {
        const L = rep.lifts[def.lift];
        let groups = it.groups.map(x => ({ ...x }));
        const isTest = groups.some(x => x.rpe === 10);
        if (L.flag === 'hard' && !isTest) {
          const big = groups.reduce((a, b) => (b.n > a.n ? b : a));
          if (big.n > 1) big.n -= 1;
          groups.forEach(x => { x.rpe = Math.max(6, x.rpe - 0.5); });
          e.flag = 'Last session ran hotter than planned → 1 set less, RPE −0.5 today.';
        }
        if (readiness === 'low' && !isTest) {
          const big = groups.reduce((a, b) => (b.n > a.n ? b : a));
          if (big.n > 1) big.n -= 1;
          groups.forEach(x => { x.rpe = Math.max(6, x.rpe - 0.5); });
        }
        for (const gr of groups) for (let i = 0; i < gr.n; i++) {
          e.sets.push({ treps: gr.reps, trpe: gr.rpe, reps: gr.reps, load: loadFor(L.e1, gr.reps, gr.rpe, s.bw, s.inc), rpe: null, done: false });
        }
        e.e1 = L.e1; e.lift = def.lift;
        e.summary = groups.map(x => `${x.n}×${x.reps} @${x.rpe}`).join(' + ');
      } else if (def.type === 'run') {
        e.sets.push({ min: it.minutes, km: '', done: false });
        e.summary = `${it.minutes} min easy`;
      } else if (def.type === 'check') {
        e.sets.push({ min: def.min, done: false });
        e.summary = `${def.min} min`;
      } else {
        const P = rep.prog[it.key] || { t: def.lo, load: def.type === 'load' ? (s.startLoads?.[it.key] ?? def.start) : 0, lvl: 0 };
        let n = it.sets;
        if (readiness === 'low') n = Math.max(2, n - 1);
        e.target = P.t;
        const trpe = out.deload ? def.rpe - 1 : def.rpe;
        for (let i = 0; i < n; i++) {
          if (def.type === 'hold') e.sets.push({ tsec: P.t, sec: P.t, trpe, rpe: null, done: false });
          else e.sets.push({ treps: P.t, reps: P.t, trpe, load: def.type === 'load' ? P.load : undefined, rpe: null, done: false });
        }
        e.summary = def.type === 'hold' ? `${n}×${P.t}s` : `${n}×${P.t}` + (def.type === 'load' ? ` · ${P.load ? P.load + ' kg' : 'BW'}` : '') + ` @${trpe}`;
        if (P.lvl) e.lvl = P.lvl;
        if (rep.msgs[it.key]) e.flag = rep.msgs[it.key] + (def.type === 'bw' ? ' (raise deficit / harder variation, reps reset).' : '.');
      }
      out.ex.push(e);
    }
    return out;
  }

  // live autoregulation inside a session for main lifts
  function adjustRemaining(e, setIdx, s) {
    const st = e.sets[setIdx];
    if (st.rpe == null || st.trpe == null) return null;
    const diff = st.rpe - st.trpe;
    if (Math.abs(diff) < 1 && st.reps >= st.treps) return null;
    // blend the single-set estimate 50/50 with the planned max so one misjudged set can't swing loads wildly
    const e1 = 0.5 * (e.e1 || 0) + 0.5 * ((Number(st.load) + s.bw) / pct(Number(st.reps), st.rpe));
    let changed = null;
    for (let i = setIdx + 1; i < e.sets.length; i++) {
      const r = e.sets[i];
      if (r.done || r.edited) continue;
      const nl = loadFor(e1, r.treps, r.trpe, s.bw, s.inc);
      if (nl !== r.load) { r.load = nl; changed = nl; }
    }
    return changed == null ? null : { load: changed, harder: diff < 0 };
  }

  global.Forge = { EX, pct, replay, buildSession, adjustRemaining, dayTemplate, block, posIndex, posFrom, WEEKS, loadFor, isDeload };
})(window);
