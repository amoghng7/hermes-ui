/**
 * hermesStore — Zustand global state store for Hermes UI.
 *
 * Provides a single source of truth for all panels (ThreadList,
 * ChatWorkspace, SwarmPanel, Skills, Memory, etc.).
 *
 * Import selector hooks from `@/store/hooks` instead of consuming
 * this store directly in components.
 */

import { create } from "zustand";
import type { Agent, AskUserRequest, ConfirmationRequest, MemoryEntry, McpServer, Message, Profile, Session, Skill, ToolCall } from "@/types/hermes";
import {
  listProfiles,
  listSessions,
  createSession as apiCreateSession,
  deleteSession as apiDeleteSession,
  renameSession as apiRenameSession,
  getMemory,
} from "@/lib/hermesClient";

// ---------------------------------------------------------------------------
// State shape
// ---------------------------------------------------------------------------

export interface HermesState {
  profiles: Profile[];
  activeProfileId: string | null;
  sessions: Session[];
  activeSessionId: string | null;
  /** Messages keyed by sessionId. */
  messagesBySession: Record<string, Message[]>;
  /** Which session is currently streaming (null if none). */
  streamingSessionId: string | null;
  /** The message ID currently being streamed (null if none). */
  streamingMessageId: string | null;
  /** Swarm agents keyed by sessionId. */
  agents: Record<string, Agent[]>;
  /** Tool calls keyed by sessionId. */
  toolCallsBySession: Record<string, ToolCall[]>;
  /** Pending ask_user request (replaces ChatInput while set). */
  pendingAskUser: AskUserRequest | null;
  /** Pending confirmation request for a destructive tool call. */
  pendingConfirmation: ConfirmationRequest | null;
  skills: Skill[];
  mcpServers: McpServer[];
  memory: MemoryEntry[];
  /** Monotonically incremented every time the session list is mutated locally.
   *  Used by the background poll to discard stale results. */
  sessionMutationVersion: number;
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

export interface HermesActions {
  /**
   * Low-level setter for active profile id + cleared profile-scoped caches.
   * Callers should generally use `switchProfile` for user-initiated profile changes.
   */
  setActiveProfile(id: string): void;

  /**
   * Switch the active profile and reload sessions + memory for that profile.
   */
  switchProfile(id: string): Promise<void>;

  /**
   * Create a new session via the Hermes gateway, add it to the list,
   * and make it the active session.
   */
  createSession(title?: string): Promise<Session>;

  /**
   * Rename an existing session.
   */
  renameSession(id: string, title: string): Promise<void>;

  /**
   * Remove a session from state and the gateway.
   */
  deleteSession(id: string): Promise<void>;

  /**
   * Set the active session.  Kicks off a message fetch if the session's
   * messages have not been cached yet.
   */
  setActiveSession(id: string): void;

  /**
   * Clear the active session (e.g. when navigating to the home route).
   */
  clearActiveSession(): void;

  /**
   * Add a completed user message without touching streaming state.
   * Use this instead of `appendMessage` for user-authored messages.
   */
  addUserMessage(sessionId: string, message: Message): void;

  /**
   * Append a partial message token during SSE streaming.
   * Creates the message entry on first call for a given messageId.
   */
  appendMessage(sessionId: string, message: Message): void;

  /**
   * Mark a streaming message as complete.
   * Clears `streamingSessionId` and `streamingMessageId` only when both
   * the `sessionId` and `messageId` match the currently active stream.
   */
  finalizeMessage(sessionId: string, messageId: string): void;

  /**
   * Store tool calls for a session (replaces any previously cached calls).
   */
  setToolCalls(sessionId: string, calls: ToolCall[]): void;

  /**
   * Set or clear the pending ask_user dialog.
   * Pass `null` to dismiss the dialog.
   */
  setPendingAskUser(request: AskUserRequest | null): void;

  /**
   * Set or clear the pending confirmation dialog.
   * Pass `null` to dismiss the dialog.
   */
  setPendingConfirmation(request: ConfirmationRequest | null): void;

  /**
   * Add a new agent or update an existing one for a session.
   * If an agent with the same `id` already exists it is shallowly merged
   * (new values overwrite old ones); otherwise it is appended.
   */
  upsertAgent(sessionId: string, agent: Agent): void;

  // Internal helpers exposed for testing / direct use
  _setSessions(sessions: Session[]): void;
  _setMemory(memory: MemoryEntry[]): void;
  _setAgents(sessionId: string, agents: Agent[]): void;
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

let profileSwitchRequestVersion = 0;

export const useHermesStore = create<HermesState & HermesActions>((set, get) => ({
  // ── Initial state ────────────────────────────────────────────────────────
  profiles: [],
  activeProfileId: null,
  sessions: [],
  activeSessionId: null,
  messagesBySession: {},
  streamingSessionId: null,
  streamingMessageId: null,
  agents: {},
  toolCallsBySession: {},
  pendingAskUser: null,
  pendingConfirmation: null,
  skills: [],
  mcpServers: [],
  memory: [],
  sessionMutationVersion: 0,

  // ── Actions ──────────────────────────────────────────────────────────────

  setActiveProfile(id: string) {
    set({ activeProfileId: id, sessions: [], activeSessionId: null, memory: [], streamingSessionId: null, streamingMessageId: null });
  },

  async switchProfile(id: string) {
    const requestedId = id;
    const requestVersion = ++profileSwitchRequestVersion;
    get().setActiveProfile(requestedId);
    // Promise.allSettled ensures sessions still load even if the memory
    // endpoint is unavailable (e.g. 404 for a new profile).
    const [sessionsResult, memoryResult] = await Promise.allSettled([
      listSessions(requestedId),
      getMemory(requestedId),
    ]);
    // Discard stale response if profile switched again while awaiting.
    if (get().activeProfileId !== requestedId || profileSwitchRequestVersion !== requestVersion) return;
    const update: Partial<HermesState> = {};
    if (sessionsResult.status === "fulfilled") update.sessions = sessionsResult.value;
    if (memoryResult.status === "fulfilled") update.memory = memoryResult.value;
    if (Object.keys(update).length > 0) set(update);
  },

  async createSession(title?: string) {
    const { activeProfileId } = get();
    const session = await apiCreateSession(title, activeProfileId ?? undefined);
    set((state) => ({
      sessions: [session, ...state.sessions],
      activeSessionId: session.id,
      sessionMutationVersion: state.sessionMutationVersion + 1,
    }));
    return session;
  },

  async renameSession(id: string, title: string) {
    const updated = await apiRenameSession(id, title);
    set((state) => ({
      sessions: state.sessions.map((s) => (s.id === id ? updated : s)),
      sessionMutationVersion: state.sessionMutationVersion + 1,
    }));
  },

  async deleteSession(id: string) {
    await apiDeleteSession(id);
    set((state) => {
      const remaining = state.sessions.filter((s) => s.id !== id);

      // Build remaining records by spreading and deleting the target key.
      const remainingToolCalls = { ...state.toolCallsBySession };
      delete remainingToolCalls[id];
      const remainingMessages = { ...state.messagesBySession };
      delete remainingMessages[id];
      const remainingAgents = { ...state.agents };
      delete remainingAgents[id];

      let newActiveId = state.activeSessionId;
      if (state.activeSessionId === id) {
        // Pick the most recently updated remaining session, or null if none left.
        const sorted = [...remaining].sort(
          (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        );
        newActiveId = sorted[0]?.id ?? null;
      }

      return {
        sessions: remaining,
        activeSessionId: newActiveId,
        toolCallsBySession: remainingToolCalls,
        messagesBySession: remainingMessages,
        agents: remainingAgents,
        sessionMutationVersion: state.sessionMutationVersion + 1,
      };
    });
  },

  setActiveSession(id: string) {
    const { messagesBySession } = get();
    set({ activeSessionId: id });
    // Messages already cached — nothing more to do.
    if (messagesBySession[id]) return;
    // Pre-populate with empty array so consumers know we're aware of the session.
    set((state) => ({
      messagesBySession: { ...state.messagesBySession, [id]: [] },
    }));

    // Background fetch for messages on this session if a gateway endpoint exists.
    // This is fire-and-forget: UI shows empty initially, then populates when
    // the server responds. If the endpoint doesn't exist yet (no backend), the
    // catch silently degrades to the empty array already set above.
    fetch(`${process.env["NEXT_PUBLIC_HERMES_BASE_URL"] ?? "http://localhost:8000"}/v1/sessions/${id}/messages`, {
      headers: { Accept: "application/json" },
    })
      .then(async (res) => {
        if (!res.ok) return;
        const msgs = (await res.json()) as unknown[];
        if (!Array.isArray(msgs)) return;
        // Only update if this session is still active (user didn't switch away).
        if (get().activeSessionId !== id) return;
        const typed = msgs.filter(
          (m): m is Message =>
            m !== null &&
            typeof m === "object" &&
            "id" in m &&
            "role" in m &&
            "content" in m
        );
        set((state) => ({
          messagesBySession: { ...state.messagesBySession, [id]: typed },
        }));
      })
      .catch(() => undefined);
  },

  clearActiveSession() {
    set({ activeSessionId: null });
  },

  addUserMessage(sessionId: string, message: Message) {
    set((state) => {
      const existing = state.messagesBySession[sessionId] ?? [];
      return {
        messagesBySession: { ...state.messagesBySession, [sessionId]: [...existing, message] },
      };
    });
  },

  appendMessage(sessionId: string, message: Message) {
    set((state) => {
      const existing = state.messagesBySession[sessionId] ?? [];
      const idx = existing.findIndex((m) => m.id === message.id);
      let updated: Message[];
      if (idx === -1) {
        // New message — append and mark session as streaming
        updated = [...existing, message];
      } else {
        // Existing partial message — replace with updated content
        updated = existing.map((m, i) => (i === idx ? message : m));
      }
      return {
        messagesBySession: { ...state.messagesBySession, [sessionId]: updated },
        streamingSessionId: sessionId,
        streamingMessageId: message.id,
      };
    });
  },

  finalizeMessage(sessionId: string, messageId: string) {
    set((state) => {
      // Only clear streaming state when both session and message ID match.
      if (
        state.streamingSessionId !== sessionId ||
        state.streamingMessageId !== messageId
      ) {
        return {};
      }
      return { streamingSessionId: null, streamingMessageId: null };
    });
  },

  // ── Internal helpers ─────────────────────────────────────────────────────

  _setSessions(sessions: Session[]) {
    set({ sessions });
  },

  _setMemory(memory: MemoryEntry[]) {
    set({ memory });
  },

  _setAgents(sessionId: string, agents: Agent[]) {
    set((state) => ({
      agents: { ...state.agents, [sessionId]: agents },
    }));
  },

  upsertAgent(sessionId: string, agent: Agent) {
    set((state) => {
      const existing = state.agents[sessionId] ?? [];
      const idx = existing.findIndex((a) => a.id === agent.id);
      const updated =
        idx === -1
          ? [...existing, agent]
          : existing.map((a, i) => (i === idx ? { ...a, ...agent } : a));
      return { agents: { ...state.agents, [sessionId]: updated } };
    });
  },

  setToolCalls(sessionId: string, calls: ToolCall[]) {
    set((state) => ({
      toolCallsBySession: { ...state.toolCallsBySession, [sessionId]: calls },
    }));
  },

  setPendingAskUser(request: AskUserRequest | null) {
    set({ pendingAskUser: request });
  },

  setPendingConfirmation(request: ConfirmationRequest | null) {
    set({ pendingConfirmation: request });
  },
}));

// ---------------------------------------------------------------------------
// Bootstrap helper — load profiles on first mount (called from HermesProvider)
// ---------------------------------------------------------------------------

export async function bootstrapStore(): Promise<void> {
  try {
    const profiles = await listProfiles();
    useHermesStore.setState({ profiles });
    if (profiles.length > 0 && !useHermesStore.getState().activeProfileId) {
      await useHermesStore.getState().switchProfile(profiles[0].id);
    }
  } catch {
    // Gateway not available — gracefully degrade to empty state.
  }
}
