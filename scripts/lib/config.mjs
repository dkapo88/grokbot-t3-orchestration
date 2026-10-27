// Loads the orchestration config (environments, model routing, policy).
// Lookup order: $T3_ORCH_CONFIG, then ../config.json next to the scripts folder.
// Relative file paths inside the config (tokenFile, cookieFile) resolve against the config file's folder.
import { readFileSync, existsSync, statSync } from "node:fs";
import { dirname, resolve, isAbsolute } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
export const CONFIG_PATH = resolve(process.env.T3_ORCH_CONFIG || resolve(here, "../../config.json"));

function fail(msg) { console.error(`config: ${msg}`); process.exit(2); }

export function loadConfig() {
  if (!existsSync(CONFIG_PATH)) fail(`no config at ${CONFIG_PATH}. Copy config.example.json to config.json, or set T3_ORCH_CONFIG.`);
  let cfg;
  try { cfg = JSON.parse(readFileSync(CONFIG_PATH, "utf8")); } catch (e) { fail(`could not parse ${CONFIG_PATH}: ${e.message}`); }
  if (!cfg.environments || typeof cfg.environments !== "object") fail("missing \"environments\"");
  return cfg;
}

export function configFile(p) { return isAbsolute(p) ? p : resolve(dirname(CONFIG_PATH), p); }

// Warn (never print contents) when a credential file is readable by group or others.
export function checkSecretFile(p) {
  try { const m = statSync(p).mode & 0o077; if (m) console.error(`warning: ${p} is readable by other users; run chmod 600 on it`); } catch { fail(`credential file not found: ${p}`); }
}

export function envName(cfg) { return process.env.T3_ENV || cfg.defaultEnvironment || Object.keys(cfg.environments)[0]; }

export function getEnv(cfg, name = envName(cfg)) {
  const e = cfg.environments[name];
  if (!e) fail(`unknown environment "${name}"; known: ${Object.keys(cfg.environments).join(", ")}`);
  return { name, ...e };
}

// Resolve a routing role (implement, review, qa, ...) to a T3 modelSelection.
export function roleSelection(cfg, role) {
  const r = cfg.modelRouting?.roles?.[role];
  if (!r) fail(`no modelRouting.roles.${role} in config; roles: ${Object.keys(cfg.modelRouting?.roles || {}).join(", ")}`);
  if (!r.instanceId || !r.model) fail(`modelRouting.roles.${role} needs instanceId and model (it is ${r.via ? `handled by ${r.via}` : "incomplete"})`);
  return { instanceId: r.instanceId, model: r.model, options: (r.options || []).map((o) => ({ id: o.id, value: o.value })) };
}

// Refuse selections the config bans. No silent fallback: the caller exits instead.
export function checkBanned(cfg, sel) {
  for (const b of cfg.modelRouting?.banned || []) {
    const instOk = !b.instanceId || b.instanceId === sel.instanceId;
    const modelOk = !b.modelPattern || new RegExp(b.modelPattern, "i").test(sel.model);
    const notVia = b.unlessInstanceId && b.unlessInstanceId === sel.instanceId;
    if (instOk && modelOk && !notVia) return b.reason || `banned by modelRouting.banned (${JSON.stringify(b)})`;
  }
  return null;
}

export const PROVIDER_ALIASES = { claude: "claudeAgent", codex: "codex", cursor: "cursor", pi: "pi" };
