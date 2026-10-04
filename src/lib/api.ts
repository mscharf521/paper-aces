import type { ApiRequest, ApiResponse } from "../../shared/online";

export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export async function callApi<T = ApiResponse>(body: ApiRequest, signal?: AbortSignal): Promise<T> {
  let res: Response;
  try {
    res = await fetch("/api/game", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal,
    });
  } catch (e) {
    if ((e as Error).name === "AbortError") throw e;
    throw new ApiError(0, "Can't reach the game server. Check your connection.");
  }
  let data: (T & { error?: string }) | null = null;
  try { data = await res.json(); } catch { /* non-JSON response */ }
  if (!res.ok || !data) {
    const fallback = res.status === 404 && !data
      ? "The game server isn't running here. Online play needs the Vercel deployment (or `npm run dev`)."
      : `The game server returned an error (${res.status}).`;
    throw new ApiError(res.status, data?.error ?? fallback);
  }
  return data;
}
