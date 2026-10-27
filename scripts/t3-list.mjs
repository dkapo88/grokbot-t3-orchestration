// Read-only: list projects and recent threads (with ids).
// Usage: t3-task.sh [--env NAME] list [--limit N] [--title SUBSTR] [--archived] [--json]
import { connect, http, ENV_NAME } from "./t3rpc.mjs";
const a = process.argv.slice(2); const opt = (k) => { const i = a.indexOf(k); return i >= 0 ? a[i + 1] : undefined; };
const limit = +(opt("--limit") ?? 15); const tf = opt("--title")?.toLowerCase();
const { projects } = await http("/api/projects");
const live = projects.filter((p) => !p.deletedAt);
console.log(`env ${ENV_NAME}: ${live.length} project(s)`);
const byId = Object.fromEntries(live.map((p) => [p.id, p]));
for (const p of live) console.log(`  [project] ${p.title}  ${p.workspaceRoot}`);
const c = await connect();
let snap; try { snap = (await c.first("orchestration.subscribeShell", {})).snapshot; } catch (e) { snap = { error: String(e.message).slice(0, 300) }; }
if (a.includes("--json")) console.log(JSON.stringify(snap, null, 1).slice(0, 20000));
const all = (snap.threads || []).filter((t) => !t.deletedAt && (a.includes("--archived") || !t.archivedAt) && (!tf || String(t.title).toLowerCase().includes(tf)));
const threads = all.sort((x, y) => String(y.updatedAt || y.createdAt).localeCompare(String(x.updatedAt || x.createdAt))).slice(0, limit);
if (snap.error) console.log("snapshot error:", snap.error);
console.log(`threads (${threads.length} of ${all.length} matching):`);
for (const t of threads) {
  const st = t.activityRunStatus || t.status || "?";
  console.log(`  ${t.id}  ${t.updatedAt || t.createdAt}  ${t.title}  | ${t.modelSelection?.instanceId}/${t.modelSelection?.model}  | ${st}  | ${byId[t.projectId]?.title ?? t.projectId}${t.archivedAt ? "  | archived" : ""}`);
}
c.close(); process.exit(snap.error ? 1 : 0);
