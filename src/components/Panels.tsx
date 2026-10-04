import { useEffect, useRef, useState } from "react";
import { MAX_HP, type Duel, type LogEntry } from "../../shared/rules";
import { drawChart } from "../render/chart";

export function DamagePanel({ duel, names }: { duel: Duel; names: [string, string] }) {
  const row = (side: "blue" | "red", name: string, hp: number, alt: number) => (
    <div className={`pilot pilot-${side}`}>
      <div className="pilot-name">{name}</div>
      <div className="hp" role="meter" aria-label={`${name} airframe`} aria-valuemin={0} aria-valuemax={MAX_HP} aria-valuenow={Math.max(hp, 0)}>
        {Array.from({ length: MAX_HP }, (_, i) => <i key={i} className={i >= hp ? "lost" : ""} />)}
      </div>
      <div className="pilot-alt">{Math.round(alt * 150 + 600)} m</div>
    </div>
  );
  return (
    <section className="card">
      <h3 className="card-title"><span>Damage</span><span>Turn {duel.turn}</span></h3>
      <div className="pilots">
        {row("blue", names[0], duel.p1.hp, duel.p1.alt)}
        {row("red", names[1], duel.p2.hp, duel.p2.alt)}
      </div>
    </section>
  );
}

export function FlightLog({ duel, extra }: { duel: Duel; extra?: React.ReactNode }) {
  const [showMap, setShowMap] = useState(false);
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cx = ref.current?.getContext("2d");
    if (showMap && cx) drawChart(cx, duel.p1, duel.p2, duel.trail1, duel.trail2);
  }, [showMap, duel]);
  return (
    <section className="card">
      <h3 className="card-title">
        <span>Flight log</span>
        <span className="row">
          <button type="button" className="chip" aria-pressed={showMap} onClick={() => setShowMap(s => !s)}>Map</button>
          {extra}
        </span>
      </h3>
      <div className="log">
        {duel.log.map((l: LogEntry, i) => (
          <p key={duel.log.length - i} className={l.hit ? "hit" : ""}><b>T{l.n}</b>{l.t}</p>
        ))}
      </div>
      {showMap && <canvas ref={ref} width={440} height={440} className="chart" aria-label="Overhead map" />}
    </section>
  );
}
