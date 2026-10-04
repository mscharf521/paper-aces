// Overhead map: both aircraft, their recent tracks and their firing cones.
import { DEG, UNIT_M, type Plane, type Point } from "../../shared/rules";

export function drawChart(cx: CanvasRenderingContext2D, p1: Plane, p2: Plane, trail1: Point[], trail2: Point[]) {
  const CW = cx.canvas.width;
  const mx = (p1.x + p2.x) / 2, my = (p1.y + p2.y) / 2, sc = CW / 14;
  const X = (x: number) => (x - mx) * sc + CW / 2, Y = (y: number) => (y - my) * sc + CW / 2;
  cx.fillStyle = "#e4e9e8"; cx.fillRect(0, 0, CW, CW);
  cx.strokeStyle = "#c3cdcf"; cx.lineWidth = 1;
  for (let i = -8; i <= 8; i++) {
    const gx = X(Math.floor(mx) + i), gy = Y(Math.floor(my) + i);
    cx.beginPath(); cx.moveTo(gx, 0); cx.lineTo(gx, CW); cx.moveTo(0, gy); cx.lineTo(CW, gy); cx.stroke();
  }
  const plot = (p: Plane, color: string, trail: Point[]) => {
    cx.strokeStyle = color; cx.globalAlpha = 0.4; cx.lineWidth = 2; cx.beginPath();
    trail.forEach((t, i) => (i ? cx.lineTo(X(t.x), Y(t.y)) : cx.moveTo(X(t.x), Y(t.y))));
    cx.stroke(); cx.globalAlpha = 1;
    const x = X(p.x), y = Y(p.y), a = p.h * 45 * DEG;
    cx.fillStyle = color; cx.globalAlpha = 0.1; cx.beginPath(); cx.moveTo(x, y);
    cx.arc(x, y, 4.5 * sc, a - Math.PI / 2 - 15 * DEG, a - Math.PI / 2 + 15 * DEG); cx.fill(); cx.globalAlpha = 1;
    cx.save(); cx.translate(x, y); cx.rotate(a); cx.fillStyle = color;
    cx.fillRect(-15, -4, 30, 7); cx.fillRect(-2.5, -12, 5, 26); cx.fillRect(-7, 10, 14, 4); cx.restore();
    cx.fillStyle = "#1b2830"; cx.font = "600 12px 'IBM Plex Mono', monospace"; cx.textAlign = "left";
    cx.fillText(`${Math.round(p.alt * 150 + 600)} m`, x + 16, y - 10);
  };
  plot(p1, "#2c5a86", trail1);
  plot(p2, "#b3342b", trail2);
  cx.fillStyle = "#4b5c64"; cx.font = "12px 'IBM Plex Mono', monospace"; cx.textAlign = "right";
  cx.fillText(`grid = ${UNIT_M} m`, CW - 8, CW - 8);
}
