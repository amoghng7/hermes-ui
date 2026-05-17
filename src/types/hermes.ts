/**
 * Hermes gateway type definitions.
 *
 * All shapes mirror the Hermes API contract described in the Nous Research
 * Hermes Agent documentation.  Keep this file free of runtime code so it
 * can be imported by both server and browser without side-effects.
 */

// ---------------------------------------------------------------------------
// Error
// ---------------------------------------------------------------------------

/** Typed error thrown by every hermesClient function on a non-2xx response. */
export interface HermesApiError {
  /** HTTP status code returned by the gateway. */
  status: number;
  /** Human-readable error message from the gateway, or a network-level description. */
  message: string;
  /** Raw response body, if available. */
  body?: unknown;
}

// ---------------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------------

/** A persisted conversation session in the Hermes gateway (SQLite-backed). */
export interface Session {
  /** Unique session identifier. */
  id: string;
  /** Human-readable title for the session. */
  title: string;
  /** ISO-8601 creation timestamp. */
  createdAt: string;
  /** ISO-8601 last-updated timestamp. */
  updatedAt: string;
  /** Optional profile ID that owns this session. */
  profileId?: string;
}

// ---------------------------------------------------------------------------
// Messages
// ---------------------------------------------------------------------------

/** A single message in a session, following the OpenAI message shape. */
export interface Message {
  /** Unique message identifier. */
  id: string;
  /** The session this message belongs to. */
  sessionId: string;
  /** Conversation role. */
  role: "user" | "assistant" | "system" | "tool";
  /** Text content of the message. */
  content: string;
  /** ISO-8601 creation timestamp. */
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Tool Calls
// ---------------------------------------------------------------------------

/** A tool invocation made by the agent during a session. */
export interface ToolCall {
  /** Unique call identifier (matches the `id` in the OpenAI tool-calls array). */
  id: string;
  /** Name of the tool that was called. */
  name: string;
  /** JSON-encoded arguments passed to the tool. */
  arguments: string;
  /** ISO-8601 timestamp when the tool was invoked. */
  calledAt: string;
  /** Result returned by the tool, if available. */
  result?: ToolResult;
}

/** The result returned by a tool after execution. */
export interface ToolResult {
  /** Matches the `ToolCall.id` this result belongs to. */
  toolCallId: string;
  /** JSON-encoded output returned by the tool. */
  output: string;
  /** Whether the tool execution completed without error. */
  success: boolean;
  /** ISO-8601 timestamp when the result was received. */
  returnedAt: string;
}

// ---------------------------------------------------------------------------
// Agents
// ---------------------------------------------------------------------------

/** A swarm agent managed by the Hermes orchestrator. */
export interface Agent {
  /** Unique agent identifier. */
  id: string;
  /** Display name for the agent. */
  name: string;
  /** Current execution state. */
  status: "idle" | "active" | "waiting" | "error" | "done";
  /** Optional human-readable description of what this agent does. */
  description?: string;
  /** ISO-8601 timestamp of the last status change. */
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Profiles
// ---------------------------------------------------------------------------

/** A Hermes user profile that groups sessions and memory. */
export interface Profile {
  /** Unique profile identifier. */
  id: string;
  /** Display name for the profile. */
  name: string;
  /** ISO-8601 creation timestamp. */
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Skills / MCP
// ---------------------------------------------------------------------------

/** A registered skill (tool) available to Hermes agents. */
export interface Skill {
  /** Unique skill identifier. */
  id: string;
  /** Human-readable skill name. */
  name: string;
  /** Short description of what the skill does. */
  description: string;
  /** Whether the skill is currently enabled. */
  enabled: boolean;
}

/** A Model Context Protocol server registered with the gateway. */
export interface McpServer {
  /** Unique MCP server identifier. */
  id: string;
  /** Human-readable server name. */
  name: string;
  /** Transport URL for the MCP server. */
  url: string;
  /** Whether the server is currently reachable. */
  connected: boolean;
}

// ---------------------------------------------------------------------------
// Memory
// ---------------------------------------------------------------------------

/** A single memory entry stored for a profile. */
export interface MemoryEntry {
  /** Unique entry identifier. */
  id: string;
  /** Text content of the memory. */
  content: string;
  /** ISO-8601 creation timestamp. */
  createdAt: string;
  /** ISO-8601 last-updated timestamp. */
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// SSE / Streaming
// ---------------------------------------------------------------------------

/**
 * A single delta token yielded by the `streamChat` async generator.
 * Mirrors the OpenAI streaming chunk shape (`choices[0].delta`).
 */
export interface ChatDelta {
  /** Partial text content of the assistant response. */
  content: string;
  /** The finish reason once streaming is complete, or null while streaming. */
  finishReason: string | null;
}
