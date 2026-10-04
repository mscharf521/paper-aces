// Draws one "page": the view from the cockpit, with the enemy projected in 3D.
import { DEG, MAX_HP, clockOf, relative, vec, wrap180, type Fx, type Plane, type Relative, type Side } from "../../shared/rules";

export const PAGE_W = 960, PAGE_H = 600;
const FOC = PAGE_W * 0.55, CY = PAGE_H * 0.47;
const W = PAGE_W, H = PAGE_H;

export const rng = (seed: number) => { let s = seed >>> 0 || 1; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; };

const CLOUDS = (() => {
  const r = rng(1917), out: { az: number; el: number; w: number; n: number; s: number }[] = [];
  for (let i = 0; i < 26; i++) out.push({ az: r() * 360, el: 2 + r() * 14, w: 30 + r() * 90, n: 3 + Math.floor(r() * 4), s: r() * 1000 });
  return out;
})();

const COL: Record<Side, { wing: string; wingDark: string; body: string; mark: "roundel" | "cross" }> = {
  blue: { wing: "#b9a777", wingDark: "#8e7f55", body: "#7f7350", mark: "roundel" },
  red:  { wing: "#9c2e26", wingDark: "#6e1f1a", body: "#5a1a16", mark: "cross" },
};

type V3 = [number, number, number];
type FillKey = "wing" | "wingDark" | "body" | "strut";
interface Quad { pts: V3[]; fill: FillKey; kind: string }

// A generic two-bay biplane in its own frame (x right, y up, z forward), in map units.
const MODEL: Quad[] = (() => {
  const P: Quad[] = [];
  const q = (pts: V3[], fill: FillKey, kind: string) => P.push({ pts, fill, kind });
  const sp = 0.16;
  q([[-sp, 0.035, 0.03], [sp, 0.035, 0.03], [sp, 0.035, -0.015], [-sp, 0.035, -0.015]], "wing", "upper");
  q([[-sp * 0.92, -0.02, 0.02], [sp * 0.92, -0.02, 0.02], [sp * 0.92, -0.02, -0.02], [-sp * 0.92, -0.02, -0.02]], "wingDark", "lower");
  q([[-0.022, 0.02, 0.09], [0.022, 0.02, 0.09], [0.008, 0.012, -0.12], [-0.008, 0.012, -0.12]], "body", "top");
  q([[0, 0.022, 0.09], [0, -0.026, 0.09], [0, -0.004, -0.12], [0, 0.014, -0.12]], "body", "side");
  q([[-0.05, 0.008, -0.095], [0.05, 0.008, -0.095], [0.045, 0.008, -0.125], [-0.045, 0.008, -0.125]], "wing", "tailplane");
  q([[0, 0.012, -0.09], [0, 0.06, -0.112], [0, 0.058, -0.128], [0, 0.012, -0.124]], "wingDark", "fin");
  for (const x of [-0.1, 0.1]) q([[x, 0.035, 0.008], [x + 0.002, 0.035, 0.008], [x + 0.002, -0.02, 0], [x, -0.02, 0]], "strut", "strut");
  return P;
})();

function project(X: number, Y: number, Z: number, roll: number): [number, number] | null {
  if (Z < 0.08) return null;
  const sx = X / Z * FOC, sy = -Y / Z * FOC, c = Math.cos(roll), s = Math.sin(roll);
  return [W / 2 + sx * c - sy * s, CY + sx * s + sy * c];
}

function drawSky(cx: CanvasRenderingContext2D, headingDeg: number, roll: number, alt: number, camX: number, camY: number) {
  cx.save();
  cx.translate(W / 2, CY); cx.rotate(roll); cx.translate(-W / 2, -CY);
  const g = cx.createLinearGradient(0, -H, 0, CY);
  g.addColorStop(0, "#5f86a6"); g.addColorStop(0.7, "#a9c1cd"); g.addColorStop(1, "#dfe4dc");
  cx.fillStyle = g; cx.fillRect(-W, -H, W * 3, CY + H);
  const gg = cx.createLinearGradient(0, CY, 0, H * 2);
  gg.addColorStop(0, "#b9b99a"); gg.addColorStop(0.08, "#8d9566"); gg.addColorStop(1, "#4f5a33");
  cx.fillStyle = gg; cx.fillRect(-W, CY, W * 3, H * 2);

  // Field boundaries fixed to the ground, so turning and climbing shift them.
  const camH = 0.4 + alt * 0.35, a = headingDeg * DEG, f = vec(a), r = vec(a + 90 * DEG);
  const S = 2.5, R = 34;
  const toScreen = (wx: number, wy: number): [number, number] | null => {
    const dx = wx - camX, dy = wy - camY, Z = dx * f.x + dy * f.y, X = dx * r.x + dy * r.y;
    return Z < 0.3 ? null : [W / 2 + X / Z * FOC, CY + camH / Z * FOC];
  };
  cx.strokeStyle = "rgba(60,70,40,.35)"; cx.lineWidth = 1; cx.beginPath();
  for (let gx = Math.floor((camX - R) / S) * S; gx <= camX + R; gx += S) {
    for (let gy = Math.floor((camY - R) / S) * S; gy <= camY + R; gy += S) {
      const p = toScreen(gx, gy), q = toScreen(gx + S, gy), w = toScreen(gx, gy + S);
      if (p && q) { cx.moveTo(p[0], p[1]); cx.lineTo(q[0], q[1]); }
      if (p && w) { cx.moveTo(p[0], p[1]); cx.lineTo(w[0], w[1]); }
    }
  }
  cx.stroke();

  const hz = cx.createLinearGradient(0, CY - 30, 0, CY + 40);
  hz.addColorStop(0, "rgba(223,228,220,0)"); hz.addColorStop(0.45, "rgba(223,228,220,.85)"); hz.addColorStop(1, "rgba(223,228,220,0)");
  cx.fillStyle = hz; cx.fillRect(-W, CY - 30, W * 3, 70);

  for (const c of CLOUDS) {
    const d = wrap180(c.az - headingDeg); if (Math.abs(d) > 75) continue;
    const x = W / 2 + Math.tan(d * DEG) * FOC, y = CY - Math.tan((c.el - alt * 1.2) * DEG) * FOC;
    const r2 = rng(c.s * 1000);
    cx.fillStyle = "rgba(245,246,240,.85)";
    for (let i = 0; i < c.n; i++) {
      cx.beginPath();
      cx.ellipse(x + (r2() - 0.5) * c.w * 1.4, y + (r2() - 0.5) * c.w * 0.25, c.w * (0.35 + r2() * 0.35), c.w * (0.15 + r2() * 0.12), 0, 0, Math.PI * 2);
      cx.fill();
    }
  }
  cx.restore();
}

function drawEnemy(cx: CanvasRenderingContext2D, rel: Relative, rear: boolean, en: Plane, roll: number, damaged: number) {
  const X = rear ? -rel.rt : rel.rt, Z = rear ? -rel.fw : rel.fw, Y = rel.dAlt * 0.12;
  const yaw = (rel.yaw + (rear ? 180 : 0)) * DEG;
  const F: V3 = [Math.sin(yaw), 0, Math.cos(yaw)], R: V3 = [Math.cos(yaw), 0, -Math.sin(yaw)];
  const er = (en.roll || 0) * DEG, ec = Math.cos(er), es = Math.sin(er);
  const tf = ([mx, my, mz]: V3): V3 => {
    const x = mx * ec + my * es, y = -mx * es + my * ec;
    return [X + x * R[0] + mz * F[0], Y + y, Z + x * R[2] + mz * F[2]];
  };
  const col = COL[en.side];
  type Poly = { scr: [number, number][]; z: number; fill: string; kind: string };
  const polys: Poly[] = [];
  const add = (pts: V3[], fill: string, kind: string, dz = 0) => {
    const w = pts.map(tf), scr = w.map(p => project(p[0], p[1], p[2], roll));
    if (scr.some(s => !s)) return null;
    const z = w.reduce((s, p) => s + p[2], 0) / w.length + dz;
    const poly = { scr: scr as [number, number][], z, fill, kind };
    polys.push(poly);
    return poly;
  };
  for (const q of MODEL) add(q.pts, q.fill === "strut" ? "#2a2520" : col[q.fill], q.kind);
  const circle = (c: V3, rad: number, plane: "xy" | "xz"): V3[] => Array.from({ length: 14 }, (_, i) => {
    const t = (i / 14) * Math.PI * 2, a = Math.cos(t) * rad, b = Math.sin(t) * rad;
    return plane === "xy" ? [c[0] + a, c[1] + b, c[2]] : [c[0] + a, c[1], c[2] + b];
  });
  add(circle([0, 0, 0.095], 0.045, "xy"), "rgba(40,36,30,.28)", "prop");
  for (const sx of [-0.115, 0.115]) {
    if (col.mark === "roundel") {
      ([[0.022, "#2c5a86"], [0.015, "#f1efe6"], [0.008, "#b3342b"]] as const).forEach(([rad, f], i) => add(circle([sx, 0.037, 0.008], rad, "xz"), f, "mark", -0.001 * (i + 1)));
    } else {
      add(circle([sx, 0.037, 0.008], 0.02, "xz"), "#f1efe6", "mark", -0.001);
      const arm = (x0: number, z0: number, x1: number, z1: number) =>
        add([[sx + x0, 0.038, 0.008 + z0], [sx + x1, 0.038, 0.008 + z0], [sx + x1, 0.038, 0.008 + z1], [sx + x0, 0.038, 0.008 + z1]], "#151515", "mark", -0.002);
      arm(-0.016, -0.004, 0.016, 0.004); arm(-0.004, -0.016, 0.004, 0.016);
    }
  }
  polys.sort((a, b) => b.z - a.z);
  cx.lineJoin = "round";
  for (const p of polys) {
    cx.beginPath(); p.scr.forEach((s, i) => (i ? cx.lineTo(s[0], s[1]) : cx.moveTo(s[0], s[1]))); cx.closePath();
    cx.fillStyle = p.fill; cx.fill();
    if (p.kind !== "prop" && p.kind !== "mark") { cx.strokeStyle = "rgba(20,18,15,.7)"; cx.lineWidth = Math.max(0.6, 1.25 / Math.max(Z, 0.5)); cx.stroke(); }
  }
  const c = project(X, Y, Z, roll);
  if (c && damaged) {
    const n = damaged > 0.7 ? 9 : 5, down = damaged > 0.99;
    for (let i = 0; i < n; i++) {
      const back = project(X - F[0] * 0.12 * i, Y + 0.01 * i, Z - F[2] * 0.12 * i, roll); if (!back) continue;
      cx.fillStyle = down ? `rgba(40,35,30,${0.35 - i * 0.03})` : `rgba(70,70,70,${0.35 - i * 0.03})`;
      cx.beginPath(); cx.arc(back[0], back[1], ((8 + i * 5) * FOC) / 500 / Math.max(Z, 0.4), 0, Math.PI * 2); cx.fill();
    }
    if (down) { cx.fillStyle = "rgba(240,140,40,.85)"; cx.beginPath(); cx.arc(c[0], c[1], 14 / Math.max(Z, 0.4), 0, Math.PI * 2); cx.fill(); }
  }
  return c;
}

function gauge(cx: CanvasRenderingContext2D, x: number, y: number, v: number, label: string) {
  cx.fillStyle = "#e8e4d6"; cx.beginPath(); cx.arc(x, y, 30, 0, Math.PI * 2); cx.fill();
  cx.strokeStyle = "#111"; cx.lineWidth = 3; cx.stroke();
  cx.lineWidth = 1.5;
  for (let i = 0; i <= 8; i++) {
    const a = (-225 + i * 33.75) * DEG;
    cx.beginPath(); cx.moveTo(x + Math.cos(a) * 24, y + Math.sin(a) * 24); cx.lineTo(x + Math.cos(a) * 28, y + Math.sin(a) * 28); cx.stroke();
  }
  const a = (-225 + Math.max(0, Math.min(1, v)) * 270) * DEG;
  cx.strokeStyle = "#b3342b"; cx.lineWidth = 3; cx.beginPath(); cx.moveTo(x, y); cx.lineTo(x + Math.cos(a) * 22, y + Math.sin(a) * 22); cx.stroke();
  cx.fillStyle = "#111"; cx.font = "600 9px 'IBM Plex Mono', monospace"; cx.textAlign = "center"; cx.fillText(label, x, y + 16);
}

function drawForwardCockpit(cx: CanvasRenderingContext2D, side: Side, alt: number, spd: number, hpFrac: number) {
  const col = COL[side];
  cx.fillStyle = col.wing; cx.fillRect(0, 0, W, 62);
  cx.fillStyle = col.wingDark; cx.fillRect(0, 54, W, 8);
  cx.fillStyle = "rgba(0,0,0,.12)"; for (let i = 0; i < W; i += 46) cx.fillRect(i, 0, 2, 54);
  cx.fillStyle = "#c9c4b0"; cx.beginPath(); cx.ellipse(W / 2, 56, 70, 22, 0, 0, Math.PI); cx.fill();
  cx.fillStyle = "#94acb9"; cx.beginPath(); cx.ellipse(W / 2, 56, 62, 18, 0, 0, Math.PI); cx.fill();
  cx.strokeStyle = "#2a2520"; cx.lineWidth = 9; cx.beginPath();
  cx.moveTo(W * 0.4, 60); cx.lineTo(W * 0.43, H * 0.7); cx.moveTo(W * 0.6, 60); cx.lineTo(W * 0.57, H * 0.7); cx.stroke();
  cx.lineWidth = 14; cx.beginPath(); cx.moveTo(40, 60); cx.lineTo(70, H); cx.moveTo(W - 40, 60); cx.lineTo(W - 70, H); cx.stroke();
  cx.lineWidth = 2; cx.strokeStyle = "rgba(30,28,25,.8)"; cx.beginPath();
  cx.moveTo(45, 62); cx.lineTo(W * 0.43, H * 0.7); cx.moveTo(W - 45, 62); cx.lineTo(W * 0.57, H * 0.7); cx.stroke();
  cx.fillStyle = col.body; cx.beginPath(); cx.moveTo(0, H); cx.lineTo(0, H * 0.86); cx.quadraticCurveTo(W / 2, H * 0.62, W, H * 0.86); cx.lineTo(W, H); cx.fill();
  cx.fillStyle = "#3b2c1e"; cx.beginPath(); cx.moveTo(W * 0.12, H); cx.lineTo(W * 0.16, H * 0.86); cx.quadraticCurveTo(W / 2, H * 0.73, W * 0.84, H * 0.86); cx.lineTo(W * 0.88, H); cx.fill();
  for (const gx of [W * 0.465, W * 0.535]) {
    cx.fillStyle = "#1c1c1a"; cx.beginPath(); cx.moveTo(gx - 16, H); cx.lineTo(gx - 7, H * 0.7); cx.lineTo(gx + 7, H * 0.7); cx.lineTo(gx + 16, H); cx.fill();
    cx.fillStyle = "#3a3a36"; for (let k = 0; k < 6; k++) cx.fillRect(gx - 9 + k * 0.4, H * 0.72 + k * 14, 18 - k * 0.8, 3);
  }
  gauge(cx, W * 0.25, H * 0.92, alt / 6, "ALT");
  gauge(cx, W * 0.75, H * 0.92, spd / 3, "SPD");
  gauge(cx, W * 0.33, H * 0.95, hpFrac, "OIL");
  const ring = Math.tan(15 * DEG) * FOC, inner = Math.tan(7 * DEG) * FOC, sx = W / 2, sy = CY;
  cx.strokeStyle = "rgba(20,20,18,.9)"; cx.lineWidth = 2.5; cx.beginPath(); cx.arc(sx, sy, ring, 0, Math.PI * 2); cx.stroke();
  cx.lineWidth = 1.5; cx.beginPath(); cx.arc(sx, sy, inner, 0, Math.PI * 2); cx.stroke();
  cx.beginPath(); cx.moveTo(sx - ring, sy); cx.lineTo(sx + ring, sy); cx.moveTo(sx, sy - ring); cx.lineTo(sx, sy + ring); cx.stroke();
  cx.lineWidth = 3; cx.beginPath(); cx.moveTo(sx, sy + ring); cx.lineTo(sx, H * 0.72); cx.stroke();
}

function drawRearCockpit(cx: CanvasRenderingContext2D, side: Side) {
  const col = COL[side];
  cx.fillStyle = col.body; cx.beginPath();
  cx.moveTo(W * 0.18, H); cx.lineTo(W * 0.45, H * 0.6); cx.lineTo(W * 0.55, H * 0.6); cx.lineTo(W * 0.82, H); cx.fill();
  cx.strokeStyle = "rgba(0,0,0,.25)"; cx.lineWidth = 2;
  for (let i = 1; i < 6; i++) {
    const t = i / 6, y = H - H * 0.4 * t, hw = W * (0.32 - 0.27 * t);
    cx.beginPath(); cx.moveTo(W / 2 - hw, y); cx.lineTo(W / 2 + hw, y); cx.stroke();
  }
  cx.fillStyle = col.wing; cx.beginPath(); cx.moveTo(W * 0.3, H * 0.62); cx.lineTo(W * 0.7, H * 0.62); cx.lineTo(W * 0.66, H * 0.66); cx.lineTo(W * 0.34, H * 0.66); cx.fill();
  cx.fillStyle = col.wingDark; cx.beginPath(); cx.moveTo(W * 0.495, H * 0.62); cx.lineTo(W * 0.49, H * 0.47); cx.lineTo(W * 0.51, H * 0.45); cx.lineTo(W * 0.505, H * 0.62); cx.fill();
  cx.fillStyle = "#6b4a2c"; cx.beginPath(); cx.ellipse(W / 2, H + 30, W * 0.42, 120, 0, Math.PI, 0); cx.fill();
  cx.lineWidth = 10; cx.strokeStyle = "#2a1d12"; cx.stroke();
  cx.fillStyle = "rgba(27,40,48,.75)"; cx.font = "600 16px 'IBM Plex Mono', monospace"; cx.textAlign = "left"; cx.fillText("LOOKING AFT", 18, 30);
}

export interface PageInfo { rel: Relative; rear: boolean }

export function viewOf(me: Plane, en: Plane): PageInfo {
  const rel = relative(me, en);
  return { rel, rear: Math.abs(rel.bearing) > 100 };
}

export function drawPage(cx: CanvasRenderingContext2D, me: Plane, en: Plane, fx: Fx = {}): PageInfo {
  const { rel, rear } = viewOf(me, en);
  const camHead = me.h * 45 + (rear ? 180 : 0);
  const roll = (rear ? 1 : -1) * (me.roll || 0) * DEG * 0.7;
  cx.clearRect(0, 0, W, H);
  drawSky(cx, camHead, roll, me.alt, me.x, me.y);
  const dmg = 1 - Math.max(en.hp, 0) / MAX_HP;
  const scr = drawEnemy(cx, rel, rear, en, roll, dmg >= 0.5 ? (en.hp <= 0 ? 1 : dmg) : 0);

  if (fx.out && scr && !rear) {
    cx.strokeStyle = "rgba(255,226,140,.95)"; cx.lineWidth = 2; cx.setLineDash([10, 14]);
    for (const gx of [W * 0.465, W * 0.535]) { cx.beginPath(); cx.moveTo(gx, H * 0.7); cx.lineTo(scr[0] + (gx - W / 2) * 0.05, scr[1]); cx.stroke(); }
    cx.setLineDash([]);
    cx.fillStyle = "rgba(255,200,90,.9)";
    for (const gx of [W * 0.465, W * 0.535]) { cx.beginPath(); cx.arc(gx, H * 0.7, 9, 0, Math.PI * 2); cx.fill(); }
  }
  if (rear) drawRearCockpit(cx, me.side);
  else drawForwardCockpit(cx, me.side, me.alt, me.spd || 2, Math.max(me.hp, 0) / MAX_HP);

  const inView = !!scr && scr[0] > -20 && scr[0] < W + 20 && scr[1] > -20 && scr[1] < H + 20;
  if (!inView && en.hp > 0) {
    const ang = rear ? -wrap180(rel.bearing - 180) : rel.bearing, left = ang < 0, x = left ? 28 : W - 28;
    cx.fillStyle = "rgba(179,52,43,.92)"; cx.beginPath();
    cx.moveTo(x + (left ? -14 : 14), CY); cx.lineTo(x + (left ? 16 : -16), CY - 20); cx.lineTo(x + (left ? 16 : -16), CY + 20); cx.fill();
    cx.font = "600 15px 'IBM Plex Mono', monospace"; cx.textAlign = left ? "left" : "right"; cx.fillStyle = "#1b2830";
    cx.fillText(`${clockOf(rel.bearing)} o'clock`, left ? 52 : W - 52, CY + 5);
  }
  if (fx.inc) {
    const r = rng(fx.seed || 7);
    for (let i = 0; i < fx.inc * 4; i++) {
      const x = r() * W, y = H * 0.5 + r() * H * 0.45;
      cx.fillStyle = "#14110d"; cx.beginPath(); cx.arc(x, y, 4 + r() * 3, 0, Math.PI * 2); cx.fill();
      cx.strokeStyle = "rgba(220,210,190,.7)"; cx.lineWidth = 1.5; cx.beginPath(); cx.arc(x, y, 8, 0, Math.PI * 2); cx.stroke();
    }
    const v = cx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, W * 0.7);
    v.addColorStop(0, "rgba(179,52,43,0)"); v.addColorStop(1, "rgba(179,52,43,.45)");
    cx.fillStyle = v; cx.fillRect(0, 0, W, H);
  }
  if (me.hp <= 0) { cx.fillStyle = "rgba(30,25,20,.55)"; cx.fillRect(0, 0, W, H); }
  return { rel, rear };
}
