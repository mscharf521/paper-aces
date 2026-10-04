// Remembers which online games this browser belongs to, so a reload or a shared link rejoins.
import type { Seat } from "../../shared/rules";

export interface SavedGame { code: string; token: string; seat: Seat; at: number }
const KEY = "paperaces.games.v2";
const MAX_AGE = 3 * 60 * 60 * 1000; // matches the server's expiry

function readAll(): SavedGame[] {
  try {
    const list = JSON.parse(localStorage.getItem(KEY) || "[]") as SavedGame[];
    return list.filter(g => Date.now() - g.at < MAX_AGE);
  } catch { return []; }
}
function writeAll(list: SavedGame[]) {
  try { localStorage.setItem(KEY, JSON.stringify(list.slice(0, 8))); } catch { /* storage blocked */ }
}

export const session = {
  list: readAll,
  get(code: string) { return readAll().find(g => g.code === code) ?? null; },
  save(code: string, token: string, seat: Seat) {
    writeAll([{ code, token, seat, at: Date.now() }, ...readAll().filter(g => g.code !== code)]);
  },
  touch(code: string) {
    writeAll(readAll().map(g => (g.code === code ? { ...g, at: Date.now() } : g)));
  },
  forget(code: string) { writeAll(readAll().filter(g => g.code !== code)); },
};
