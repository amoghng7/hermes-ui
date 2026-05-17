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
  ChatDelta,
  HermesApiError,
  MemoryEntry,
  McpServer,
  Profile,
  Session,
  Skill,
  ToolCall,
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

    const error: HermesApiError = {
      status: response.status,
      message:
        typeof body === "object" &&
        body !== null &&
        "message" in body &&
        typeof (body as Record<string, unknown>)["message"] === "string"
          ? (body as Record<string, string>)["message"]
          : response.statusText || `HTTP ${response.status}`,
      body,
    };
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Chat / Completions — SSE streaming
// ---------------------------------------------------------------------------

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
  });

  await assertOk(response);

  const body = response.body;
  if (!body) {
    throw {
      status: 0,
      message: "Response body is null — streaming not supported",
    } satisfies HermesApiError;
  }

  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

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
            // Malformed chunk — skip
            continue;
          }

          const choice =
            parsed !== null &&
            typeof parsed === "object" &&
            "choices" in parsed &&
            Array.isArray((parsed as Record<string, unknown>)["choices"]) &&
            (parsed as { choices: unknown[] })["choices"][0];

          if (!choice || typeof choice !== "object") continue;

          const delta =
            "delta" in (choice as object)
              ? (choice as Record<string, unknown>)["delta"]
              : null;

          const finishReason =
            "finish_reason" in (choice as object)
              ? ((choice as Record<string, unknown>)["finish_reason"] as
                  | string
                  | null)
              : null;

          const content =
            delta !== null &&
            typeof delta === "object" &&
            "content" in (delta as object) &&
            typeof (delta as Record<string, unknown>)["content"] === "string"
              ? ((delta as Record<string, string>)["content"] as string)
              : "";

          if (content || finishReason) {
            yield { content, finishReason: finishReason ?? null };
          }
        }
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
