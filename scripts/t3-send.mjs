// Post a follow-up message into an EXISTING thread, by queue (default) or steer.
// Usage: t3-task.sh [--env NAME] send <threadId|exact title> ("<msg>" | --file F) [--queue|--steer] [--project TITLE] [--wait]
//   --queue (default): if a turn is running, the message waits and becomes a NEW run after it; if idle, it starts now.
//   --steer: inject the message into the RUNNING turn (the agent sees it at its next tool boundary, same run).
//            If idle, it simply starts a new turn. If a run is active but cannot take a steer it exits 3 and sends nothing.
// Prints JSON with delivered: "steered" | "queued" | "started", verified from the thread projection.
// Exit codes: 0 ok, 1 thread not found or ambiguous, 2 usage, 3 steer refused (nothing sent),
//             4 asked to steer but it landed as something else, 5 outcome uncertain (check messageId before retrying).
import { readFileSync } from "node:fs";
import { connect, randomUUID, ENV_NAME, RUN_ACTIVE, RUN_DONE } from "./t3rpc.mjs";

const a = process.argv.slice(2);
const flag = (k) => { const i = a.indexOf(k); if (i < 0) return; const v = a[i + 1]; a.splice(i, 2); return v; };
const bool = (k) => { const i = a.indexOf(k); if (i < 0) return false; a.splice(i, 1); return true; };
const wait = bool("--wait"), steer = bool("--steer"), queue = bool("--queue"); const projF = flag("--project"); const file = flag("--file");
const [target, ...rest] = a; const text = file ? readFileSync(file, "utf8") : rest.join(" ");
if (!target || !text || (steer && queue)) { console.error('usage: t3-task.sh [--env NAME] send <threadId|exact title> ("<msg>" | --file F) [--queue|--steer] [--project TITLE] [--wait]'); process.exit(2); }
const requested = steer ? "steer" : "queue";
const c = await connect();
const snap = (await c.first("orchestration.subscribeShell", {})).snapshot;
const projTitle = Object.fromEntries((snap.projects || []).map((p) => [p.id, p.title]));
let cands = (snap.threads || []).filter((t) => !t.deletedAt && (t.id === target || t.title === target));
if (projF) cands = cands.filter((t) => projTitle[t.projectId] === projF || t.projectId === projF);
if (cands.length !== 1) {
  console.error(cands.length ? `ambiguous: ${cands.length} threads match "${target}" in env ${ENV_NAME}; pass the id:` : `no thread "${target}" in env ${ENV_NAME} (exact title or id; see list --title)`);
  for (const t of cands) console.error(`  ${t.id}  ${t.title}  ${projTitle[t.projectId] ?? t.projectId}  archived=${!!t.archivedAt}`);
  c.close(); process.exit(1);
}
const th = cands[0]; const threadId = th.id;
const proj = () => c.call("orchestration.getThreadProjection", { threadId });
const activeOf = (pr) => (pr.runs || []).findLast((r) => RUN_ACTIVE.includes(r.status));
const steerable = (pr, run) => {
  if (!run) return "no active run";
  if (!(pr.providerTurns || []).some((t) => t.runAttemptId === run.activeAttemptId && t.status === "running")) return `run is ${run.status}, provider turn not running yet`;
  const pt = (pr.providerThreads || []).find((x) => x.id === run.providerThreadId);
  const ps = (pr.providerSessions || []).find((x) => x.id === pt?.providerSessionId);
  if (ps && ps.capabilities?.turns?.supportsActiveSteering === false) return "provider does not support active steering";
  return null;
};
let pr = await proj(); let act = activeOf(pr);
let dispatchMode = { type: "queue_after_active" }, extra = {};
if (steer && act) {
  let why = steerable(pr, act);
  for (let i = 0; why && act && i < 10; i++) { await new Promise((r) => setTimeout(r, 3000)); pr = await proj(); act = activeOf(pr); why = act ? steerable(pr, act) : null; }
  if (act && why) { console.error(`steer refused (${why}); nothing sent. Retry shortly, or use --queue if waiting is fine.`); c.close(); process.exit(3); }
  if (act) { dispatchMode = { type: "steer_active", targetRunId: act.id }; extra = { deliveryIntent: "steer" }; }
}
const messageId = randomUUID();
let res;
try {
  res = await c.call("orchestration.dispatchCommand", {
    type: "message.dispatch", commandId: randomUUID(), threadId, messageId, text, attachments: [],
    createdBy: "user", creationSource: "server", dispatchMode, ...extra,
  });
} catch (e) { console.error(`dispatch outcome uncertain (${dispatchMode.type}); do not retry before checking messageId ${messageId} in thread ${threadId}.`); c.close(); process.exit(5); }
let delivered = "unknown", msgRun;
for (let i = 0; i < 10 && delivered === "unknown"; i++) {
  await new Promise((r) => setTimeout(r, 1000));
  const p2 = await proj(); const m = (p2.messages || []).find((x) => x.id === messageId);
  msgRun = m?.runId;
  if (msgRun) delivered = act && msgRun === act.id ? "steered" : act ? "queued" : "started";
  else if (act && m && i >= 3) delivered = "queued"; // the message must exist before we claim queued
}
console.log(JSON.stringify({ env: ENV_NAME, threadId, title: th.title, messageId, requested, dispatchMode: dispatchMode.type, activeRunId: act?.id ?? null, delivered, runId: msgRun ?? null, result: res }));
if (steer && act && delivered !== "steered") console.error(`WARNING: asked to steer but the message was ${delivered}.`);
if (wait) {
  for (let i = 0; i < 720; i++) {
    await new Promise((r) => setTimeout(r, 5000));
    const p = await proj(); const msgs = p.messages || []; const idx = msgs.findIndex((m) => m.id === messageId);
    const runs = p.runs || [];
    if (idx >= 0 && msgs[idx].runId && runs.every((r) => RUN_DONE.includes(r.status))) {
      for (const m of msgs.slice(idx + 1)) if (m.role === "assistant") console.log("--- assistant ---\n" + m.text);
      break;
    }
  }
}
c.close(); process.exit(delivered === "unknown" ? 5 : steer && act && delivered !== "steered" ? 4 : 0);
