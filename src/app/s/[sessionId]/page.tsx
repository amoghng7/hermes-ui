"use client";

import { useParams } from "next/navigation";
import { ChatWorkspace } from "@/components/layout/ChatWorkspace";

/**
 * Dynamic session page — `/s/[sessionId]`.
 *
 * Thin wrapper: session activation and deep-link resolution are handled
 * inside `ChatWorkspace`.
 */
export default function SessionPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  return <ChatWorkspace sessionId={sessionId} />;
}
