/**
 * Typed selector hooks for the Hermes global store.
 *
 * Prefer these hooks over importing `useHermesStore` directly in
 * components — they provide a stable, narrowly-typed API that is
 * easier to mock and refactor.
 *
 * @module store/hooks
 */

import { useHermesStore } from "@/store/hermesStore";
import type { Agent, MemoryEntry, Message, Profile, Session } from "@/types/hermes";

// Stable empty arrays — returned instead of `[]` literals so that
// components don't re-render on every unrelated store update.
const EMPTY_MESSAGES: Message[] = [];
const EMPTY_AGENTS: Agent[] = [];

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
