import { useEffect, useRef } from "react";
import { pageNumber, type Fx, type Plane } from "../../shared/rules";
import { PAGE_H, PAGE_W, drawPage, viewOf } from "../render/cockpit";
import { describe } from "../lib/describe";

interface Props { me: Plane; en: Plane; fx: Fx; pilotLabel: string }

/** The illustrated page: cockpit view, page number and a one-line caption. */
export function CockpitPage({ me, en, fx, pilotLabel }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const { rel, rear } = viewOf(me, en);
  const caption = describe(me, en, rel, rear);

  useEffect(() => {
    const cx = ref.current?.getContext("2d");
    if (!cx) return;
    drawPage(cx, me, en, fx);
    // redraw once webfonts arrive so gauge labels use the right face
    let live = true;
    document.fonts?.ready.then(() => { if (live) drawPage(cx, me, en, fx); });
    return () => { live = false; };
  }, [me, en, fx]);

  return (
    <article className="page" aria-label="Cockpit view">
      <header className="page-head">
        <span className="eyebrow">{pilotLabel} · {rear ? "looking aft" : "forward view"}</span>
        <span className="page-no"><small>Page</small>{String(pageNumber(me, en)).padStart(3, "0")}</span>
      </header>
      <canvas ref={ref} width={PAGE_W} height={PAGE_H} className="view" role="img"
        aria-label={`Cockpit view. ${caption.text}`} />
      <p className="caption">
        {caption.tag && <span className={`tag tag-${caption.tag.kind}`}>{caption.tag.text}</span>}
        {caption.text}
      </p>
    </article>
  );
}
