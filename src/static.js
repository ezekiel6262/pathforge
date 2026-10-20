import { readFile, stat } from "node:fs/promises";
import path from "node:path";

const TYPES = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png" };

export async function serveStatic(response, pathname, root = path.resolve("web")) {
  const requested = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  const resolved = path.resolve(root, requested);
  if (!resolved.startsWith(root + path.sep) && resolved !== root) return false;
  try {
    if (!(await stat(resolved)).isFile()) return false;
    const body = await readFile(resolved);
    response.writeHead(200, { "content-type": TYPES[path.extname(resolved)] || "application/octet-stream", "content-length": body.length, "cache-control": path.extname(resolved) === ".html" ? "no-cache" : "public, max-age=3600" });
    response.end(body);
    return true;
  } catch {
    return false;
  }
}
