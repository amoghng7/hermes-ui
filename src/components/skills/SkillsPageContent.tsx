"use client";

/**
 * SkillsPageContent — the full /skills page.
 *
 * Three tabs:
 *   Installed   — skills loaded from the Hermes gateway with enable/disable/remove
 *   MCP Servers — configured MCP servers with status, tools, and add-server form
 *   Marketplace — community catalog with search, filter, and install
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useHermesStore } from "@/store/hermesStore";
import type { McpServer, Skill } from "@/types/hermes";
import {
  listSkills,
  listMcpServers,
  toggleSkill,
  deleteSkill,
  addMcpServer,
  toggleMcpServer,
} from "@/lib/hermesClient";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Tab = "installed" | "mcp" | "marketplace";

interface MarketplaceSkill {
  id: string;
  name: string;
  description: string;
  version: string;
  categories: string[];
  tags: string[];
  author: string;
  stars: number;
  installed: boolean;
}

// ---------------------------------------------------------------------------
// Static marketplace catalog (demo — replace with real registry fetch)
// ---------------------------------------------------------------------------

const MARKETPLACE_CATALOG: MarketplaceSkill[] = [
  {
    id: "web-search",
    name: "Web Search",
    description: "Search the web and retrieve up-to-date information using DuckDuckGo.",
    version: "2.1.0",
    categories: ["search", "web"],
    tags: ["search", "ddg", "web"],
    author: "hermes-community",
    stars: 412,
    installed: false,
  },
  {
    id: "code-executor",
    name: "Code Executor",
    description: "Execute Python snippets in a sandboxed environment and return stdout/stderr.",
    version: "1.4.2",
    categories: ["code", "execution"],
    tags: ["python", "sandbox", "repl"],
    author: "hermes-community",
    stars: 387,
    installed: false,
  },
  {
    id: "file-manager",
    name: "File Manager",
    description: "Read, write, list, and delete files on the host filesystem within allowed paths.",
    version: "1.0.5",
    categories: ["files", "system"],
    tags: ["fs", "read", "write"],
    author: "hermes-community",
    stars: 298,
    installed: false,
  },
  {
    id: "browser-control",
    name: "Browser Control",
    description: "Automate browser interactions — click, type, screenshot via Playwright MCP.",
    version: "0.9.1",
    categories: ["browser", "automation"],
    tags: ["playwright", "web", "scrape"],
    author: "hermes-labs",
    stars: 241,
    installed: false,
  },
  {
    id: "memory-retriever",
    name: "Memory Retriever",
    description: "Semantic search over the agent's long-term memory store.",
    version: "1.2.0",
    categories: ["memory", "rag"],
    tags: ["vector", "embedding", "retrieval"],
    author: "hermes-community",
    stars: 188,
    installed: false,
  },
  {
    id: "slack-integration",
    name: "Slack Integration",
    description: "Send messages, read channels, and manage threads in Slack workspaces.",
    version: "1.1.0",
    categories: ["messaging", "integration"],
    tags: ["slack", "chat", "notifications"],
    author: "hermes-community",
    stars: 156,
    installed: false,
  },
  {
    id: "github-tools",
    name: "GitHub Tools",
    description: "Manage GitHub repos, issues, PRs, and CI workflows from within Hermes.",
    version: "1.3.0",
    categories: ["code", "devops"],
    tags: ["github", "git", "ci"],
    author: "hermes-labs",
    stars: 344,
    installed: false,
  },
  {
    id: "sql-query",
    name: "SQL Query",
    description: "Execute SQL queries against connected databases (PostgreSQL, SQLite, MySQL).",
    version: "1.0.2",
    categories: ["database", "query"],
    tags: ["sql", "db", "postgres"],
    author: "hermes-community",
    stars: 177,
    installed: false,
  },
];

const ALL_CATEGORIES = Array.from(
  new Set(MARKETPLACE_CATALOG.flatMap((s) => s.categories))
).sort();

// ---------------------------------------------------------------------------
// Small reusable UI primitives
// ---------------------------------------------------------------------------

function Tag({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[0.625rem] font-bold uppercase tracking-wider bg-primary/10 text-primary border border-primary/20">
      {label}
    </span>
  );
}

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={[
        "relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        checked ? "bg-primary" : "bg-surface-container-high",
      ].join(" ")}
    >
      <span
        aria-hidden="true"
        className={[
          "pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-lg transform ring-0 transition duration-200 ease-in-out",
          checked ? "translate-x-4" : "translate-x-0",
        ].join(" ")}
      />
    </button>
  );
}

function EmptyState({
  icon,
  title,
  body,
}: {
  icon: string;
  title: string;
  body: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 text-center flex-1 py-16 px-6">
      <span className="material-symbols-outlined text-5xl text-primary/30" aria-hidden="true">
        {icon}
      </span>
      <p className="text-[0.9375rem] font-semibold text-on-surface">{title}</p>
      <p className="text-[0.8125rem] text-text-muted leading-relaxed max-w-xs">{body}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Installed Skills tab
// ---------------------------------------------------------------------------

interface SkillCardProps {
  skill: Skill;
  onToggle: (id: string, enabled: boolean) => Promise<void>;
  onRemove: (id: string) => void;
  onLoadToSession: (id: string) => void;
  hasActiveSession: boolean;
}

function SkillCard({ skill, onToggle, onRemove, onLoadToSession, hasActiveSession }: SkillCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);

  const handleToggle = async (v: boolean) => {
    setToggling(true);
    try {
      await onToggle(skill.id, v);
    } finally {
      setToggling(false);
    }
  };

  return (
    <div
      className={[
        "rounded-2xl border transition-colors",
        skill.enabled
          ? "border-primary/20 bg-surface-container"
          : "border-border-subtle bg-surface-container-low opacity-70",
      ].join(" ")}
    >
      {/* Card header */}
      <div className="flex items-start gap-3 px-4 pt-4 pb-3">
        {/* Icon */}
        <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
          <span className="material-symbols-outlined text-[18px] text-primary" aria-hidden="true">
            extension
          </span>
        </div>

        {/* Name + meta */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-h1 text-[0.9375rem] font-semibold text-on-surface truncate">
              {skill.name}
            </span>
            {skill.version && (
              <span className="text-[0.625rem] font-code text-text-muted bg-surface-container-high px-1.5 py-0.5 rounded">
                v{skill.version}
              </span>
            )}
          </div>
          <p className="text-[0.8125rem] text-on-surface-variant leading-snug mt-0.5 line-clamp-2">
            {skill.description}
          </p>
          {/* Tags */}
          {skill.tags && skill.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {skill.tags.map((t) => (
                <Tag key={t} label={t} />
              ))}
            </div>
          )}
        </div>

        {/* Toggle */}
        <div className="flex flex-col items-end gap-2 flex-shrink-0 ml-2">
          <Toggle
            checked={skill.enabled}
            onChange={handleToggle}
            label={`${skill.enabled ? "Disable" : "Enable"} ${skill.name}`}
          />
          {toggling && (
            <span className="text-[0.625rem] text-text-muted">saving…</span>
          )}
        </div>
      </div>

      {/* Actions bar */}
      <div className="flex items-center gap-2 px-4 pb-3 border-t border-border-subtle pt-3">
        <button
          type="button"
          onClick={() => setExpanded((p) => !p)}
          aria-expanded={expanded}
          className="flex items-center gap-1 text-[0.75rem] text-on-surface-variant hover:text-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
        >
          <span
            className={[
              "material-symbols-outlined text-[1rem] transition-transform",
              expanded ? "rotate-90" : "",
            ].join(" ")}
            aria-hidden="true"
          >
            chevron_right
          </span>
          {expanded ? "Hide instructions" : "Show instructions"}
        </button>

        <div className="flex-1" />

        {hasActiveSession && (
          <button
            type="button"
            onClick={() => onLoadToSession(skill.id)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[0.75rem] text-on-surface-variant hover:text-primary hover:bg-primary/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <span className="material-symbols-outlined text-[0.875rem]" aria-hidden="true">
              chat_add_on
            </span>
            Load into chat
          </button>
        )}

        {confirmRemove ? (
          <div className="flex items-center gap-2">
            <span className="text-[0.75rem] text-status-error">Remove skill?</span>
            <button
              type="button"
              onClick={() => onRemove(skill.id)}
              className="px-2.5 py-1 rounded-lg text-[0.75rem] bg-status-error/10 text-status-error hover:bg-status-error/20 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-status-error"
            >
              Confirm
            </button>
            <button
              type="button"
              onClick={() => setConfirmRemove(false)}
              className="px-2.5 py-1 rounded-lg text-[0.75rem] text-on-surface-variant hover:bg-hover-subtle transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmRemove(true)}
            aria-label={`Remove ${skill.name}`}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[0.75rem] text-text-muted hover:text-status-error hover:bg-status-error/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-status-error"
          >
            <span className="material-symbols-outlined text-[0.875rem]" aria-hidden="true">
              delete
            </span>
            Remove
          </button>
        )}
      </div>

      {/* Expanded instructions */}
      {expanded && (
        <div className="px-4 pb-4 border-t border-border-subtle pt-3">
          <p className="text-[0.625rem] uppercase tracking-wider text-text-muted mb-2">
            Instructions
          </p>
          <pre className="text-[0.8125rem] font-code text-on-surface-variant bg-surface-container-high rounded-xl p-3 whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto custom-scrollbar">
            {skill.instructions ?? skill.description}
          </pre>
        </div>
      )}
    </div>
  );
}

function InstalledTab({
  skills,
  loading,
  error,
  onToggle,
  onRemove,
  onLoadToSession,
  hasActiveSession,
}: {
  skills: Skill[];
  loading: boolean;
  error: string | null;
  onToggle: (id: string, enabled: boolean) => Promise<void>;
  onRemove: (id: string) => void;
  onLoadToSession: (id: string) => void;
  hasActiveSession: boolean;
}) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 gap-3 text-text-muted">
        <span className="material-symbols-outlined animate-spin text-2xl text-primary" aria-hidden="true">
          refresh
        </span>
        <span className="text-[0.875rem]">Loading skills…</span>
      </div>
    );
  }
  if (error) {
    return (
      <EmptyState
        icon="error"
        title="Failed to load skills"
        body={error}
      />
    );
  }
  if (skills.length === 0) {
    return (
      <EmptyState
        icon="extension_off"
        title="No skills installed"
        body="Skills extend what Hermes agents can do. Browse the Marketplace tab to discover and install skills."
      />
    );
  }
  return (
    <div className="flex flex-col gap-3">
      {skills.map((s) => (
        <SkillCard
          key={s.id}
          skill={s}
          onToggle={onToggle}
          onRemove={onRemove}
          onLoadToSession={onLoadToSession}
          hasActiveSession={hasActiveSession}
        />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// MCP Servers tab
// ---------------------------------------------------------------------------

interface McpServerCardProps {
  server: McpServer;
  onToggle: (id: string, enabled: boolean) => Promise<void>;
}

function McpServerCard({ server, onToggle }: McpServerCardProps) {
  const [toggling, setToggling] = useState(false);

  const isEnabled = server.enabled !== false;
  const ping = server.pingStatus ?? (server.connected ? "online" : "offline");

  const handleToggle = async (v: boolean) => {
    setToggling(true);
    try {
      await onToggle(server.id, v);
    } finally {
      setToggling(false);
    }
  };

  return (
    <div
      className={[
        "rounded-2xl border",
        isEnabled
          ? "border-border-default bg-surface-container"
          : "border-border-subtle bg-surface-container-low opacity-70",
      ].join(" ")}
    >
      <div className="flex items-start gap-3 px-4 pt-4 pb-3">
        {/* Icon */}
        <div className="w-9 h-9 rounded-xl bg-secondary/10 border border-secondary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
          <span className="material-symbols-outlined text-[18px] text-secondary" aria-hidden="true">
            device_hub
          </span>
        </div>

        {/* Meta */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-h1 text-[0.9375rem] font-semibold text-on-surface">
              {server.name}
            </span>
            {/* Ping badge */}
            <span
              className={[
                "flex items-center gap-1 px-2 py-0.5 rounded-full text-[0.625rem] font-bold uppercase tracking-wider",
                ping === "online"
                  ? "bg-green-500/10 text-green-400 border border-green-500/20"
                  : ping === "offline"
                  ? "bg-status-error/10 text-status-error border border-status-error/20"
                  : "bg-surface-container-high text-text-muted border border-border-subtle",
              ].join(" ")}
            >
              <span
                className={[
                  "w-1.5 h-1.5 rounded-full",
                  ping === "online"
                    ? "bg-green-400 animate-pulse"
                    : ping === "offline"
                    ? "bg-status-error"
                    : "bg-text-muted",
                ].join(" ")}
                aria-hidden="true"
              />
              {ping}
            </span>
            {/* Transport badge */}
            {server.transport && (
              <span className="text-[0.625rem] font-code text-text-muted bg-surface-container-high px-1.5 py-0.5 rounded">
                {server.transport}
              </span>
            )}
          </div>

          {/* URL or command */}
          {(server.url || server.command) && (
            <p className="text-[0.75rem] font-code text-text-muted mt-0.5 truncate">
              {server.transport === "stdio" && server.command
                ? server.command
                : server.url}
            </p>
          )}

          {/* Exposed tools */}
          {server.tools && server.tools.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {server.tools.slice(0, 6).map((t) => (
                <span
                  key={t}
                  className="inline-flex items-center px-2 py-0.5 rounded-full text-[0.625rem] font-code bg-secondary/10 text-secondary border border-secondary/20"
                >
                  {t}
                </span>
              ))}
              {server.tools.length > 6 && (
                <span className="text-[0.625rem] text-text-muted self-center">
                  +{server.tools.length - 6} more
                </span>
              )}
            </div>
          )}

          {/* Last error */}
          {server.lastError && (
            <p className="text-[0.75rem] text-status-error mt-1.5 flex items-start gap-1">
              <span className="material-symbols-outlined text-[0.875rem] flex-shrink-0 mt-0.5" aria-hidden="true">
                error
              </span>
              {server.lastError}
            </p>
          )}
        </div>

        {/* Toggle */}
        <div className="flex flex-col items-end gap-2 flex-shrink-0 ml-2">
          <Toggle
            checked={isEnabled}
            onChange={handleToggle}
            label={`${isEnabled ? "Disable" : "Enable"} ${server.name}`}
          />
          {toggling && (
            <span className="text-[0.625rem] text-text-muted">saving…</span>
          )}
        </div>
      </div>
    </div>
  );
}

function AddMcpServerForm({ onAdd }: { onAdd: (server: McpServer) => void }) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [transport, setTransport] = useState<"stdio" | "http">("http");
  const nameRef = useRef<HTMLInputElement>(null);
  const urlRef = useRef<HTMLInputElement>(null);
  const commandRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = nameRef.current?.value.trim() ?? "";
    const url = urlRef.current?.value.trim() ?? "";
    const command = commandRef.current?.value.trim() ?? "";

    if (!name) { setError("Name is required."); return; }
    if (transport === "http" && !url) { setError("URL is required for HTTP transport."); return; }
    if (transport === "stdio" && !command) { setError("Command is required for stdio transport."); return; }

    setError(null);
    setSubmitting(true);
    try {
      const server = await addMcpServer({ name, transport, url: url || undefined, command: command || undefined });
      onAdd(server);
      setOpen(false);
      if (nameRef.current) nameRef.current.value = "";
      if (urlRef.current) urlRef.current.value = "";
      if (commandRef.current) commandRef.current.value = "";
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to add server.";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-4 py-3 rounded-2xl border border-dashed border-border-default text-on-surface-variant hover:text-primary hover:border-primary/40 hover:bg-primary/5 transition-colors w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <span className="material-symbols-outlined text-[1.25rem]" aria-hidden="true">add_circle</span>
        <span className="text-[0.875rem] font-medium">Add MCP Server</span>
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="rounded-2xl border border-primary/30 bg-surface-container p-4 flex flex-col gap-3"
      aria-label="Add MCP server form"
    >
      <div className="flex items-center justify-between">
        <h3 className="font-h1 text-[0.9375rem] font-semibold text-on-surface">Add MCP Server</h3>
        <button
          type="button"
          onClick={() => { setOpen(false); setError(null); }}
          aria-label="Cancel"
          className="p-1 rounded-lg text-text-muted hover:text-on-surface hover:bg-hover-subtle transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <span className="material-symbols-outlined text-[1rem]" aria-hidden="true">close</span>
        </button>
      </div>

      {/* Name */}
      <div className="flex flex-col gap-1">
        <label htmlFor="mcp-name" className="text-[0.75rem] text-on-surface-variant font-medium">
          Name <span aria-hidden="true" className="text-status-error">*</span>
        </label>
        <input
          id="mcp-name"
          ref={nameRef}
          type="text"
          placeholder="My MCP Server"
          required
          className="px-3 py-2 rounded-xl bg-surface-container-high border border-border-default text-[0.875rem] text-on-surface placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      {/* Transport */}
      <div className="flex flex-col gap-1">
        <span className="text-[0.75rem] text-on-surface-variant font-medium">Transport</span>
        <div className="flex gap-2">
          {(["http", "stdio"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTransport(t)}
              className={[
                "flex-1 py-2 rounded-xl text-[0.8125rem] font-medium border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                transport === t
                  ? "bg-primary/10 text-primary border-primary/30"
                  : "bg-surface-container-high text-on-surface-variant border-border-default hover:bg-hover-subtle",
              ].join(" ")}
            >
              {t.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* URL or Command */}
      {transport === "http" ? (
        <div className="flex flex-col gap-1">
          <label htmlFor="mcp-url" className="text-[0.75rem] text-on-surface-variant font-medium">
            URL <span aria-hidden="true" className="text-status-error">*</span>
          </label>
          <input
            id="mcp-url"
            ref={urlRef}
            type="url"
            placeholder="https://mcp.example.com/sse"
            required
            className="px-3 py-2 rounded-xl bg-surface-container-high border border-border-default text-[0.875rem] text-on-surface placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
      ) : (
        <div className="flex flex-col gap-1">
          <label htmlFor="mcp-command" className="text-[0.75rem] text-on-surface-variant font-medium">
            Command <span aria-hidden="true" className="text-status-error">*</span>
          </label>
          <input
            id="mcp-command"
            ref={commandRef}
            type="text"
            placeholder="npx @my-org/mcp-server"
            required
            className="px-3 py-2 rounded-xl bg-surface-container-high border border-border-default text-[0.875rem] font-code text-on-surface placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
      )}

      {error && (
        <p role="alert" className="text-[0.75rem] text-status-error flex items-center gap-1">
          <span className="material-symbols-outlined text-[0.875rem]" aria-hidden="true">error</span>
          {error}
        </p>
      )}

      <div className="flex gap-2 justify-end pt-1">
        <button
          type="button"
          onClick={() => { setOpen(false); setError(null); }}
          className="px-4 py-2 rounded-xl text-[0.875rem] text-on-surface-variant hover:bg-hover-subtle transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="px-4 py-2 rounded-xl text-[0.875rem] font-medium bg-primary text-on-primary hover:bg-primary/90 disabled:opacity-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          {submitting ? "Adding…" : "Add Server"}
        </button>
      </div>
    </form>
  );
}

function McpTab({
  servers,
  loading,
  error,
  onToggle,
  onAdd,
}: {
  servers: McpServer[];
  loading: boolean;
  error: string | null;
  onToggle: (id: string, enabled: boolean) => Promise<void>;
  onAdd: (server: McpServer) => void;
}) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 gap-3 text-text-muted">
        <span className="material-symbols-outlined animate-spin text-2xl text-primary" aria-hidden="true">
          refresh
        </span>
        <span className="text-[0.875rem]">Loading MCP servers…</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {error && (
        <div className="rounded-xl bg-status-error/10 border border-status-error/20 px-4 py-3 text-[0.8125rem] text-status-error flex items-start gap-2">
          <span className="material-symbols-outlined text-[1rem] flex-shrink-0 mt-0.5" aria-hidden="true">error</span>
          {error}
        </div>
      )}
      {servers.length === 0 && !error ? (
        <EmptyState
          icon="device_hub"
          title="No MCP servers configured"
          body="MCP servers expose tools to Hermes agents over stdio or HTTP. Add your first server below."
        />
      ) : (
        servers.map((s) => (
          <McpServerCard key={s.id} server={s} onToggle={onToggle} />
        ))
      )}
      <AddMcpServerForm onAdd={onAdd} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Marketplace tab
// ---------------------------------------------------------------------------

function MarketplaceSkillCard({
  skill,
  onInstall,
  installing,
}: {
  skill: MarketplaceSkill;
  onInstall: (id: string) => void;
  installing: boolean;
}) {
  return (
    <div className="rounded-2xl border border-border-default bg-surface-container hover:border-primary/30 transition-colors">
      <div className="flex items-start gap-3 px-4 pt-4 pb-4">
        <div className="w-9 h-9 rounded-xl bg-tertiary/10 border border-tertiary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
          <span className="material-symbols-outlined text-[18px] text-tertiary" aria-hidden="true">
            extension
          </span>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-h1 text-[0.9375rem] font-semibold text-on-surface">
              {skill.name}
            </span>
            <span className="text-[0.625rem] font-code text-text-muted bg-surface-container-high px-1.5 py-0.5 rounded">
              v{skill.version}
            </span>
            <div className="flex items-center gap-1 text-text-muted ml-auto">
              <span className="material-symbols-outlined text-[0.875rem]" aria-hidden="true">star</span>
              <span className="text-[0.75rem]">{skill.stars}</span>
            </div>
          </div>
          <p className="text-[0.8125rem] text-on-surface-variant leading-snug mt-0.5">
            {skill.description}
          </p>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {skill.tags.map((t) => <Tag key={t} label={t} />)}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between px-4 pb-3 border-t border-border-subtle pt-3">
        <span className="text-[0.75rem] text-text-muted">
          by{" "}
          <span className="font-code text-on-surface-variant">{skill.author}</span>
        </span>
        {skill.installed ? (
          <span className="flex items-center gap-1 px-3 py-1 rounded-lg text-[0.75rem] bg-primary/10 text-primary border border-primary/20">
            <span className="material-symbols-outlined text-[0.875rem]" aria-hidden="true">check_circle</span>
            Installed
          </span>
        ) : (
          <button
            type="button"
            onClick={() => onInstall(skill.id)}
            disabled={installing}
            className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-[0.75rem] font-medium bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 disabled:opacity-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <span className="material-symbols-outlined text-[0.875rem]" aria-hidden="true">
              {installing ? "refresh" : "download"}
            </span>
            {installing ? "Installing…" : "Install"}
          </button>
        )}
      </div>
    </div>
  );
}

function MarketplaceTab({ onInstalled }: { onInstalled: () => void }) {
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [catalog, setCatalog] = useState<MarketplaceSkill[]>(MARKETPLACE_CATALOG);
  const [installingId, setInstallingId] = useState<string | null>(null);

  const filtered = catalog.filter((s) => {
    const matchesSearch =
      !search ||
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.description.toLowerCase().includes(search.toLowerCase()) ||
      s.tags.some((t) => t.toLowerCase().includes(search.toLowerCase()));
    const matchesCategory =
      !activeCategory || s.categories.includes(activeCategory);
    return matchesSearch && matchesCategory;
  });

  const handleInstall = (id: string) => {
    setInstallingId(id);
    // Optimistic update — marks the skill as installed in local catalog state.
    // A real install API call would go here once the backend endpoint is available.
    setCatalog((prev) =>
      prev.map((s) => (s.id === id ? { ...s, installed: true } : s))
    );
    onInstalled();
    setInstallingId(null);
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Search + filter row */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <span
            className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[1.125rem] text-text-muted pointer-events-none"
            aria-hidden="true"
          >
            search
          </span>
          <input
            type="search"
            placeholder="Search skills…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-xl bg-surface-container-high border border-border-default text-[0.875rem] text-on-surface placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        {/* Category chips */}
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setActiveCategory(null)}
            className={[
              "px-3 py-1.5 rounded-full text-[0.75rem] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
              activeCategory === null
                ? "bg-primary/10 text-primary border border-primary/30"
                : "bg-surface-container-high text-on-surface-variant hover:bg-hover-subtle border border-border-default",
            ].join(" ")}
          >
            All
          </button>
          {ALL_CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setActiveCategory(activeCategory === cat ? null : cat)}
              className={[
                "px-3 py-1.5 rounded-full text-[0.75rem] font-medium capitalize transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                activeCategory === cat
                  ? "bg-primary/10 text-primary border border-primary/30"
                  : "bg-surface-container-high text-on-surface-variant hover:bg-hover-subtle border border-border-default",
              ].join(" ")}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Results */}
      {filtered.length === 0 ? (
        <EmptyState
          icon="search_off"
          title="No skills found"
          body="Try a different search term or category filter."
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {filtered.map((s) => (
            <MarketplaceSkillCard
              key={s.id}
              skill={s}
              onInstall={handleInstall}
              installing={installingId === s.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Top-level page
// ---------------------------------------------------------------------------

export function SkillsPageContent() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>("installed");

  // Store state
  const storeSkills = useHermesStore((s) => s.skills);
  const storeMcpServers = useHermesStore((s) => s.mcpServers);
  const activeSessionId = useHermesStore((s) => s.activeSessionId);

  // Local copies — optimistically updated
  const [skills, setSkills] = useState<Skill[]>(storeSkills);
  const [mcpServers, setMcpServers] = useState<McpServer[]>(storeMcpServers);

  const [skillsLoading, setSkillsLoading] = useState(false);
  const [skillsError, setSkillsError] = useState<string | null>(null);
  const [mcpLoading, setMcpLoading] = useState(false);
  const [mcpError, setMcpError] = useState<string | null>(null);

  // Ref-backed re-fetch so callbacks can trigger a refresh without becoming
  // effect dependencies themselves (avoids react-hooks/set-state-in-effect).
  const refetchSkills = useRef<() => void>(() => undefined);
  const refetchMcp = useRef<() => void>(() => undefined);

  useEffect(() => {
    let cancelled = false;

    const doFetchSkills = async () => {
      setSkillsLoading(true);
      setSkillsError(null);
      try {
        const data = await listSkills();
        if (!cancelled) {
          setSkills(data);
          useHermesStore.setState({ skills: data });
        }
      } catch (err: unknown) {
        if (!cancelled) {
          const msg = err instanceof Error ? err.message : "Failed to load skills.";
          setSkillsError(msg);
          setSkills(useHermesStore.getState().skills);
        }
      } finally {
        if (!cancelled) setSkillsLoading(false);
      }
    };

    const doFetchMcp = async () => {
      setMcpLoading(true);
      setMcpError(null);
      try {
        const data = await listMcpServers();
        if (!cancelled) {
          setMcpServers(data);
          useHermesStore.setState({ mcpServers: data });
        }
      } catch (err: unknown) {
        if (!cancelled) {
          const msg = err instanceof Error ? err.message : "Failed to load MCP servers.";
          setMcpError(msg);
          setMcpServers(useHermesStore.getState().mcpServers);
        }
      } finally {
        if (!cancelled) setMcpLoading(false);
      }
    };

    refetchSkills.current = doFetchSkills;
    refetchMcp.current = doFetchMcp;

    doFetchSkills();
    doFetchMcp();

    return () => { cancelled = true; };
  }, []);

  // ── Skill actions ─────────────────────────────────────────────────────────

  const handleToggleSkill = useCallback(async (id: string, enabled: boolean) => {
    // Optimistic update
    setSkills((prev) => prev.map((s) => s.id === id ? { ...s, enabled } : s));
    try {
      const updated = await toggleSkill(id, enabled);
      setSkills((prev) => prev.map((s) => s.id === id ? updated : s));
    } catch {
      // Revert on failure
      setSkills((prev) => prev.map((s) => s.id === id ? { ...s, enabled: !enabled } : s));
    }
  }, []);

  const handleRemoveSkill = useCallback(async (id: string) => {
    // Optimistic removal
    setSkills((prev) => prev.filter((s) => s.id !== id));
    try {
      await deleteSkill(id);
    } catch {
      // Revert: re-fetch via ref
      refetchSkills.current();
    }
  }, []);

  const handleLoadToSession = useCallback(() => {
    // Navigate to the chat view where the skill will be active in the
    // current session context. A dedicated API call to inject the skill
    // into the running session context can be added once the endpoint is
    // available; for now we route to the Interaction page.
    router.push("/");
  }, [router]);

  // ── MCP actions ───────────────────────────────────────────────────────────

  const handleToggleMcp = useCallback(async (id: string, enabled: boolean) => {
    setMcpServers((prev) =>
      prev.map((s) => s.id === id ? { ...s, enabled } : s)
    );
    try {
      const updated = await toggleMcpServer(id, enabled);
      setMcpServers((prev) => prev.map((s) => s.id === id ? updated : s));
    } catch {
      setMcpServers((prev) =>
        prev.map((s) => s.id === id ? { ...s, enabled: !enabled } : s)
      );
    }
  }, []);

  const handleAddMcpServer = useCallback((server: McpServer) => {
    setMcpServers((prev) => [...prev, server]);
  }, []);

  // ── Tab config ────────────────────────────────────────────────────────────

  const tabs: { id: Tab; label: string; icon: string; badge?: number }[] = [
    { id: "installed", label: "Installed", icon: "extension", badge: skills.length > 0 ? skills.length : undefined },
    { id: "mcp", label: "MCP Servers", icon: "device_hub", badge: mcpServers.length > 0 ? mcpServers.length : undefined },
    { id: "marketplace", label: "Marketplace", icon: "storefront" },
  ];

  return (
    <div className="flex-1 flex flex-col min-h-0 max-w-3xl w-full mx-auto">
      {/* Page header */}
      <div className="flex items-center gap-3 mb-6 flex-shrink-0">
        <div className="w-10 h-10 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
          <span className="material-symbols-outlined text-[1.25rem] text-primary" aria-hidden="true">
            extension
          </span>
        </div>
        <div>
          <h1 className="font-h1 text-xl font-semibold text-on-surface leading-tight">
            Skills &amp; MCP
          </h1>
          <p className="text-[0.8125rem] text-text-muted">
            Manage capabilities available to Hermes agents
          </p>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 mb-5 bg-surface-container rounded-2xl p-1 flex-shrink-0" role="tablist" aria-label="Skills sections">
        {tabs.map((tab) => {
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              id={`tab-${tab.id}`}
              aria-selected={active}
              aria-controls={`tabpanel-${tab.id}`}
              onClick={() => setActiveTab(tab.id)}
              className={[
                "flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-[0.8125rem] font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                active
                  ? "bg-surface-container-lowest text-primary shadow-sm"
                  : "text-on-surface-variant hover:text-on-surface hover:bg-hover-subtle",
              ].join(" ")}
            >
              <span className="material-symbols-outlined text-[1rem]" aria-hidden="true">
                {tab.icon}
              </span>
              <span className="hidden sm:inline">{tab.label}</span>
              {tab.badge !== undefined && tab.badge > 0 && (
                <span
                  className={[
                    "inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1 rounded-full text-[0.625rem] font-bold",
                    active
                      ? "bg-primary/20 text-primary"
                      : "bg-surface-container-high text-text-muted",
                  ].join(" ")}
                  aria-label={`${tab.badge} items`}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab panels */}
      <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar pb-4">
        <div
          id="tabpanel-installed"
          role="tabpanel"
          aria-labelledby="tab-installed"
          hidden={activeTab !== "installed"}
        >
          {activeTab === "installed" && (
            <InstalledTab
              skills={skills}
              loading={skillsLoading}
              error={skillsError}
              onToggle={handleToggleSkill}
              onRemove={handleRemoveSkill}
              onLoadToSession={handleLoadToSession}
              hasActiveSession={activeSessionId !== null}
            />
          )}
        </div>

        <div
          id="tabpanel-mcp"
          role="tabpanel"
          aria-labelledby="tab-mcp"
          hidden={activeTab !== "mcp"}
        >
          {activeTab === "mcp" && (
            <McpTab
              servers={mcpServers}
              loading={mcpLoading}
              error={mcpError}
              onToggle={handleToggleMcp}
              onAdd={handleAddMcpServer}
            />
          )}
        </div>

        <div
          id="tabpanel-marketplace"
          role="tabpanel"
          aria-labelledby="tab-marketplace"
          hidden={activeTab !== "marketplace"}
        >
          {activeTab === "marketplace" && (
            <MarketplaceTab onInstalled={() => refetchSkills.current()} />
          )}
        </div>
      </div>
    </div>
  );
}
