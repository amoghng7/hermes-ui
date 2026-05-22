"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { useSessions } from "@/store/hooks";
import { useHermesStore } from "@/store/hermesStore";
import type { Session } from "@/types/hermes";

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------

function formatRelativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60_000);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin} min ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay === 1) return "Yesterday";
  if (diffDay < 7) return `${diffDay} days ago`;
  return new Date(dateStr).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

type DateGroup = "Today" | "Yesterday" | "This Week" | "Older";

function getDateGroup(dateStr: string): DateGroup {
  const now = new Date();
  const then = new Date(dateStr);

  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfYesterday = new Date(startOfToday.getTime() - 86_400_000);
  const startOfWeek = new Date(startOfToday.getTime() - 7 * 86_400_000);

  if (then >= startOfToday) return "Today";
  if (then >= startOfYesterday) return "Yesterday";
  if (then >= startOfWeek) return "This Week";
  return "Older";
}

const GROUP_ORDER: DateGroup[] = ["Today", "Yesterday", "This Week", "Older"];

function groupSessions(sessions: Session[]): Map<DateGroup, Session[]> {
  const map = new Map<DateGroup, Session[]>();
  for (const session of sessions) {
    const group = getDateGroup(session.updatedAt);
    if (!map.has(group)) map.set(group, []);
    map.get(group)!.push(session);
  }
  return map;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface SessionItemProps {
  session: Session;
  isActive: boolean;
  lastMessagePreview: string | null;
  onSelect: (id: string) => void;
  onRename: (session: Session) => void;
  onDelete: (id: string) => void;
}

const SessionItem: React.FC<SessionItemProps> = ({
  session,
  isActive,
  lastMessagePreview,
  onSelect,
  onRename,
  onDelete,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!menuOpen) return;
    const handle = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [menuOpen]);

  // Close dropdown on Escape
  useEffect(() => {
    if (!menuOpen) return;
    const handle = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("keydown", handle);
    return () => document.removeEventListener("keydown", handle);
  }, [menuOpen]);

  return (
    <div
      className={[
        "group flex items-stretch gap-1 rounded-2xl transition-all",
        isActive
          ? "bg-primary/10 ring-1 ring-primary/50"
          : "hover:bg-hover-subtle",
      ].join(" ")}
    >
      {/* Clickable session area */}
      <button
        type="button"
        onClick={() => onSelect(session.id)}
        onDoubleClick={() => onRename(session)}
        aria-current={isActive ? "page" : undefined}
        className="flex-1 flex flex-col gap-1 p-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-2xl min-w-0"
      >
        <div className="flex items-start justify-between gap-2">
          <span
            className={[
              "font-medium text-[0.9375rem] transition-colors truncate flex-1",
              isActive ? "text-primary" : "text-on-surface group-hover:text-primary",
            ].join(" ")}
          >
            {session.title}
          </span>
          <span className="text-[0.6875rem] text-text-muted shrink-0 mt-0.5">
            {formatRelativeTime(session.updatedAt)}
          </span>
        </div>
        {lastMessagePreview && (
          <span className="text-[0.8125rem] text-text-muted truncate">
            {lastMessagePreview}
          </span>
        )}
      </button>

      {/* Three-dot menu button — shown on hover or when menu is open */}
      <div ref={menuRef} className="relative flex items-start pt-2 pr-2">
        <button
          type="button"
          aria-label="Session options"
          aria-expanded={menuOpen}
          onClick={(e) => {
            e.stopPropagation();
            setMenuOpen((v) => !v);
          }}
          className={[
            "p-1 rounded-lg text-text-muted hover:bg-surface-container hover:text-on-surface transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
            menuOpen ? "opacity-100" : "opacity-0 group-hover:opacity-100",
          ].join(" ")}
        >
          <span className="material-symbols-outlined text-[1.125rem]" aria-hidden="true">
            more_horiz
          </span>
        </button>

        {menuOpen && (
          <div
            role="menu"
            className="absolute right-0 top-8 z-50 bg-surface-container-high border border-border-default rounded-xl shadow-lg overflow-hidden min-w-[9rem]"
          >
            <button
              type="button"
              role="menuitem"
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpen(false);
                onRename(session);
              }}
              className="w-full flex items-center gap-2 px-4 py-2.5 text-[0.875rem] text-on-surface hover:bg-hover-subtle transition-colors"
            >
              <span className="material-symbols-outlined text-[1rem]" aria-hidden="true">edit</span>
              Rename
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpen(false);
                onDelete(session.id);
              }}
              className="w-full flex items-center gap-2 px-4 py-2.5 text-[0.875rem] text-status-error hover:bg-status-error/10 transition-colors"
            >
              <span className="material-symbols-outlined text-[1rem]" aria-hidden="true">delete</span>
              Delete
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export const ThreadList: React.FC = () => {
  const sessions = useSessions();
  const messagesBySession = useHermesStore((s) => s.messagesBySession);
  const activeSessionId = useHermesStore((s) => s.activeSessionId);
  const createSession = useHermesStore((s) => s.createSession);
  const deleteSession = useHermesStore((s) => s.deleteSession);
  const renameSession = useHermesStore((s) => s.renameSession);
  const setActiveSession = useHermesStore((s) => s.setActiveSession);

  const router = useRouter();
  // Try to read current session from URL (works both on / and /s/[sessionId])
  const params = useParams<{ sessionId?: string }>();
  const urlSessionId = params?.sessionId ?? null;

  const [search, setSearch] = useState("");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const renameInputRef = useRef<HTMLInputElement>(null);

  // Sync URL session into store on initial render / param change
  useEffect(() => {
    if (urlSessionId) {
      setActiveSession(urlSessionId);
    }
  }, [urlSessionId, setActiveSession]);

  // Focus rename input when editing begins
  useEffect(() => {
    if (renamingId) {
      setTimeout(() => renameInputRef.current?.focus(), 0);
    }
  }, [renamingId]);

  const handleNewChat = useCallback(async () => {
    if (isCreating) return;
    setIsCreating(true);
    try {
      const session = await createSession("New chat");
      router.push(`/s/${session.id}`);
    } finally {
      setIsCreating(false);
    }
  }, [isCreating, createSession, router]);

  const handleSelect = useCallback(
    (id: string) => {
      setActiveSession(id);
      router.push(`/s/${id}`);
    },
    [setActiveSession, router]
  );

  const handleDelete = useCallback(
    async (id: string) => {
      await deleteSession(id);
      // Store already picks the next-best session; navigate accordingly.
      const nextId = useHermesStore.getState().activeSessionId;
      if (nextId) {
        router.push(`/s/${nextId}`);
      } else {
        router.push("/");
      }
    },
    [deleteSession, router]
  );

  const handleRenameStart = useCallback((session: Session) => {
    setRenamingId(session.id);
    setRenameValue(session.title);
  }, []);

  const handleRenameSubmit = useCallback(
    async (id: string) => {
      const trimmed = renameValue.trim();
      if (trimmed) {
        await renameSession(id, trimmed);
      }
      setRenamingId(null);
    },
    [renameValue, renameSession]
  );

  const handleRenameKeyDown = useCallback(
    (e: React.KeyboardEvent, id: string) => {
      if (e.key === "Enter") void handleRenameSubmit(id);
      if (e.key === "Escape") setRenamingId(null);
    },
    [handleRenameSubmit]
  );

  // Filter sessions by search query
  const filtered = search.trim()
    ? sessions.filter(
        (s) =>
          s.title.toLowerCase().includes(search.toLowerCase()) ||
          (messagesBySession[s.id] ?? []).some((m) =>
            m.content.toLowerCase().includes(search.toLowerCase())
          )
      )
    : sessions;

  const grouped = groupSessions(filtered);

  // Determine which session is highlighted: prefer URL param, else store
  const currentActiveId = urlSessionId ?? activeSessionId;

  return (
    <aside
      aria-label="Conversation threads"
      className="hidden lg:flex lg:w-1/5 flex-col gap-3 bg-surface-container rounded-3xl p-4 overflow-hidden border border-border-subtle"
    >
      {/* Header row */}
      <div className="flex items-center justify-between px-2 pt-2">
        <h3 className="font-h2 text-xl font-semibold text-primary">Threads</h3>
        <button
          type="button"
          aria-label="New chat"
          onClick={() => void handleNewChat()}
          disabled={isCreating}
          className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-primary/10 text-primary text-[0.8125rem] font-semibold hover:bg-primary/20 disabled:opacity-60 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <span className="material-symbols-outlined text-[1.125rem]" aria-hidden="true">add</span>
          {isCreating ? "Creating…" : "New chat"}
        </button>
      </div>

      {/* Search bar */}
      <div className="relative px-1">
        <span
          className="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-[1.125rem] text-text-muted pointer-events-none"
          aria-hidden="true"
        >
          search
        </span>
        <input
          type="search"
          aria-label="Search conversations"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search…"
          className="w-full pl-9 pr-3 py-2 rounded-xl bg-surface-container-high border border-border-subtle text-[0.875rem] text-on-surface placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/50"
        />
      </div>

      {/* Session list */}
      <div className="flex flex-col gap-1 overflow-y-auto pr-1 custom-scrollbar flex-1 min-h-0">
        {sessions.length === 0 ? (
          /* ── Empty state ── */
          <div className="flex flex-col items-center justify-center gap-4 flex-1 py-12 px-4 text-center">
            <span
              className="material-symbols-outlined text-5xl text-primary/30"
              aria-hidden="true"
            >
              forum
            </span>
            <div>
              <p className="text-[0.9375rem] font-semibold text-on-surface">
                No conversations yet
              </p>
              <p className="text-[0.8125rem] text-text-muted mt-1">
                Start your first conversation
              </p>
            </div>
            <button
              type="button"
              onClick={() => void handleNewChat()}
              disabled={isCreating}
              className="px-4 py-2 rounded-xl bg-primary text-white text-[0.875rem] font-semibold hover:opacity-90 disabled:opacity-60 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              {isCreating ? "Creating…" : "Start your first conversation"}
            </button>
          </div>
        ) : filtered.length === 0 ? (
          /* ── No search results ── */
          <div className="flex flex-col items-center justify-center gap-2 py-12 px-4 text-center">
            <span
              className="material-symbols-outlined text-4xl text-text-muted/50"
              aria-hidden="true"
            >
              search_off
            </span>
            <p className="text-[0.875rem] text-text-muted">
              No conversations match &ldquo;{search}&rdquo;
            </p>
          </div>
        ) : (
          /* ── Grouped sessions ── */
          GROUP_ORDER.filter((g) => grouped.has(g)).map((group) => (
            <div key={group}>
              <div className="text-text-muted text-[0.6875rem] font-semibold uppercase tracking-wider px-4 py-2 mt-2 first:mt-0">
                {group}
              </div>

              {grouped.get(group)!.map((session) =>
                renamingId === session.id ? (
                  /* ── Inline rename input ── */
                  <div key={session.id} className="px-1 py-0.5">
                    <input
                      ref={renameInputRef}
                      type="text"
                      aria-label="Rename session"
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onBlur={() => void handleRenameSubmit(session.id)}
                      onKeyDown={(e) => handleRenameKeyDown(e, session.id)}
                      className="w-full px-4 py-3 rounded-2xl bg-surface-container-high border border-primary/50 text-[0.9375rem] text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                ) : (
                  <SessionItem
                    key={session.id}
                    session={session}
                    isActive={currentActiveId === session.id}
                    lastMessagePreview={
                      (messagesBySession[session.id] ?? []).at(-1)?.content?.slice(0, 80) ?? null
                    }
                    onSelect={handleSelect}
                    onRename={handleRenameStart}
                    onDelete={handleDelete}
                  />
                )
              )}
            </div>
          ))
        )}
      </div>
    </aside>
  );
};
