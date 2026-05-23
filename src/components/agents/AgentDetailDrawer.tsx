"use client";

/**
 * AgentDetailDrawer — slide-in overlay inside the Swarm Agents aside panel.
 *
 * Shows full detail for a selected agent: role / system prompt, tool list,
 * token usage, and available actions.  Renders as an absolute-positioned
 * layer over the parent aside so the chat panel is never obscured.
 */

import { useEffect, useRef } from "react";
import type { Agent } from "@/types/hermes";

export interface AgentDetailDrawerProps {
  agent: Agent;
  onClose: () => void;
}

function statusLabel(status: Agent["status"]): string {
  switch (status) {
    case "idle":    return "IDLE";
    case "active":  return "RUNNING";
    case "waiting": return "SYNTHESIZING";
    case "done":    return "DONE";
    case "error":   return "ERROR";
  }
}

function statusColor(status: Agent["status"]): string {
  switch (status) {
    case "idle":    return "bg-surface-container-high text-text-muted border-border-subtle";
    case "active":  return "bg-primary/10 text-primary border-primary/30";
    case "waiting": return "bg-yellow-900/30 text-yellow-400 border-yellow-800/40";
    case "done":    return "bg-green-900/30 text-green-400 border-green-800/40";
    case "error":   return "bg-red-900/30 text-status-error border-red-800/40";
  }
}

export function AgentDetailDrawer({ agent, onClose }: AgentDetailDrawerProps) {
  const isActive = agent.status === "active" || agent.status === "waiting";
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  // Move focus to the close button when the drawer opens, and restore on close.
  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    closeBtnRef.current?.focus();
    return () => {
      if (previouslyFocused && document.contains(previouslyFocused)) {
        try {
          previouslyFocused.focus();
        } catch {
          // Element may have become non-focusable; ignore.
        }
      }
    };
  }, []);

  // Close on Escape key.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    /* Overlay fills the parent aside */
    <div
      className="absolute inset-0 z-30 flex flex-col bg-surface-glass-heavy backdrop-blur-sm"
      role="region"
      aria-label={`Agent details: ${agent.name}`}
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-border-subtle">
        <button
          ref={closeBtnRef}
          type="button"
          onClick={onClose}
          aria-label="Close agent details"
          className="p-1.5 rounded-lg hover:bg-surface-container transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <span className="material-symbols-outlined text-[1.25rem] text-text-muted" aria-hidden="true">
            arrow_back
          </span>
        </button>
        <div className="flex-1 min-w-0">
          <h4 className="font-h1 text-base font-semibold text-on-surface truncate">
            {agent.name}
          </h4>
          {agent.parentAgentId && (
            <p className="text-[0.6875rem] text-text-muted truncate">
              Delegated by <span className="text-primary">{agent.parentAgentId}</span>
            </p>
          )}
        </div>
        {/* Status badge */}
        <span
          className={[
            "px-2 py-0.5 rounded-full text-[0.6875rem] font-bold uppercase tracking-wider border flex items-center gap-1",
            statusColor(agent.status),
          ].join(" ")}
        >
          {isActive && (
            <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" aria-hidden="true" />
          )}
          {statusLabel(agent.status)}
        </span>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto custom-scrollbar px-5 py-4 space-y-5">

        {/* Role / system prompt */}
        {(agent.description ?? agent.task) && (
          <section aria-label="Agent role">
            <p className="text-[0.6875rem] uppercase tracking-wider text-text-muted mb-2">Role</p>
            <p className="text-sm text-on-surface-variant leading-relaxed whitespace-pre-wrap">
              {agent.description ?? agent.task}
            </p>
          </section>
        )}

        {/* Task */}
        {agent.task && agent.description && agent.task !== agent.description && (
          <section aria-label="Agent task">
            <p className="text-[0.6875rem] uppercase tracking-wider text-text-muted mb-2">Task</p>
            <p className="text-sm text-on-surface-variant leading-relaxed whitespace-pre-wrap">
              {agent.task}
            </p>
          </section>
        )}

        {/* Tools */}
        {agent.tools && agent.tools.length > 0 && (
          <section aria-label="Agent tools">
            <p className="text-[0.6875rem] uppercase tracking-wider text-text-muted mb-2">
              Tools ({agent.tools.length})
            </p>
            <ul className="flex flex-wrap gap-1.5">
              {agent.tools.map((tool) => (
                <li key={tool}>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-surface-container border border-border-subtle text-[0.6875rem] text-on-surface-variant font-code">
                    <span className="material-symbols-outlined text-[0.875rem] text-text-muted" aria-hidden="true">
                      build
                    </span>
                    {tool}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Token usage */}
        {agent.tokenUsage && (
          <section aria-label="Token usage">
            <p className="text-[0.6875rem] uppercase tracking-wider text-text-muted mb-2">Token usage</p>
            <div className="flex gap-4">
              <div className="bg-surface-container rounded-xl px-3 py-2 text-center">
                <p className="text-xs text-text-muted">Input</p>
                <p className="font-code text-sm text-on-surface font-medium">{agent.tokenUsage.input.toLocaleString()}</p>
              </div>
              <div className="bg-surface-container rounded-xl px-3 py-2 text-center">
                <p className="text-xs text-text-muted">Output</p>
                <p className="font-code text-sm text-on-surface font-medium">{agent.tokenUsage.output.toLocaleString()}</p>
              </div>
            </div>
          </section>
        )}

        {/* Last seen */}
        <p className="text-[0.6875rem] text-text-muted font-code pt-1">
          Last updated: {new Date(agent.updatedAt).toLocaleTimeString()}
        </p>
      </div>
    </div>
  );
}
