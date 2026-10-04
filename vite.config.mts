import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

/**
 * Serves /api/* from the files in /api during `npm run dev`, so online play works locally
 * without the Vercel CLI. Put UPSTASH_REDIS_REST_URL / _TOKEN in .env.local.
 */
function devApi(): Plugin {
  return {
    name: "paper-aces-dev-api",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith("/api/")) return next();
        try {
          const name = req.url.split("?")[0].replace(/^\/api\//, "").replace(/\/$/, "");
          const mod = await server.ssrLoadModule(`/api/${name}.ts`);
          const handler = mod[req.method ?? "GET"];
          if (typeof handler !== "function") { res.statusCode = 405; return res.end(); }
          const chunks: Buffer[] = [];
          for await (const c of req) chunks.push(c as Buffer);
          const request = new Request(`http://localhost${req.url}`, {
            method: req.method,
            headers: req.headers as Record<string, string>,
            body: chunks.length ? Buffer.concat(chunks) : undefined,
          });
          const response: Response = await handler(request);
          res.statusCode = response.status;
          response.headers.forEach((v, k) => res.setHeader(k, v));
          res.end(Buffer.from(await response.arrayBuffer()));
        } catch (e) {
          server.ssrFixStacktrace(e as Error);
          next(e);
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  Object.assign(process.env, loadEnv(mode, process.cwd(), "")); // expose .env.local to the API handlers
  return {
    plugins: [react(), devApi()],
    server: { port: 5173 },
  };
});
