"use client";

import { useEffect } from "react";
import { useParams } from "next/navigation";
import { ThreadList } from "@/components/chat/ThreadList";
import { ChatWorkspace } from "@/components/chat/ChatWorkspace";
import { useHermesStore } from "@/store/hermesStore";

/**
 * Dynamic session page — `/s/[sessionId]`.
 *
 * Activates the session identified by the URL parameter in the Zustand store,
 * then renders the same ThreadList + ChatWorkspace layout as the home page.
 * This ensures that deep-linking to a session URL (or refreshing the page)
 * correctly selects the session without a full store re-bootstrap.
 */
export default function SessionPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const setActiveSession = useHermesStore((s) => s.setActiveSession);

  useEffect(() => {
    if (sessionId) {
      setActiveSession(sessionId);
    }
  }, [sessionId, setActiveSession]);

  return (
    <div className="flex-1 flex gap-6 box-border fluid-main-margin">
      <ThreadList />
      <ChatWorkspace />
    </div>
  );
}
