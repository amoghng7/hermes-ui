"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { ThreadList } from "@/components/chat/ThreadList";
import { ChatWorkspace } from "@/components/chat/ChatWorkspace";
import { useHermesStore } from "@/store/hermesStore";
import { useSessions } from "@/store/hooks";

/**
 * Dynamic session page — `/s/[sessionId]`.
 *
 * Activates the session identified by the URL parameter in the Zustand store,
 * then renders the same ThreadList + ChatWorkspace layout as the home page.
 * This ensures that deep-linking to a session URL (or refreshing the page)
 * correctly selects the session without a full store re-bootstrap.
 *
 * If sessions have loaded but the requested session doesn't exist, redirects
 * to `/` rather than rendering an empty workspace.
 */
export default function SessionPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const router = useRouter();
  const setActiveSession = useHermesStore((s) => s.setActiveSession);
  const sessions = useSessions();

  useEffect(() => {
    if (!sessionId) return;

    // Sessions haven't loaded yet — activate optimistically; the poll cycle
    // will populate the sidebar once bootstrap completes.
    if (sessions.length === 0) {
      setActiveSession(sessionId);
      return;
    }

    // Sessions are loaded. If the requested session isn't in the list, go home.
    const found = sessions.find((s) => s.id === sessionId);
    if (!found) {
      router.replace("/");
      return;
    }

    setActiveSession(sessionId);
  }, [sessionId, sessions, setActiveSession, router]);

  return (
    <div className="flex-1 flex gap-6 box-border fluid-main-margin">
      <ThreadList />
      <ChatWorkspace />
    </div>
  );
}
