"use client";

import { useState } from "react";
import type { ToolCall } from "@/types/hermes";

export interface ToolTimelineProps {
  toolCalls: ToolCall[];
}

type ToolStatus = "running" | "success" | "error";

function getToolStatus(call: ToolCall): ToolStatus {
  if (!call.result) return "running";
  return call.result.success ? "success" : "error";
}

function formatDuration(start: string, end: string): string {
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function toolIcon(name: string): string {
  if (/terminal|bash|shell|exec/i.test(name)) return "terminal";
  if (/file|read|write|fs/i.test(name)) return "folder_open";
  if (/search|grep|find/i.test(name)) return "search";
  if (/todo|task/i.test(name)) return "checklist";
  if (/web|http|fetch|browse/i.test(name)) return "language";
  if (/agent|delegate|spawn/i.test(name)) return "smart_toy";
  if (/memory|recall|store/i.test(name)) return "memory";
  return "build";
}

interface TimelineEntryProps {
  call: ToolCall;
}

function TimelineEntry({ call }: TimelineEntryProps) {
  const [open, setOpen] = useState(false);
  const status = getToolStatus(call);

  const statusColors: Record<ToolStatus, string> = {
    running: "bg-yellow-900/40 text-yellow-400 border-yellow-800/40",
    success: "bg-green-900/40 text-green-400 border-green-800/40",
    error: "bg-red-900/40 text-status-error border-red-800/40",
  };

  const statusLabel: Record<ToolStatus, string> = {
    running: "running",
    success: "success",
    error: "error",
  };

  const duration =
    call.result?.returnedAt
      ? formatDuration(call.calledAt, call.result.returnedAt)
      : null;

  return (
    <li className="border border-border-subtle rounded-xl overflow-hidden">
      {/* Entry header — always visible */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 px-4 py-2.5 bg-surface-container hover:bg-surface-container-high transition-colors text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        aria-expanded={open}
        aria-label={`${call.name} — ${statusLabel[status]}${duration ? `, ${duration}` : ""}`}
      >
        <span className="material-symbols-outlined text-[1.125rem] text-text-muted" aria-hidden="true">
          {toolIcon(call.name)}
        </span>
        <span className="font-code text-[0.8125rem] text-on-surface font-medium flex-1 truncate">
          {call.name}
        </span>
        <span
          className={[
            "px-2 py-0.5 rounded-full font-code text-[0.6875rem] font-bold border",
            statusColors[status],
          ].join(" ")}
        >
          {statusLabel[status]}
        </span>
        {duration && (
          <span className="text-[0.6875rem] text-text-muted font-code">{duration}</span>
        )}
        <span
          className={[
            "material-symbols-outlined text-[1rem] text-text-muted transition-transform",
            open ? "rotate-180" : "",
          ].join(" ")}
          aria-hidden="true"
        >
          expand_more
        </span>
      </button>

      {/* Expandable detail */}
      <div className={["tool-timeline-body", open ? "expanded" : ""].join(" ")}>
        <div className="px-4 py-3 bg-surface-container-lowest border-t border-border-subtle space-y-3">
          {/* Parameters */}
          {call.arguments && call.arguments !== "{}" && (
            <div>
              <p className="text-[0.6875rem] uppercase tracking-wider text-text-muted mb-1">Parameters</p>
              <pre className="font-code text-[0.75rem] text-on-surface-variant bg-surface-container rounded-lg p-3 overflow-x-auto whitespace-pre-wrap">
                {(() => {
                  try {
                    return JSON.stringify(JSON.parse(call.arguments), null, 2);
                  } catch {
                    return call.arguments;
                  }
                })()}
              </pre>
            </div>
          )}

          {/* Result snippet */}
          {call.result?.output && (
            <div>
              <p className="text-[0.6875rem] uppercase tracking-wider text-text-muted mb-1">Result</p>
              <pre className="font-code text-[0.75rem] text-on-surface-variant bg-surface-container rounded-lg p-3 overflow-x-auto whitespace-pre-wrap max-h-40 overflow-y-auto">
                {call.result.output.length > 800
                  ? call.result.output.slice(0, 800) + "\n… (truncated)"
                  : call.result.output}
              </pre>
            </div>
          )}

          {/* Timestamp */}
          <p className="text-[0.6875rem] text-text-muted font-code">
            {new Date(call.calledAt).toLocaleTimeString()}
            {duration && ` · ${duration}`}
          </p>
        </div>
      </div>
    </li>
  );
}

export function ToolTimeline({ toolCalls }: ToolTimelineProps) {
  const [open, setOpen] = useState(false);

  if (toolCalls.length === 0) return null;

  const doneCount = toolCalls.filter((c) => c.result).length;

  return (
    <div className="mt-3 rounded-xl border border-primary/20 overflow-hidden">
      {/* Timeline toggle header */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-4 py-2.5 bg-surface-container-lowest hover:bg-surface-container transition-colors text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        aria-expanded={open}
        aria-label={`Tool calls: ${doneCount} of ${toolCalls.length} complete`}
      >
        <span className="material-symbols-outlined text-[1rem] text-primary" aria-hidden="true">
          timeline
        </span>
        <span className="text-[0.75rem] font-bold uppercase tracking-wider text-primary">
          {toolCalls.length} tool call{toolCalls.length !== 1 ? "s" : ""}
        </span>
        <span className="text-[0.6875rem] text-text-muted ml-1">
          ({doneCount} complete)
        </span>
        <span
          className={[
            "material-symbols-outlined text-[1rem] text-text-muted ml-auto transition-transform",
            open ? "rotate-180" : "",
          ].join(" ")}
          aria-hidden="true"
        >
          expand_more
        </span>
      </button>

      {/* Entries */}
      <div className={["tool-timeline-body", open ? "expanded" : ""].join(" ")}>
        <ul className="px-3 py-3 space-y-2 bg-surface-container-lowest">
          {toolCalls.map((call) => (
            <TimelineEntry key={call.id} call={call} />
          ))}
        </ul>
      </div>
    </div>
  );
}
