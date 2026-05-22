"use client";

import { ThreadList } from "@/components/chat/ThreadList";
import { ChatWorkspace } from "@/components/chat/ChatWorkspace";

export default function HomePage() {
  return (
    <div className="flex-1 flex gap-6 box-border fluid-main-margin">
      <ThreadList />
      <ChatWorkspace />
    </div>
  );
}
