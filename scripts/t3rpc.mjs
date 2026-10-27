// Minimal Effect-RPC-over-WebSocket client for a local or remote T3 Code server.
// The environment comes from config.json (see config.example.json), picked with T3_ENV or --env.
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import WebSocket from "ws";
import { HttpsProxyAgent } from "https-proxy-agent";
import { ProxyAgent } from "undici";
import { loadConfig, getEnv, configFile, checkSecretFile } from "./lib/config.mjs";

export const CONFIG = loadConfig();
const E = getEnv(CONFIG);
export const ENV_NAME = E.name;
export const ENV = E;

const base = new URL(E.baseUrl);
if (!["http:", "https:"].includes(base.protocol) || base.username || base.password) throw new Error("Invalid T3 endpoint");
// Plain HTTP only for loopback, or hosts listed explicitly in T3_ALLOW_HTTP_HOSTS (comma-separated).
const httpOk = ["127.0.0.1", "localhost", "[::1]", ...(process.env.T3_ALLOW_HTTP_HOSTS || "").split(",").map((h) => h.trim().toLowerCase()).filter(Boolean)];
if (base.protocol === "http:" && !httpOk.includes(base.hostname)) throw new Error("Remote T3 endpoints require HTTPS (or list the host in T3_ALLOW_HTTP_HOSTS)");
const ORIGIN = base.origin;

export const headers = { "Content-Type": "application/json", "x-t3-orchestration-protocol": "2" };
const auth = E.auth || {};
if (process.env.T3_TOKEN) headers.Authorization = `Bearer ${process.env.T3_TOKEN}`;
else if (auth.tokenFile) { const f = configFile(auth.tokenFile); checkSecretFile(f); headers.Authorization = `Bearer ${readFileSync(f, "utf8").trim()}`; }
if (auth.cookieFile) { // Netscape cookie jar (curl -c)
  const f = configFile(auth.cookieFile); checkSecretFile(f);
  const host = base.hostname, now = Date.now() / 1000;
  const c = readFileSync(f, "utf8").split("\n").map((l) => l.replace(/^#HttpOnly_/, ""))
    .filter((l) => l && !l.startsWith("#")).map((l) => l.split("\t"))
    .filter((x) => x.length >= 7 && (host === x[0].replace(/^\./, "") || (x[1] === "TRUE" && host.endsWith("." + x[0].replace(/^\./, "")))) && (x[4] === "0" || +x[4] > now))
    .map((x) => `${x[5]}=${x[6]}`);
  if (c.length) headers.Cookie = c.join("; ");
}
if (!headers.Authorization && !headers.Cookie) throw new Error(`environment ${ENV_NAME} has no credentials (auth.tokenFile, auth.cookieFile or T3_TOKEN)`);

const proxy = process.env.T3_PROXY || E.proxy;
const dispatcher = proxy ? new ProxyAgent(proxy) : undefined;
const wsAgent = proxy ? new HttpsProxyAgent(proxy) : undefined;

export async function http(path, body) {
  const r = await fetch(ORIGIN + path, { method: body ? "POST" : "GET", headers, body: body ? JSON.stringify(body) : undefined, dispatcher, redirect: "error", signal: AbortSignal.timeout(30000) });
  const t = await r.text(); if (!r.ok) throw new Error(`${path} HTTP ${r.status}`); return t ? JSON.parse(t) : null;
}

export async function connect() {
  const { ticket } = await http("/api/auth/websocket-ticket", {});
  const ws = new WebSocket(`${ORIGIN.replace(/^http/, "ws")}/ws?orchestrationProtocol=2&wsTicket=${encodeURIComponent(ticket)}`,
    { agent: wsAgent, headers: headers.Cookie ? { Cookie: headers.Cookie, Origin: ORIGIN } : { Origin: ORIGIN } });
  await new Promise((ok, no) => { ws.once("open", ok); ws.once("error", no); });
  let n = 0; const pending = new Map();
  ws.on("message", (data) => {
    for (const line of String(data).split("\n").filter(Boolean)) {
      const m = JSON.parse(line); const msgs = Array.isArray(m) ? m : [m];
      for (const x of msgs) {
        if (x._tag === "Ping") ws.send(JSON.stringify({ _tag: "Pong" }));
        const p = pending.get(String(x.requestId)); if (!p) continue;
        if (x._tag === "Chunk") { ws.send(JSON.stringify({ _tag: "Ack", requestId: x.requestId })); p.chunks.push(...x.values); if (p.first) { pending.delete(String(x.requestId)); p.ok(x.values[0]); } }
        if (x._tag === "Exit") {
          pending.delete(String(x.requestId));
          x.exit._tag === "Success" ? p.ok(x.exit.value ?? p.chunks) : p.no(new Error("T3 RPC failed; outcome may be uncertain"));
        }
      }
    }
  });
  const send = (tag, payload, first) => new Promise((ok, no) => {
    const id = String(++n); pending.set(id, { ok, no, chunks: [], first });
    ws.send(JSON.stringify({ _tag: "Request", id, tag, payload, headers: [] }));
    if (first) setTimeout(() => no(new Error(tag + " timed out")), 20000).unref();
  });
  return {
    call: (tag, payload) => send(tag, payload, false),
    // first(): open a streaming RPC (e.g. orchestration.subscribeShell) and resolve with its first value
    first: (tag, payload) => send(tag, payload, true),
    close: () => ws.close(),
  };
}

export const RUN_ACTIVE = ["preparing", "starting", "running", "waiting"];
export const RUN_DONE = ["completed", "failed", "cancelled", "interrupted", "rolled_back"];
export { randomUUID };
