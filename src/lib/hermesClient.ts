/**
 * hermesClient — HTTP + SSE client for the Hermes gateway.
 *
 * All public functions are tree-shakeable pure functions with zero
 * module-level side-effects.  Each function accepts an optional
 * `fetchImpl` parameter so they can be tested with a mock `fetch`.
 *
 * Environment variables (Next.js public prefix):
 *   NEXT_PUBLIC_HERMES_BASE_URL  — gateway base URL (default: http://localhost:8000)
 *   NEXT_PUBLIC_HERMES_API_KEY   — bearer token sent in Authorization header
 *
 * @module hermesClient
 */

import type {
  AddMcpServerPayload,
  ChatDelta,
  HermesApiError,
  MemoryEntry,
  McpServer,
  Profile,
  ProfileSettings,
  Session,
  Skill,
  ToolCall,
  ToolCallDelta,
} from "@/types/hermes";

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Resolved base URL for all gateway requests. */
function resolveBaseUrl(): string {
  return (
    process.env["NEXT_PUBLIC_HERMES_BASE_URL"] ?? "http://localhost:8000"
  );
}

/** Build the Authorization header value when an API key is configured. */
function resolveAuthHeader(): Record<string, string> {
  const key = process.env["NEXT_PUBLIC_HERMES_API_KEY"];
  return key ? { Authorization: `Bearer ${key}` } : {};
}

/**
 * Throw a typed {@link HermesApiError} if `response.ok` is false.
 *
 * We attach the typed payload to a real `Error` instance so that callers
 * receive a proper stack trace rather than a plain thrown object.
 *
 * @param response - The `Response` object to inspect.
 */
async function assertOk(response: Response): Promise<void> {
  if (!response.ok) {
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      body = await response.text().catch(() => undefined);
    }

    const message =
      typeof body === "object" &&
      body !== null &&
      "message" in body &&
      typeof (body as Record<string, unknown>)["message"] === "string"
        ? (body as Record<string, string>)["message"]
        : response.statusText || `HTTP ${response.status}`;

    const error: HermesApiError = Object.assign(new Error(message), {
      status: response.status,
      message,
      body,
    });
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Chat / Completions — SSE streaming
// ---------------------------------------------------------------------------

/**
 * Type guard / shape validator for a single SSE choice object.
 * Returns true when `value` has the expected `delta` and optional
 * `finish_reason` fields.
 */
function isSseChoice(
  value: unknown
): value is { delta: Record<string, unknown>; finish_reason: string | null } {
  const delta = (value as Record<string, unknown>)["delta"];
  return (
    value !== null &&
    typeof value === "object" &&
    "delta" in (value as object) &&
    delta !== null &&
    typeof delta === "object"
  );
}

/**
 * Parse a single raw SSE tool-call entry into a {@link ToolCallDelta}, or
 * return `null` when the entry carries no useful information or is malformed.
 */
function parseToolCallDelta(rawEntry: unknown): ToolCallDelta | null {
  if (rawEntry === null || typeof rawEntry !== "object") return null;
  const tc = rawEntry as Record<string, unknown>;
  // Skip entries with a missing or invalid index — silently coercing to 0 would
  // cause multiple distinct tool calls to collide in the accumulator.
  if (typeof tc["index"] !== "number") return null;
  const index = tc["index"];
  const id = typeof tc["id"] === "string" ? tc["id"] : undefined;
  const fn = tc["function"];
  const fnObj = fn !== null && typeof fn === "object" ? (fn as Record<string, unknown>) : null;
  const name = fnObj && typeof fnObj["name"] === "string" ? fnObj["name"] : undefined;
  const argumentsDelta =
    fnObj && typeof fnObj["arguments"] === "string" ? fnObj["arguments"] : undefined;
  // Only include entries that carry at least one piece of information.
  if (id === undefined && name === undefined && argumentsDelta === undefined) return null;
  return { index, id, name, argumentsDelta };
}

/**
 * Extract a {@link ChatDelta} from a raw parsed SSE chunk.
 * Returns `null` when the chunk does not contain a usable delta.
 *
 * @param parsed - The JSON-parsed SSE data payload.
 */
function extractChatDelta(parsed: unknown): ChatDelta | null {
  if (parsed === null || typeof parsed !== "object") return null;

  const choices = (parsed as Record<string, unknown>)["choices"];
  if (!Array.isArray(choices) || choices.length === 0) return null;

  const choice = choices[0];
  if (!isSseChoice(choice)) return null;

  const content =
    typeof choice.delta["content"] === "string" ? choice.delta["content"] : "";
  const finishReason =
    typeof choice.finish_reason === "string" ? choice.finish_reason : null;

  // Extract tool call deltas so callers can detect delegate_task and other
  // function calls streamed alongside (or instead of) text content.
  let toolCallsDelta: ChatDelta["toolCallsDelta"];
  const rawToolCalls = choice.delta["tool_calls"];
  if (Array.isArray(rawToolCalls) && rawToolCalls.length > 0) {
    const deltas = rawToolCalls.map(parseToolCallDelta).filter((d): d is ToolCallDelta => d !== null);
    if (deltas.length > 0) toolCallsDelta = deltas;
  }

  if (!content && !finishReason && !toolCallsDelta) return null;
  return { content, finishReason, toolCallsDelta };
}

/** Options for a streaming chat request. */
export interface StreamChatOptions {
  /**
   * Conversation messages to send, following the OpenAI message shape.
   * At minimum include one user message.
   */
  messages: Array<{ role: string; content: string }>;
  /**
   * The model identifier to use.
   * @default "hermes"
   */
  model?: string;
  /**
   * Custom base URL overriding the `NEXT_PUBLIC_HERMES_BASE_URL` env var.
   * Useful in tests or multi-tenant setups.
   */
  baseUrl?: string;
  /**
   * Custom `fetch` implementation.  Pass a mock here to unit-test callers
   * without making real network requests.
   * @default globalThis.fetch
   */
  fetchImpl?: typeof fetch;
  /** Abort signal used to cancel an in-flight stream. */
  signal?: AbortSignal;
}

/**
 * Stream a chat completion from the Hermes gateway using Server-Sent Events.
 *
 * Yields {@link ChatDelta} objects as the assistant response streams in.
 * The generator completes when the `[DONE]` sentinel is received or the
 * connection closes.
 *
 * @example
 * ```ts
 * for await (const delta of streamChat({ messages: [{ role: "user", content: "Hello" }] })) {
 *   process.stdout.write(delta.content);
 * }
 * ```
 *
 * @param options - {@link StreamChatOptions}
 * @yields {ChatDelta} Partial delta tokens from the assistant.
 * @throws {HermesApiError} On non-2xx responses.
 */
export async function* streamChat(
  options: StreamChatOptions
): AsyncGenerator<ChatDelta> {
  const {
    messages,
    model = "hermes",
    baseUrl = resolveBaseUrl(),
    fetchImpl = globalThis.fetch,
    signal,
  } = options;

  const url = `${baseUrl}/v1/chat/completions`;

  const response = await fetchImpl(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
      ...resolveAuthHeader(),
    },
    body: JSON.stringify({ model, messages, stream: true }),
    signal,
  });

  await assertOk(response);

  const body = response.body;
  if (!body) {
    const err: HermesApiError = Object.assign(
      new Error("Response body is null — streaming not supported"),
      { status: 0, message: "Response body is null — streaming not supported" }
    );
    throw err;
  }

  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // Normalize CRLF → LF so SSE events split reliably regardless of
      // server/proxy line-ending conventions (SSE permits both \n\n and \r\n\r\n).
      buffer = buffer.replace(/\r\n/g, "\n");

      // Split on SSE newline boundaries; each event ends with "\n\n"
      const parts = buffer.split("\n\n");
      // Keep the last (possibly incomplete) chunk in the buffer
      buffer = parts.pop() ?? "";

      for (const part of parts) {
        for (const line of part.split("\n")) {
          if (!line.startsWith("data:")) continue;

          const data = line.slice(5).trim();
          if (data === "[DONE]") return;

          let parsed: unknown;
          try {
            parsed = JSON.parse(data);
          } catch {
            // Malformed SSE chunk — skip and continue processing
            if (process.env["NODE_ENV"] === "development") {
              console.debug("[hermesClient] malformed SSE chunk:", data);
            }
            continue;
          }

          const delta = extractChatDelta(parsed);
          if (delta) yield delta;
        }
      }
    }

    // Flush: the stream closed without a trailing blank line or [DONE].
    // Process any remaining complete event in the buffer so the last delta
    // (e.g. final content token or tool_call result) is not silently dropped.
    buffer += decoder.decode(); // flush the TextDecoder's internal state
    buffer = buffer.replace(/\r\n/g, "\n");
    const remaining = buffer.trim();
    if (remaining) {
      for (const line of remaining.split("\n")) {
        if (!line.startsWith("data:")) continue;
        const data = line.slice(5).trim();
        if (data === "[DONE]") break;
        let parsed: unknown;
        try { parsed = JSON.parse(data); } catch { continue; }
        const delta = extractChatDelta(parsed);
        if (delta) yield delta;
      }
    }
  } finally {
    reader.cancel().catch(() => undefined);
  }
}

// ---------------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------------

/** Options accepted by every REST function for overriding defaults. */
interface ClientOptions {
  /** Custom base URL. Overrides `NEXT_PUBLIC_HERMES_BASE_URL`. */
  baseUrl?: string;
  /** Custom `fetch` implementation for unit testing. */
  fetchImpl?: typeof fetch;
}

/**
 * Call a Hermes tool by name with JSON arguments.
 *
 * @param name - Tool name to invoke (for example, "file").
 * @param args - JSON-serializable argument payload.
 * @param opts - {@link ClientOptions}
 * @returns Raw JSON response from the gateway.
 * @throws {HermesApiError} On non-2xx responses.
 */
export async function callTool(
  name: string,
  args: Record<string, unknown>,
  opts: ClientOptions = {}
): Promise<unknown> {
  const baseUrl = opts.baseUrl ?? resolveBaseUrl();
  const fetchImpl = opts.fetchImpl ?? globalThis.fetch;

  const response = await fetchImpl(`${baseUrl}/v1/tools/call`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...resolveAuthHeader(),
    },
    body: JSON.stringify({ name, arguments: args }),
  });
  await assertOk(response);
  return response.json() as Promise<unknown>;
}

/**
 * List models exposed by the Hermes gateway.
 *
 * Supports common response shapes:
 * - string[] (`["hermes", "gpt-4o"]`)
 * - object[] with `.id`/`.name`
 * - OpenAI-style `{ data: [{ id: "..." }] }`
 */
export async function listModels(opts: ClientOptions = {}): Promise<string[]> {
  const baseUrl = opts.baseUrl ?? resolveBaseUrl();
  const fetchImpl = opts.fetchImpl ?? globalThis.fetch;

  const response = await fetchImpl(`${baseUrl}/v1/models`, {
    headers: { ...resolveAuthHeader() },
  });
  await assertOk(response);
  const payload = (await response.json()) as unknown;

  const values = Array.isArray(payload)
    ? payload
    : payload &&
        typeof payload === "object" &&
        Array.isArray((payload as Record<string, unknown>).data)
      ? ((payload as Record<string, unknown>).data as unknown[])
      : [];

  const models = values
    .map((value) => {
      if (typeof value === "string") return value;
      if (!value || typeof value !== "object") return null;
      const id = (value as Record<string, unknown>).id;
      if (typeof id === "string" && id.trim()) return id;
      const name = (value as Record<string, unknown>).name;
      return typeof name === "string" && name.trim() ? name : null;
    })
    .filter((model): model is string => Boolean(model));

  return Array.from(new Set(models));
}

/**
 * List all sessions, optionally scoped to a profile.
 *
 * @param profileId - Optional profile ID to filter sessions.
 * @param opts - {@link ClientOptions}
 * @returns Resolved array of {@link Session} objects.
 * @throws {HermesApiError} On non-2xx responses.
 */
export async function listSessions(
  profileId?: string,
  opts: ClientOptions = {}
): Promise<Session[]> {
  const baseUrl = opts.baseUrl ?? resolveBaseUrl();
  const fetchImpl = opts.fetchImpl ?? globalThis.fetch;

  const params = profileId
    ? `?${new URLSearchParams({ profile_id: profileId }).toString()}`
    : "";
  const response = await fetchImpl(`${baseUrl}/v1/sessions${params}`, {
    headers: { ...resolveAuthHeader() },
  });
  await assertOk(response);
  return response.json() as Promise<Session[]>;
}

/**
 * Create a new session.
 *
 * @param title - Optional human-readable title for the session.
 * @param profileId - Optional profile ID to associate the session with.
 * @param opts - {@link ClientOptions}
 * @returns The newly created {@link Session}.
 * @throws {HermesApiError} On non-2xx responses.
 */
export async function createSession(
  title?: string,
  profileId?: string,
  opts: ClientOptions = {}
): Promise<Session> {
  const baseUrl = opts.baseUrl ?? resolveBaseUrl();
  const fetchImpl = opts.fetchImpl ?? globalThis.fetch;

  const response = await fetchImpl(`${baseUrl}/v1/sessions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...resolveAuthHeader(),
    },
    body: JSON.stringify({
      ...(title !== undefined ? { title } : {}),
      ...(profileId !== undefined ? { profile_id: profileId } : {}),
    }),
  });
  await assertOk(response);
  return response.json() as Promise<Session>;
}

/**
 * Fetch a single session by its ID.
 *
 * @param sessionId - The ID of the session to retrieve.
 * @param opts - {@link ClientOptions}
 * @returns The matching {@link Session}.
 * @throws {HermesApiError} On non-2xx responses or if the session is not found.
 */
export async function getSession(
  sessionId: string,
  opts: ClientOptions = {}
): Promise<Session> {
  const baseUrl = opts.baseUrl ?? resolveBaseUrl();
  const fetchImpl = opts.fetchImpl ?? globalThis.fetch;

  const response = await fetchImpl(`${baseUrl}/v1/sessions/${sessionId}`, {
    headers: { ...resolveAuthHeader() },
  });
  await assertOk(response);
  return response.json() as Promise<Session>;
}

/**
 * Rename (update the title of) an existing session.
 *
 * @param sessionId - The ID of the session to rename.
 * @param title - The new title for the session.
 * @param opts - {@link ClientOptions}
 * @returns The updated {@link Session}.
 * @throws {HermesApiError} On non-2xx responses.
 */
export async function renameSession(
  sessionId: string,
  title: string,
  opts: ClientOptions = {}
): Promise<Session> {
  const baseUrl = opts.baseUrl ?? resolveBaseUrl();
  const fetchImpl = opts.fetchImpl ?? globalThis.fetch;

  const response = await fetchImpl(`${baseUrl}/v1/sessions/${sessionId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...resolveAuthHeader(),
    },
    body: JSON.stringify({ title }),
  });
  await assertOk(response);
  return response.json() as Promise<Session>;
}

/**
 * Delete a session by its ID.
 *
 * @param sessionId - The ID of the session to delete.
 * @param opts - {@link ClientOptions}
 * @returns Resolves to `undefined` on success.
 * @throws {HermesApiError} On non-2xx responses.
 */
export async function deleteSession(
  sessionId: string,
  opts: ClientOptions = {}
): Promise<void> {
  const baseUrl = opts.baseUrl ?? resolveBaseUrl();
  const fetchImpl = opts.fetchImpl ?? globalThis.fetch;

  const response = await fetchImpl(`${baseUrl}/v1/sessions/${sessionId}`, {
    method: "DELETE",
    headers: { ...resolveAuthHeader() },
  });
  await assertOk(response);
}

// ---------------------------------------------------------------------------
// Tool Timeline
// ---------------------------------------------------------------------------

/**
 * Retrieve the ordered list of tool call + result pairs for a session.
 *
 * @param sessionId - The session to fetch tool calls for.
 * @param opts - {@link ClientOptions}
 * @returns Array of {@link ToolCall} objects, each optionally containing a `.result`.
 * @throws {HermesApiError} On non-2xx responses.
 */
export async function getToolCalls(
  sessionId: string,
  opts: ClientOptions = {}
): Promise<ToolCall[]> {
  const baseUrl = opts.baseUrl ?? resolveBaseUrl();
  const fetchImpl = opts.fetchImpl ?? globalThis.fetch;

  const response = await fetchImpl(
    `${baseUrl}/v1/sessions/${sessionId}/tool-calls`,
    { headers: { ...resolveAuthHeader() } }
  );
  await assertOk(response);
  return response.json() as Promise<ToolCall[]>;
}

// ---------------------------------------------------------------------------
// Skills / MCP
// ---------------------------------------------------------------------------

/**
 * List all skills (tools) registered with the gateway.
 *
 * @param opts - {@link ClientOptions}
 * @returns Array of {@link Skill} objects.
 * @throws {HermesApiError} On non-2xx responses.
 */
export async function listSkills(opts: ClientOptions = {}): Promise<Skill[]> {
  const baseUrl = opts.baseUrl ?? resolveBaseUrl();
  const fetchImpl = opts.fetchImpl ?? globalThis.fetch;

  const response = await fetchImpl(`${baseUrl}/v1/skills`, {
    headers: { ...resolveAuthHeader() },
  });
  await assertOk(response);
  return response.json() as Promise<Skill[]>;
}

/**
 * List all Model Context Protocol servers registered with the gateway.
 *
 * @param opts - {@link ClientOptions}
 * @returns Array of {@link McpServer} objects.
 * @throws {HermesApiError} On non-2xx responses.
 */
export async function listMcpServers(
  opts: ClientOptions = {}
): Promise<McpServer[]> {
  const baseUrl = opts.baseUrl ?? resolveBaseUrl();
  const fetchImpl = opts.fetchImpl ?? globalThis.fetch;

  const response = await fetchImpl(`${baseUrl}/v1/mcp/servers`, {
    headers: { ...resolveAuthHeader() },
  });
  await assertOk(response);
  return response.json() as Promise<McpServer[]>;
}

/**
 * Enable or disable a skill for the active profile.
 *
 * @param id - The skill ID to toggle.
 * @param enabled - `true` to enable, `false` to disable.
 * @param opts - {@link ClientOptions}
 * @returns The updated {@link Skill}.
 * @throws {HermesApiError} On non-2xx responses.
 */
export async function toggleSkill(
  id: string,
  enabled: boolean,
  opts: ClientOptions = {}
): Promise<Skill> {
  const baseUrl = opts.baseUrl ?? resolveBaseUrl();
  const fetchImpl = opts.fetchImpl ?? globalThis.fetch;

  const response = await fetchImpl(`${baseUrl}/v1/skills/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...resolveAuthHeader() },
    body: JSON.stringify({ enabled }),
  });
  await assertOk(response);
  return response.json() as Promise<Skill>;
}

/**
 * Remove a skill from the gateway.
 *
 * @param id - The skill ID to delete.
 * @param opts - {@link ClientOptions}
 * @returns Resolves to `undefined` on success.
 * @throws {HermesApiError} On non-2xx responses.
 */
export async function deleteSkill(
  id: string,
  opts: ClientOptions = {}
): Promise<void> {
  const baseUrl = opts.baseUrl ?? resolveBaseUrl();
  const fetchImpl = opts.fetchImpl ?? globalThis.fetch;

  const response = await fetchImpl(`${baseUrl}/v1/skills/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: { ...resolveAuthHeader() },
  });
  await assertOk(response);
}

/**
 * Register a new MCP server with the gateway.
 *
 * @param payload - {@link AddMcpServerPayload} describing the server.
 * @param opts - {@link ClientOptions}
 * @returns The created {@link McpServer}.
 * @throws {HermesApiError} On non-2xx responses.
 */
export async function addMcpServer(
  payload: AddMcpServerPayload,
  opts: ClientOptions = {}
): Promise<McpServer> {
  const baseUrl = opts.baseUrl ?? resolveBaseUrl();
  const fetchImpl = opts.fetchImpl ?? globalThis.fetch;

  const response = await fetchImpl(`${baseUrl}/v1/mcp/servers`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...resolveAuthHeader() },
    body: JSON.stringify(payload),
  });
  await assertOk(response);
  return response.json() as Promise<McpServer>;
}

/**
 * Enable or disable an MCP server.
 *
 * @param id - The MCP server ID to toggle.
 * @param enabled - `true` to enable, `false` to disable.
 * @param opts - {@link ClientOptions}
 * @returns The updated {@link McpServer}.
 * @throws {HermesApiError} On non-2xx responses.
 */
export async function toggleMcpServer(
  id: string,
  enabled: boolean,
  opts: ClientOptions = {}
): Promise<McpServer> {
  const baseUrl = opts.baseUrl ?? resolveBaseUrl();
  const fetchImpl = opts.fetchImpl ?? globalThis.fetch;

  const response = await fetchImpl(`${baseUrl}/v1/mcp/servers/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...resolveAuthHeader() },
    body: JSON.stringify({ enabled }),
  });
  await assertOk(response);
  return response.json() as Promise<McpServer>;
}

// ---------------------------------------------------------------------------
// Memory
// ---------------------------------------------------------------------------

/**
 * Retrieve the memory entries stored for a profile.
 *
 * @param profileId - The profile whose memory to fetch.
 * @param opts - {@link ClientOptions}
 * @returns Array of {@link MemoryEntry} objects.
 * @throws {HermesApiError} On non-2xx responses.
 */
export async function getMemory(
  profileId: string,
  opts: ClientOptions = {}
): Promise<MemoryEntry[]> {
  const baseUrl = opts.baseUrl ?? resolveBaseUrl();
  const fetchImpl = opts.fetchImpl ?? globalThis.fetch;

  const response = await fetchImpl(
    `${baseUrl}/v1/profiles/${profileId}/memory`,
    { headers: { ...resolveAuthHeader() } }
  );
  await assertOk(response);
  return response.json() as Promise<MemoryEntry[]>;
}

/**
 * Overwrite (or append) the memory content for a profile.
 *
 * @param profileId - The profile whose memory to update.
 * @param content - The new memory content to store.
 * @param opts - {@link ClientOptions}
 * @returns Resolves to `undefined` on success.
 * @throws {HermesApiError} On non-2xx responses.
 */
export async function updateMemory(
  profileId: string,
  content: string,
  opts: ClientOptions = {}
): Promise<void> {
  const baseUrl = opts.baseUrl ?? resolveBaseUrl();
  const fetchImpl = opts.fetchImpl ?? globalThis.fetch;

  const response = await fetchImpl(
    `${baseUrl}/v1/profiles/${profileId}/memory`,
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        ...resolveAuthHeader(),
      },
      body: JSON.stringify({ content }),
    }
  );
  await assertOk(response);
}

// ---------------------------------------------------------------------------
// Profiles
// ---------------------------------------------------------------------------

/**
 * List all profiles registered in the gateway.
 *
 * @param opts - {@link ClientOptions}
 * @returns Array of {@link Profile} objects.
 * @throws {HermesApiError} On non-2xx responses.
 */
export async function listProfiles(
  opts: ClientOptions = {}
): Promise<Profile[]> {
  const baseUrl = opts.baseUrl ?? resolveBaseUrl();
  const fetchImpl = opts.fetchImpl ?? globalThis.fetch;

  const response = await fetchImpl(`${baseUrl}/v1/profiles`, {
    headers: { ...resolveAuthHeader() },
  });
  await assertOk(response);
  return response.json() as Promise<Profile[]>;
}

/**
 * Create a new profile.
 *
 * @param name - Display name for the profile.
 * @param opts - {@link ClientOptions}
 * @returns The newly created {@link Profile}.
 * @throws {HermesApiError} On non-2xx responses.
 */
export async function createProfile(
  name: string,
  options: { color?: string; description?: string } = {},
  opts: ClientOptions = {}
): Promise<Profile> {
  const baseUrl = opts.baseUrl ?? resolveBaseUrl();
  const fetchImpl = opts.fetchImpl ?? globalThis.fetch;

  const response = await fetchImpl(`${baseUrl}/v1/profiles`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...resolveAuthHeader() },
    body: JSON.stringify({
      name,
      ...(options.color ? { color: options.color } : {}),
      ...(options.description ? { description: options.description } : {}),
    }),
  });
  await assertOk(response);
  return response.json() as Promise<Profile>;
}

/**
 * Get settings for a profile.
 *
 * @param profileId - The profile ID.
 * @param opts - {@link ClientOptions}
 * @returns The persisted {@link ProfileSettings}.
 * @throws {HermesApiError} On non-2xx responses.
 */
export async function getProfileSettings(
  profileId: string,
  opts: ClientOptions = {}
): Promise<ProfileSettings> {
  const baseUrl = opts.baseUrl ?? resolveBaseUrl();
  const fetchImpl = opts.fetchImpl ?? globalThis.fetch;

  const response = await fetchImpl(`${baseUrl}/v1/profiles/${encodeURIComponent(profileId)}/settings`, {
    headers: { ...resolveAuthHeader() },
  });
  await assertOk(response);
  return response.json() as Promise<ProfileSettings>;
}

/**
 * Update settings for a profile.
 *
 * @param profileId - The profile ID.
 * @param settings - Partial profile settings payload.
 * @param opts - {@link ClientOptions}
 * @returns The updated {@link ProfileSettings}.
 * @throws {HermesApiError} On non-2xx responses.
 */
export async function updateProfileSettings(
  profileId: string,
  settings: Partial<ProfileSettings>,
  opts: ClientOptions = {}
): Promise<ProfileSettings> {
  const baseUrl = opts.baseUrl ?? resolveBaseUrl();
  const fetchImpl = opts.fetchImpl ?? globalThis.fetch;

  const response = await fetchImpl(`${baseUrl}/v1/profiles/${encodeURIComponent(profileId)}/settings`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...resolveAuthHeader() },
    body: JSON.stringify(settings),
  });
  await assertOk(response);
  return response.json() as Promise<ProfileSettings>;
}

/**
 * Delete a profile.
 *
 * @param profileId - The profile ID to delete.
 * @param opts - {@link ClientOptions}
 * @returns Resolves to `undefined` on success.
 * @throws {HermesApiError} On non-2xx responses.
 */
export async function deleteProfile(
  profileId: string,
  opts: ClientOptions = {}
): Promise<void> {
  const baseUrl = opts.baseUrl ?? resolveBaseUrl();
  const fetchImpl = opts.fetchImpl ?? globalThis.fetch;

  const response = await fetchImpl(`${baseUrl}/v1/profiles/${encodeURIComponent(profileId)}`, {
    method: "DELETE",
    headers: { ...resolveAuthHeader() },
  });
  await assertOk(response);
}
