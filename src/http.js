import { AppError } from "./lib/errors.js";

export async function readJson(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 1_000_000) throw new AppError(413, "PAYLOAD_TOO_LARGE", "Request body exceeds 1 MB.");
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new AppError(400, "INVALID_JSON", "Request body must contain valid JSON.");
  }
}

export function send(response, status, body, corsOrigin = "*") {
  const payload = JSON.stringify(body, (_, value) => typeof value === "bigint" ? value.toString() : value);
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(payload),
    "access-control-allow-origin": corsOrigin,
    "access-control-allow-methods": "GET,POST,PATCH,DELETE,OPTIONS",
    "access-control-allow-headers": "content-type"
  });
  response.end(payload);
}
