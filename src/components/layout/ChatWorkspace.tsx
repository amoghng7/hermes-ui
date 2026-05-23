"use client";

/**
 * ChatWorkspace — three-pane layout component.
 *
 * Composes ThreadList (left sidebar) + ChatSection (center) +
 * an optional right panel into the standard Hermes UI layout.
 *
 * Accepts a `sessionId` prop so any route can render a fully-functional
 * workspace without duplicating activation or fetch logic:
 *
 *   <ChatWorkspace sessionId="new" />           // home — no session selected
 *   <ChatWorkspace sessionId={params.id} />     // deep-link to a session
 *   <ChatWorkspace sessionId={id} rightPanel="agents" />
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { ThreadList } from "@/components/chat/ThreadList";
import { ChatSection } from "@/components/chat/ChatSection";
import { SessionAgentsPanel } from "@/components/agents/SessionAgentsPanel";
import { useHermesStore } from "@/store/hermesStore";
import { useSessions } from "@/store/hooks";
import { getSession } from "@/lib/hermesClient";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ChatWorkspaceProps {
  sessionId: string;
  rightPanel?: "agents" | "none";
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ChatWorkspace({ sessionId, rightPanel = "agents" }: ChatWorkspaceProps) {
  const setActiveSession = useHermesStore((s) => s.setActiveSession);
  const clearActiveSession = useHermesStore((s) => s.clearActiveSession);
  const sessions = useSessions();

  // Whether this workspace represents a brand-new (unsaved) session.
  const isNew = sessionId === "new";

  // Computed during render — true once the session appears in the local list.
  const sessionFound = !isNew && sessions.some((s) => s.id === sessionId);

  // Tracks the outcome of an async gateway fetch.
  // All writes happen in async callbacks (.then/.catch) which are never flagged
  // by react-hooks/set-state-in-effect.
  type GatewayResult = "idle" | "success" | "error";
  const [gatewayResult, setGatewayResult] = useState<GatewayResult>("idle");

  // Render-time state reset when sessionId changes — keeps status correct on
  // the very first render after a route change (avoids a one-frame stale flash).
  // This is the pattern React recommends for "storing information from previous
  // renders": https://react.dev/reference/react/useState#storing-information-from-previous-renders
  const [prevSessionId, setPrevSessionId] = useState(sessionId);
  if (prevSessionId !== sessionId) {
    setPrevSessionId(sessionId);
    setGatewayResult("idle");
  }

  // Derive workspace status from synchronous reactive state — no extra setState needed.
  const status: "loading" | "ready" | "not-found" =
    isNew || sessionFound || gatewayResult === "success"
      ? "ready"
      : gatewayResult === "error"
        ? "not-found"
        : "loading";

  useEffect(() => {
    if (isNew) {
      clearActiveSession();
      return;
    }

    if (sessionFound) {
      // Session is already in the local list — activate it.
      // Status is derived from `sessionFound`, no setState needed here.
      setActiveSession(sessionId);
      return;
    }

    // Session not in the local list — try fetching directly from the gateway.
    // All state updates are in async callbacks, which are safe from the lint rule.
    let cancelled = false;
    getSession(sessionId)
      .then((remote) => {
        if (cancelled) return;
        // Merge the newly-fetched session into the sidebar list.
        useHermesStore.setState((state) => ({
          sessions: [...state.sessions.filter((s) => s.id !== remote.id), remote],
          sessionMutationVersion: state.sessionMutationVersion + 1,
        }));
        setActiveSession(remote.id);
        setGatewayResult("success");
      })
      .catch(() => {
        if (!cancelled) {
          clearActiveSession();
          setGatewayResult("error");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [sessionId, isNew, sessionFound, setActiveSession, clearActiveSession]);

  // ── Loading state ─────────────────────────────────────────────────────────
  if (status === "loading") {
    return (
      <div
        role="status"
        aria-live="polite"
        className="flex-1 flex gap-6 box-border fluid-main-margin items-center justify-center min-h-[60vh]"
      >
        <div className="flex flex-col items-center gap-4 text-on-surface-variant">
          <span className="material-symbols-outlined animate-spin text-4xl" aria-hidden="true">
            progress_activity
          </span>
          <p className="text-sm">Loading session…</p>
        </div>
      </div>
    );
  }

  // ── Not-found state ───────────────────────────────────────────────────────
  if (status === "not-found") {
    return (
      <div
        role="alert"
        className="flex-1 flex gap-6 box-border fluid-main-margin items-center justify-center min-h-[60vh]"
      >
        <div className="flex flex-col items-center gap-4 text-on-surface-variant">
          <span className="material-symbols-outlined text-4xl" aria-hidden="true">error</span>
          <p className="text-sm">Session not found.</p>
          <Link href="/" className="text-primary hover:underline text-sm mt-2">
            Go home
          </Link>
        </div>
      </div>
    );
  }

  // ── Ready — render the full three-pane layout ─────────────────────────────
  return (
    <div className="flex-1 flex gap-6 box-border fluid-main-margin">
      <ThreadList />
      <ChatSection sessionId={sessionId} />
      {rightPanel === "agents" && (
        <SessionAgentsPanel sessionId={isNew ? null : sessionId} />
      )}
    </div>
  );
}
