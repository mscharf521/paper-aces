// Paper Aces — shared flight rules. Loaded by the browser (window.PaperRules)
// and by the Vercel API (require("../rules.js")) so both resolve turns identically.
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.PaperRules = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";
  const MAX_HP = 8, UNIT_M = 40, DEG = Math.PI / 180;
  const MAN = {
    hardL:   { name: "Tight left",    long: "Tight turn left",    turn: -2, fwd: 1.2, side: 0,  alt: -0.25, roll: -55, spd: 1 },
    bankL:   { name: "Bank left",     long: "Bank left",          turn: -1, fwd: 2,   side: 0,  alt: 0,     roll: -25, spd: 2 },
    straight:{ name: "Straight",      long: "Straight and level", turn: 0,  fwd: 2,   side: 0,  alt: 0,     roll: 0,   spd: 2 },
    bankR:   { name: "Bank right",    long: "Bank right",         turn: 1,  fwd: 2,   side: 0,  alt: 0,     roll: 25,  spd: 2 },
    hardR:   { name: "Tight right",   long: "Tight turn right",   turn: 2,  fwd: 1.2, side: 0,  alt: -0.25, roll: 55,  spd: 1 },
    slipL:   { name: "Slip left",     long: "Sideslip left",      turn: 0,  fwd: 1.5, side: -1, alt: 0,     roll: -15, spd: 2 },
    slow:    { name: "Throttle back", long: "Throttle back",      turn: 0,  fwd: 1,   side: 0,  alt: 0,     roll: 0,   spd: 1 },
    fast:    { name: "Dive",          long: "Full-throttle dive", turn: 0,  fwd: 3,   side: 0,  alt: -0.5,  roll: 0,   spd: 3 },
    slipR:   { name: "Slip right",    long: "Sideslip right",     turn: 0,  fwd: 1.5, side: 1,  alt: 0,     roll: 15,  spd: 2 },
    immel:   { name: "Immelmann",     long: "Immelmann turn",     turn: 4,  fwd: 1,   side: 0,  alt: 1,     roll: 0,   spd: 1 },
  };
  const ORDER = ["hardL", "bankL", "straight", "bankR", "hardR", "slipL", "slow", "fast", "slipR", "immel"];

  function lockReason(prev, m) {
    if (prev === "immel" && (m === "immel" || m === "fast")) return "Low on energy after the Immelmann.";
    if (prev === "fast" && (m === "hardL" || m === "hardR")) return "Too fast out of the dive to pull a tight turn.";
    if ((prev === "hardL" || prev === "hardR") && m === "fast") return "Still bleeding speed from the tight turn.";
    if (prev === "slow" && m === "immel") return "Not enough speed to go over the top.";
    return null;
  }
  const vec = a => ({ x: Math.sin(a), y: -Math.cos(a) });
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const wrap180 = d => ((d + 180) % 360 + 360) % 360 - 180;

  function move(p, m) {
    const M = MAN[m], q = { ...p };
    const a0 = p.h * 45 * DEG, h1 = (p.h + M.turn + 8) % 8, a1 = h1 * 45 * DEG;
    if (M.turn !== 0 && M.turn !== 4) {
      const v0 = vec(a0), v1 = vec(a1);
      q.x += (v0.x + v1.x) * M.fwd / 2; q.y += (v0.y + v1.y) * M.fwd / 2;
    } else {
      const v = vec(a0), s = vec(a0 + 90 * DEG);
      q.x += v.x * M.fwd + s.x * M.side; q.y += v.y * M.fwd + s.y * M.side;
    }
    q.h = h1; q.alt = clamp(p.alt + M.alt, 0, 6); q.roll = M.roll; q.last = m; q.spd = M.spd;
    return q;
  }
  function relative(me, en) {
    const dx = en.x - me.x, dy = en.y - me.y, a = me.h * 45 * DEG;
    const f = vec(a), r = vec(a + 90 * DEG);
    const fw = dx * f.x + dy * f.y, rt = dx * r.x + dy * r.y;
    return { fw, rt, dist: Math.hypot(dx, dy), bearing: Math.atan2(rt, fw) / DEG,
             yaw: wrap180((en.h - me.h) * 45), dAlt: en.alt - me.alt };
  }
  function hitsOn(me, en) {
    const r = relative(me, en), b = Math.abs(r.bearing);
    if (Math.abs(r.dAlt) > 1) return 0;
    if (r.dist <= 1.8 && b <= 22) return 2;
    if (r.dist <= 4.5 && b <= 15) return 1;
    return 0;
  }
  function step(a, b, ma, mb) {
    const A = move(a, ma), B = move(b, mb);
    const ev = { collide: false, hitA: 0, hitB: 0 };
    const d = Math.hypot(A.x - B.x, A.y - B.y);
    if (d < 0.7 && Math.abs(A.alt - B.alt) < 0.6) { ev.collide = true; A.hp -= 1; B.hp -= 1; }
    ev.hitA = hitsOn(A, B); ev.hitB = hitsOn(B, A);
    B.hp -= ev.hitA; A.hp -= ev.hitB;
    return { A, B, ev };
  }
  function pageNumber(me, en) {
    const r = relative(me, en);
    const band = r.dist < 1.8 ? 0 : r.dist < 3 ? 1 : r.dist < 4.5 ? 2 : r.dist < 7 ? 3 : 4;
    const clock = ((Math.round(r.bearing / 30) % 12) + 12) % 12;
    const asp = ((Math.round(r.yaw / 45) % 8) + 8) % 8;
    const lvl = r.dAlt > 0.5 ? 2 : r.dAlt < -0.5 ? 0 : 1;
    return 1 + ((band * 12 + clock) * 8 + asp) * 3 + lvl;
  }
  function clockOf(bearing) { const c = Math.round(((bearing % 360) + 360) % 360 / 30); return c === 0 ? 12 : c; }

  function newDuel() {
    const s = {
      turn: 1, over: false, overText: "", winner: 0,
      p1: { x: 0.6, y: 4, h: 0, alt: 3, hp: MAX_HP, roll: 0, last: null, side: "blue", spd: 2 },
      p2: { x: -0.6, y: -4, h: 4, alt: 3, hp: MAX_HP, roll: 0, last: null, side: "red", spd: 2 },
      log: [], fx1: {}, fx2: {},
    };
    s.trail1 = [{ x: s.p1.x, y: s.p1.y }]; s.trail2 = [{ x: s.p2.x, y: s.p2.y }];
    s.log.unshift({ n: 1, t: `Two aircraft close head-on at ${8 * UNIT_M} m. Blue flies north, Red flies south.` });
    return s;
  }

  // Resolve one turn in place. names = [blueName, redName] for the log.
  function resolveTurn(S, m1, m2, names, rand) {
    rand = rand || Math.random;
    const log = (t, hit) => S.log.unshift({ t, hit: !!hit, n: S.turn });
    const { A, B, ev } = step(S.p1, S.p2, m1, m2);
    log(`${names[0]}: ${MAN[m1].long.toLowerCase()}. ${names[1]}: ${MAN[m2].long.toLowerCase()}.`);
    if (ev.collide) log("Wingtips touch as they pass. Both aircraft take damage.", true);
    if (ev.hitA) log(`${names[0]} ${ev.hitA === 2 ? "rakes " + names[1] + " at point-blank range" : "lands a burst on " + names[1]} (${ev.hitA} hit${ev.hitA > 1 ? "s" : ""}).`, true);
    if (ev.hitB) log(`${names[1]} ${ev.hitB === 2 ? "rakes " + names[0] + " at point-blank range" : "lands a burst on " + names[0]} (${ev.hitB} hit${ev.hitB > 1 ? "s" : ""}).`, true);
    S.p1 = A; S.p2 = B; S.trail1.push({ x: A.x, y: A.y }); S.trail2.push({ x: B.x, y: B.y });
    if (S.trail1.length > 12) { S.trail1.shift(); S.trail2.shift(); }
    const seed = Math.floor(rand() * 1e6);
    S.fx1 = { out: ev.hitA, inc: ev.hitB, seed }; S.fx2 = { out: ev.hitB, inc: ev.hitA, seed: seed + 1 };
    if (A.hp > 0 && B.hp > 0 && Math.hypot(A.x - B.x, A.y - B.y) > 10) {
      const v = vec(A.h * 45 * DEG), sd = vec((A.h + 2) * 45 * DEG), off = rand() * 2 - 1;
      S.p2 = { ...B, x: A.x + v.x * 7 + sd.x * off, y: A.y + v.y * 7 + sd.y * off, h: (A.h + 4) % 8,
               alt: clamp(A.alt + Math.round(rand() * 2 - 1), 0, 6), roll: 0, last: null };
      S.p1 = { ...A, last: null };
      S.trail1 = [{ x: S.p1.x, y: S.p1.y }]; S.trail2 = [{ x: S.p2.x, y: S.p2.y }];
      log("The aircraft lose each other, then wheel around and close head-on again.");
    }
    S.turn++;
    if (S.log.length > 60) S.log.length = 60;
    const d1 = S.p1.hp <= 0, d2 = S.p2.hp <= 0;
    if (d1 || d2) {
      S.over = true;
      S.winner = d1 && d2 ? 0 : d2 ? 1 : 2;
      S.overText = d1 && d2 ? "Both aircraft go down. No victory today." : `${names[d2 ? 0 : 1]} wins.`;
      S.log.unshift({ t: S.overText, hit: true, n: S.turn - 1 });
    }
    return ev;
  }

  // Computer pilot
  function evalPos(me, en) {
    const a = relative(me, en), b = relative(en, me);
    const prox = d => Math.max(0, 1 - d / 8);
    const aim = r => Math.max(0, Math.cos(r.bearing * DEG)) ** 3 * prox(r.dist) * (Math.abs(r.dAlt) <= 1 ? 1 : 0.4);
    return aim(a) * 2 - aim(b) * 2.4 + (me.hp - en.hp) * 4;
  }
  function aiChoose(me, en, level) {
    const mine = ORDER.filter(m => !lockReason(me.last, m));
    const theirs = ORDER.filter(m => !lockReason(en.last, m));
    const scored = mine.map(m => {
      const vals = theirs.map(o => {
        const { A, B } = step(me, en, m, o);
        if (B.hp <= 0 && A.hp > 0) return 100;
        if (A.hp <= 0) return -100;
        return evalPos(A, B);
      });
      const avg = vals.reduce((s, v) => s + v, 0) / vals.length, min = Math.min(...vals);
      return { m, v: level >= 2 ? avg * 0.55 + min * 0.45 : avg + (Math.random() - 0.5) * 6 };
    });
    scored.sort((x, y) => y.v - x.v);
    if (level >= 2) return Math.random() < 0.85 ? scored[0].m : scored[Math.min(1, scored.length - 1)].m;
    return scored[Math.floor(Math.random() * Math.min(4, scored.length))].m;
  }

  return { MAX_HP, UNIT_M, DEG, MAN, ORDER, lockReason, vec, clamp, wrap180, move, relative, hitsOn, step,
           pageNumber, clockOf, newDuel, resolveTurn, aiChoose };
});
