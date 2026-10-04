import { Redis } from "@upstash/redis";
import { HttpError } from "./errors";

let client: Redis | null = null;

/**
 * Finds the Upstash credentials Vercel's integration added. Accepts the Upstash names,
 * the legacy KV names, and either of those with a custom prefix (e.g. STORAGE_KV_REST_API_URL).
 */
export function resolveCredentials(env: NodeJS.ProcessEnv = process.env): { url: string; token: string } | null {
  let url = env.UPSTASH_REDIS_REST_URL || env.KV_REST_API_URL;
  let token = env.UPSTASH_REDIS_REST_TOKEN || env.KV_REST_API_TOKEN;
  if (!url || !token) {
    for (const [k, v] of Object.entries(env)) {
      if (!v) continue;
      if (!url && /(KV_REST_API_URL|REDIS_REST_URL)$/.test(k)) url = v;
      if (!token && /(KV_REST_API_TOKEN|REDIS_REST_TOKEN)$/.test(k) && !/READ_ONLY/.test(k)) token = v;
    }
  }
  return url && token ? { url: url.replace(/\/$/, ""), token } : null;
}

export function redis(): Redis {
  if (client) return client;
  const creds = resolveCredentials();
  if (!creds) {
    throw new HttpError(500, "The game server has no database. Connect Upstash Redis to the Vercel project and redeploy.");
  }
  client = new Redis({ url: creds.url, token: creds.token });
  return client;
}
