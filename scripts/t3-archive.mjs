// Archive settled threads (default), or delete archived ones with explicit confirmation.
// Usage: t3-task.sh [--env NAME] archive <threadId>... [--dry-run]
//        t3-task.sh [--env NAME] delete  <threadId>... --yes      (only threads that are already archived and settled)
// Never archives a thread that is mid-run or has queued messages.
import { connect, randomUUID, ENV_NAME, RUN_ACTIVE } from "./t3rpc.mjs";
const a = process.argv.slice(2);
const action = a.shift();
const dry = a.includes("--dry-run"), yes = a.includes("--yes");
const ids = a.filter((x) => !x.startsWith("--"));
if (!["archive", "delete"].includes(action) || !ids.length) { console.error("usage: t3-task.sh [--env NAME] (archive|delete) <threadId>... [--dry-run] [--yes]"); process.exit(2); }
if (action === "delete" && !yes) { console.error("refused: delete is permanent. Get the owner's OK, then pass --yes."); process.exit(2); }
const c = await connect(); let skipped = 0;
for (const threadId of ids) {
  let p; try { p = await c.call("orchestration.getThreadProjection", { threadId }); } catch (e) { console.log(`${threadId}  error: ${e.message}`); skipped++; continue; }
  const active = (p.runs || []).filter((r) => RUN_ACTIVE.includes(r.status)).length;
  const queued = (p.queuedMessages || p.queue || []).length;
  const archived = !!(p.thread?.archivedAt ?? p.archivedAt);
  const title = p.thread?.title ?? p.title ?? "";
  if (active || queued) { console.log(`${threadId}  skip (not settled: ${active} active run(s), ${queued} queued)  ${title}`); skipped++; continue; }
  if (action === "delete" && !archived) { console.log(`${threadId}  skip (archive it first)  ${title}`); skipped++; continue; }
  if (action === "archive" && archived) { console.log(`${threadId}  already archived  ${title}`); continue; }
  if (dry) { console.log(`${threadId}  would ${action}  ${title}`); continue; }
  await c.call("orchestration.dispatchCommand", { type: action === "archive" ? "thread.archive" : "thread.delete", commandId: randomUUID(), threadId });
  console.log(`${threadId}  ${action}d  ${title}`);
}
c.close(); process.exit(skipped ? 1 : 0);
