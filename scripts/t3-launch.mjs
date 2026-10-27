// Launch ONE implementer (or other) thread with an explicit model. No silent fallbacks.
// Usage:
//   t3-task.sh [--env NAME] launch <project-path> --role <role> --title "<short task>" (--brief "<text>" | --brief-file F) [--option id=value]... [--mode plan] [--wait]
//   t3-task.sh [--env NAME] launch <project-path> <provider> <model> --title "<short task>" (--brief "<text>" | --brief-file F) [--option id=value]... [--wait]
// provider: claude | codex | cursor | pi | any T3 instanceId. Roles come from config.json modelRouting.roles.
import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { connect, http, randomUUID, ENV_NAME, ENV, CONFIG, RUN_DONE } from "./t3rpc.mjs";
import { roleSelection, checkBanned, PROVIDER_ALIASES } from "./lib/config.mjs";

const a = process.argv.slice(2);
const flag = (k) => { const i = a.indexOf(k); if (i < 0) return; const v = a[i + 1]; a.splice(i, 2); return v; };
const bool = (k) => { const i = a.indexOf(k); if (i < 0) return false; a.splice(i, 1); return true; };
const opts = []; for (let v; (v = flag("--option")) !== undefined;) opts.push(v);
const wait = bool("--wait"); const dryRun = bool("--dry-run");
const title = flag("--title"); const mode = flag("--mode") || "default";
const role = flag("--role"); const briefFile = flag("--brief-file"); let brief = flag("--brief");
const usage = 'usage: t3-task.sh [--env NAME] launch <project-path> (--role R | <provider> <model>) --title "<short task>" (--brief "<text>" | --brief-file F) [--option id=value] [--mode plan] [--wait] [--dry-run]';
const [proj, ...pos] = a;
if (briefFile) brief = readFileSync(briefFile, "utf8");
if (!brief && pos.length > (role ? 0 : 2)) brief = pos.slice(role ? 0 : 2).join(" ");
if (!proj || !brief || (!role && pos.length < 2)) { console.error(usage); process.exit(2); }
if (!title) { console.error("refused: pass --title with a short plain-English description of the task (3 to 7 words). Titles are never auto-generated."); process.exit(2); }
if (/[\u2013\u2014]/.test(title)) { console.error("refused: no en or em dashes in thread titles"); process.exit(2); }
if (!proj.startsWith("/")) { console.error("project path must be absolute (a path on the T3 host, not on the bot's box)"); process.exit(2); }

let sel;
if (role) sel = roleSelection(CONFIG, role);
else sel = { instanceId: PROVIDER_ALIASES[pos[0]] || pos[0], model: pos[1], options: [] };
for (const o of opts) {
  const m = o.match(/^([^=]+)=(.*)$/); if (!m) { console.error(`bad --option ${o}; use id=value`); process.exit(2); }
  const v = m[2] === "true" ? true : m[2] === "false" ? false : m[2];
  sel.options = sel.options.filter((x) => x.id !== m[1]).concat({ id: m[1], value: v });
}
const banned = checkBanned(CONFIG, sel);
if (banned) { console.error(`refused: ${banned}. Not falling back to another model.`); process.exit(2); }
if (ENV.role === "apple-only" && !role?.startsWith("apple") && !process.env.T3_ALLOW_ANY_ROLE) {
  console.error(`refused: environment ${ENV_NAME} is apple-only. Launch general coding on the primary host, or set T3_ALLOW_ANY_ROLE=1 for this one call.`); process.exit(2);
}
if (!sel.options.length) delete sel.options;
if (dryRun) { console.log(JSON.stringify({ env: ENV_NAME, project: proj, title, modelSelection: sel, mode, briefChars: brief.length })); process.exit(0); }

let { projects } = await http("/api/projects");
let p = projects.find((x) => x.workspaceRoot === proj && !x.deletedAt);
if (!p) {
  await http("/api/projects/mutate", { type: "project.create", commandId: randomUUID(), projectId: randomUUID(), title: basename(proj), workspaceRoot: proj });
  ({ projects } = await http("/api/projects")); p = projects.find((x) => x.workspaceRoot === proj && !x.deletedAt);
  if (!p) { console.error("project create did not show up; check the path exists on the host"); process.exit(1); }
}
const c = await connect();
const threadId = randomUUID();
await c.call("orchestration.launchThread", {
  commandId: randomUUID(), threadId, projectId: p.id, creationSource: "server",
  title, generateTitle: false,
  modelSelection: sel, runtimeMode: "full-access", interactionMode: mode,
  workspaceStrategy: { type: "root" }, initialMessage: { text: brief, attachments: [] },
});
console.log(JSON.stringify({ env: ENV_NAME, threadId, projectId: p.id, project: proj, title, modelSelection: sel }));
if (wait) {
  for (let i = 0; i < 720; i++) {
    await new Promise((r) => setTimeout(r, 5000));
    const pr = await c.call("orchestration.getThreadProjection", { threadId });
    const runs = pr.runs || [];
    if (runs.length && runs.every((r) => RUN_DONE.includes(r.status))) {
      console.log("run status:", runs.map((r) => r.status).join(","));
      for (const m of pr.messages || []) if (m.role === "assistant") console.log("--- assistant ---\n" + m.text);
      break;
    }
  }
}
c.close();
