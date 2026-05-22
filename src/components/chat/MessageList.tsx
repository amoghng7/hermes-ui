"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Message } from "@/types/hermes";

interface MessageListProps {
  messages: Message[];
  isStreaming: boolean;
}

export function MessageList({ messages, isStreaming }: MessageListProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [stickToBottom, setStickToBottom] = useState(true);

  const lastAssistantMessageId = useMemo(() => {
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      if (messages[index].role === "assistant") return messages[index].id;
    }
    return null;
  }, [messages]);

  useEffect(() => {
    if (!stickToBottom) return;
    const node = containerRef.current;
    if (!node) return;
    node.scrollTo({ top: node.scrollHeight, behavior: "smooth" });
  }, [messages, isStreaming, stickToBottom]);

  const handleScroll: React.UIEventHandler<HTMLDivElement> = (event) => {
    const node = event.currentTarget;
    const distanceFromBottom =
      node.scrollHeight - node.scrollTop - node.clientHeight;
    setStickToBottom(distanceFromBottom < 48);
  };

  if (messages.length === 0) {
    return (
      <div className="flex-1 p-8 flex items-center justify-center">
        <div className="max-w-xl text-center">
          <h3 className="text-xl font-semibold text-on-surface">Start a new Hermes chat</h3>
          <p className="text-sm text-text-muted mt-2">
            Ask Hermes to plan, code, review, or explain your next step.
          </p>
          <ul className="mt-6 space-y-2 text-sm text-text-muted">
            <li className="bg-surface-container rounded-xl px-4 py-3 border border-border-subtle">
              “Summarize the architecture of this repository.”
            </li>
            <li className="bg-surface-container rounded-xl px-4 py-3 border border-border-subtle">
              “Implement a small bug fix and explain the trade-offs.”
            </li>
            <li className="bg-surface-container rounded-xl px-4 py-3 border border-border-subtle">
              “Write a release note for the latest feature branch.”
            </li>
          </ul>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className="flex-1 overflow-y-auto p-8 flex flex-col gap-8 custom-scrollbar"
    >
      {messages.map((message) => {
        const isUser = message.role === "user";
        const showStreamingCursor =
          isStreaming &&
          !isUser &&
          message.id === lastAssistantMessageId;

        return (
          <div key={message.id} className={isUser ? "flex justify-end" : "flex gap-4"}>
            {!isUser && (
              <div
                className="w-10 h-10 rounded-full bg-primary-container flex items-center justify-center shrink-0"
                aria-hidden="true"
              >
                <span className="material-symbols-outlined text-on-primary-container">smart_toy</span>
              </div>
            )}
            <div
              className={
                isUser
                  ? "max-w-[85%] bg-surface-container-high rounded-3xl p-6 border border-border-subtle"
                  : "max-w-[85%] bg-surface-container rounded-3xl p-6 border border-border-subtle"
              }
            >
              <p className="text-[1rem] text-on-surface whitespace-pre-wrap break-words">
                {message.content}
                {showStreamingCursor && (
                  <span className="inline-block w-[0.5ch] animate-pulse">▍</span>
                )}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
