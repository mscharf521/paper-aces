import type { Redis } from "@upstash/redis";

/**
 * A tiny in-process stand-in for the Upstash client, covering only the commands
 * gameService uses. For `npm run dev` without Upstash credentials; state is lost on restart.
 */
type Entry = { value: unknown; expires: number | null };
type SetOpts = { nx?: boolean; ex?: number };

const clone = <T>(v: T): T => (v === undefined ? v : structuredClone(v));

class MemoryStore {
  private data = new Map<string, Entry>();

  private live(key: string): Entry | undefined {
    const e = this.data.get(key);
    if (e && e.expires !== null && e.expires <= Date.now()) {
      this.data.delete(key);
      return undefined;
    }
    return e;
  }

  private hash(key: string, create: boolean): Record<string, unknown> | undefined {
    const e = this.live(key);
    if (e) return e.value as Record<string, unknown>;
    if (!create) return undefined;
    const h: Record<string, unknown> = {};
    this.data.set(key, { value: h, expires: null });
    return h;
  }

  async get<T>(key: string): Promise<T | null> {
    const e = this.live(key);
    return e ? clone(e.value as T) : null;
  }

  async set(key: string, value: unknown, opts: SetOpts = {}): Promise<"OK" | null> {
    if (opts.nx && this.live(key)) return null;
    this.data.set(key, { value: clone(value), expires: opts.ex ? Date.now() + opts.ex * 1000 : null });
    return "OK";
  }

  async del(...keys: string[]): Promise<number> {
    let n = 0;
    for (const k of keys) if (this.live(k) && this.data.delete(k)) n++;
    return n;
  }

  async expire(key: string, seconds: number): Promise<0 | 1> {
    const e = this.live(key);
    if (!e) return 0;
    e.expires = Date.now() + seconds * 1000;
    return 1;
  }

  async hgetall<T>(key: string): Promise<T | null> {
    const h = this.hash(key, false);
    return h && Object.keys(h).length ? (clone(h) as T) : null;
  }

  async hsetnx(key: string, field: string, value: unknown): Promise<0 | 1> {
    const h = this.hash(key, true)!;
    if (field in h) return 0;
    h[field] = clone(value);
    return 1;
  }

  async hdel(key: string, ...fields: string[]): Promise<number> {
    const h = this.hash(key, false);
    if (!h) return 0;
    let n = 0;
    for (const f of fields) if (f in h) { delete h[f]; n++; }
    if (!Object.keys(h).length) this.data.delete(key);
    return n;
  }

  pipeline() {
    const ops: (() => Promise<unknown>)[] = [];
    const store = this;
    const p = {
      get(key: string) { ops.push(() => store.get(key)); return p; },
      set(key: string, value: unknown, opts?: SetOpts) { ops.push(() => store.set(key, value, opts)); return p; },
      del(...keys: string[]) { ops.push(() => store.del(...keys)); return p; },
      expire(key: string, s: number) { ops.push(() => store.expire(key, s)); return p; },
      hgetall(key: string) { ops.push(() => store.hgetall(key)); return p; },
      hsetnx(key: string, f: string, v: unknown) { ops.push(() => store.hsetnx(key, f, v)); return p; },
      hdel(key: string, ...f: string[]) { ops.push(() => store.hdel(key, ...f)); return p; },
      async exec() {
        const out: unknown[] = [];
        for (const op of ops) out.push(await op());
        return out;
      },
    };
    return p;
  }
}

/** Kept on globalThis so Vite's module reloads don't wipe running games. */
export function memoryRedis(): Redis {
  const g = globalThis as { __paperAcesMemoryRedis?: MemoryStore };
  g.__paperAcesMemoryRedis ??= new MemoryStore();
  return g.__paperAcesMemoryRedis as unknown as Redis;
}
