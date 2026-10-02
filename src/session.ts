import type { LaneMcpConfig } from "./config.js";

/**
 * Turns the teammate's PAT into a live RLS-scoped session for local reads.
 *
 * The PAT is the only credential the local server holds. It exchanges it at the
 * hosted `/api/mcp/session` endpoint for a short-lived Supabase user JWT (the
 * JWT-minting secret stays on the server) plus the public Supabase config. The
 * JWT is cached until shortly before it expires, then transparently refreshed.
 */
type SessionResponse = {
  access_token: string;
  expires_in: number;
  user: { id: string; email: string };
  supabase: { url: string; anon_key: string };
};

const REFRESH_SKEW_MS = 30_000;

export class LaneSession {
  private token: string;
  private apiUrl: string;
  private cached: { accessToken: string; expiresAt: number } | null = null;
  supabaseUrl = "";
  supabaseAnonKey = "";

  constructor(config: LaneMcpConfig) {
    this.token = config.token;
    this.apiUrl = config.apiUrl;
  }

  /** A valid Supabase access token, refreshed from the PAT as needed. */
  async accessToken(): Promise<string> {
    if (this.cached && Date.now() < this.cached.expiresAt - REFRESH_SKEW_MS) {
      return this.cached.accessToken;
    }
    const response = await fetch(`${this.apiUrl}/api/mcp/session`, {
      method: "POST",
      headers: { authorization: `Bearer ${this.token}`, "content-type": "application/json" },
    });
    if (response.status === 401) {
      throw new Error("Lane rejected this token. Regenerate a PAT in Settings → Connect Claude and update your config.");
    }
    if (!response.ok) {
      throw new Error(`Lane session exchange failed (HTTP ${response.status}). Is ${this.apiUrl} reachable?`);
    }
    const data = (await response.json()) as SessionResponse;
    // Read helpers (getLaneContext / listLaneWorkspaces) read the Supabase config
    // from process.env; populate it here from the authoritative hosted response.
    this.supabaseUrl = data.supabase.url;
    this.supabaseAnonKey = data.supabase.anon_key;
    process.env.NEXT_PUBLIC_SUPABASE_URL = data.supabase.url;
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = data.supabase.anon_key;

    this.cached = { accessToken: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
    return data.access_token;
  }

  /** POST one lane action to the hosted write endpoint (HMAC signing stays server-side). */
  async apply(action: unknown): Promise<{ applied: boolean; action: string; message: string }> {
    const response = await fetch(`${this.apiUrl}/api/mcp/apply`, {
      method: "POST",
      headers: { authorization: `Bearer ${this.token}`, "content-type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const text = await response.text();
    let payload: { applied?: boolean; action?: string; message?: string; error?: string };
    try {
      payload = JSON.parse(text) as typeof payload;
    } catch {
      throw new Error(`Lane returned a non-JSON write response (HTTP ${response.status}): ${text.slice(0, 200)}`);
    }
    if (!response.ok || !payload.applied) {
      throw new Error(payload.error ?? `Lane could not apply the action (HTTP ${response.status}).`);
    }
    return { applied: true, action: payload.action ?? "", message: payload.message ?? "Applied." };
  }

  /** POST one project action (create / update / delete) via the hosted project gateway. */
  async applyProject(action: unknown): Promise<{ applied: boolean; action: string; projectId?: string; message: string }> {
    const response = await fetch(`${this.apiUrl}/api/mcp/apply-project`, {
      method: "POST",
      headers: { authorization: `Bearer ${this.token}`, "content-type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const text = await response.text();
    let payload: { applied?: boolean; action?: string; projectId?: string; message?: string; error?: string };
    try {
      payload = JSON.parse(text) as typeof payload;
    } catch {
      throw new Error(`Lane returned a non-JSON project response (HTTP ${response.status}): ${text.slice(0, 200)}`);
    }
    if (!response.ok || !payload.applied) {
      throw new Error(payload.error ?? `Lane could not apply the project action (HTTP ${response.status}).`);
    }
    return { applied: true, action: payload.action ?? "", projectId: payload.projectId, message: payload.message ?? "Applied." };
  }

  /** Read the current public share status for a project. */
  async getShareLink(projectId: string): Promise<Record<string, unknown>> {
    const response = await fetch(`${this.apiUrl}/api/mcp/share-link`, {
      method: "POST",
      headers: { authorization: `Bearer ${this.token}`, "content-type": "application/json" },
      body: JSON.stringify({ projectId }),
    });
    const text = await response.text();
    try {
      return JSON.parse(text) as Record<string, unknown>;
    } catch {
      throw new Error(`Lane returned a non-JSON share-link response (HTTP ${response.status}): ${text.slice(0, 200)}`);
    }
  }

  /** Build a read-only generative view (availability/PTO, overview, milestones,
   *  deliverables, activities, signals, portfolio) via the shared hosted builder. */
  async renderView(body: Record<string, unknown>): Promise<Record<string, unknown>> {
    const response = await fetch(`${this.apiUrl}/api/mcp/view`, {
      method: "POST",
      headers: { authorization: `Bearer ${this.token}`, "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const text = await response.text();
    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(text) as Record<string, unknown>;
    } catch {
      throw new Error(`Lane returned a non-JSON view response (HTTP ${response.status}): ${text.slice(0, 200)}`);
    }
    if (!response.ok) throw new Error((payload.error as string | undefined) ?? `Lane could not render that view (HTTP ${response.status}).`);
    return (payload.view as Record<string, unknown>) ?? payload;
  }

  /**
   * Journey + knowledge calls. Every one is proxied to the hosted endpoint —
   * reads (/journey, /kg) and writes (/apply-journey, /ingest) — so scope
   * checks, preview semantics and indexing kick-off all stay server-side. The
   * endpoint answers { result, text }; errors come back as { error } and are
   * returned (not thrown) so the tool can show Lane's own wording.
   */
  async journeyCall(
    endpoint: "journey" | "kg" | "apply-journey" | "ingest",
    body: Record<string, unknown>,
  ): Promise<{ ok: true; result: Record<string, unknown>; text: string } | { ok: false; status: number; error: string }> {
    const response = await fetch(`${this.apiUrl}/api/mcp/${endpoint}`, {
      method: "POST",
      headers: { authorization: `Bearer ${this.token}`, "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const text = await response.text();
    let payload: { result?: Record<string, unknown>; text?: string; error?: string };
    try {
      payload = JSON.parse(text) as typeof payload;
    } catch {
      return { ok: false, status: response.status, error: `Lane returned a non-JSON response (HTTP ${response.status}). Is ${this.apiUrl} running a version with journeys?` };
    }
    if (response.status === 401) return { ok: false, status: 401, error: "Lane rejected this token. Regenerate a PAT in Settings → Connect Claude and update your config." };
    if (!response.ok || !payload.result) return { ok: false, status: response.status, error: payload.error ?? `Lane could not complete that request (HTTP ${response.status}).` };
    return { ok: true, result: payload.result, text: payload.text ?? "" };
  }

  /** Validate export access and return a browser-openable download URL. */
  async planExport(body: { projectId: string; format: string; title?: string }): Promise<Record<string, unknown>> {
    const response = await fetch(`${this.apiUrl}/api/mcp/plan-export`, {
      method: "POST",
      headers: { authorization: `Bearer ${this.token}`, "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const text = await response.text();
    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(text) as Record<string, unknown>;
    } catch {
      throw new Error(`Lane returned a non-JSON export response (HTTP ${response.status}): ${text.slice(0, 200)}`);
    }
    if (!response.ok) throw new Error((payload.error as string | undefined) ?? `Lane could not prepare the export (HTTP ${response.status}).`);
    return payload;
  }
}
