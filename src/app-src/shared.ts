/**
 * Shared helpers for the Ask Lane MCP Apps iframes: HTML escaping and host-driven
 * theming (light/dark + host style variables/fonts). Bundled into each app.
 */
import { App, applyDocumentTheme, applyHostStyleVariables, applyHostFonts } from "@modelcontextprotocol/ext-apps";

export function esc(value: string): string {
  return value.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] as string);
}

// Lane's Convergence Signal mark (inherits currentColor), inlined so it renders
// in the sandbox with no external asset. Sits to the left of the "Lane" wordmark.
const LANE_MARK =
  '<svg class="mark" viewBox="0 0 64 64" width="13" height="13" fill="none" aria-hidden="true">' +
  '<g stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-linejoin="round">' +
  '<path d="M8 12C24 12 22 32 30 32"/><path d="M8 32H30"/><path d="M8 52C24 52 22 32 30 32"/>' +
  '<path d="M44 32H56"/><circle cx="37" cy="32" r="5.75"/></g></svg>';

/** The Lane badge: logo mark + wordmark (with an optional "· Qualifier"). */
export function badge(text = "Lane"): string {
  return `<span class="badge">${LANE_MARK}<span>${esc(text)}</span></span>`;
}

type HostCtx = { theme?: unknown; styles?: { variables?: unknown; css?: { fonts?: unknown } } } | undefined;

function applyCtx(ctx: HostCtx): void {
  if (!ctx) return;
  try {
    const theme = ctx.theme;
    if (theme === "light" || theme === "dark") {
      document.documentElement.setAttribute("data-theme", theme);
      applyDocumentTheme(theme);
    }
    if (ctx.styles?.variables) applyHostStyleVariables(ctx.styles.variables as never);
    if (ctx.styles?.css?.fonts) applyHostFonts(ctx.styles.css.fonts as never);
  } catch (error) {
    console.error("[lane] theme apply failed", error);
  }
}

/** Apply the host theme now and on every host-context change. */
export function wireTheme(app: App): void {
  app.onhostcontextchanged = (ctx) => applyCtx(ctx as HostCtx);
}

export function applyInitialTheme(app: App): void {
  applyCtx(app.getHostContext() as HostCtx);
}
