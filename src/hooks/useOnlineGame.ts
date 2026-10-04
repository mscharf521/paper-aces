import { useCallback, useEffect, useRef, useState } from "react";
import type { ManeuverId } from "../../shared/rules";
import type { OnlineView } from "../../shared/online";
import { ApiError, callApi } from "../lib/api";
import { session } from "../lib/session";

export type OnlineStatus = "loading" | "ready" | "missing" | "error";

/**
 * Keeps an online game in sync with the server. Polls quickly while waiting
 * (for a joiner or the opponent's move) and slowly otherwise.
 */
export function useOnlineGame(code: string, token: string | null) {
  const [view, setView] = useState<OnlineView | null>(null);
  const [status, setStatus] = useState<OnlineStatus>(token ? "loading" : "missing");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const viewRef = useRef<OnlineView | null>(null);
  viewRef.current = view;

  const accept = useCallback((v: OnlineView) => {
    setView(prev => (prev && JSON.stringify(prev) === JSON.stringify(v) ? prev : v));
    setStatus("ready");
    setError(null);
    session.touch(v.code);
  }, []);

  const refresh = useCallback(async (signal?: AbortSignal) => {
    if (!token) return;
    try {
      const { state } = await callApi({ action: "state", code, token }, signal);
      accept(state);
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      const err = e as ApiError;
      if (err.status === 404 || err.status === 403) { session.forget(code); setStatus("missing"); }
      if (!viewRef.current) setStatus(err.status === 404 || err.status === 403 ? "missing" : "error");
      setError(err.message);
    }
  }, [code, token, accept]);

  // Polling loop
  useEffect(() => {
    if (!token) { setStatus("missing"); return; }
    let stopped = false, timer: ReturnType<typeof setTimeout> | undefined;
    const ctrl = new AbortController();
    const tick = async () => {
      await refresh(ctrl.signal);
      if (stopped) return;
      const v = viewRef.current;
      const waiting = !v || !v.joined || !!v.myPick;
      const delay = document.hidden ? 8000 : waiting ? 1500 : 3000;
      timer = setTimeout(tick, delay);
    };
    tick();
    const onVisible = () => { if (!document.hidden) { clearTimeout(timer); tick(); } };
    document.addEventListener("visibilitychange", onVisible);
    return () => { stopped = true; ctrl.abort(); clearTimeout(timer); document.removeEventListener("visibilitychange", onVisible); };
  }, [token, refresh]);

  const pick = useCallback(async (maneuver: ManeuverId) => {
    const v = viewRef.current;
    if (!token || !v) return;
    setBusy(true);
    try {
      const { state } = await callApi({ action: "pick", code, token, turn: v.turn, maneuver });
      accept(state);
    } catch (e) {
      setError((e as Error).message);
      refresh();
    } finally { setBusy(false); }
  }, [code, token, accept, refresh]);

  const rematch = useCallback(async () => {
    if (!token) return;
    setBusy(true);
    try { const { state } = await callApi({ action: "rematch", code, token }); accept(state); }
    catch (e) { setError((e as Error).message); refresh(); }
    finally { setBusy(false); }
  }, [code, token, accept, refresh]);

  const leave = useCallback(async () => {
    if (token) { try { await callApi({ action: "leave", code, token }); } catch { /* already gone */ } }
    session.forget(code);
  }, [code, token]);

  return { view, status, error, busy, pick, rematch, leave, refresh };
}
