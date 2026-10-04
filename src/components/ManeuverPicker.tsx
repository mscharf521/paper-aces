import { useEffect } from "react";
import { MAN, ORDER, lockReason, type ManeuverId } from "../../shared/rules";

const KEYS = "qwertasdfg";

const PATHS: Record<ManeuverId, string> = {
  straight: "M19 33V8M13 14l6-6 6 6",
  slow: "M19 33V18M13 24l6-6 6 6M12 31h3M18 31h3M24 31h2",
  fast: "M19 35V4M13 10l6-6 6 6M13 17l6-6 6 6",
  bankL: "M24 33V22q0-9-10-12M14 4l-2 6 6 2",
  bankR: "M14 33V22q0-9 10-12M24 4l2 6-6 2",
  hardL: "M26 34V18q0-6-6-6H8M13 7l-5 5 5 5",
  hardR: "M12 34V18q0-6 6-6h12M25 7l5 5-5 5",
  slipL: "M22 33l-8-23M10 13l4-4 4 4",
  slipR: "M16 33l8-23M20 13l4-4 4 4",
  immel: "M14 34V12a6 6 0 0 1 12 0v12M21 19l5 6 5-6",
};

export function ManeuverGlyph({ id }: { id: ManeuverId }) {
  return (
    <svg viewBox="0 0 38 38" aria-hidden="true">
      <path d={PATHS[id]} stroke="currentColor" strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

interface Props {
  last: ManeuverId | null;
  selected: ManeuverId | null;
  disabled: boolean;
  onSelect: (m: ManeuverId) => void;
  onSubmit?: () => void;
}

export function ManeuverPicker({ last, selected, disabled, onSelect, onSubmit }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (disabled || t.tagName === "INPUT" || t.tagName === "TEXTAREA" || document.querySelector("[data-modal-open]")) return;
      const i = KEYS.indexOf(e.key.toLowerCase());
      if (i >= 0 && !lockReason(last, ORDER[i])) onSelect(ORDER[i]);
      if (e.key === "Enter" && selected && onSubmit && t.tagName !== "BUTTON") onSubmit();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [disabled, last, selected, onSelect, onSubmit]);

  return (
    <div className="mans" role="radiogroup" aria-label="Maneuver">
      {ORDER.map((id, i) => {
        const why = lockReason(last, id);
        return (
          <button key={id} type="button" role="radio" aria-checked={selected === id}
            className={`man${selected === id ? " is-selected" : ""}`}
            disabled={disabled || !!why}
            title={why ? `${MAN[id].long}: ${why}` : `${MAN[id].long} (${KEYS[i].toUpperCase()})`}
            onClick={() => onSelect(id)}>
            <ManeuverGlyph id={id} />
            <span>{MAN[id].name}</span>
          </button>
        );
      })}
    </div>
  );
}

export function lockedNote(last: ManeuverId | null): string | null {
  const reasons = [...new Set(ORDER.map(id => lockReason(last, id)).filter(Boolean))];
  return reasons.length ? `Locked this turn: ${reasons.join(" ")}` : null;
}
