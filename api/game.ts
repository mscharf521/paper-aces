// Vercel Function: POST /api/game
import { handleAction } from "../server/gameService";
import { HttpError } from "../server/errors";

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

export async function POST(request: Request): Promise<Response> {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Send a JSON body." }, 400);
  }
  try {
    return json(await handleAction(body));
  } catch (e) {
    if (e instanceof HttpError) return json({ error: e.message }, e.status);
    console.error("[api/game]", e);
    return json({ error: "The game server hit a problem. Try again in a moment." }, 500);
  }
}

export function GET(): Response {
  return json({ error: "Use POST." }, 405);
}
