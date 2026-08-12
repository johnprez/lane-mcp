// Bundles each MCP Apps iframe app (src/app-src/<name>.ts + the ext-apps client)
// into a single self-contained HTML string, emitted as a generated .ts module so
// the stdio server can serve it inline from a `ui://` resource with no runtime
// file reads. Runs before tsup/tsc (see package.json).
import { build } from "esbuild";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** @type {{ name: string, entry: string, exportName: string }[]} */
const apps = [
  { name: "workspaces", entry: "src/app-src/workspaces.ts", exportName: "WORKSPACES_APP_HTML" },
  { name: "approval", entry: "src/app-src/approval.ts", exportName: "APPROVAL_APP_HTML" },
  { name: "dashboard", entry: "src/app-src/dashboard.ts", exportName: "DASHBOARD_APP_HTML" },
  { name: "form", entry: "src/app-src/form.ts", exportName: "FORM_APP_HTML" },
  { name: "activity", entry: "src/app-src/activity.ts", exportName: "ACTIVITY_APP_HTML" },
  { name: "entity", entry: "src/app-src/entity.ts", exportName: "ENTITY_APP_HTML" },
  { name: "deps", entry: "src/app-src/deps.ts", exportName: "DEPS_APP_HTML" },
  { name: "tasks", entry: "src/app-src/tasks.ts", exportName: "TASKS_APP_HTML" },
];

// Shared shell + Lane-themed, light/dark-aware styles. Each app owns its markup
// by rendering into #root, so this stays generic across cards. Dark values apply
// when the host reports a dark theme (data-theme=dark, set by shared.ts) or, absent
// an explicit host theme, when the OS prefers dark.
const SHARED_CSS = `
:root {
  color-scheme: light dark;
  --card-bg:#fff; --ink:#201f2b; --muted:#6b6678; --line:#e6e2f0; --subtle:#f6f4fb;
  --purple:#5b43c9; --purple-bg:#efeaff; --jade:#2f9e6a; --amber:#c77d16; --red:#d1453f;
  --shadow:0 10px 30px rgb(39 28 60 / .08);
}
[data-theme="dark"] {
  --card-bg:#1b1a22; --ink:#eceaf2; --muted:#a49fb0; --line:#332f3d; --subtle:#26232f;
  --purple:#b7a6ff; --purple-bg:#2c2540; --jade:#4bd08a; --amber:#e0a94a; --red:#ff7a72;
  --shadow:0 12px 34px rgb(0 0 0 / .4);
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --card-bg:#1b1a22; --ink:#eceaf2; --muted:#a49fb0; --line:#332f3d; --subtle:#26232f;
    --purple:#b7a6ff; --purple-bg:#2c2540; --jade:#4bd08a; --amber:#e0a94a; --red:#ff7a72;
    --shadow:0 12px 34px rgb(0 0 0 / .4);
  }
}
* { box-sizing:border-box; }
body { margin:0; font-family:-apple-system,"Segoe UI",system-ui,sans-serif; background:transparent; color:var(--ink); }
.card { max-width:520px; margin:14px auto; padding:18px 20px; border:1px solid var(--line); border-radius:16px; background:var(--card-bg); box-shadow:var(--shadow); }
.card.wide { max-width:640px; }
body.fullscreen .card.wide { max-width:960px; }
.head { display:flex; align-items:center; justify-content:space-between; }
.badge { display:inline-flex; align-items:center; gap:6px; padding:4px 10px 4px 8px; border-radius:999px; background:var(--purple-bg); color:var(--purple); font-size:11px; font-weight:700; letter-spacing:.08em; text-transform:uppercase; }
.badge svg.mark { display:block; flex:none; }
h1 { margin:12px 0 4px; font-size:18px; letter-spacing:-.01em; }
h2 { margin:18px 0 8px; font-size:12px; font-weight:700; letter-spacing:.05em; text-transform:uppercase; color:var(--muted); }
p { margin:0; color:var(--muted); font-size:13px; line-height:1.5; }
.ok { color:var(--jade); } .err { color:var(--red); }
.ok-note { color:var(--jade); }
code.chip { display:inline-block; padding:2px 7px; border-radius:6px; background:var(--subtle); color:var(--purple); font-size:12px; font-weight:650; font-family:ui-monospace,SFMono-Regular,Menlo,monospace; }
.note { margin-top:10px; font-size:12px; }

/* Fields (approval) */
.fields { margin:12px 0 2px; border:1px solid var(--line); border-radius:10px; overflow:hidden; }
.row { display:flex; gap:10px; padding:7px 12px; font-size:12.5px; }
.row + .row { border-top:1px solid var(--line); }
.row .k { flex:0 0 36%; color:var(--muted); font-weight:600; }
.row .v { flex:1; color:var(--ink); word-break:break-word; }

/* Buttons */
.actions { display:flex; gap:8px; margin-top:14px; }
.btn { appearance:none; border:1px solid var(--line); border-radius:10px; padding:9px 14px; font-size:13px; font-weight:650; cursor:pointer; background:var(--card-bg); color:var(--ink); }
.btn:disabled { opacity:.5; cursor:default; }
.btn-primary { border-color:transparent; color:#fff; background:linear-gradient(135deg,#7357e8,#4c43e8); }
.btn-ghost { color:var(--muted); }
.fs-btn { appearance:none; border:1px solid var(--line); border-radius:8px; padding:5px 10px; font-size:11px; font-weight:650; color:var(--muted); background:transparent; cursor:pointer; }

/* Tiles (dashboard) */
.tiles { display:grid; grid-template-columns:repeat(auto-fit,minmax(96px,1fr)); gap:8px; margin-top:12px; }
.tile { appearance:none; text-align:left; cursor:pointer; font:inherit; color:inherit; border:1px solid var(--line); border-radius:12px; padding:10px 12px; background:var(--subtle); display:flex; flex-direction:column; gap:2px; transition:border-color 120ms ease; }
.tile:hover { border-color:color-mix(in srgb, var(--purple) 40%, var(--line)); }
.tile-on { border-color:var(--purple); box-shadow:0 0 0 2px color-mix(in srgb, var(--purple) 20%, transparent); }
.row-btn { appearance:none; width:100%; border:0; background:transparent; font:inherit; text-align:left; cursor:pointer; color:inherit; }
.row-btn:hover { background:var(--subtle); }
.drill { margin-top:12px; border:1px solid var(--line); border-radius:12px; padding:10px 12px; background:var(--subtle); }
.drill-head { display:flex; align-items:center; justify-content:space-between; }
.drill-head h2 { margin:0; }
.drill .list { margin-top:8px; background:var(--card-bg); }
.tile .n { font-size:22px; font-weight:760; letter-spacing:-.02em; }
.tile .l { font-size:10.5px; color:var(--muted); text-transform:uppercase; letter-spacing:.06em; font-weight:650; }
.tile.warn-red { border-color:color-mix(in srgb, var(--red) 45%, var(--line)); }
.tile.warn-red .n { color:var(--red); }
.tile.warn-amber { border-color:color-mix(in srgb, var(--amber) 45%, var(--line)); }
.tile.warn-amber .n { color:var(--amber); }

/* Attention list */
.attn { margin:4px 0 0; padding:0; list-style:none; }
.attn li { display:flex; align-items:center; gap:8px; padding:5px 0; font-size:13px; color:var(--ink); }
.dot { flex:none; width:8px; height:8px; border-radius:50%; }
.dot-red { background:var(--red); } .dot-amber { background:var(--amber); }

/* Lists (milestones / workspaces) */
.list { border:1px solid var(--line); border-radius:12px; overflow:hidden; }
.item { display:flex; align-items:center; justify-content:space-between; gap:12px; padding:9px 12px; font-size:13px; }
.item + .item { border-top:1px solid var(--line); }
.item-title { font-weight:600; color:var(--ink); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.item-meta { flex:none; color:var(--muted); font-size:12px; }
.listrow { display:flex; align-items:center; justify-content:space-between; gap:12px; width:100%; padding:11px 12px; border:0; background:transparent; color:var(--ink); text-align:left; font:inherit; cursor:pointer; }
.list-tap .listrow + .listrow { border-top:1px solid var(--line); }
.listrow:hover { background:var(--subtle); }
.listrow-main { display:flex; flex-direction:column; gap:2px; min-width:0; }
.listrow-title { font-weight:650; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.listrow-sub { font-size:11.5px; color:var(--muted); text-transform:capitalize; }
.pill { flex:none; padding:3px 9px; border-radius:999px; font-size:10.5px; font-weight:700; letter-spacing:.04em; text-transform:uppercase; }
.pill-active { color:var(--jade); background:color-mix(in srgb, var(--jade) 16%, transparent); }

/* Form (create card) */
.field { margin-top:10px; }
.flabel { display:block; margin-bottom:4px; font-size:11.5px; font-weight:650; color:var(--muted); }
.req { color:var(--red); }
input[type=text], input[type=date], input[type=datetime-local], textarea, select { width:100%; padding:8px 10px; border:1px solid var(--line); border-radius:9px; background:var(--card-bg); color:var(--ink); font:inherit; font-size:13px; }
input:focus, textarea:focus, select:focus { outline:0; border-color:var(--purple); box-shadow:0 0 0 3px color-mix(in srgb, var(--purple) 22%, transparent); }
textarea { resize:vertical; }
.chk { display:flex; align-items:center; gap:7px; font-size:13px; color:var(--ink); font-weight:500; }
.chk input { width:auto; }
.people { display:flex; flex-direction:column; gap:6px; max-height:150px; overflow:auto; padding:8px 10px; border:1px solid var(--line); border-radius:9px; }
.muted-s { font-size:12px; color:var(--muted); margin:6px 0 0; }
.grid2 { display:grid; grid-template-columns:1fr 1fr; gap:0 12px; }
@media (max-width:440px){ .grid2 { grid-template-columns:1fr; } }

/* Activity editor: tabs, swatches, inline lists */
.tabs { display:flex; gap:2px; margin-top:14px; border-bottom:1px solid var(--line); }
.tab { appearance:none; border:0; background:transparent; padding:8px 12px; margin-bottom:-1px; font:inherit; font-size:12.5px; font-weight:650; color:var(--muted); border-bottom:2px solid transparent; cursor:pointer; }
.tab-on { color:var(--purple); border-bottom-color:var(--purple); }
.tabnum { display:inline-flex; min-width:16px; justify-content:center; padding:0 5px; border-radius:999px; background:var(--subtle); color:var(--muted); font-size:10.5px; }
.tabbody { margin-top:12px; }
.flash { margin:10px 0 0; font-size:12.5px; font-weight:600; }
.flash.ok { color:var(--jade); } .flash.err { color:var(--red); }
.swatches { display:flex; flex-wrap:wrap; gap:8px; }
.swatch { position:relative; cursor:pointer; }
.swatch input { position:absolute; opacity:0; inset:0; }
.swatch > span { display:grid; place-items:center; width:30px; height:30px; border-radius:50%; border:2px solid transparent; box-shadow:inset 0 0 0 1px var(--line); font-size:9px; font-weight:700; color:var(--muted); }
.swatch input:checked + span { border-color:var(--ink); }
.swatch-none > span { background:var(--subtle); }
.done { text-decoration:line-through; color:var(--muted); }
.note-body { font-size:12.5px; color:var(--ink); white-space:pre-wrap; word-break:break-word; }
.link-btn { appearance:none; border:0; background:transparent; color:var(--muted); font:inherit; font-size:11.5px; font-weight:600; cursor:pointer; padding:2px 4px; }
.link-btn:hover { color:var(--red); }
.link-a { flex:1; min-width:0; color:var(--purple); font-size:12.5px; font-weight:600; text-decoration:none; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.link-a:hover { text-decoration:underline; }
.addrow { display:flex; gap:8px; align-items:flex-start; margin-top:10px; }
.addrow input, .addrow textarea { flex:1; }

/* Tasks board */
.tabs-filter { margin-top:12px; }
.lane-group { margin-top:14px; }
.lane-h { display:flex; align-items:baseline; justify-content:space-between; margin-bottom:6px; }
.lane-name { font-size:11px; font-weight:750; letter-spacing:.06em; text-transform:uppercase; color:var(--muted); }
.lane-count { font-size:11px; font-weight:650; color:var(--muted); font-variant-numeric:tabular-nums; }
.act { border:1px solid var(--line); border-radius:12px; padding:10px 12px; margin-bottom:8px; }
.act-top { display:flex; align-items:center; gap:8px; }
.act-title { flex:1; min-width:0; font-weight:600; font-size:13.5px; color:var(--ink); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; padding:0; }
.act-title:hover { color:var(--purple); background:transparent; text-decoration:underline; }
.act-done .act-title { color:var(--muted); text-decoration:line-through; }
.act-prog { display:flex; align-items:center; gap:8px; margin-top:8px; }
.act-pct { font-size:11px; font-weight:650; color:var(--muted); font-variant-numeric:tabular-nums; flex:none; }
.act-due { font-size:11px; color:var(--muted); flex:none; }
.tprog { flex:1; min-width:70px; height:5px; border-radius:999px; background:var(--subtle); overflow:hidden; }
.tprog > i { display:block; height:100%; border-radius:999px; background:var(--purple); }
.st { flex:none; padding:2px 8px; border-radius:999px; font-size:10px; font-weight:700; letter-spacing:.03em; text-transform:uppercase; color:var(--muted); background:var(--subtle); }
.st-in_progress { color:var(--purple); background:var(--purple-bg); }
.st-blocked { color:var(--red); background:color-mix(in srgb, var(--red) 15%, transparent); }
.st-done { color:var(--jade); background:color-mix(in srgb, var(--jade) 15%, transparent); }
.prio-hi { flex:none; padding:2px 8px; border-radius:999px; font-size:10px; font-weight:700; letter-spacing:.03em; text-transform:uppercase; color:var(--amber); background:color-mix(in srgb, var(--amber) 16%, transparent); }
.avs { display:inline-flex; align-items:center; flex:none; }
.av { display:inline-flex; align-items:center; justify-content:center; width:22px; height:22px; margin-left:-6px; border:1.5px solid var(--card-bg); border-radius:50%; background:var(--purple-bg); color:var(--purple); font-size:9px; font-weight:700; }
.av:first-child { margin-left:0; }
.av-more { background:var(--subtle); color:var(--muted); }
.tk-toggle { appearance:none; flex:none; border:1px solid var(--line); border-radius:999px; background:var(--card-bg); color:var(--muted); font:inherit; font-size:10px; font-weight:700; padding:1px 8px; cursor:pointer; font-variant-numeric:tabular-nums; }
.tk-toggle:hover { border-color:var(--purple); color:var(--purple); }
.tk-list { margin-top:8px; padding-top:8px; border-top:1px solid var(--line); display:flex; flex-direction:column; gap:5px; }
.tk { display:flex; align-items:center; gap:8px; font-size:12.5px; }
.tk-box { display:grid; place-items:center; flex:none; width:15px; height:15px; border:1.5px solid var(--line); border-radius:4px; color:transparent; font-size:9px; font-weight:800; }
.tk-box.on { border-color:var(--purple); background:var(--purple); color:#fff; }
.tk-name { min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:var(--ink); }
.tk-name.done { color:var(--muted); text-decoration:line-through; }
.tk-add, .lane-add { display:inline-block; margin-top:8px; padding:4px 6px; border-radius:7px; color:var(--purple); font-size:12px; font-weight:620; width:auto; }
.tk-add:hover, .lane-add:hover { background:var(--purple-bg); }
.lane-add { margin-top:2px; }
.empty { margin-top:14px; }
`;

function pageHtml(scriptJs) {
  // Guard against the bundle containing a literal </script> that closes the tag early.
  const safeJs = scriptJs.replace(/<\/script>/gi, "<\\/script>");
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="color-scheme" content="light dark" />
<style>${SHARED_CSS}</style>
</head>
<body><div id="root"></div><script>${safeJs}</script></body>
</html>`;
}

for (const app of apps) {
  const result = await build({
    entryPoints: [path.join(root, app.entry)],
    bundle: true,
    format: "iife",
    platform: "browser",
    target: "es2020",
    minify: true,
    write: false,
  });
  const js = result.outputFiles[0].text;
  const html = pageHtml(js);
  const outPath = path.join(root, "src/generated", `${app.name}-app.ts`);
  await mkdir(path.dirname(outPath), { recursive: true });
  await writeFile(
    outPath,
    `// AUTO-GENERATED by scripts/build-apps.mjs — do not edit by hand.\nexport const ${app.exportName} = ${JSON.stringify(html)};\n`,
  );
  console.error(`[build-apps] ${app.name}: ${(html.length / 1024).toFixed(1)} KB -> ${path.relative(root, outPath)}`);
}
