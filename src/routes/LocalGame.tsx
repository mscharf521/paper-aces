import { useCallback, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { MAN, aiChoose, newDuel, resolveTurn, type Duel, type ManeuverId, type Seat } from "../../shared/rules";
import { GameScreen } from "../components/GameScreen";
import { lockedNote } from "../components/ManeuverPicker";
import { Overlay } from "../components/Overlay";
import { NotFound } from "./HowToPlay";

type Mode = "rookie" | "ace" | "local";
type Handoff = null | { to: Seat; text: string };

export function LocalGame() {
  const { mode } = useParams<{ mode: Mode }>();
  if (mode !== "rookie" && mode !== "ace" && mode !== "local") return <NotFound />;
  return <LocalDuel key={mode} mode={mode} />;
}

function LocalDuel({ mode }: { mode: Mode }) {
  const navigate = useNavigate();
  const hot = mode === "local";
  const names: [string, string] = hot ? ["Pilot 1", "Pilot 2"] : ["You", mode === "ace" ? "The ace" : "The rookie"];
  const [duel, setDuel] = useState<Duel>(newDuel);
  const [picking, setPicking] = useState<Seat>(1);
  const [picks, setPicks] = useState<{ 1: ManeuverId | null; 2: ManeuverId | null }>({ 1: null, 2: null });
  const [handoff, setHandoff] = useState<Handoff>(hot ? { to: 1, text: "Pilot 2, look away. Pilot 1 picks first." } : null);
  const [result, setResult] = useState(false);

  const selected = picks[picking];
  const select = useCallback((m: ManeuverId) => setPicks(p => ({ ...p, [picking]: m })), [picking]);

  const restart = () => {
    setDuel(newDuel()); setPicks({ 1: null, 2: null }); setPicking(1); setResult(false);
    setHandoff(hot ? { to: 1, text: "Pilot 2, look away. Pilot 1 picks first." } : null);
  };

  const fly = () => {
    if (duel.over) return restart();
    if (!selected) return;
    if (hot && picking === 1) {
      setPicking(2);
      setHandoff({ to: 2, text: "Pilot 1 has chosen. Pilot 1, look away." });
      return;
    }
    const m1 = picks[1]!, m2 = hot ? picks[2]! : aiChoose(duel.p2, duel.p1, mode === "ace" ? 2 : 1);
    const next = resolveTurn(duel, m1, m2, names);
    setDuel(next); setPicks({ 1: null, 2: null }); setPicking(1);
    if (next.over) setTimeout(() => setResult(true), 900);
    else if (hot) setHandoff({ to: 1, text: "Both moves are flown. Pilot 2, look away." });
  };

  let note: string = lockedNote(duel[picking === 2 ? "p2" : "p1"].last) ?? "Pick a maneuver. Struck-through cards are locked by your last move.";
  if (selected) note = `${MAN[selected].long}.${selected === "immel" ? " You climb and reverse direction; no dive or second Immelmann next turn." : ""}`;
  if (duel.over) note = duel.overText;

  const resultTitle = duel.winner === 0 ? "Mutual loss" : hot ? `${names[duel.winner - 1]} wins` : duel.winner === 1 ? "Victory" : "Shot down";

  return (
    <>
      <GameScreen
        duel={duel} seat={picking} names={names}
        pilotLabel={names[picking - 1]}
        pickTitle={hot ? `${names[picking - 1]}'s maneuver` : "Your maneuver"}
        selected={selected} onSelect={select}
        pickerDisabled={duel.over || !!handoff}
        note={note}
        action={{ label: duel.over ? "Fly again" : hot && picking === 1 ? "Lock in & pass" : "Fly it", disabled: !duel.over && !selected, onClick: fly }}
        logExtra={<Link to="/" className="chip">Leave</Link>}
      />
      {handoff && (
        <Overlay title={`${names[handoff.to - 1]}, take the controls`}
          actions={<button className="btn btn-primary" onClick={() => setHandoff(null)}>I'm ready</button>}>
          <p>{handoff.text}</p>
        </Overlay>
      )}
      {result && (
        <Overlay title={resultTitle} tone={duel.winner === 0 ? "default" : !hot && duel.winner === 2 ? "loss" : "win"}
          actions={<>
            <button className="btn btn-primary" onClick={restart}>Fly again</button>
            <button className="btn" onClick={() => setResult(false)}>See the last page</button>
            <button className="btn btn-ghost" onClick={() => navigate("/")}>Main menu</button>
          </>}>
          <p>{duel.overText} The duel lasted {duel.turn - 1} turns.</p>
        </Overlay>
      )}
    </>
  );
}
