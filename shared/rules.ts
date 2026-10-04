// Flight rules shared by the browser and the API, so a turn resolves identically on both.

export const MAX_HP = 8;
export const UNIT_M = 40; // metres per map unit
export const DEG = Math.PI / 180;

export type ManeuverId =
  | "hardL" | "bankL" | "straight" | "bankR" | "hardR"
  | "slipL" | "slow" | "fast" | "slipR" | "immel";

export interface Maneuver {
  name: string; long: string;
  turn: number; fwd: number; side: number; alt: number; roll: number; spd: number;
}

export const MAN: Record<ManeuverId, Maneuver> = {
  hardL:    { name: "Tight left",    long: "Tight turn left",    turn: -2, fwd: 1.2, side: 0,  alt: -0.25, roll: -55, spd: 1 },
  bankL:    { name: "Bank left",     long: "Bank left",          turn: -1, fwd: 2,   side: 0,  alt: 0,     roll: -25, spd: 2 },
  straight: { name: "Straight",      long: "Straight and level", turn: 0,  fwd: 2,   side: 0,  alt: 0,     roll: 0,   spd: 2 },
  bankR:    { name: "Bank right",    long: "Bank right",         turn: 1,  fwd: 2,   side: 0,  alt: 0,     roll: 25,  spd: 2 },
  hardR:    { name: "Tight right",   long: "Tight turn right",   turn: 2,  fwd: 1.2, side: 0,  alt: -0.25, roll: 55,  spd: 1 },
  slipL:    { name: "Slip left",     long: "Sideslip left",      turn: 0,  fwd: 1.5, side: -1, alt: 0,     roll: -15, spd: 2 },
  slow:     { name: "Throttle back", long: "Throttle back",      turn: 0,  fwd: 1,   side: 0,  alt: 0,     roll: 0,   spd: 1 },
  fast:     { name: "Dive",          long: "Full-throttle dive", turn: 0,  fwd: 3,   side: 0,  alt: -0.5,  roll: 0,   spd: 3 },
  slipR:    { name: "Slip right",    long: "Sideslip right",     turn: 0,  fwd: 1.5, side: 1,  alt: 0,     roll: 15,  spd: 2 },
  immel:    { name: "Immelmann",     long: "Immelmann turn",     turn: 4,  fwd: 1,   side: 0,  alt: 1,     roll: 0,   spd: 1 },
};

export const ORDER: ManeuverId[] = ["hardL", "bankL", "straight", "bankR", "hardR", "slipL", "slow", "fast", "slipR", "immel"];
export const isManeuver = (m: unknown): m is ManeuverId => typeof m === "string" && m in MAN;

export type Side = "blue" | "red";
export type Seat = 1 | 2;

export interface Plane {
  x: number; y: number; h: number; alt: number; hp: number; roll: number;
  last: ManeuverId | null; side: Side; spd: number;
}
export interface Fx { out?: number; inc?: number; seed?: number }
export interface LogEntry { n: number; t: string; hit?: boolean }
export interface Point { x: number; y: number }

export interface Duel {
  turn: number;
  over: boolean;
  overText: string;
  winner: 0 | 1 | 2; // 0 = both down (or none yet)
  p1: Plane; p2: Plane;
  trail1: Point[]; trail2: Point[];
  log: LogEntry[];
  fx1: Fx; fx2: Fx;
}

export function lockReason(prev: ManeuverId | null, m: ManeuverId): string | null {
  if (prev === "immel" && (m === "immel" || m === "fast")) return "Low on energy after the Immelmann.";
  if (prev === "fast" && (m === "hardL" || m === "hardR")) return "Too fast out of the dive to pull a tight turn.";
  if ((prev === "hardL" || prev === "hardR") && m === "fast") return "Still bleeding speed from the tight turn.";
  if (prev === "slow" && m === "immel") return "Not enough speed to go over the top.";
  return null;
}

export const vec = (a: number): Point => ({ x: Math.sin(a), y: -Math.cos(a) });
export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
export const wrap180 = (d: number) => ((d + 180) % 360 + 360) % 360 - 180;

export function move(p: Plane, m: ManeuverId): Plane {
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

export interface Relative { fw: number; rt: number; dist: number; bearing: number; yaw: number; dAlt: number }

export function relative(me: Plane, en: Plane): Relative {
  const dx = en.x - me.x, dy = en.y - me.y, a = me.h * 45 * DEG;
  const f = vec(a), r = vec(a + 90 * DEG);
  const fw = dx * f.x + dy * f.y, rt = dx * r.x + dy * r.y;
  return { fw, rt, dist: Math.hypot(dx, dy), bearing: Math.atan2(rt, fw) / DEG,
           yaw: wrap180((en.h - me.h) * 45), dAlt: en.alt - me.alt };
}

/** Hits `me` scores on `en` from the current positions. */
export function hitsOn(me: Plane, en: Plane): number {
  const r = relative(me, en), b = Math.abs(r.bearing);
  if (Math.abs(r.dAlt) > 1) return 0;
  if (r.dist <= 1.8 && b <= 22) return 2;
  if (r.dist <= 4.5 && b <= 15) return 1;
  return 0;
}

export function step(a: Plane, b: Plane, ma: ManeuverId, mb: ManeuverId) {
  const A = move(a, ma), B = move(b, mb);
  const ev = { collide: false, hitA: 0, hitB: 0 };
  const d = Math.hypot(A.x - B.x, A.y - B.y);
  if (d < 0.7 && Math.abs(A.alt - B.alt) < 0.6) { ev.collide = true; A.hp -= 1; B.hp -= 1; }
  ev.hitA = hitsOn(A, B); ev.hitB = hitsOn(B, A);
  B.hp -= ev.hitA; A.hp -= ev.hitB;
  return { A, B, ev };
}

/** The "page" a pilot turns to: one number per distinct view (1–1440). */
export function pageNumber(me: Plane, en: Plane): number {
  const r = relative(me, en);
  const band = r.dist < 1.8 ? 0 : r.dist < 3 ? 1 : r.dist < 4.5 ? 2 : r.dist < 7 ? 3 : 4;
  const clock = ((Math.round(r.bearing / 30) % 12) + 12) % 12;
  const asp = ((Math.round(r.yaw / 45) % 8) + 8) % 8;
  const lvl = r.dAlt > 0.5 ? 2 : r.dAlt < -0.5 ? 0 : 1;
  return 1 + ((band * 12 + clock) * 8 + asp) * 3 + lvl;
}

export function clockOf(bearing: number): number {
  const c = Math.round((((bearing % 360) + 360) % 360) / 30);
  return c === 0 || c === 12 ? 12 : c;
}

export function newDuel(): Duel {
  const p1: Plane = { x: 0.6, y: 4, h: 0, alt: 3, hp: MAX_HP, roll: 0, last: null, side: "blue", spd: 2 };
  const p2: Plane = { x: -0.6, y: -4, h: 4, alt: 3, hp: MAX_HP, roll: 0, last: null, side: "red", spd: 2 };
  return {
    turn: 1, over: false, overText: "", winner: 0, p1, p2,
    trail1: [{ x: p1.x, y: p1.y }], trail2: [{ x: p2.x, y: p2.y }],
    log: [{ n: 1, t: `Two aircraft close head-on at ${8 * UNIT_M} m. Blue flies north, Red flies south.` }],
    fx1: {}, fx2: {},
  };
}

/** Fly one turn. Returns a new duel; the input is not changed. names = [blue, red] for the log. */
export function resolveTurn<T extends Duel>(duel: T, m1: ManeuverId, m2: ManeuverId, names: [string, string], rand: () => number = Math.random): T {
  const S: T = structuredClone(duel);
  const log = (t: string, hit = false) => S.log.unshift({ t, hit, n: S.turn });
  const { A, B, ev } = step(S.p1, S.p2, m1, m2);
  const [n1, n2] = names;
  log(`${n1}: ${MAN[m1].long.toLowerCase()}. ${n2}: ${MAN[m2].long.toLowerCase()}.`);
  if (ev.collide) log("Wingtips touch as they pass. Both aircraft take damage.", true);
  const burst = (who: string, on: string, n: number) =>
    `${who} ${n === 2 ? `rakes ${on} at point-blank range` : `lands a burst on ${on}`} (${n} hit${n > 1 ? "s" : ""}).`;
  if (ev.hitA) log(burst(n1, n2, ev.hitA), true);
  if (ev.hitB) log(burst(n2, n1, ev.hitB), true);

  S.p1 = A; S.p2 = B;
  S.trail1.push({ x: A.x, y: A.y }); S.trail2.push({ x: B.x, y: B.y });
  if (S.trail1.length > 12) { S.trail1.shift(); S.trail2.shift(); }
  const seed = Math.floor(rand() * 1e6);
  S.fx1 = { out: ev.hitA, inc: ev.hitB, seed };
  S.fx2 = { out: ev.hitB, inc: ev.hitA, seed: seed + 1 };

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
    S.overText = d1 && d2 ? "Both aircraft go down. No victory today." : `${d2 ? n1 : n2} wins.`;
    S.log.unshift({ t: S.overText, hit: true, n: S.turn - 1 });
  }
  return S;
}

// ---------- Computer pilot ----------
function evalPos(me: Plane, en: Plane) {
  const a = relative(me, en), b = relative(en, me);
  const prox = (d: number) => Math.max(0, 1 - d / 8);
  const aim = (r: Relative) => Math.max(0, Math.cos(r.bearing * DEG)) ** 3 * prox(r.dist) * (Math.abs(r.dAlt) <= 1 ? 1 : 0.4);
  return aim(a) * 2 - aim(b) * 2.4 + (me.hp - en.hp) * 4;
}

export type AiLevel = 1 | 2;

export function aiChoose(me: Plane, en: Plane, level: AiLevel): ManeuverId {
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
