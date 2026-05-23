"use client";

/**
 * SessionAgentsPanel — right-side aside panel displaying live subagent state.
 *
 * Replaces the hardcoded swarm-topology SVG in ChatWorkspace with a
 * real-time list of agents that have been spawned for the current session
 * via `delegate_task` calls.  Reads from the Zustand store (populated by
 * the ChatWorkspace streaming loop) and shows an empty state for sessions
 * that run as a single agent.
 *
 * Clicking an agent card opens AgentDetailDrawer overlaid on this panel.
 */

import { useState } from "react";
import { useAgents } from "@/store/hooks";
import type { Agent } from "@/types/hermes";
import { AgentDetailDrawer } from "@/components/agents/AgentDetailDrawer";

// ---------------------------------------------------------------------------
// Status helpers
// ---------------------------------------------------------------------------

type AgentStatus = Agent["status"];

function statusLabel(status: AgentStatus): string {
  switch (status) {
    case "idle":    return "IDLE";
    case "active":  return "RUNNING";
    case "waiting": return "SYNTHESIZING";
    case "done":    return "DONE";
    case "error":   return "ERROR";
  }
}

function statusBadgeClass(status: AgentStatus): string {
  switch (status) {
    case "idle":
      return "bg-surface-container-high text-text-muted border-border-subtle";
    case "active":
      return "bg-primary/10 text-primary border-primary/30";
    case "waiting":
      return "bg-yellow-900/30 text-yellow-400 border-yellow-800/40";
    case "done":
      return "bg-green-900/30 text-green-400 border-green-800/40";
    case "error":
      return "bg-red-900/30 text-status-error border-red-800/40";
  }
}

/** Deterministic hue from a string name — same name always → same color.
 *  Uses 31 as the multiplier, a common prime for polynomial rolling hashes.
 *  `>>> 0` converts to an unsigned 32-bit integer to guarantee a non-negative result. */
function nameToHue(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  }
  return hash % 360;
}

// ---------------------------------------------------------------------------
// AgentCard
// ---------------------------------------------------------------------------

interface AgentCardProps {
  agent: Agent;
  onClick: () => void;
}

function AgentCard({ agent, onClick }: AgentCardProps) {
  const [toolsExpanded, setToolsExpanded] = useState(false);
  const isActive = agent.status === "active" || agent.status === "waiting";
  const hue = nameToHue(agent.name);
  const accentColor = `hsl(${hue} 50% 65%)`;

  return (
    <button
      type="button"
      className="agent-card rounded-2xl overflow-hidden cursor-pointer hover:border-primary/30 transition-colors group w-full text-left"
      onClick={onClick}
      aria-label={`Agent: ${agent.name}, status: ${statusLabel(agent.status)}`}
    >
      {/* Card header */}
      <div className="px-4 pt-3 pb-2 flex items-start gap-3">
        {/* Avatar */}
        <div
          className="w-9 h-9 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5"
          style={{
            borderColor: `hsl(${hue} 50% 45%)`,
            background: `hsl(${hue} 30% 20%)`,
            boxShadow: `0 0 10px hsl(${hue} 50% 40% / 25%)`,
          }}
          aria-hidden="true"
        >
          <span className="material-symbols-outlined text-sm" style={{ color: accentColor }}>
            smart_toy
          </span>
        </div>

        {/* Name + description */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-h1 text-sm font-semibold text-on-surface leading-tight truncate">
              {agent.name}
            </p>
            {/* Status badge */}
            <span
              className={[
                "inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[0.625rem] font-bold uppercase tracking-wider border",
                statusBadgeClass(agent.status),
              ].join(" ")}
            >
              {isActive && (
                <span className="w-1 h-1 rounded-full bg-current animate-pulse" aria-hidden="true" />
              )}
              {statusLabel(agent.status)}
            </span>
          </div>

          {agent.description && (
            <p className="text-[0.6875rem] text-text-muted mt-0.5 line-clamp-2 leading-snug">
              {agent.description}
            </p>
          )}

          {agent.task && !agent.description && (
            <p className="text-[0.6875rem] text-text-muted mt-0.5 line-clamp-2 leading-snug">
              {agent.task}
            </p>
          )}
        </div>
      </div>

      {/* Meta row: origin + timestamp + tool count */}
      <div className="px-4 pb-2 flex items-center gap-3 text-[0.625rem] text-text-muted">
        {agent.parentAgentId && (
          <span className="flex items-center gap-1 truncate">
            <span className="material-symbols-outlined text-[0.75rem]" aria-hidden="true">account_tree</span>
            <span className="truncate">{agent.parentAgentId}</span>
          </span>
        )}
        {agent.tools && agent.tools.length > 0 && (
          <button
            type="button"
            className="flex items-center gap-1 hover:text-on-surface transition-colors ml-auto focus-visible:outline-none"
            onClick={(e) => {
              e.stopPropagation();
              setToolsExpanded((v) => !v);
            }}
            aria-expanded={toolsExpanded}
            aria-label={`${agent.tools.length} tools — ${toolsExpanded ? "collapse" : "expand"}`}
          >
            <span className="material-symbols-outlined text-[0.75rem]" aria-hidden="true">build</span>
            {agent.tools.length} tool{agent.tools.length !== 1 ? "s" : ""}
            <span
              className={["material-symbols-outlined text-[0.75rem] transition-transform", toolsExpanded ? "rotate-180" : ""].join(" ")}
              aria-hidden="true"
            >
              expand_more
            </span>
          </button>
        )}
        {(!agent.tools || agent.tools.length === 0) && (
          <span className="ml-auto text-[0.6875rem] font-code">
            {new Date(agent.updatedAt).toLocaleTimeString()}
          </span>
        )}
      </div>

      {/* Tool list (hover/expand) */}
      {toolsExpanded && agent.tools && agent.tools.length > 0 && (
        <div
          className="px-4 pb-3 flex flex-wrap gap-1"
          onClick={(e) => e.stopPropagation()}
        >
          {agent.tools.map((tool) => (
            <span
              key={tool}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-surface-container border border-border-subtle text-[0.625rem] text-on-surface-variant font-code"
            >
              <span className="material-symbols-outlined text-[0.75rem] text-text-muted" aria-hidden="true">build</span>
              {tool}
            </span>
          ))}
        </div>
      )}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

function EmptyState({ sessionId }: { sessionId: string | null }) {
  if (!sessionId) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center px-6">
        <span className="material-symbols-outlined text-4xl text-text-muted" aria-hidden="true">
          hub
        </span>
        <p className="text-sm text-text-muted">
          Select a session to see agent activity.
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center px-6">
      <span className="material-symbols-outlined text-4xl text-text-muted" aria-hidden="true">
        smart_toy
      </span>
      <p className="text-sm font-medium text-on-surface-variant">
        Running as single agent
      </p>
      <p className="text-xs text-text-muted leading-relaxed">
        Subagents spawned via <span className="font-code text-primary">delegate_task</span> will
        appear here in real time.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Panel
// ---------------------------------------------------------------------------

export interface SessionAgentsPanelProps {
  sessionId: string | null;
}

export function SessionAgentsPanel({ sessionId }: SessionAgentsPanelProps) {
  const agents = useAgents(sessionId);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);

  const activeCount = agents.filter(
    (a) => a.status === "active" || a.status === "waiting"
  ).length;

  return (
    <aside
      aria-label="Swarm topology"
      className="hidden xl:flex xl:w-[35%] glass-panel rounded-3xl flex-col overflow-hidden relative"
    >
      {/* Panel header */}
      <div className="p-6 border-b border-border-subtle flex-shrink-0">
        <h3 className="font-h1 text-xl font-semibold text-on-surface">
          Swarm Agents
        </h3>
        <div className="flex gap-2 mt-2 flex-wrap">
          <span className="px-3 py-1 rounded-full bg-primary/10 text-primary text-[0.6875rem] uppercase font-bold tracking-wider">
            {agents.length === 0 ? "Single Agent" : `${agents.length} Agent${agents.length !== 1 ? "s" : ""}`}
          </span>
          {activeCount > 0 && (
            <span className="px-3 py-1 rounded-full bg-surface-container text-primary text-[0.6875rem] uppercase font-bold tracking-wider flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" aria-hidden="true" />
              {activeCount} active
            </span>
          )}
          {agents.length > 0 && activeCount === 0 && (
            <span className="px-3 py-1 rounded-full bg-surface-container text-text-muted text-[0.6875rem] uppercase font-bold tracking-wider">
              Live Status
            </span>
          )}
        </div>
      </div>

      {/* Agent list or empty state */}
      {agents.length > 0 ? (
        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-3">
          {agents.map((agent) => (
            <AgentCard
              key={agent.id}
              agent={agent}
              onClick={() => setSelectedAgent(agent)}
            />
          ))}
        </div>
      ) : (
        <EmptyState sessionId={sessionId} />
      )}

      {/* Detail drawer — overlays the panel content */}
      {selectedAgent !== null && (
        <AgentDetailDrawer
          agent={selectedAgent}
          onClose={() => setSelectedAgent(null)}
        />
      )}
    </aside>
  );
}
