import { UNIT_M, clockOf, hitsOn, wrap180, type Plane, type Relative } from "../../shared/rules";

export type TagKind = "sights" | "danger" | "calm" | "down";
export interface Caption { tag: { kind: TagKind; text: string } | null; text: string }

/** One plain sentence describing what the pilot sees on this page. */
export function describe(me: Plane, en: Plane, rel: Relative, rear: boolean): Caption {
  const metres = Math.round((rel.dist * UNIT_M) / 5) * 5;
  // aspect relative to the line of sight: 0° = coming straight at you, 180° = flying away
  const aspect = Math.abs(wrap180(rel.yaw - (180 + rel.bearing)));
  const asp = aspect < 30 ? "nose-on, coming at you" : aspect > 150 ? "tail toward you, running"
    : aspect < 75 ? "angling toward you" : aspect > 115 ? "angling away" : "crossing broadside";
  const lvl = rel.dAlt > 0.5 ? "above you" : rel.dAlt < -0.5 ? "below you" : "level with you";
  const pos = Math.abs(rel.bearing) < 8 ? "dead ahead" : rear && Math.abs(rel.bearing) > 170 ? "dead astern" : `at ${clockOf(rel.bearing)} o'clock`;
  let tag: Caption["tag"] = null;
  if (en.hp <= 0) tag = { kind: "down", text: "Going down" };
  else if (hitsOn(me, en)) tag = { kind: "sights", text: "In your sights" };
  else if (hitsOn(en, me)) tag = { kind: "danger", text: "He has you lined up" };
  else if (rel.dist > 7) tag = { kind: "calm", text: "Distant" };
  return { tag, text: `Enemy ${pos}, about ${metres} m, ${lvl}, ${asp}.` };
}
