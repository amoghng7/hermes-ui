"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ThreadList } from "@/components/chat/ThreadList";
import { ChatWorkspace } from "@/components/chat/ChatWorkspace";
import { useHermesStore } from "@/store/hermesStore";
import { useSessions } from "@/store/hooks";
import { getSession } from "@/lib/hermesClient";

type SessionStatus = "loading" | "found" | "not-found";

/**
 * Dynamic session page — `/s/[sessionId]`.
 *
 * Activates the session identified by the URL parameter and fetches its
 * details from the gateway if it is not present in the local sidebar list.
 * This prevents the old behaviour of redirecting valid deep-links just
 * because the sidebar list had not loaded yet or was stale.
 */
export default function SessionPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const setActiveSession = useHermesStore((s) => s.setActiveSession);
  const sessions = useSessions();
  const [status, setStatus] = useState<SessionStatus>("loading");

  useEffect(() => {
    if (!sessionId) return;

    // Reset to loading whenever the URL param changes so we don’t keep
    // rendering a stale workspace from a previous session.
    setStatus("loading");

    const found = sessions.find((s) => s.id === sessionId);
    if (found) {
      setActiveSession(sessionId);
      setStatus("found");
      return;
    }

    // Session not in the local list — try fetching directly from the gateway
    // before giving up. This handles deep-links to sessions created elsewhere
    // or sessions that simply haven't been polled yet.
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
        setStatus("found");
      })
      .catch(() => {
        if (!cancelled) setStatus("not-found");
      });

    return () => {
      cancelled = true;
    };
  }, [sessionId, sessions, setActiveSession]);

  if (status === "loading") {
    return (
      <div className="flex-1 flex gap-6 box-border fluid-main-margin items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-4 text-on-surface-variant">
          <span className="material-symbols-outlined animate-spin text-4xl" aria-hidden="true">
            progress_activity
          </span>
          <p className="text-sm">Loading session…</p>
        </div>
      </div>
    );
  }

  if (status === "not-found") {
    return (
      <div className="flex-1 flex gap-6 box-border fluid-main-margin items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-4 text-on-surface-variant">
          <span className="material-symbols-outlined text-4xl" aria-hidden="true">error</span>
          <p className="text-sm">Session not found.</p>
          <a href="/" className="text-primary hover:underline text-sm mt-2">
            Go home
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex gap-6 box-border fluid-main-margin">
      <ThreadList />
      <ChatWorkspace />
    </div>
  );
}
