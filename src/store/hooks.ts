/**
 * Typed selector hooks for the Hermes global store.
 *
 * Prefer these hooks over importing `useHermesStore` directly in
 * components — they provide a stable, narrowly-typed API that is
 * easier to mock and refactor.
 *
 * @module store/hooks
 */

import { useMemo } from "react";
import { useHermesStore } from "@/store/hermesStore";
import type { Agent, MemoryEntry, Message, Profile, Session, ToolCall } from "@/types/hermes";

// Stable empty arrays — returned instead of `[]` literals so that
// components don't re-render on every unrelated store update.
const EMPTY_MESSAGES: Message[] = [];
const EMPTY_AGENTS: Agent[] = [];
const EMPTY_TOOL_CALLS: ToolCall[] = [];

// ---------------------------------------------------------------------------
// Profiles
// ---------------------------------------------------------------------------

/** Returns the full list of profiles. */
export function useProfiles(): Profile[] {
  return useHermesStore((s) => s.profiles);
}

/** Returns the currently active profile, or `null` if none is selected. */
export function useActiveProfile(): Profile | null {
  return useHermesStore((s) => {
    if (!s.activeProfileId) return null;
    return s.profiles.find((p) => p.id === s.activeProfileId) ?? null;
  });
}

// ---------------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------------

/** Returns the full list of sessions for the active profile. */
export function useSessions(): Session[] {
  return useHermesStore((s) => s.sessions);
}

/** Returns the currently active session, or `null` if none is selected. */
export function useActiveSession(): Session | null {
  return useHermesStore((s) => {
    if (!s.activeSessionId) return null;
    return s.sessions.find((session) => session.id === s.activeSessionId) ?? null;
  });
}

// ---------------------------------------------------------------------------
// Messages
// ---------------------------------------------------------------------------

/**
 * Returns the message list for a given session.
 * Returns an empty array when the session has not been loaded yet.
 */
export function useMessages(sessionId: string | null): Message[] {
  return useHermesStore((s) =>
    sessionId ? (s.messagesBySession[sessionId] ?? EMPTY_MESSAGES) : EMPTY_MESSAGES
  );
}

/** Returns `true` when the given session is currently streaming a response. */
export function useIsStreaming(sessionId: string | null): boolean {
  return useHermesStore((s) => sessionId !== null && s.streamingSessionId === sessionId);
}

// ---------------------------------------------------------------------------
// Agents
// ---------------------------------------------------------------------------

/**
 * Returns the swarm agents for a given session.
 * Returns an empty array when no agents have been loaded.
 */
export function useAgents(sessionId: string | null): Agent[] {
  return useHermesStore((s) =>
    sessionId ? (s.agents[sessionId] ?? EMPTY_AGENTS) : EMPTY_AGENTS
  );
}

// ---------------------------------------------------------------------------
// Memory
// ---------------------------------------------------------------------------

/** Returns the memory entries for the active profile. */
export function useMemory(): MemoryEntry[] {
  return useHermesStore((s) => s.memory);
}

// ---------------------------------------------------------------------------
// Tool Calls
// ---------------------------------------------------------------------------

/**
 * Returns the tool calls for a given session.
 * Returns an empty array when no tool calls have been loaded.
 */
export function useToolCalls(sessionId: string | null): ToolCall[] {
  return useHermesStore((s) =>
    sessionId ? (s.toolCallsBySession[sessionId] ?? EMPTY_TOOL_CALLS) : EMPTY_TOOL_CALLS
  );
}

/**
 * Groups session-level tool calls by the assistant message they followed,
 * matching each call to the latest assistant message created before `calledAt`.
 * Returns a stable `Record<messageId, ToolCall[]>` suitable for `MessageList`.
 */
export function useToolCallsByMessage(
  sessionId: string | null,
  messages: Message[]
): Record<string, ToolCall[]> {
  const toolCalls = useToolCalls(sessionId);
  return useMemo(() => {
    if (toolCalls.length === 0) return {};
    const assistantMessages = messages.filter((m) => m.role === "assistant");
    if (assistantMessages.length === 0) return {};
    const result: Record<string, ToolCall[]> = {};
    for (const call of toolCalls) {
      const calledAt = new Date(call.calledAt).getTime();
      let best: Message | null = null;
      for (const msg of assistantMessages) {
        const msgTime = new Date(msg.createdAt).getTime();
        if (msgTime <= calledAt && (!best || new Date(best.createdAt).getTime() < msgTime)) {
          best = msg;
        }
      }
      if (best) {
        (result[best.id] ??= []).push(call);
      }
    }
    return result;
  }, [toolCalls, messages]);
}
