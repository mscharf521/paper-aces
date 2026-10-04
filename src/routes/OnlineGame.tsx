import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { MAN, type ManeuverId } from "../../shared/rules";
import { isCode, normalizeCode, type OnlineView } from "../../shared/online";
import { GameScreen } from "../components/GameScreen";
import { lockedNote } from "../components/ManeuverPicker";
import { Overlay } from "../components/Overlay";
import { useOnlineGame } from "../hooks/useOnlineGame";
import { callApi } from "../lib/api";
import { session } from "../lib/session";
import { NotFound } from "./HowToPlay";

export function OnlineGame() {
  const code = normalizeCode(useParams().code);
  if (!isCode(code)) return <NotFound />;
  return <OnlineSession key={code} code={code} />;
}

function OnlineSession({ code }: { code: string }) {
  const [token, setToken] = useState<string | null>(() => session.get(code)?.token ?? null);
  if (!token) return <JoinPrompt code={code} onJoined={setToken} />;
  return <OnlineMatch code={code} token={token} />;
}

/** Someone opened a share link: confirm before taking the second seat. */
function JoinPrompt({ code, onJoined }: { code: string; onJoined: (t: string) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const join = async () => {
    setBusy(true); setError(null);
    try {
      const { token, state } = await callApi({ action: "join", code });
      session.save(code, token!, state.seat);
      onJoined(token!);
    } catch (e) { setError((e as Error).message); setBusy(false); }
  };
  return (
    <div className="center-card card">
      <p className="eyebrow">You've been challenged</p>
      <h1>Game <span className="code-inline">{code}</span></h1>
      <p>Join as Red. Your opponent, the host, flies Blue.</p>
      <button className="btn btn-primary btn-lg" onClick={join} disabled={busy}>{busy ? "Joining…" : "Join as Red"}</button>
      {error && <p className="form-error" role="alert">{error}</p>}
      <p><Link to="/online">Host your own game instead</Link></p>
    </div>
  );
}

function OnlineMatch({ code, token }: { code: string; token: string }) {
  const { view, status, error, busy, pick, rematch, leave } = useOnlineGame(code, token);
  const navigate = useNavigate();

  if (status === "missing") {
    return (
      <div className="center-card card">
        <h1>Game {code} isn't available</h1>
        <p>{error ?? "It may have expired, or the host cancelled it."}</p>
        <Link to="/online" className="btn btn-primary">Host or join another game</Link>
      </div>
    );
  }
  if (!view) {
    return (
      <div className="center-card card" aria-busy="true">
        <p className="eyebrow">Game {code}</p>
        <h1>{status === "error" ? "Can't reach the game server" : "Connecting…"}</h1>
        {status === "error" && <p className="form-error">{error} Retrying automatically.</p>}
      </div>
    );
  }
  if (!view.joined) {
    return <Lobby view={view} onCancel={async () => { await leave(); navigate("/online"); }} />;
  }
  return <Match view={view} busy={busy} error={error} onPick={pick} onRematch={rematch}
    onLeave={() => navigate("/online")} />;
}

/** Host waits here until the second pilot joins. */
function Lobby({ view, onCancel }: { view: OnlineView; onCancel: () => void }) {
  const link = `${window.location.origin}/g/${view.code}`;
  const [copied, setCopied] = useState<"" | "code" | "link">("");
  const linkRef = useRef<HTMLSpanElement>(null);
  const copy = async (text: string, what: "code" | "link") => {
    try { await navigator.clipboard.writeText(text); setCopied(what); setTimeout(() => setCopied(""), 1800); }
    catch {
      const r = document.createRange(); if (linkRef.current) { r.selectNodeContents(linkRef.current); getSelection()?.removeAllRanges(); getSelection()?.addRange(r); }
    }
  };
  return (
    <div className="lobby card">
      <p className="eyebrow">Game code</p>
      <div className="code-tiles" aria-label={`Game code ${view.code.split("").join(" ")}`}>
        {view.code.split("").map((c, i) => <span key={i} className="code-tile">{c}</span>)}
      </div>
      <p className="lobby-help">Your opponent opens Paper Aces, chooses <b>Online → Join a game</b> and enters this code. You fly Blue.</p>
      <div className="lobby-actions">
        <button className="btn" onClick={() => copy(view.code, "code")}>{copied === "code" ? "Copied" : "Copy code"}</button>
        <button className="btn" onClick={() => copy(link, "link")}>{copied === "link" ? "Copied" : "Copy invite link"}</button>
      </div>
      <p className="lobby-link"><span ref={linkRef}>{link}</span></p>
      <div className="waiting" role="status">
        <span className="radar" aria-hidden="true" />
        Waiting for a second pilot…
      </div>
      <button className="btn btn-ghost" onClick={onCancel}>Cancel game</button>
    </div>
  );
}

function Match({ view, busy, error, onPick, onRematch, onLeave }: {
  view: OnlineView; busy: boolean; error: string | null;
  onPick: (m: ManeuverId) => void; onRematch: () => void; onLeave: () => void;
}) {
  const [draft, setDraft] = useState<ManeuverId | null>(null);
  const [showResult, setShowResult] = useState(false);
  const seenOver = useRef(view.over);
  const turnRef = useRef(view.turn);

  useEffect(() => { // new turn or round: clear the draft
    if (view.turn !== turnRef.current) { setDraft(null); turnRef.current = view.turn; }
  }, [view.turn]);
  useEffect(() => {
    if (view.over && !seenOver.current) { const t = setTimeout(() => setShowResult(true), 900); seenOver.current = true; return () => clearTimeout(t); }
    if (!view.over) { seenOver.current = false; setShowResult(false); }
  }, [view.over]);

  const me = view.seat === 1 ? view.p1 : view.p2;
  const oppSeat = view.seat === 1 ? 2 : 1;
  const locked = !!view.myPick;
  const selected = view.myPick ?? draft;

  let note: string = lockedNote(me.last) ?? "Pick a maneuver. Struck-through cards are locked by your last move.";
  if (selected) note = `${MAN[selected].long}.`;
  if (view.picked[oppSeat] && !locked) note = `Your opponent has chosen. ${selected ? MAN[selected].long + "." : "Your move."}`;
  if (locked) note = `${MAN[view.myPick!].long}. Locked in — waiting for your opponent.`;
  if (view.over) note = view.overText;
  if (error) note = error;

  const action = view.over
    ? { label: "Rematch", disabled: busy, onClick: onRematch }
    : locked
      ? { label: "Waiting for their move", disabled: true, onClick: () => {} }
      : { label: busy ? "Sending…" : "Fly it", disabled: !draft || busy, onClick: () => draft && onPick(draft) };

  const won = view.winner === view.seat;
  return (
    <>
      <GameScreen
        duel={view} seat={view.seat}
        names={view.seat === 1 ? ["You", "Red"] : ["Blue", "You"]}
        pilotLabel={view.seat === 1 ? "Blue · you" : "Red · you"}
        pickTitle="Your maneuver"
        pickMeta={<span className="meta">
          <span className={`dot ${view.picked[oppSeat] ? "on" : ""}`} aria-hidden="true" />
          {view.picked[oppSeat] ? "Opponent ready" : "Opponent choosing"} · <span className="code-chip sm">{view.code}</span>
        </span>}
        selected={selected} onSelect={setDraft}
        pickerDisabled={locked || view.over || busy}
        note={note}
        action={action}
        logExtra={<button type="button" className="chip" onClick={onLeave}>Leave</button>}
      />
      {showResult && (
        <Overlay title={view.winner === 0 ? "Mutual loss" : won ? "Victory" : "Shot down"} tone={view.winner === 0 ? "default" : won ? "win" : "loss"}
          actions={<>
            <button className="btn btn-primary" onClick={() => { setShowResult(false); onRematch(); }}>Rematch</button>
            <button className="btn" onClick={() => setShowResult(false)}>See the last page</button>
          </>}>
          <p>{view.overText} The duel lasted {view.turn - 1} turns.</p>
        </Overlay>
      )}
    </>
  );
}
