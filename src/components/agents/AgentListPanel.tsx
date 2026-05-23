"use client";

/**
 * AgentListPanel — left-column panel for the /agents page.
 *
 * Renders all agents across all sessions with an optional session filter
 * and a per-agent row showing identity, status, and owning session.
 */

import { useMemo } from "react";
import type { Agent, Session } from "@/types/hermes";

// ---------------------------------------------------------------------------
// Shared augmented type — exported for use by sibling panels
// ---------------------------------------------------------------------------

/** Agent extended with the sessionId it was spawned under. */
export interface AgentWithSession extends Agent {
  sessionId: string;
}

// ---------------------------------------------------------------------------
// Status helpers
// ---------------------------------------------------------------------------

function statusLabel(status: Agent["status"]): string {
  switch (status) {
    case "idle":    return "IDLE";
    case "active":  return "RUNNING";
    case "waiting": return "SYNTHESIZING";
    case "done":    return "DONE";
    case "error":   return "ERROR";
  }
}

function statusDotClass(status: Agent["status"]): string {
  switch (status) {
    case "idle":    return "bg-outline";
    case "active":  return "bg-primary animate-pulse";
    case "waiting": return "bg-yellow-400 animate-pulse";
    case "done":    return "bg-green-400";
    case "error":   return "bg-status-error";
  }
}

/** Deterministic hue from agent name — same name → same colour. */
function nameToHue(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  }
  return hash % 360;
}

// ---------------------------------------------------------------------------
// AgentListItem
// ---------------------------------------------------------------------------

interface AgentListItemProps {
  agent: AgentWithSession;
  sessionTitle: string;
  isSelected: boolean;
  onClick: () => void;
}

function AgentListItem({ agent, sessionTitle, isSelected, onClick }: AgentListItemProps) {
  const hue = useMemo(() => nameToHue(agent.name), [agent.name]);
  const isActive = agent.status === "active" || agent.status === "waiting";

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={isSelected}
      aria-label={[
        "Agent:",
        agent.name,
        "· status:",
        statusLabel(agent.status),
        "· session:",
        sessionTitle,
      ].join(" ")}
      className={[
        "w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
        isSelected
          ? "bg-primary/10 ring-1 ring-primary/30"
          : "hover:bg-hover-subtle",
      ].join(" ")}
    >
      {/* Avatar */}
      <div
        className={[
          "w-8 h-8 rounded-full border-2 flex items-center justify-center flex-shrink-0",
          isActive ? "avatar-glow" : "",
        ].join(" ")}
        style={{
          borderColor: `hsl(${hue} 50% 45%)`,
          background: `hsl(${hue} 30% 20%)`,
        }}
        aria-hidden="true"
      >
        <span
          className="material-symbols-outlined text-[14px]"
          style={{ color: `hsl(${hue} 55% 68%)` }}
        >
          smart_toy
        </span>
      </div>

      {/* Text info */}
      <div className="flex-1 min-w-0">
        {/* Name row */}
        <div className="flex items-center gap-1.5">
          <span
            className={[
              "w-2 h-2 rounded-full flex-shrink-0",
              statusDotClass(agent.status),
            ].join(" ")}
            aria-hidden="true"
          />
          <span
            className={[
              "font-h1 text-[0.8125rem] font-semibold truncate",
              isSelected ? "text-primary" : "text-on-surface",
            ].join(" ")}
          >
            {agent.name}
          </span>
        </div>

        {/* Status + session row */}
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className="text-[10px] uppercase font-bold tracking-wider text-text-muted">
            {statusLabel(agent.status)}
          </span>
          <span className="text-text-muted text-[10px]" aria-hidden="true">·</span>
          <span className="text-[11px] text-text-muted truncate font-code">
            {sessionTitle}
          </span>
        </div>
      </div>

      {/* Chevron for selected */}
      {isSelected && (
        <span
          className="material-symbols-outlined text-[1rem] text-primary flex-shrink-0"
          aria-hidden="true"
        >
          chevron_right
        </span>
      )}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Panel
// ---------------------------------------------------------------------------

export interface AgentListPanelProps {
  agentsWithSession: AgentWithSession[];
  sessions: Session[];
  filterSessionId: string | null;
  onFilterSession: (id: string | null) => void;
  selectedAgentId: string | null;
  onSelectAgent: (id: string) => void;
}

export function AgentListPanel({
  agentsWithSession,
  sessions,
  filterSessionId,
  onFilterSession,
  selectedAgentId,
  onSelectAgent,
}: AgentListPanelProps) {
  const sessionMap = useMemo(() => {
    const m = new Map<string, Session>();
    for (const s of sessions) m.set(s.id, s);
    return m;
  }, [sessions]);

  const filtered = useMemo(
    () =>
      filterSessionId
        ? agentsWithSession.filter((a) => a.sessionId === filterSessionId)
        : agentsWithSession,
    [agentsWithSession, filterSessionId],
  );

  const activeCount = useMemo(
    () =>
      filtered.filter(
        (a) => a.status === "active" || a.status === "waiting",
      ).length,
    [filtered],
  );

  const hasMultipleSessions = sessions.length > 1;

  return (
    <aside
      aria-label="Agent list"
      className="hidden lg:flex lg:w-1/5 flex-col gap-0 bg-surface-container rounded-3xl overflow-hidden border border-border-subtle"
    >
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="px-5 pt-5 pb-4 flex items-center justify-between flex-shrink-0">
        <h2 className="font-h2 text-xl font-semibold text-primary">Agents</h2>
        {activeCount > 0 && (
          <span className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-primary/10 text-primary text-[0.625rem] font-bold uppercase tracking-wider">
            <span
              className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"
              aria-hidden="true"
            />
            {activeCount} active
          </span>
        )}
      </div>

      {/* ── Session filter ──────────────────────────────────────────────────── */}
      {hasMultipleSessions && (
        <div className="px-4 pb-3 flex-shrink-0 border-b border-border-subtle">
          <p className="text-[0.625rem] uppercase tracking-wider text-text-muted px-1 mb-1.5">
            Filter by session
          </p>
          <div className="flex flex-col gap-0.5 max-h-36 overflow-y-auto custom-scrollbar">
            <button
              type="button"
              onClick={() => onFilterSession(null)}
              className={[
                "flex items-center gap-2 px-3 py-1.5 rounded-xl text-[0.75rem] text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                filterSessionId === null
                  ? "bg-primary/10 text-primary"
                  : "text-on-surface-variant hover:bg-hover-subtle",
              ].join(" ")}
            >
              <span
                className="material-symbols-outlined text-[0.875rem]"
                aria-hidden="true"
              >
                layers
              </span>
              All sessions
            </button>
            {sessions.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => onFilterSession(s.id)}
                className={[
                  "flex items-center gap-2 px-3 py-1.5 rounded-xl text-[0.75rem] text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                  filterSessionId === s.id
                    ? "bg-primary/10 text-primary"
                    : "text-on-surface-variant hover:bg-hover-subtle",
                ].join(" ")}
              >
                <span
                  className="material-symbols-outlined text-[0.875rem] flex-shrink-0"
                  aria-hidden="true"
                >
                  chat
                </span>
                <span className="truncate">{s.title}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Agent list ──────────────────────────────────────────────────────── */}
      <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-3 flex flex-col gap-0.5">
        {agentsWithSession.length === 0 ? (
          /* Global empty state */
          <div className="flex flex-col items-center justify-center gap-3 text-center flex-1 py-12 px-4">
            <span
              className="material-symbols-outlined text-5xl text-primary/30"
              aria-hidden="true"
            >
              hub
            </span>
            <p className="text-[0.9375rem] font-semibold text-on-surface">
              No agents yet
            </p>
            <p className="text-[0.8125rem] text-text-muted leading-relaxed">
              Agents will appear once sessions spawn subagents via{" "}
              <span className="font-code text-primary">delegate_task</span>.
            </p>
          </div>
        ) : filtered.length === 0 ? (
          /* Filtered empty state */
          <div className="flex flex-col items-center justify-center gap-2 py-12 px-4 text-center">
            <span
              className="material-symbols-outlined text-4xl text-text-muted/50"
              aria-hidden="true"
            >
              filter_list_off
            </span>
            <p className="text-[0.875rem] text-text-muted">
              No agents in this session.
            </p>
          </div>
        ) : (
          filtered.map((agent) => (
            <AgentListItem
              key={[agent.sessionId, agent.id].join("/")}
              agent={agent}
              sessionTitle={
                sessionMap.get(agent.sessionId)?.title ?? agent.sessionId
              }
              isSelected={selectedAgentId === `${agent.sessionId}/${agent.id}`}
              onClick={() => onSelectAgent(`${agent.sessionId}/${agent.id}`)}
            />
          ))
        )}
      </div>

      {/* ── Footer count ─────────────────────────────────────────────────────── */}
      {filtered.length > 0 && (
        <div className="px-5 py-3 border-t border-border-subtle flex-shrink-0">
          <p className="text-[0.625rem] uppercase tracking-wider text-text-muted">
            {filtered.length} agent{filtered.length !== 1 ? "s" : ""}
            {filterSessionId ? " in session" : " total"}
          </p>
        </div>
      )}
    </aside>
  );
}
