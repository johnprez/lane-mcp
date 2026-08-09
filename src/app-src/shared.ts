/**
 * Shared helpers for the Ask Lane MCP Apps iframes: HTML escaping and host-driven
 * theming (light/dark + host style variables/fonts). Bundled into each app.
 */
import { App, applyDocumentTheme, applyHostStyleVariables, applyHostFonts } from "@modelcontextprotocol/ext-apps";

export function esc(value: string): string {
  return value.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] as string);
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
