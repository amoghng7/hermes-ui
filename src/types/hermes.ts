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
  /** Optional human-readable description / role of what this agent does. */
  description?: string;
  /** ISO-8601 timestamp of the last status change. */
  updatedAt: string;
  /** List of tool names available to this agent. */
  tools?: string[];
  /** ID of the parent agent that delegated work to this agent, if any. */
  parentAgentId?: string;
  /** The task description assigned to this agent by its parent. */
  task?: string;
  /** Token usage recorded for this agent, if available. */
  tokenUsage?: TokenUsage;
}

/** Token consumption recorded for an agent run. */
export interface TokenUsage {
  input: number;
  output: number;
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
  /** Optional ISO-8601 timestamp of latest profile activity. */
  lastActiveAt?: string;
  /** Optional profile description. */
  description?: string;
  /** Optional color hex used for avatar/chip. */
  color?: string;
  /** Optional precomputed session count. */
  sessionCount?: number;
  /** Optional precomputed enabled skill count. */
  skillsCount?: number;
}

/** Per-profile settings persisted by the gateway. */
export interface ProfileSettings {
  apiKeys: Record<string, string>;
  defaultModel: string;
  enabledSkillIds: string[];
  enabledMcpServerIds: string[];
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
  /** Whether the skill is currently enabled for the active profile. */
  enabled: boolean;
  /** Semantic version string, e.g. "1.2.0". */
  version?: string;
  /** Broad category labels, e.g. ["search", "web"]. */
  categories?: string[];
  /** Fine-grained tags for filtering. */
  tags?: string[];
  /** Full skill prompt / instructions rendered in the expand panel. */
  instructions?: string;
}

/** Transport mechanism for an MCP server. */
export type McpTransport = "stdio" | "http";

/** A Model Context Protocol server registered with the gateway. */
export interface McpServer {
  /** Unique MCP server identifier. */
  id: string;
  /** Human-readable server name. */
  name: string;
  /** Transport URL for HTTP servers or empty string for stdio servers. */
  url: string;
  /** Whether the server is currently reachable. */
  connected: boolean;
  /** Transport type: stdio subprocess or HTTP endpoint. */
  transport?: McpTransport;
  /** CLI command used to launch stdio servers. */
  command?: string;
  /** List of tool names exposed by this server. */
  tools?: string[];
  /** Explicit ping status reported by the gateway. */
  pingStatus?: "online" | "offline" | "unknown";
  /** Last error message from the server, if any. */
  lastError?: string;
  /** Whether this server is administratively enabled. */
  enabled?: boolean;
  /** Environment variables passed to the server process (key→value). */
  env?: Record<string, string>;
}

/** Payload for adding a new MCP server. */
export interface AddMcpServerPayload {
  name: string;
  transport: McpTransport;
  /** Required when transport is "http". */
  url?: string;
  /** Required when transport is "stdio". */
  command?: string;
  env?: Record<string, string>;
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
// AskUser / Confirmation dialogs
// ---------------------------------------------------------------------------

/**
 * A pending question that the assistant is asking the user.
 * Set in the store when an `ask_user` tool call or marker is detected.
 */
export interface AskUserRequest {
  /** The question text to display to the user. */
  question: string;
  /** Pre-defined options the user can choose from. */
  options?: string[];
  /** When true the user may select multiple options. */
  multiSelect?: boolean;
  /** When true a free-text input is shown in addition to options. */
  allowCustom?: boolean;
}

/**
 * A pending confirmation for a potentially destructive tool invocation.
 * Set in the store when a `confirmation_required` marker is detected.
 */
export interface ConfirmationRequest {
  /** Display name of the tool about to be executed. */
  toolName: string;
  /** Arguments / parameters the tool will be called with. */
  parameters: Record<string, unknown>;
  /** Optional human-readable warning about the action's consequences. */
  warningText?: string;
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
  /** Tool call chunk deltas from the SSE stream, if any. */
  toolCallsDelta?: ToolCallDelta[];
}

/**
 * A partial tool-call chunk streamed from a single SSE event.
 * Multiple chunks with the same `index` must be merged to reconstruct
 * the full tool call (id + name appear on the first chunk only;
 * `argumentsDelta` is appended on every subsequent chunk).
 * If `id` or `name` appear on a later chunk, the first-seen value wins —
 * subsequent duplicates should be ignored when accumulating.
 */
export interface ToolCallDelta {
  /** Position index of this tool call in the current request batch. */
  index: number;
  /** Stable call ID — present only on the first chunk for this index. */
  id?: string;
  /** Function name — present only on the first chunk for this index. */
  name?: string;
  /** Partial JSON arguments string to be appended to the accumulated buffer. */
  argumentsDelta?: string;
}
