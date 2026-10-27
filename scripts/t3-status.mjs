// Read-only: is a thread settled? Prints one JSON line per thread.
// Usage: t3-task.sh [--env NAME] status <threadId> [<threadId>...]
// settled = no run is preparing/starting/running/waiting and nothing is queued.
import { connect, ENV_NAME, RUN_ACTIVE } from "./t3rpc.mjs";
const ids = process.argv.slice(2);
if (!ids.length) { console.error("usage: t3-task.sh [--env NAME] status <threadId> [<threadId>...]"); process.exit(2); }
const c = await connect(); let bad = 0;
for (const threadId of ids) {
  try {
    const p = await c.call("orchestration.getThreadProjection", { threadId });
    const runs = p.runs || [];
    const active = runs.filter((r) => RUN_ACTIVE.includes(r.status));
    const queued = (p.queuedMessages || p.queue || []).length;
    const last = runs[runs.length - 1];
    const lastReply = [...(p.messages || [])].reverse().find((m) => m.role === "assistant")?.text || "";
    console.log(JSON.stringify({
      env: ENV_NAME, threadId, title: p.thread?.title ?? p.title ?? null,
      model: p.thread?.modelSelection ? `${p.thread.modelSelection.instanceId}/${p.thread.modelSelection.model}` : null,
      runs: runs.length, lastRunStatus: last?.status ?? null, activeRuns: active.length, queued,
      settled: active.length === 0 && queued === 0, archived: !!(p.thread?.archivedAt ?? p.archivedAt),
      lastReply: lastReply.slice(0, 400),
    }));
  } catch (e) { bad++; console.log(JSON.stringify({ env: ENV_NAME, threadId, error: String(e.message).slice(0, 200) })); }
}
c.close(); process.exit(bad ? 1 : 0);
