"use client";

import { useEffect } from "react";
import { ThreadList } from "@/components/chat/ThreadList";
import { ChatWorkspace } from "@/components/chat/ChatWorkspace";
import { useHermesStore } from "@/store/hermesStore";

export default function HomePage() {
  const clearActiveSession = useHermesStore((s) => s.clearActiveSession);

  useEffect(() => {
    // Navigating to / means "no session selected"; clear any stale active session
    // so the sidebar and workspace are in sync.
    clearActiveSession();
  }, [clearActiveSession]);

  return (
    <div className="flex-1 flex gap-6 box-border fluid-main-margin">
      <ThreadList />
      <ChatWorkspace />
    </div>
  );
}
