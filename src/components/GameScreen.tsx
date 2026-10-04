import type { ReactNode } from "react";
import type { Duel, ManeuverId, Seat } from "../../shared/rules";
import { CockpitPage } from "./CockpitPage";
import { ManeuverPicker } from "./ManeuverPicker";
import { DamagePanel, FlightLog } from "./Panels";

export interface GameScreenProps {
  duel: Duel;
  seat: Seat;                     // whose page to show
  names: [string, string];        // Blue row, Red row
  pilotLabel: string;
  pickTitle: string;
  pickMeta?: ReactNode;
  selected: ManeuverId | null;
  pickerDisabled: boolean;
  onSelect: (m: ManeuverId) => void;
  note: ReactNode;
  action: { label: string; disabled: boolean; onClick: () => void };
  logExtra?: ReactNode;
}

/** The in-flight layout shared by every mode: page on the left, controls on the right. */
export function GameScreen(p: GameScreenProps) {
  const me = p.seat === 2 ? p.duel.p2 : p.duel.p1;
  const en = p.seat === 2 ? p.duel.p1 : p.duel.p2;
  const fx = p.seat === 2 ? p.duel.fx2 : p.duel.fx1;
  return (
    <div className="game">
      <CockpitPage me={me} en={en} fx={fx} pilotLabel={p.pilotLabel} />
      <aside className="panel">
        <DamagePanel duel={p.duel} names={p.names} />
        <section className="card">
          <h3 className="card-title"><span>{p.pickTitle}</span>{p.pickMeta}</h3>
          <ManeuverPicker last={me.last} selected={p.selected} disabled={p.pickerDisabled}
            onSelect={p.onSelect} onSubmit={p.action.disabled ? undefined : p.action.onClick} />
          <p className="note" role="status">{p.note}</p>
          <button type="button" className="btn btn-primary btn-block" disabled={p.action.disabled} onClick={p.action.onClick}>
            {p.action.label}
          </button>
        </section>
        <FlightLog duel={p.duel} extra={p.logExtra} />
      </aside>
    </div>
  );
}
