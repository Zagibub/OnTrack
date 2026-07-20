// Minimal prod-build server for e2e: static files from dist with SPA fallback,
// /api/* proxied to the local API (mirrors the nginx config in apps/web/nginx.conf).
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../dist/web/browser", import.meta.url));
const apiOrigin = process.env.API_URL ?? "http://localhost:3000";
const port = Number(process.env.PORT ?? 4173);

const MIME = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json",
  ".txt": "text/plain",
  ".woff2": "font/woff2",
};

async function proxy(req, res) {
  const upstream = await fetch(apiOrigin + req.url, {
    method: req.method,
    headers: { ...req.headers, host: new URL(apiOrigin).host },
    body: req.method === "GET" || req.method === "HEAD" ? undefined : req,
    duplex: "half",
    redirect: "manual",
  });
  const headers = {};
  upstream.headers.forEach((value, key) => {
    if (key !== "set-cookie" && key !== "content-encoding" && key !== "transfer-encoding") {
      headers[key] = value;
    }
  });
  const cookies = upstream.headers.getSetCookie();
  if (cookies.length > 0) headers["set-cookie"] = cookies;
  res.writeHead(upstream.status, headers);
  res.end(Buffer.from(await upstream.arrayBuffer()));
}

async function serveStatic(res, pathname) {
  const safePath = normalize(pathname).replace(/^(\.\.[/\\])+/, "");
  const candidates = [join(root, safePath), join(root, "index.html")];
  for (const file of candidates) {
    try {
      const body = await readFile(file);
      res.writeHead(200, { "content-type": MIME[extname(file)] ?? "application/octet-stream" });
      res.end(body);
      return;
    } catch {
      // try next candidate
    }
  }
  res.writeHead(404).end("not found");
}

createServer(async (req, res) => {
  try {
    const { pathname } = new URL(req.url ?? "/", "http://localhost");
    if (pathname.startsWith("/api/")) {
      await proxy(req, res);
    } else {
      await serveStatic(res, pathname === "/" ? "/index.html" : pathname);
    }
  } catch (err) {
    console.error(err);
    if (!res.headersSent) res.writeHead(502);
    res.end();
  }
}).listen(port, () => console.log(`serving ${root} on :${port}, /api -> ${apiOrigin}`));
