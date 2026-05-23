"use client";

/**
 * SwarmMinimapPanel — right-column panel for the /agents page.
 *
 * Renders a read-only SwarmGraph scoped to the currently selected agent's
 * session (or the filtered session if no agent is selected).  Clicking a node
 * in the graph selects that agent in the left panel.
 */

import { useMemo } from "react";
import { useAgents } from "@/store/hooks";
import { SwarmGraph } from "@/components/swarm/SwarmGraph";

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

interface EmptyStateProps {
  reason: "no-session" | "no-agents";
}

function EmptyState({ reason }: EmptyStateProps) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center px-6">
      <span
        className="material-symbols-outlined text-4xl text-text-muted"
        aria-hidden="true"
      >
        {reason === "no-session" ? "account_tree" : "hub"}
      </span>
      <p className="text-sm font-medium text-on-surface-variant">
        {reason === "no-session"
          ? "No session selected"
          : "No agents in session"}
      </p>
      <p className="text-xs text-text-muted leading-relaxed max-w-[16rem]">
        {reason === "no-session"
          ? "Select an agent from the list to see its session topology."
          : "Subagents spawned via delegate_task will appear here."}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Panel
// ---------------------------------------------------------------------------

export interface SwarmMinimapPanelProps {
  /** Session to scope the graph to — null shows an empty state. */
  sessionId: string | null;
  /** Session title for the header label. */
  sessionTitle: string | null;
  /** Currently selected agent (highlighted in graph). */
  selectedAgentId: string | null;
  /** Callback when a graph node is clicked. */
  onSelectAgent: (agentId: string) => void;
}

export function SwarmMinimapPanel({
  sessionId,
  sessionTitle,
  selectedAgentId,
  onSelectAgent,
}: SwarmMinimapPanelProps) {
  const agents = useAgents(sessionId);

  /** Edges derived from parentAgentId relationships. */
  const edges = useMemo(
    () =>
      agents
        .filter((a) => a.parentAgentId != null)
        .map((a) => ({ from: a.parentAgentId!, to: a.id })),
    [agents],
  );

  const activeCount = useMemo(
    () =>
      agents.filter((a) => a.status === "active" || a.status === "waiting")
        .length,
    [agents],
  );

  return (
    <aside
      aria-label="Swarm topology minimap"
      className="hidden xl:flex xl:w-[35%] glass-panel rounded-3xl flex-col overflow-hidden"
    >
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="px-5 py-4 border-b border-border-subtle flex-shrink-0">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-h1 text-base font-semibold text-on-surface">
            Session Topology
          </h3>

          {/* Active indicator */}
          {activeCount > 0 && (
            <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[0.625rem] font-bold uppercase tracking-wider">
              <span
                className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"
                aria-hidden="true"
              />
              {activeCount} active
            </span>
          )}
        </div>

        {/* Session label */}
        {sessionTitle ? (
          <p className="text-[0.6875rem] text-text-muted mt-1 truncate font-code">
            {sessionTitle}
          </p>
        ) : (
          <p className="text-[0.6875rem] text-text-muted/50 mt-1">
            No session
          </p>
        )}

        {/* Agent count chips */}
        {sessionId && (
          <div className="flex gap-2 mt-2.5 flex-wrap">
            <span className="px-2.5 py-0.5 rounded-full bg-surface-container text-text-muted text-[0.625rem] uppercase font-bold tracking-wider">
              {`${agents.length} agent${agents.length !== 1 ? "s" : ""}`}
            </span>
            {selectedAgentId && sessionId && selectedAgentId.startsWith(`${sessionId}/`) && (
              <span className="px-2.5 py-0.5 rounded-full bg-primary/10 text-primary text-[0.625rem] uppercase font-bold tracking-wider flex items-center gap-1">
                <span
                  className="material-symbols-outlined text-[0.75rem]"
                  aria-hidden="true"
                >
                  radio_button_checked
                </span>
                Selected
              </span>
            )}
          </div>
        )}
      </div>

      {/* ── Graph or empty state ────────────────────────────────────────────── */}
      {!sessionId ? (
        <EmptyState reason="no-session" />
      ) : agents.length === 0 ? (
        <EmptyState reason="no-agents" />
      ) : (
        <SwarmGraph
          agents={agents}
          edges={edges}
          onAgentSelect={onSelectAgent}
          selectedAgentId={
            selectedAgentId && sessionId && selectedAgentId.startsWith(`${sessionId}/`)
              ? selectedAgentId.split("/")[1]
              : undefined
          }
        />
      )}
    </aside>
  );
}
