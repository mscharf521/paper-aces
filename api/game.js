// Paper Aces online play — Vercel serverless function backed by Upstash Redis (REST API, no SDK needed).
// POST /api/game  { action: "create" | "join" | "state" | "pick" | "rematch", code, token, turn, maneuver }
const R = require("../rules.js");
const crypto = require("crypto");

const TTL = 60 * 60 * 3; // games expire 3 hours after the last move
const LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ"; // no I or O, so codes are easy to read aloud
const NAMES = ["Blue", "Red"];

function creds() {
  const env = process.env;
  let url = env.UPSTASH_REDIS_REST_URL || env.KV_REST_API_URL;
  let token = env.UPSTASH_REDIS_REST_TOKEN || env.KV_REST_API_TOKEN;
  if (!url || !token) { // integrations sometimes add a custom prefix, e.g. STORAGE_KV_REST_API_URL
    for (const k of Object.keys(env)) {
      if (!url && /(KV_REST_API_URL|REDIS_REST_URL)$/.test(k)) url = env[k];
      if (!token && /(KV_REST_API_TOKEN|REDIS_REST_TOKEN)$/.test(k) && !/READ_ONLY/.test(k)) token = env[k];
    }
  }
  if (!url || !token) throw Object.assign(new Error("Redis is not configured. Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN."), { status: 500 });
  return { url: url.replace(/\/$/, ""), token };
}
async function redis(cmds) { // pipeline: array of commands -> array of results
  const { url, token } = creds();
  const r = await fetch(url + "/pipeline", {
    method: "POST", headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
    body: JSON.stringify(cmds),
  });
  if (!r.ok) throw Object.assign(new Error("Redis request failed (" + r.status + ")"), { status: 502 });
  const out = await r.json();
  return out.map(x => { if (x.error) throw new Error(x.error); return x.result; });
}
const gKey = c => "pa:g:" + c, pKey = c => "pa:p:" + c, lKey = (c, t) => "pa:l:" + c + ":" + t;
const fail = (status, msg) => { throw Object.assign(new Error(msg), { status }); };
const hashToObj = arr => { const o = {}; for (let i = 0; arr && i < arr.length; i += 2) o[arr[i]] = arr[i + 1]; return o; };

async function load(code) {
  const [g, p] = await redis([["GET", gKey(code)], ["HGETALL", pKey(code)]]);
  if (!g) fail(404, "No game with that code. Check the letters, or ask the host for a new code.");
  return { g: JSON.parse(g), picks: hashToObj(p) };
}
function seatOf(g, token) {
  if (token && token === g.t1) return 1;
  if (token && token === g.t2) return 2;
  fail(403, "This device is not part of that game.");
}
function view(g, picks, seat) {
  const { t1, t2, ...pub } = g;
  return { ...pub, seat, joined: !!t2,
    picked: { 1: !!picks[g.turn + ":1"], 2: !!picks[g.turn + ":2"] },
    myPick: picks[g.turn + ":" + seat] || null };
}
async function tryResolve(code, g, picks) {
  const m1 = picks[g.turn + ":1"], m2 = picks[g.turn + ":2"];
  if (!m1 || !m2 || g.over) return { g, picks };
  const [lock] = await redis([["SET", lKey(code, g.turn), "1", "NX", "EX", "20"]]);
  if (lock !== "OK") return { g, picks }; // another request is resolving this turn
  const fresh = await load(code); // re-read under the lock
  const G = fresh.g;
  if (G.turn !== g.turn || G.over) return fresh;
  const t = G.turn;
  R.resolveTurn(G, m1, m2, NAMES);
  G.updated = Date.now();
  await redis([["SET", gKey(code), JSON.stringify(G), "EX", String(TTL)], ["HDEL", pKey(code), t + ":1", t + ":2"], ["EXPIRE", pKey(code), String(TTL)]]);
  delete picks[t + ":1"]; delete picks[t + ":2"];
  return { g: G, picks };
}

async function handle(body) {
  const action = body.action;
  const code = String(body.code || "").toUpperCase().replace(/[^A-Z]/g, "").slice(0, 4);

  if (action === "create") {
    const g = { ...R.newDuel(), t1: crypto.randomBytes(16).toString("hex"), t2: null, created: Date.now(), updated: Date.now() };
    for (let i = 0; i < 12; i++) {
      let c = ""; for (let k = 0; k < 4; k++) c += LETTERS[crypto.randomInt(LETTERS.length)];
      const [ok] = await redis([["SET", gKey(c), JSON.stringify({ ...g, code: c }), "NX", "EX", String(TTL)]]);
      if (ok === "OK") return { token: g.t1, state: view({ ...g, code: c }, {}, 1) };
    }
    fail(503, "Could not find a free code. Try again.");
  }

  if (code.length !== 4) fail(400, "Codes are four letters.");

  if (action === "join") {
    const { g, picks } = await load(code);
    if (body.token && (body.token === g.t1 || body.token === g.t2)) return { token: body.token, state: view(g, picks, seatOf(g, body.token)) };
    if (g.t2) fail(409, "That game already has two pilots.");
    const t2 = crypto.randomBytes(16).toString("hex");
    // claim the second seat atomically, so two people joining at once can't both get in
    const [claimed] = await redis([["SET", "pa:j:" + code, t2, "NX", "EX", String(TTL)]]);
    if (claimed !== "OK") fail(409, "That game already has two pilots.");
    g.t2 = t2; g.updated = Date.now();
    g.log.unshift({ n: g.turn, t: "Red has joined. The duel begins." });
    await redis([["SET", gKey(code), JSON.stringify(g), "EX", String(TTL)]]);
    return { token: g.t2, state: view(g, picks, 2) };
  }

  let { g, picks } = await load(code);
  const seat = seatOf(g, body.token);

  if (action === "state") {
    ({ g, picks } = await tryResolve(code, g, picks)); // recovers a turn if a resolver crashed
    return { state: view(g, picks, seat) };
  }

  if (action === "pick") {
    if (!g.t2) fail(409, "Waiting for the second pilot to join.");
    if (g.over) fail(409, "This duel is over.");
    if (Number(body.turn) !== g.turn) fail(409, "That turn has already been flown. Refreshing.");
    const m = body.maneuver, me = seat === 1 ? g.p1 : g.p2;
    if (!R.MAN[m]) fail(400, "Unknown maneuver.");
    const why = R.lockReason(me.last, m); if (why) fail(400, why);
    const field = g.turn + ":" + seat;
    const [, , all] = await redis([["HSETNX", pKey(code), field, m], ["EXPIRE", pKey(code), String(TTL)], ["HGETALL", pKey(code)]]);
    picks = hashToObj(all);
    ({ g, picks } = await tryResolve(code, g, picks));
    return { state: view(g, picks, seat) };
  }

  if (action === "rematch") {
    if (!g.over) fail(409, "The duel is still on.");
    const n = { ...R.newDuel(), code, t1: g.t1, t2: g.t2, created: g.created, updated: Date.now(), round: (g.round || 1) + 1 };
    n.log.unshift({ n: 1, t: `${seat === 1 ? "Blue" : "Red"} calls for a rematch. Round ${n.round}.` });
    await redis([["SET", gKey(code), JSON.stringify(n), "EX", String(TTL)], ["DEL", pKey(code)]]);
    return { state: view(n, {}, seat) };
  }

  fail(400, "Unknown action.");
}

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") { res.statusCode = 405; return res.end(JSON.stringify({ error: "Use POST." })); }
  try {
    let body = req.body;
    if (typeof body === "string") body = JSON.parse(body || "{}");
    if (!body) { // body not pre-parsed
      body = await new Promise((ok, no) => { let s = ""; req.on("data", d => s += d); req.on("end", () => { try { ok(JSON.parse(s || "{}")); } catch (e) { no(e); } }); });
    }
    const out = await handle(body || {});
    res.statusCode = 200; res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify(out));
  } catch (e) {
    res.statusCode = e.status || 500; res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: e.message || "Server error" }));
  }
};
module.exports.handle = handle;
