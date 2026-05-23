"use client";

/**
 * AgentDetailPanel — center column for the /agents page.
 *
 * Shows the full identity card, role/system-prompt viewer, tool list with
 * call statistics, and token usage breakdown for the selected agent.
 * Empty state when no agent is selected.
 */

import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import Link from "next/link";
import type { Session, ToolCall } from "@/types/hermes";
import type { AgentWithSession } from "@/components/agents/AgentListPanel";

// ---------------------------------------------------------------------------
// Status helpers
// ---------------------------------------------------------------------------

type AgentStatus = AgentWithSession["status"];

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

/** Deterministic hue from agent name — same name → same colour. */
function nameToHue(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  }
  return hash % 360;
}

/** Format a relative time string for last-called display. */
function formatRelativeTime(isoString: string): string {
  const now = Date.now();
  const then = new Date(isoString).getTime();
  if (Number.isNaN(then)) return "unknown";
  if (then > now) return new Date(isoString).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60_000);
  const diffHr = Math.floor(diffMin / 60);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  return new Date(isoString).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

// ---------------------------------------------------------------------------
// Copy hook
// ---------------------------------------------------------------------------

function useCopyToClipboard(text: string) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current);
    };
  }, []);

  const copy = useCallback(() => {
    if (!navigator.clipboard) return;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      if (timerRef.current !== null) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setCopied(false), 2000);
    }).catch(() => undefined);
  }, [text]);

  return { copied, copy };
}

// ---------------------------------------------------------------------------
// ToolRow
// ---------------------------------------------------------------------------

interface ToolRowProps {
  toolName: string;
  callCount: number;
  lastCalledAt: string | null;
}

function ToolRow({ toolName, callCount, lastCalledAt }: ToolRowProps) {
  return (
    <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-surface-container-low border border-border-subtle">
      {/* Icon */}
      <div
        className="w-7 h-7 rounded-lg bg-surface-container flex items-center justify-center flex-shrink-0"
        aria-hidden="true"
      >
        <span className="material-symbols-outlined text-[0.875rem] text-text-muted">
          build
        </span>
      </div>

      {/* Name */}
      <span className="flex-1 font-code text-[0.8125rem] text-on-surface truncate">
        {toolName}
      </span>

      {/* Stats */}
      <div className="flex items-center gap-3 flex-shrink-0">
        {callCount > 0 && (
          <span className="text-[0.6875rem] text-text-muted font-code">
            ×{callCount}
          </span>
        )}
        {lastCalledAt && (
          <span className="text-[0.6875rem] text-text-muted">
            {formatRelativeTime(lastCalledAt)}
          </span>
        )}
        {callCount === 0 && (
          <span className="text-[0.6875rem] text-text-muted/50">
            not called
          </span>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SystemPromptViewer
// ---------------------------------------------------------------------------

interface SystemPromptViewerProps {
  content: string;
  label: string;
}

function SystemPromptViewer({ content, label }: SystemPromptViewerProps) {
  const { copied, copy } = useCopyToClipboard(content);

  return (
    <section aria-label={label}>
      <div className="flex items-center justify-between mb-2">
        <p className="text-[0.625rem] uppercase tracking-wider text-text-muted font-bold">
          {label}
        </p>
        <button
          type="button"
          onClick={copy}
          aria-label={copied ? "Copied" : "Copy to clipboard"}
          className="flex items-center gap-1 px-2 py-1 rounded-lg text-[0.6875rem] text-text-muted hover:text-on-surface hover:bg-surface-container transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <span
            className="material-symbols-outlined text-[0.875rem]"
            aria-hidden="true"
          >
            {copied ? "check" : "content_copy"}
          </span>
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <div className="relative rounded-xl overflow-hidden border border-border-subtle">
        <pre className="bg-terminal-bg p-4 text-[0.8125rem] font-code text-on-surface-variant leading-relaxed overflow-y-auto max-h-56 custom-scrollbar whitespace-pre-wrap break-words">
          {content}
        </pre>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// TokenUsageBar
// ---------------------------------------------------------------------------

interface TokenUsageBarProps {
  input: number;
  output: number;
}

function TokenUsageBar({ input, output }: TokenUsageBarProps) {
  const total = input + output;
  const inputPct = total > 0 ? Math.round((input / total) * 100) : 50;
  const outputPct = 100 - inputPct;

  return (
    <section aria-label="Token usage">
      <p className="text-[0.625rem] uppercase tracking-wider text-text-muted font-bold mb-3">
        Token usage
      </p>
      {/* Bar */}
      <div
        className="h-2 rounded-full overflow-hidden bg-surface-container-high mb-3 flex"
        role="img"
        aria-label={`Token usage: ${inputPct}% prompt, ${outputPct}% completion`}
      >
        <div
          className="h-full rounded-l-full bg-primary/70"
          style={{ width: `${inputPct}%` }}
        />
        <div className="h-full bg-secondary/50" style={{ width: `${outputPct}%` }} />
      </div>
      {/* Legend */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <span
            className="w-2 h-2 rounded-full bg-primary/70 flex-shrink-0"
            aria-hidden="true"
          />
          <span className="text-[0.6875rem] text-text-muted">Prompt</span>
          <span className="font-code text-[0.8125rem] text-on-surface font-medium">
            {input.toLocaleString()}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span
            className="w-2 h-2 rounded-full bg-secondary/50 flex-shrink-0"
            aria-hidden="true"
          />
          <span className="text-[0.6875rem] text-text-muted">Completion</span>
          <span className="font-code text-[0.8125rem] text-on-surface font-medium">
            {output.toLocaleString()}
          </span>
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <span className="text-[0.6875rem] text-text-muted">Total</span>
          <span className="font-code text-[0.8125rem] text-primary font-medium">
            {total.toLocaleString()}
          </span>
        </div>
      </div>
      {/* Percentage labels */}
      <div className="flex justify-between mt-1">
        <span className="text-[0.625rem] text-text-muted/60 font-code">
          {inputPct}% prompt
        </span>
        <span className="text-[0.625rem] text-text-muted/60 font-code">
          {outputPct}% completion
        </span>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// EmptyState
// ---------------------------------------------------------------------------

function EmptyState() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center px-8">
      <div
        className="w-16 h-16 rounded-full bg-surface-container-high flex items-center justify-center"
        aria-hidden="true"
      >
        <span className="material-symbols-outlined text-3xl text-text-muted">
          person_search
        </span>
      </div>
      <div>
        <p className="text-base font-semibold text-on-surface-variant">
          No agent selected
        </p>
        <p className="text-[0.875rem] text-text-muted mt-1 leading-relaxed">
          Select an agent from the list to inspect its identity, prompt, and
          tool usage.
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Panel
// ---------------------------------------------------------------------------

export interface AgentDetailPanelProps {
  agent: AgentWithSession | null;
  session: Session | null;
  toolCalls: ToolCall[];
}

export function AgentDetailPanel({
  agent,
  session,
  toolCalls,
}: AgentDetailPanelProps) {
  // Compute per-tool stats from session tool calls
  const toolStats = useMemo(() => {
    const map = new Map<string, { count: number; lastCalledAt: string | null }>();
    for (const call of toolCalls) {
      if (!map.has(call.name)) map.set(call.name, { count: 0, lastCalledAt: null });
      const s = map.get(call.name)!;
      s.count++;
      if (!s.lastCalledAt || call.calledAt > s.lastCalledAt) {
        s.lastCalledAt = call.calledAt;
      }
    }
    return map;
  }, [toolCalls]);

  if (agent === null) {
    return (
      <main
        aria-label="Agent detail"
        className="flex-1 glass-panel rounded-3xl flex flex-col overflow-hidden"
      >
        <EmptyState />
      </main>
    );
  }

  const hue = nameToHue(agent.name);
  const isActive = agent.status === "active" || agent.status === "waiting";
  const initial = agent.name.charAt(0).toUpperCase();

  // System prompt: prefer description (role definition), then task (assigned work)
  const systemPrompt = agent.description ?? agent.task ?? null;

  return (
    <main
      aria-label={`Agent detail: ${agent.name}`}
      className="flex-1 glass-panel rounded-3xl flex flex-col overflow-hidden"
    >
      {/* ── Scrollable body ──────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">

        {/* ── Identity card ──────────────────────────────────────────────── */}
        <div className="p-6 border-b border-border-subtle">
          <div className="agent-card rounded-2xl p-5">
            <div className="flex items-start gap-4">
              {/* Avatar */}
              <div
                className={[
                  "w-14 h-14 rounded-2xl border-2 flex items-center justify-center flex-shrink-0 text-xl font-bold",
                  isActive ? "avatar-glow" : "",
                ].join(" ")}
                style={{
                  borderColor: `hsl(${hue} 50% 45%)`,
                  background: `hsl(${hue} 30% 18%)`,
                  color: `hsl(${hue} 55% 68%)`,
                }}
                aria-hidden="true"
              >
                {initial}
              </div>

              {/* Name + status */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start gap-3 flex-wrap">
                  <h1 className="font-h1 text-lg font-semibold text-on-surface leading-tight">
                    {agent.name}
                  </h1>
                  <span
                    className={[
                      "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[0.625rem] font-bold uppercase tracking-wider border",
                      statusBadgeClass(agent.status),
                    ].join(" ")}
                  >
                    {isActive && (
                      <span
                        className="w-1.5 h-1.5 rounded-full bg-current animate-pulse"
                        aria-hidden="true"
                      />
                    )}
                    {statusLabel(agent.status)}
                  </span>
                </div>

                {agent.description && (
                  <p className="text-[0.875rem] text-on-surface-variant mt-1.5 leading-relaxed">
                    {agent.description}
                  </p>
                )}

                {/* Meta row */}
                <div className="flex items-center gap-4 mt-3 flex-wrap">
                  {/* Session link */}
                  {session && (
                    <Link
                      href={["/s", agent.sessionId].join("/")}
                      className="inline-flex items-center gap-1.5 text-[0.75rem] text-text-muted hover:text-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
                    >
                      <span
                        className="material-symbols-outlined text-[0.875rem]"
                        aria-hidden="true"
                      >
                        chat
                      </span>
                      <span className="truncate max-w-[12rem]">
                        {session.title}
                      </span>
                      <span
                        className="material-symbols-outlined text-[0.75rem]"
                        aria-hidden="true"
                      >
                        open_in_new
                      </span>
                    </Link>
                  )}

                  {/* Parent agent */}
                  {agent.parentAgentId && (
                    <span className="inline-flex items-center gap-1 text-[0.75rem] text-text-muted">
                      <span
                        className="material-symbols-outlined text-[0.875rem]"
                        aria-hidden="true"
                      >
                        account_tree
                      </span>
                      Delegated by{" "}
                      <span className="text-primary font-code text-[0.6875rem]">
                        {agent.parentAgentId}
                      </span>
                    </span>
                  )}

                  {/* Last updated */}
                  <span className="text-[0.6875rem] text-text-muted font-code ml-auto">
                    Updated{" "}
                    {new Date(agent.updatedAt).toLocaleTimeString(undefined, {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Detail sections ─────────────────────────────────────────────── */}
        <div className="p-6 space-y-8">

          {/* Task */}
          {agent.task && agent.task !== agent.description && (
            <section aria-label="Assigned task">
              <p className="text-[0.625rem] uppercase tracking-wider text-text-muted font-bold mb-2">
                Assigned task
              </p>
              <p className="text-[0.875rem] text-on-surface-variant leading-relaxed whitespace-pre-wrap">
                {agent.task}
              </p>
            </section>
          )}

          {/* System prompt / role instructions */}
          {systemPrompt && (
            <SystemPromptViewer
              content={systemPrompt}
              label="Role / Instructions"
            />
          )}

          {/* Tool list */}
          {agent.tools && agent.tools.length > 0 && (
            <section aria-label="Session tool activity">
              <p className="text-[0.625rem] uppercase tracking-wider text-text-muted font-bold mb-3">
                Session tool activity ({agent.tools.length})
              </p>
              <div className="flex flex-col gap-2">
                {agent.tools.map((toolName) => {
                  const stats = toolStats.get(toolName);
                  return (
                    <ToolRow
                      key={toolName}
                      toolName={toolName}
                      callCount={stats?.count ?? 0}
                      lastCalledAt={stats?.lastCalledAt ?? null}
                    />
                  );
                })}
              </div>
            </section>
          )}

          {/* Token usage */}
          {agent.tokenUsage && (
            <TokenUsageBar
              input={agent.tokenUsage.input}
              output={agent.tokenUsage.output}
            />
          )}

          {/* Empty tools + no prompt placeholder */}
          {!systemPrompt && (!agent.tools || agent.tools.length === 0) && !agent.tokenUsage && (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <span
                className="material-symbols-outlined text-3xl text-text-muted/40"
                aria-hidden="true"
              >
                info
              </span>
              <p className="text-[0.875rem] text-text-muted">
                No additional detail available for this agent.
              </p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
