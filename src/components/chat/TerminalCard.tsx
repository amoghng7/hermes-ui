"use client";

import { useState, useMemo } from "react";

export interface TerminalCardProps {
  /** Raw terminal output text. */
  output: string;
  /** Tool name that produced this output (e.g. "terminal", "bash"). */
  toolName?: string;
  /** Exit code of the command, if known. */
  exitCode?: number;
  /** Optional command that was run. */
  command?: string;
}

const COLLAPSE_THRESHOLD = 20;
const VIRTUALIZE_THRESHOLD = 100;
const VIRTUAL_VISIBLE_LINES = 60;

export function TerminalCard({
  output,
  toolName = "terminal",
  exitCode,
  command,
}: TerminalCardProps) {
  const [expanded, setExpanded] = useState(false);

  const lines = useMemo(() => output.split("\n"), [output]);
  const shouldCollapse = lines.length > COLLAPSE_THRESHOLD;
  const shouldVirtualize = lines.length > VIRTUALIZE_THRESHOLD;

  const visibleLines = useMemo(() => {
    if (!shouldCollapse || expanded) {
      return shouldVirtualize ? lines.slice(0, VIRTUAL_VISIBLE_LINES) : lines;
    }
    return lines.slice(0, COLLAPSE_THRESHOLD);
  }, [lines, expanded, shouldCollapse, shouldVirtualize]);

  const exitSuccess = exitCode === undefined || exitCode === 0;

  return (
    <div className="rounded-xl overflow-hidden border border-border-default my-2">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-surface-container-highest border-b border-border-subtle">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[1rem] text-text-muted" aria-hidden="true">
            terminal
          </span>
          <span className="font-code text-[0.75rem] text-text-muted uppercase tracking-wider">
            {toolName}
          </span>
          {command && (
            <code className="font-code text-[0.75rem] text-on-surface-variant truncate max-w-[30ch]">
              {command}
            </code>
          )}
        </div>
        <div className="flex items-center gap-2">
          {exitCode !== undefined && (
            <span
              className={[
                "px-2 py-0.5 rounded-full font-code text-[0.6875rem] font-bold",
                exitSuccess
                  ? "bg-green-900/40 text-green-400 border border-green-800/40"
                  : "bg-red-900/40 text-status-error border border-red-800/40",
              ].join(" ")}
              aria-label={`Exit code ${exitCode}`}
            >
              exit {exitCode}
            </span>
          )}
          {shouldCollapse && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="text-[0.75rem] text-text-muted hover:text-on-surface transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              aria-expanded={expanded}
              aria-label={expanded ? "Collapse output" : "Expand full output"}
            >
              {expanded ? "collapse" : `+${lines.length - COLLAPSE_THRESHOLD} more`}
            </button>
          )}
        </div>
      </div>

      {/* Output */}
      <div
        className="bg-terminal-bg px-4 py-3 overflow-x-auto"
        style={{ maxHeight: expanded || !shouldCollapse ? "none" : "12rem" }}
      >
        <pre className="font-code text-[0.8125rem] text-on-surface leading-relaxed whitespace-pre">
          {visibleLines.join("\n")}
          {shouldVirtualize && (expanded || !shouldCollapse) && lines.length > VIRTUAL_VISIBLE_LINES && (
            <span className="block text-text-muted italic mt-2">
              … {lines.length - VIRTUAL_VISIBLE_LINES} more lines (virtualized)
            </span>
          )}
        </pre>
      </div>
    </div>
  );
}

/**
 * Attempt to detect a terminal-style tool result from raw content.
 * Returns parsed fields when detected, or null otherwise.
 */
export function parseTerminalContent(content: string): {
  output: string;
  exitCode?: number;
  command?: string;
} | null {
  // JSON-wrapped result: { output: "...", exit_code: 0, command: "..." }
  try {
    const parsed = JSON.parse(content) as unknown;
    if (parsed && typeof parsed === "object") {
      const p = parsed as Record<string, unknown>;
      if (typeof p["output"] === "string" || typeof p["stdout"] === "string") {
        return {
          output: (typeof p["output"] === "string" ? p["output"] : (p["stdout"] as string)) ?? "",
          exitCode: typeof p["exit_code"] === "number" ? p["exit_code"] : undefined,
          command: typeof p["command"] === "string" ? p["command"] : undefined,
        };
      }
    }
  } catch {
    // Not JSON — fall through to pattern matching
  }

  // Markdown fenced code block: ```bash\n...\n```
  const fencedMatch = /^```(?:bash|sh|shell|zsh|fish)\n([\s\S]*?)```$/m.exec(content);
  if (fencedMatch) {
    return { output: fencedMatch[1] ?? "" };
  }

  return null;
}
