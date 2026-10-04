// Online duel logic. Each game lives in Redis under its four-letter code.
//
//   pa:g:CODE         game record (JSON): duel state + both players' secret tokens
//   pa:p:CODE         hash of hidden picks for the current turn, field "turn:seat"
//   pa:j:CODE         claim on the second seat, so only one person can join
//   pa:l:CODE:TURN    short lock so exactly one request resolves each turn
import { randomBytes, randomInt } from "node:crypto";
import { isManeuver, lockReason, newDuel, resolveTurn, type Duel, type ManeuverId, type Seat } from "../shared/rules.js";
import { CODE_LETTERS, isCode, normalizeCode, type ApiRequest, type ApiResponse, type OnlineView } from "../shared/online.js";
import { HttpError } from "./errors.js";
import { redis } from "./redis.js";

const TTL = 60 * 60 * 3; // seconds; refreshed on every write
const NAMES: [string, string] = ["Blue", "Red"];

interface GameRecord extends Duel {
  code: string;
  t1: string;
  t2: string | null;
  round: number;
  created: number;
  updated: number;
}
type Picks = Record<string, ManeuverId>;

const gKey = (c: string) => `pa:g:${c}`;
const pKey = (c: string) => `pa:p:${c}`;
const jKey = (c: string) => `pa:j:${c}`;
const lKey = (c: string, t: number) => `pa:l:${c}:${t}`;
const newToken = () => randomBytes(16).toString("hex");

async function load(code: string): Promise<{ g: GameRecord; picks: Picks }> {
  const [g, picks] = await redis().pipeline().get<GameRecord>(gKey(code)).hgetall<Picks>(pKey(code)).exec<[GameRecord | null, Picks | null]>();
  if (!g) throw new HttpError(404, `There's no game ${code}. Check the letters, or ask the host for a new code.`);
  return { g, picks: picks ?? {} };
}

async function save(g: GameRecord) {
  g.updated = Date.now();
  await redis().set(gKey(g.code), g, { ex: TTL });
}

function seatOf(g: GameRecord, token: unknown): Seat {
  if (typeof token === "string" && token) {
    if (token === g.t1) return 1;
    if (token === g.t2) return 2;
  }
  throw new HttpError(403, "This device isn't part of that game. Join it with the code instead.");
}

function view(g: GameRecord, picks: Picks, seat: Seat): OnlineView {
  const { t1: _t1, t2, created: _c, updated: _u, ...duel } = g;
  void _t1; void _c; void _u;
  return {
    ...duel,
    seat,
    joined: !!t2,
    round: g.round,
    picked: { 1: !!picks[`${g.turn}:1`], 2: !!picks[`${g.turn}:2`] },
    myPick: picks[`${g.turn}:${seat}`] ?? null,
  };
}

/** If both pilots have picked, fly the turn. Safe to call from any request; a lock makes it run once. */
async function tryResolve(code: string, g: GameRecord, picks: Picks) {
  const m1 = picks[`${g.turn}:1`], m2 = picks[`${g.turn}:2`];
  if (!m1 || !m2 || g.over) return { g, picks };
  const got = await redis().set(lKey(code, g.turn), "1", { nx: true, ex: 20 });
  if (got !== "OK") return { g, picks }; // another request is flying this turn
  const fresh = await load(code);
  if (fresh.g.turn !== g.turn || fresh.g.over) return fresh;
  const t = g.turn;
  const next = resolveTurn(fresh.g, m1, m2, NAMES);
  await redis().pipeline()
    .set(gKey(code), { ...next, updated: Date.now() }, { ex: TTL })
    .hdel(pKey(code), `${t}:1`, `${t}:2`)
    .expire(pKey(code), TTL)
    .exec();
  const rest = { ...fresh.picks };
  delete rest[`${t}:1`]; delete rest[`${t}:2`];
  return { g: next, picks: rest };
}

async function createGame(): Promise<ApiResponse> {
  const token = newToken();
  for (let i = 0; i < 12; i++) {
    let code = "";
    for (let k = 0; k < 4; k++) code += CODE_LETTERS[randomInt(CODE_LETTERS.length)];
    const g: GameRecord = { ...newDuel(), code, t1: token, t2: null, round: 1, created: Date.now(), updated: Date.now() };
    const ok = await redis().set(gKey(code), g, { nx: true, ex: TTL });
    if (ok === "OK") return { token, state: view(g, {}, 1) };
  }
  throw new HttpError(503, "Couldn't find a free game code. Try again.");
}

async function joinGame(code: string, token?: string): Promise<ApiResponse> {
  const { g, picks } = await load(code);
  if (token && (token === g.t1 || token === g.t2)) return { token, state: view(g, picks, seatOf(g, token)) }; // rejoining
  if (g.t2) throw new HttpError(409, `Game ${code} already has two pilots.`);
  const t2 = newToken();
  const claimed = await redis().set(jKey(code), t2, { nx: true, ex: TTL });
  if (claimed !== "OK") throw new HttpError(409, `Game ${code} already has two pilots.`);
  const fresh = (await load(code)).g; // re-read so we don't overwrite anything written meanwhile
  fresh.t2 = t2;
  fresh.log.unshift({ n: fresh.turn, t: "Red has joined. The duel begins." });
  await save(fresh);
  return { token: t2, state: view(fresh, picks, 2) };
}

async function pick(code: string, token: string, turn: number, maneuver: unknown): Promise<ApiResponse> {
  let { g, picks } = await load(code);
  const seat = seatOf(g, token);
  if (!g.t2) throw new HttpError(409, "Waiting for the second pilot to join.");
  if (g.over) throw new HttpError(409, "This duel is over.");
  if (Number(turn) !== g.turn) throw new HttpError(409, "That turn has already been flown.");
  if (!isManeuver(maneuver)) throw new HttpError(400, "Unknown maneuver.");
  const why = lockReason((seat === 1 ? g.p1 : g.p2).last, maneuver);
  if (why) throw new HttpError(400, why);

  const field = `${g.turn}:${seat}`;
  const [, , all] = await redis().pipeline()
    .hsetnx(pKey(code), field, maneuver)
    .expire(pKey(code), TTL)
    .hgetall<Picks>(pKey(code))
    .exec<[number, number, Picks | null]>();
  picks = all ?? {};
  ({ g, picks } = await tryResolve(code, g, picks));
  return { state: view(g, picks, seat) };
}

async function getState(code: string, token: string): Promise<ApiResponse> {
  let { g, picks } = await load(code);
  const seat = seatOf(g, token);
  ({ g, picks } = await tryResolve(code, g, picks)); // also recovers a turn if a resolver died mid-way
  return { state: view(g, picks, seat) };
}

async function rematch(code: string, token: string): Promise<ApiResponse> {
  const { g } = await load(code);
  const seat = seatOf(g, token);
  if (!g.over) throw new HttpError(409, "The duel is still on.");
  const round = g.round + 1;
  const next: GameRecord = { ...newDuel(), code, t1: g.t1, t2: g.t2, round, created: g.created, updated: Date.now() };
  next.log.unshift({ n: 1, t: `${NAMES[seat - 1]} calls for a rematch. Round ${round}.` });
  await redis().pipeline().set(gKey(code), next, { ex: TTL }).del(pKey(code)).exec();
  return { state: view(next, {}, seat) };
}

async function leave(code: string, token: string): Promise<{ ok: true }> {
  const { g } = await load(code);
  const seat = seatOf(g, token);
  if (seat === 1 && !g.t2) {
    await redis().del(gKey(code), pKey(code), jKey(code)); // host cancelled before anyone joined
  }
  return { ok: true };
}

export async function handleAction(body: Partial<ApiRequest> & Record<string, unknown>): Promise<ApiResponse | { ok: true }> {
  const action = body.action;
  if (action === "create") return createGame();

  const code = normalizeCode(body.code);
  if (!isCode(code)) throw new HttpError(400, "Game codes are four letters.");
  const token = typeof body.token === "string" ? body.token : "";

  switch (action) {
    case "join": return joinGame(code, token || undefined);
    case "state": return getState(code, token);
    case "pick": return pick(code, token, Number(body.turn), body.maneuver);
    case "rematch": return rematch(code, token);
    case "leave": return leave(code, token);
    default: throw new HttpError(400, "Unknown action.");
  }
}
