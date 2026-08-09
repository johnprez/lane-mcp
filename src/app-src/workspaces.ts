/**
 * Ask Lane workspace list card. Rendered for lane_list_workspaces: a clean list
 * of the workspaces you belong to with your role and which is active. Clicking a
 * row asks Lane about that workspace (sendMessage) — the connector has no
 * switch-active-workspace tool, so this is a read + a nudge, not a mutation.
 */
import { App } from "@modelcontextprotocol/ext-apps";
import { badge, esc, wireTheme, applyInitialTheme } from "./shared.js";

const root = document.getElementById("root")!;

type Workspace = { id?: string; name?: string; role?: string; active?: boolean };

function card(title: string, body: string): string {
  return `<div class="card">${badge("Lane")}<h1>${esc(title)}</h1>${body}</div>`;
}

function render(workspaces: Workspace[]): void {
  if (!workspaces.length) {
    root.innerHTML = card("Workspaces", "<p>No Lane workspaces found for your account.</p>");
    return;
  }
  const rows = workspaces
    .map((w) => {
      const active = w.active ? '<span class="pill pill-active">Active</span>' : "";
      return (
        `<button class="listrow" type="button">` +
        `<span class="listrow-main"><span class="listrow-title">${esc(w.name ?? "Untitled")}</span>` +
        `<span class="listrow-sub">${esc(w.role ?? "")}</span></span>${active}</button>`
      );
    })
    .join("");
  root.innerHTML = card("Your Lane workspaces", `<div class="list list-tap">${rows}</div>`);
  root.querySelectorAll<HTMLButtonElement>(".listrow").forEach((btn) => {
    btn.addEventListener("click", () => {
      const name = btn.querySelector(".listrow-title")?.textContent ?? "";
      void app
        .sendMessage({ role: "user", content: [{ type: "text", text: `What's happening in the ${name} workspace?` }] })
        .catch(() => {});
    });
  });
}

const app = new App({ name: "Lane Workspaces", version: "0.1.0" });
wireTheme(app);
root.innerHTML = card("Your Lane workspaces", '<p>Loading…</p>');

app
  .connect()
  .then(async () => {
    applyInitialTheme(app);
    try {
      const result = await app.callServerTool({ name: "lane_list_workspaces", arguments: {} });
      const workspaces = (result as { structuredContent?: { workspaces?: Workspace[] } }).structuredContent?.workspaces ?? [];
      render(workspaces);
    } catch {
      root.innerHTML = card("Workspaces", "<p>Couldn't read your workspaces.</p>");
    }
  })
  .catch((error: unknown) => console.error("[lane-workspaces]", error));
