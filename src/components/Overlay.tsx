import { useEffect, useRef, type ReactNode } from "react";

interface Props { title: string; children?: ReactNode; actions: ReactNode; tone?: "default" | "win" | "loss" }

/** Full-screen card used for hand-offs between pilots and end-of-duel results. */
export function Overlay({ title, children, actions, tone = "default" }: Props) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => { box.current?.querySelector<HTMLElement>("button")?.focus(); }, [title]);
  return (
    <div className="overlay" data-modal-open role="dialog" aria-modal="true" aria-labelledby="overlay-title">
      <div className={`overlay-box tone-${tone}`} ref={box}>
        <h2 id="overlay-title">{title}</h2>
        {children}
        <div className="overlay-actions">{actions}</div>
      </div>
    </div>
  );
}
