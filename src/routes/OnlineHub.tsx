import { useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { isCode, normalizeCode } from "../../shared/online";
import { callApi } from "../lib/api";
import { session } from "../lib/session";

export function OnlineHub() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [code, setCode] = useState(() => normalizeCode(params.get("code")));
  const [hosting, setHosting] = useState(false);
  const [joining, setJoining] = useState(false);
  const [hostError, setHostError] = useState<string | null>(null);
  const [joinError, setJoinError] = useState<string | null>(null);
  const saved = session.list();

  const host = async () => {
    setHosting(true); setHostError(null);
    try {
      const { token, state } = await callApi({ action: "create" });
      session.save(state.code, token!, 1);
      navigate(`/g/${state.code}`);
    } catch (e) {
      setHostError((e as Error).message);
      setHosting(false);
    }
  };

  const join = async (e: FormEvent) => {
    e.preventDefault();
    const c = normalizeCode(code);
    if (!isCode(c)) { setJoinError("Enter the four-letter code from the host."); return; }
    setJoining(true); setJoinError(null);
    try {
      const existing = session.get(c);
      const { token, state } = await callApi({ action: "join", code: c, token: existing?.token });
      session.save(c, token!, state.seat);
      navigate(`/g/${c}`);
    } catch (err) {
      setJoinError((err as Error).message);
      setJoining(false);
    }
  };

  return (
    <div className="online-hub">
      <header className="section-head">
        <p className="eyebrow">Two devices</p>
        <h1>Fly online</h1>
        <p className="lede">One pilot hosts and gets a four-letter code. The other enters it here. The host flies Blue; the joiner flies Red.</p>
      </header>

      <div className="hub-grid">
        <section className="card hub-card">
          <h2>Host a game</h2>
          <p>You'll get a code to share and wait on the lobby screen until your opponent joins.</p>
          <button type="button" className="btn btn-primary btn-lg" onClick={host} disabled={hosting}>
            {hosting ? "Opening a game…" : "Host a game"}
          </button>
          {hostError && <p className="form-error" role="alert">{hostError}</p>}
        </section>

        <section className="card hub-card">
          <h2>Join a game</h2>
          <p>Type the code the host gave you.</p>
          <form className="join-form" onSubmit={join} noValidate>
            <label htmlFor="join-code" className="sr-only">Game code</label>
            <input id="join-code" className="code-input" value={code} maxLength={4} placeholder="ABCD"
              autoComplete="off" autoCapitalize="characters" spellCheck={false} inputMode="text"
              aria-invalid={!!joinError} aria-describedby={joinError ? "join-error" : undefined}
              onChange={e => { setCode(normalizeCode(e.target.value)); setJoinError(null); }} />
            <button type="submit" className="btn btn-primary btn-lg" disabled={joining || code.length !== 4}>
              {joining ? "Joining…" : "Join"}
            </button>
          </form>
          {joinError && <p className="form-error" id="join-error" role="alert">{joinError}</p>}
        </section>
      </div>

      {saved.length > 0 && (
        <section className="card recent">
          <h3 className="card-title"><span>Your games on this device</span></h3>
          <ul>
            {saved.map(g => (
              <li key={g.code}>
                <span className="code-chip">{g.code}</span>
                <span>You fly {g.seat === 1 ? "Blue (host)" : "Red"}</span>
                <Link to={`/g/${g.code}`} className="chip">Rejoin</Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
