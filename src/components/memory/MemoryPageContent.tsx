"use client";

/**
 * MemoryPageContent — the full /memory page.
 *
 * Layout:
 *   Left sidebar  — list of memory scopes: Global + one per profile
 *   Main area     — selected scope's memory content
 *                   • View mode: entries rendered as markdown cards
 *                   • Edit mode: combined textarea with auto-save / save button
 *   Search bar    — full-text filter across displayed entries
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import rehypeSanitize from "rehype-sanitize";
import { useHermesStore } from "@/store/hermesStore";
import { useProfiles, useActiveProfile } from "@/store/hooks";
import { getMemory, updateMemory } from "@/lib/hermesClient";
import type { MemoryEntry, Profile } from "@/types/hermes";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const AUTO_SAVE_DELAY_MS = 3000;
const CONTENT_PREVIEW_LENGTH = 120;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ScopeId = "global" | string; // "global" = aggregate all; otherwise profileId

interface MemoryScope {
  id: ScopeId;
  label: string;
  icon: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTimestamp(iso: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} chars`;
  return `${(n / 1024).toFixed(1)} KB`;
}

function getEntryKey(entry: MemoryEntry, scopeId: ScopeId): string {
  // Composite key for global scope. Uses id+updatedAt as a practical discriminator.
  // A stronger solution would attach profileId to MemoryEntry during global aggregation.
  return scopeId === "global" ? `${entry.id}:${entry.updatedAt}` : entry.id;
}

function latestUpdated(entries: MemoryEntry[]): string | null {
  if (entries.length === 0) return null;
  return entries.reduce((best, e) =>
    e.updatedAt > best.updatedAt ? e : best
  ).updatedAt;
}

// Build a single editable string from all entries, separated by HR markers.
function entriesToText(entries: MemoryEntry[]): string {
  return entries.map((e) => e.content).join("\n\n---\n\n");
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function ScopeSidebar({
  scopes,
  activeId,
  onSelect,
}: {
  scopes: MemoryScope[];
  activeId: ScopeId;
  onSelect: (id: ScopeId) => void;
}) {
  return (
    <aside className="w-full flex flex-col gap-1 border-r border-border-default pr-4 overflow-y-auto">
      <p className="text-[0.625rem] font-bold uppercase tracking-widest text-text-muted mb-2 px-2">
        Memory Scopes
      </p>
      {scopes.map((scope) => {
        const active = scope.id === activeId;
        return (
          <button
            key={scope.id}
            type="button"
            onClick={() => onSelect(scope.id)}
            className={[
              "flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary w-full",
              active
                ? "bg-primary/10 text-primary ring-1 ring-primary/30"
                : "text-on-surface-variant hover:text-on-surface hover:bg-hover-subtle",
            ].join(" ")}
          >
            <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
              {scope.icon}
            </span>
            <span className="truncate">{scope.label}</span>
          </button>
        );
      })}
    </aside>
  );
}

function MetaBar({
  entryCount,
  totalChars,
  lastUpdated,
}: {
  entryCount: number;
  totalChars: number;
  lastUpdated: string | null;
}) {
  return (
    <div className="flex flex-wrap items-center gap-4 text-xs text-text-muted">
      <span className="flex items-center gap-1">
        <span className="material-symbols-outlined text-[14px]" aria-hidden="true">notes</span>
        {entryCount} {entryCount === 1 ? "entry" : "entries"}
      </span>
      <span className="flex items-center gap-1">
        <span className="material-symbols-outlined text-[14px]" aria-hidden="true">data_object</span>
        {formatBytes(totalChars)}
      </span>
      {lastUpdated && (
        <span className="flex items-center gap-1">
          <span className="material-symbols-outlined text-[14px]" aria-hidden="true">schedule</span>
          Last modified: {formatTimestamp(lastUpdated)}
        </span>
      )}
    </div>
  );
}

function MemoryCard({ entry }: { entry: MemoryEntry }) {
  return (
    <article className="rounded-2xl border border-border-default bg-surface-container-low p-5 flex flex-col gap-3">
      <div className="prose prose-invert prose-sm max-w-none text-on-surface-variant">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[rehypeHighlight, rehypeSanitize]}
        >
          {entry.content}
        </ReactMarkdown>
      </div>
      <div className="flex flex-wrap gap-4 text-[0.625rem] text-text-muted border-t border-border-subtle pt-2 mt-1">
        <span>Created {formatTimestamp(entry.createdAt)}</span>
        {entry.updatedAt !== entry.createdAt && (
          <span>Updated {formatTimestamp(entry.updatedAt)}</span>
        )}
        <span>{formatBytes(entry.content.length)}</span>
      </div>
    </article>
  );
}

function SaveWarningDialog({
  onConfirm,
  onCancel,
}: {
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="save-warning-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
    >
      <div className="bg-surface-container-low border border-border-default rounded-2xl shadow-2xl max-w-sm w-full p-6 flex flex-col gap-4">
        <div className="flex items-start gap-3">
          <span className="material-symbols-outlined text-[28px] text-tertiary shrink-0" aria-hidden="true">
            warning
          </span>
          <div>
            <h2 id="save-warning-title" className="font-semibold text-on-surface text-base">
              Save Memory Changes
            </h2>
            <p className="text-sm text-on-surface-variant mt-1">
              Edits are written directly to Hermes memory files. Changes
              auto-save after 3 seconds of inactivity. This action cannot be undone.
            </p>
          </div>
        </div>
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded-xl text-sm text-on-surface-variant hover:bg-hover-subtle transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="px-4 py-2 rounded-xl text-sm font-semibold bg-primary text-on-primary hover:bg-primary/90 active:scale-95 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

function EscapeHandler({ onEscape }: { onEscape: () => void }) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onEscape();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onEscape]);
  return null;
}

function DiscardChangesDialog({
  onConfirm,
  onCancel,
}: {
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="discard-changes-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
    >
      <div className="bg-surface-container-low border border-border-default rounded-2xl shadow-2xl max-w-sm w-full p-6 flex flex-col gap-4">
        <div className="flex items-start gap-3">
          <span className="material-symbols-outlined text-[28px] text-status-error shrink-0" aria-hidden="true">
            undo
          </span>
          <div>
            <h2 id="discard-changes-title" className="font-semibold text-on-surface text-base">
              Discard Unsaved Changes?
            </h2>
            <p className="text-sm text-on-surface-variant mt-1">
              You have unsaved changes. Switching scopes will discard them.
            </p>
          </div>
        </div>
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded-xl text-sm text-on-surface-variant hover:bg-hover-subtle transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            Keep editing
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="px-4 py-2 rounded-xl text-sm font-semibold bg-status-error text-on-primary-container hover:bg-status-error/90 active:scale-95 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-status-error"
          >
            Discard
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page component
// ---------------------------------------------------------------------------

export function MemoryPageContent() {
  const profiles = useProfiles();
  const activeProfile = useActiveProfile();
  const storeMemory = useHermesStore((s) => s.memory);

  // Build sidebar scopes: Global aggregate + one per profile
  const scopes: MemoryScope[] = [
    { id: "global", label: "Global (HONCHO)", icon: "public" },
    ...profiles.map((p: Profile) => ({
      id: p.id,
      label: p.name,
      icon: "person",
    })),
  ];

  // Selected scope — default to active profile if available
  const [activeScopeId, setActiveScopeId] = useState<ScopeId>(
    activeProfile?.id ?? "global"
  );

  // Per-scope entry cache keyed by scope ID
  const [entriesByScope, setEntriesByScope] = useState<Record<string, MemoryEntry[]>>({});
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Ref-backed refetch so save callbacks can trigger a reload without
  // violating react-hooks/set-state-in-effect (same pattern as SkillsPageContent).
  const refetchRef = useRef<() => void>(() => undefined);

  // Search query
  const [searchQuery, setSearchQuery] = useState("");

  // Edit state
  const [mode, setMode] = useState<"view" | "edit">("view");
  const [editText, setEditText] = useState("");
  const [savedText, setSavedText] = useState("");
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [showWarning, setShowWarning] = useState(false);
  const [pendingScopeId, setPendingScopeId] = useState<ScopeId | null>(null);

  // Debounce timer for auto-save
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Monotonic counter to discard stale save completions
  const saveSeqRef = useRef(0);

  // ---------------------------------------------------------------------------
  // Data loading — async functions defined INSIDE the effect body so that
  // setState calls inside them don't trigger react-hooks/set-state-in-effect.
  // ---------------------------------------------------------------------------

  useEffect(() => {
    let cancelled = false;

    const doLoad = async () => {
      setLoading(true);
      setLoadError(null);

      if (activeScopeId === "global") {
        if (profiles.length === 0) {
          if (!cancelled) {
            setEntriesByScope((prev) => ({ ...prev, global: [] }));
            setLoading(false);
          }
          return;
        }
        try {
          const results = await Promise.allSettled(
            profiles.map((p) => getMemory(p.id))
          );
          if (!cancelled) {
            const combined: MemoryEntry[] = [];
            let failedCount = 0;
            results.forEach((r) => {
              if (r.status === "fulfilled") combined.push(...r.value);
              else failedCount++;
            });
            setEntriesByScope((prev) => ({ ...prev, global: combined }));
            if (failedCount > 0) {
              setLoadError(
                `Could not load memory for ${failedCount} profile${failedCount > 1 ? "s" : ""} — Hermes may be unavailable.`
              );
            }
          }
        } catch (err) {
          if (!cancelled) {
            setLoadError(
              err instanceof Error
                ? `Failed to load global memory: ${err.message}`
                : "Failed to load global memory — Hermes may be unavailable."
            );
          }
        } finally {
          if (!cancelled) setLoading(false);
        }
        return;
      }

      // Profile scope
      try {
        const entries = await getMemory(activeScopeId);
        if (!cancelled) {
          setEntriesByScope((prev) => ({ ...prev, [activeScopeId]: entries }));
        }
      } catch (err) {
        if (!cancelled) {
          setLoadError(
            err instanceof Error
              ? `Failed to load memory: ${err.message}`
              : "Failed to load memory — Hermes may be unavailable."
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    refetchRef.current = doLoad;
    doLoad();

    return () => { cancelled = true; };
  }, [activeScopeId, profiles]);

  // ---------------------------------------------------------------------------
  // Derived state — useMemo avoids a setState-in-effect for store sync.
  // For the active profile scope prefer the freshest Zustand store value
  // when the local cache is still empty on first render.
  // ---------------------------------------------------------------------------

  const currentEntries = useMemo(() => {
    if (
      activeScopeId === activeProfile?.id &&
      !entriesByScope[activeScopeId]?.length &&
      storeMemory.length > 0
    ) {
      return storeMemory;
    }
    return entriesByScope[activeScopeId] ?? [];
  }, [activeScopeId, activeProfile?.id, entriesByScope, storeMemory]);

  const filteredEntries = useMemo(
    () =>
      searchQuery.trim()
        ? currentEntries.filter((e) =>
            e.content.toLowerCase().includes(searchQuery.toLowerCase())
          )
        : currentEntries,
    [currentEntries, searchQuery]
  );

  const totalChars = useMemo(
    () => currentEntries.reduce((sum, e) => sum + e.content.length, 0),
    [currentEntries]
  );
  const lastUpdated = useMemo(() => latestUpdated(currentEntries), [currentEntries]);

  // ---------------------------------------------------------------------------
  // Scope selection
  // ---------------------------------------------------------------------------

  // Applies a confirmed scope switch (called after the DiscardChangesDialog confirms)
  const applySwitch = useCallback((id: ScopeId) => {
    if (autoSaveTimer.current) {
      clearTimeout(autoSaveTimer.current);
      autoSaveTimer.current = null;
    }
    setActiveScopeId(id);
    setMode("view");
    setDirty(false);
    setSaveError(null);
    setSaveSuccess(false);
  }, []);

  const handleScopeSelect = (id: ScopeId) => {
    if (dirty) {
      setPendingScopeId(id);
      return;
    }
    applySwitch(id);
  };

  // ---------------------------------------------------------------------------
  // Edit helpers
  // ---------------------------------------------------------------------------

  const enterEditMode = () => {
    const text = entriesToText(currentEntries);
    setEditText(text);
    setSavedText(text);
    setDirty(false);
    setSaveError(null);
    setSaveSuccess(false);
    setMode("edit");
  };

  const exitEditMode = () => {
    if (autoSaveTimer.current) {
      clearTimeout(autoSaveTimer.current);
      autoSaveTimer.current = null;
    }
    setMode("view");
    setDirty(false);
    setSaveError(null);
    setSaveSuccess(false);
  };

  const performSave = useCallback(
    async (content: string, silent = false) => {
      if (activeScopeId === "global") return;

      const seq = ++saveSeqRef.current;

      setSaving(true);
      setSaveError(null);

      try {
        await updateMemory(activeScopeId, content);

        // Only apply state updates if this is still the latest save
        if (seq !== saveSeqRef.current) return;

        setSavedText(content);
        setDirty(false);
        if (!silent) setSaveSuccess(true);
        refetchRef.current();
      } catch (err) {
        if (seq !== saveSeqRef.current) return;

        setSaveError(
          err instanceof Error
            ? `Save failed: ${err.message}`
            : "Save failed — Hermes may be unavailable. Please try again."
        );
      } finally {
        if (seq === saveSeqRef.current) {
          setSaving(false);
        }
      }
    },
    [activeScopeId]
  );

  const handleEditChange = (value: string) => {
    setEditText(value);
    setDirty(value !== savedText);
    setSaveSuccess(false);

    if (activeScopeId !== "global") {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
      autoSaveTimer.current = setTimeout(() => {
        void performSave(value, /* silent */ true);
      }, AUTO_SAVE_DELAY_MS);
    }
  };

  const handleDiscard = () => {
    if (autoSaveTimer.current) {
      clearTimeout(autoSaveTimer.current);
      autoSaveTimer.current = null;
    }
    setEditText(savedText);
    setDirty(false);
    setSaveError(null);
    setSaveSuccess(false);
  };

  const handleSaveClick = () => setShowWarning(true);

  const handleWarningConfirm = () => {
    setShowWarning(false);
    if (autoSaveTimer.current) {
      clearTimeout(autoSaveTimer.current);
      autoSaveTimer.current = null;
    }
    void performSave(editText);
  };

  // Clean up debounce timer on unmount
  useEffect(() => {
    return () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    };
  }, []);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const isGlobal = activeScopeId === "global";
  const canEdit = !isGlobal;

  return (
    <>
      {showWarning && (
        <SaveWarningDialog
          onConfirm={handleWarningConfirm}
          onCancel={() => setShowWarning(false)}
        />
      )}

      {/* Escape key handler for warning dialog */}
      {showWarning && (
        <EscapeHandler onEscape={() => setShowWarning(false)} />
      )}
      {pendingScopeId !== null && (
        <DiscardChangesDialog
          onConfirm={() => {
            const id = pendingScopeId;
            setPendingScopeId(null);
            applySwitch(id);
          }}
          onCancel={() => setPendingScopeId(null)}
        />
      )}

      {/* Escape key handler for discard dialog */}
      {pendingScopeId !== null && (
        <EscapeHandler onEscape={() => setPendingScopeId(null)} />
      )}

      <main className="flex flex-col md:pl-28 pt-20 pb-20 md:pb-6 min-h-screen">
        {/* Page header */}
        <div className="px-6 pt-6 pb-4 border-b border-border-default flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold font-outfit text-on-surface">Memory</h1>
            <p className="text-sm text-on-surface-variant mt-0.5">
              Browse and edit Hermes agent memory across all profiles.
            </p>
          </div>

          {/* Full-text search */}
          <div className="relative w-full sm:w-72">
            <span
              className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-text-muted pointer-events-none"
              aria-hidden="true"
            >
              search
            </span>
            <input
              type="search"
              aria-label="Search memory"
              placeholder="Search memory…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-xl bg-surface-container border border-border-default text-sm text-on-surface placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary transition-shadow"
            />
          </div>
        </div>

        {/* Body: sidebar + content */}
        <div className="flex flex-1 min-h-0">
          {/* Scope sidebar — desktop only */}
          <div className="hidden md:flex py-6 pl-6 pr-0 w-64 shrink-0">
            <ScopeSidebar
              scopes={scopes}
              activeId={activeScopeId}
              onSelect={handleScopeSelect}
            />
          </div>

          {/* Main content area */}
          <div className="flex-1 px-6 py-6 overflow-y-auto flex flex-col gap-4 min-h-0">
            {/* Toolbar: meta + edit controls */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <MetaBar
                entryCount={filteredEntries.length}
                totalChars={totalChars}
                lastUpdated={lastUpdated}
              />

              {canEdit && (
                <div className="flex items-center gap-2">
                  {mode === "view" ? (
                    <button
                      type="button"
                      onClick={enterEditMode}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm bg-surface-container border border-border-default text-on-surface-variant hover:text-primary hover:border-primary/40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    >
                      <span className="material-symbols-outlined text-[16px]" aria-hidden="true">edit</span>
                      Edit
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={exitEditMode}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm bg-surface-container border border-border-default text-on-surface-variant hover:text-on-surface transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      >
                        <span className="material-symbols-outlined text-[16px]" aria-hidden="true">visibility</span>
                        View
                      </button>
                      {dirty && (
                        <button
                          type="button"
                          onClick={handleDiscard}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm text-on-surface-variant hover:text-status-error hover:bg-status-error/10 border border-border-default transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                        >
                          <span className="material-symbols-outlined text-[16px]" aria-hidden="true">undo</span>
                          Revert
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={handleSaveClick}
                        disabled={!dirty || saving}
                        className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-sm font-semibold bg-primary text-on-primary hover:bg-primary/90 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      >
                        {saving ? (
                          <>
                            <span className="material-symbols-outlined text-[16px] animate-spin" aria-hidden="true">progress_activity</span>
                            Saving…
                          </>
                        ) : (
                          <>
                            <span className="material-symbols-outlined text-[16px]" aria-hidden="true">save</span>
                            Save
                          </>
                        )}
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Save error / success banners */}
            {saveError && (
              <div
                role="alert"
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-status-error/10 border border-status-error/30 text-sm text-status-error"
              >
                <span className="material-symbols-outlined text-[16px]" aria-hidden="true">error</span>
                {saveError}
              </div>
            )}
            {saveSuccess && (
              <div
                role="status"
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary/10 border border-primary/30 text-sm text-primary"
              >
                <span className="material-symbols-outlined text-[16px]" aria-hidden="true">check_circle</span>
                Memory saved successfully.
              </div>
            )}

            {/* Loading spinner */}
            {loading && (
              <div className="flex items-center justify-center py-16 text-text-muted gap-2">
                <span className="material-symbols-outlined text-[24px] animate-spin" aria-hidden="true">progress_activity</span>
                Loading…
              </div>
            )}

            {/* Load error */}
            {!loading && loadError && (
              <div
                role="alert"
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-status-error/10 border border-status-error/30 text-sm text-status-error"
              >
                <span className="material-symbols-outlined text-[16px]" aria-hidden="true">error</span>
                {loadError}
              </div>
            )}

            {/* ── Edit mode ─────────────────────────────────────────────── */}
            {!loading && mode === "edit" && (
              <div className="flex flex-col gap-2 flex-1">
                <p className="text-xs text-text-muted flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px] text-tertiary" aria-hidden="true">warning</span>
                  Edits are written directly to Hermes memory files. Auto-saves after {AUTO_SAVE_DELAY_MS / 1000} s of inactivity.
                </p>
                <textarea
                  aria-label="Memory content editor"
                  value={editText}
                  onChange={(e) => handleEditChange(e.target.value)}
                  spellCheck
                  className="flex-1 min-h-[480px] w-full rounded-2xl border border-border-default bg-surface-container p-4 text-sm font-code text-on-surface placeholder:text-text-muted resize-y focus:outline-none focus:ring-2 focus:ring-primary transition-shadow"
                  placeholder="No memory content yet. Start typing to create memory entries…"
                />
                {dirty && (
                  <p className="text-xs text-text-muted text-right">Unsaved changes</p>
                )}
              </div>
            )}

            {/* ── View mode ─────────────────────────────────────────────── */}
            {!loading && !loadError && mode === "view" && (
              <>
                {filteredEntries.length === 0 ? (
                  <div className="flex flex-col items-center justify-center gap-3 text-center flex-1 py-16 px-6">
                    <span className="material-symbols-outlined text-[48px] text-text-muted" aria-hidden="true">
                      {searchQuery ? "search_off" : "bookmark_border"}
                    </span>
                    <p className="text-base font-semibold text-on-surface-variant">
                      {searchQuery ? "No matching entries" : "No memory entries"}
                    </p>
                    <p className="text-sm text-text-muted max-w-xs">
                      {searchQuery
                        ? "Try a different search term."
                        : "This scope has no memory entries yet. Switch to Edit mode to add content."}
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    {/* Entry summary table */}
                    <div className="overflow-x-auto rounded-2xl border border-border-default">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-border-default bg-surface-container-low text-left text-[0.625rem] uppercase tracking-widest text-text-muted">
                            <th className="px-4 py-3 font-semibold">Content</th>
                            <th className="px-4 py-3 font-semibold whitespace-nowrap hidden sm:table-cell">Last Updated</th>
                            <th className="px-4 py-3 font-semibold whitespace-nowrap hidden md:table-cell">Size</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredEntries.map((entry) => (
                            <tr
                              key={getEntryKey(entry, activeScopeId)}
                              className="border-b border-border-subtle last:border-0 hover:bg-hover-subtle transition-colors"
                            >
                              <td className="px-4 py-3 text-on-surface-variant max-w-xs">
                                <p className="truncate">{entry.content.slice(0, CONTENT_PREVIEW_LENGTH)}{entry.content.length > CONTENT_PREVIEW_LENGTH ? "…" : ""}</p>
                              </td>
                              <td className="px-4 py-3 text-text-muted whitespace-nowrap hidden sm:table-cell">
                                {formatTimestamp(entry.updatedAt)}
                              </td>
                              <td className="px-4 py-3 text-text-muted whitespace-nowrap hidden md:table-cell">
                                {formatBytes(entry.content.length)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Detailed rendered markdown cards */}
                    <div className="flex flex-col gap-3 mt-2">
                      {filteredEntries.map((entry) => (
                        <MemoryCard key={getEntryKey(entry, activeScopeId)} entry={entry} />
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </main>
    </>
  );
}
