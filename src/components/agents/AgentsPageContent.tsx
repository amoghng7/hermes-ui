"use client";

/**
 * AgentsPageContent — the full three-column /agents page.
 *
 * Extracted into a component so it can be mounted from the test-renderer
 * route (which Next.js rewrites to from /agents) as well as any future
 * src/app/agents/page.tsx once the directory can be created.
 *
 * Three columns:
 *   Left   — AgentListPanel:     all agents across sessions with session filter
 *   Center — AgentDetailPanel:   identity card, prompt viewer, tool list
 *   Right  — SwarmMinimapPanel:  mini swarm graph scoped to selected session
 */

import { useMemo, useState } from "react";
import { useHermesStore } from "@/store/hermesStore";
import { useSessions } from "@/store/hooks";
import { AgentListPanel } from "@/components/agents/AgentListPanel";
import { AgentDetailPanel } from "@/components/agents/AgentDetailPanel";
import { SwarmMinimapPanel } from "@/components/agents/SwarmMinimapPanel";
import type { AgentWithSession } from "@/components/agents/AgentListPanel";

export function AgentsPageContent() {
  // ── Store ────────────────────────────────────────────────────────────────
  const agentsBySession = useHermesStore((s) => s.agents);
  const toolCallsBySession = useHermesStore((s) => s.toolCallsBySession);
  const sessions = useSessions();

  // ── Local state ──────────────────────────────────────────────────────────
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [filterSessionId, setFilterSessionId] = useState<string | null>(null);

  // ── Derived data ─────────────────────────────────────────────────────────

  /** Flat list of all agents across all sessions, each augmented with sessionId. */
  const agentsWithSession = useMemo<AgentWithSession[]>(
    () =>
      Object.entries(agentsBySession).flatMap(([sessionId, agents]) =>
        agents.map((agent) => ({ ...agent, sessionId })),
      ),
    [agentsBySession],
  );

  /** Session map for O(1) lookup by id. */
  const sessionMap = useMemo(
    () => new Map(sessions.map((s) => [s.id, s])),
    [sessions],
  );

  /** The currently selected agent (null when none selected or id not found). */
  const selectedAgent = useMemo(
    () =>
      selectedAgentId !== null
        ? (agentsWithSession.find((a) => a.id === selectedAgentId) ?? null)
        : null,
    [agentsWithSession, selectedAgentId],
  );

  /** Session the selected agent belongs to. */
  const selectedSession = selectedAgent
    ? (sessionMap.get(selectedAgent.sessionId) ?? null)
    : null;

  /**
   * Tool calls for the selected session — used by AgentDetailPanel to show
   * per-tool call counts and last-called timestamps.
   */
  const sessionToolCalls = useMemo(
    () =>
      selectedAgent
        ? (toolCallsBySession[selectedAgent.sessionId] ?? [])
        : [],
    [selectedAgent, toolCallsBySession],
  );

  /**
   * Session id for the minimap: prefer the selected agent's session; fall
   * back to the active filter session; null otherwise (empty state).
   */
  const minimapSessionId =
    selectedAgent?.sessionId ?? filterSessionId ?? null;

  const minimapSessionTitle = minimapSessionId
    ? (sessionMap.get(minimapSessionId)?.title ?? null)
    : null;

  // ── Callbacks ────────────────────────────────────────────────────────────

  const handleSelectAgent = (id: string) => {
    setSelectedAgentId((prev) => (prev === id ? null : id));
  };

  const handleFilterSession = (id: string | null) => {
    setFilterSessionId(id);
  };

  const handleMinimapSelect = (agentId: string) => {
    setSelectedAgentId(agentId);
  };

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="flex-1 flex gap-6 box-border fluid-main-margin min-h-0">
      {/* Left — agent list */}
      <AgentListPanel
        agentsWithSession={agentsWithSession}
        sessions={sessions}
        filterSessionId={filterSessionId}
        onFilterSession={handleFilterSession}
        selectedAgentId={selectedAgentId}
        onSelectAgent={handleSelectAgent}
      />

      {/* Center — agent detail */}
      <AgentDetailPanel
        agent={selectedAgent}
        session={selectedSession}
        toolCalls={sessionToolCalls}
      />

      {/* Right — swarm minimap */}
      <SwarmMinimapPanel
        sessionId={minimapSessionId}
        sessionTitle={minimapSessionTitle}
        selectedAgentId={selectedAgentId}
        onSelectAgent={handleMinimapSelect}
      />
    </div>
  );
}
