"use client";

import { useEffect, useRef, useState } from "react";
import { ThreadList } from "@/components/chat/ThreadList";
import { ChatInput } from "@/components/chat/ChatInput";
import { MessageList } from "@/components/chat/MessageList";
import { AskUserDialog } from "@/components/chat/AskUserDialog";
import { ConfirmationDialog } from "@/components/chat/ConfirmationDialog";
import { streamChat } from "@/lib/hermesClient";
import { useActiveSession, useIsStreaming, useMessages, usePendingAskUser, usePendingConfirmation, useToolCallsByMessage } from "@/store/hooks";
import { useHermesStore } from "@/store/hermesStore";
import type { AskUserRequest, ConfirmationRequest, Message } from "@/types/hermes";

function makeMessageId(prefix: string): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// ---------------------------------------------------------------------------
// Detection helpers — parse ask_user / confirmation_required markers from
// assistant message content.  The Hermes backend embeds these as JSON blocks.
// ---------------------------------------------------------------------------

/**
 * Try to extract a JSON value from a string that may end with a JSON block.
 * Returns the parsed object when the last `{…}` in `content` is valid JSON,
 * otherwise returns `null`.
 */
function extractTrailingJson(content: string): Record<string, unknown> | null {
  const start = content.lastIndexOf("{");
  if (start === -1) return null;
  try {
    const parsed: unknown = JSON.parse(content.slice(start));
    if (parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // Not valid JSON — ignore
  }
  return null;
}

/**
 * Detect an `ask_user` request embedded in the assistant message content.
 * Looks for `{"type":"ask_user", ...}` or `{"ask_user": {...}}` patterns.
 */
function detectAskUser(content: string): AskUserRequest | null {
  const obj = extractTrailingJson(content);
  if (!obj) return null;

  // Shape A: {"type": "ask_user", "question": "...", ...}
  if (obj["type"] === "ask_user" && typeof obj["question"] === "string") {
    return {
      question: obj["question"],
      options: Array.isArray(obj["options"]) ? (obj["options"] as string[]) : undefined,
      multiSelect: Boolean(obj["multiSelect"]),
      allowCustom: Boolean(obj["allowCustom"]),
    };
  }

  // Shape B: {"ask_user": {"question": "...", ...}}
  const inner = obj["ask_user"];
  if (inner !== null && typeof inner === "object" && !Array.isArray(inner)) {
    const req = inner as Record<string, unknown>;
    if (typeof req["question"] === "string") {
      return {
        question: req["question"],
        options: Array.isArray(req["options"]) ? (req["options"] as string[]) : undefined,
        multiSelect: Boolean(req["multiSelect"]),
        allowCustom: Boolean(req["allowCustom"]),
      };
    }
  }

  return null;
}

/**
 * Detect a `confirmation_required` request embedded in the assistant message
 * content.  Looks for `{"type":"confirmation_required", ...}` or
 * `{"confirmation_required": {...}}` patterns.
 */
function detectConfirmation(content: string): ConfirmationRequest | null {
  const obj = extractTrailingJson(content);
  if (!obj) return null;

  // Shape A: {"type": "confirmation_required", "tool": "rm", "parameters": {...}}
  if (obj["type"] === "confirmation_required" && typeof obj["tool"] === "string") {
    return {
      toolName: obj["tool"],
      parameters:
        obj["parameters"] !== null &&
        typeof obj["parameters"] === "object" &&
        !Array.isArray(obj["parameters"])
          ? (obj["parameters"] as Record<string, unknown>)
          : {},
      warningText: typeof obj["warning"] === "string" ? obj["warning"] : undefined,
    };
  }

  // Shape B: {"confirmation_required": {"tool": "rm", "parameters": {...}}}
  const inner = obj["confirmation_required"];
  if (inner !== null && typeof inner === "object" && !Array.isArray(inner)) {
    const req = inner as Record<string, unknown>;
    if (typeof req["tool"] === "string") {
      return {
        toolName: req["tool"],
        parameters:
          req["parameters"] !== null &&
          typeof req["parameters"] === "object" &&
          !Array.isArray(req["parameters"])
            ? (req["parameters"] as Record<string, unknown>)
            : {},
        warningText: typeof req["warning"] === "string" ? req["warning"] : undefined,
      };
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export default function HomePage() {
  const activeSession = useActiveSession();
  const activeSessionId = activeSession?.id ?? null;
  const messages = useMessages(activeSessionId);
  const isStreaming = useIsStreaming(activeSessionId);
  const toolCallsByMessage = useToolCallsByMessage(activeSessionId, messages);
  const appendMessage = useHermesStore((state) => state.appendMessage);
  const finalizeMessage = useHermesStore((state) => state.finalizeMessage);
  const createSession = useHermesStore((state) => state.createSession);
  const setPendingAskUser = useHermesStore((state) => state.setPendingAskUser);
  const setPendingConfirmation = useHermesStore((state) => state.setPendingConfirmation);
  const pendingAskUser = usePendingAskUser();
  const pendingConfirmation = usePendingConfirmation();

  const [model, setModel] = useState("hermes");
  const [isSending, setIsSending] = useState(false);
  const [isCreatingSession, setIsCreatingSession] = useState(false);
  const sendingRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const streamRunIdRef = useRef(0);

  // Clear pending dialogs when the active session changes
  useEffect(() => {
    setPendingAskUser(null);
    setPendingConfirmation(null);
    return () => {
      streamRunIdRef.current += 1;
      abortRef.current?.abort();
      abortRef.current = null;
      sendingRef.current = false;
      setIsSending(false);
    };
  }, [activeSessionId, setPendingAskUser, setPendingConfirmation]);

  const handleSend = async (text: string): Promise<void> => {
    if (!activeSessionId || sendingRef.current) {
      // Throw so ChatInput can restore composer text on rejected sends.
      throw new Error("A message is already being sent.");
    }

    const runId = streamRunIdRef.current + 1;
    streamRunIdRef.current = runId;
    abortRef.current?.abort();
    const abortController = new AbortController();
    abortRef.current = abortController;
    sendingRef.current = true;
    setIsSending(true);
    const createdAt = new Date().toISOString();
    const userMessageId = makeMessageId("user");
    const assistantMessageId = makeMessageId("assistant");
    const sessionId = activeSessionId;

    const userMessage: Message = {
      id: userMessageId,
      sessionId,
      role: "user",
      content: text,
      createdAt,
    };
    appendMessage(sessionId, userMessage);
    finalizeMessage(sessionId, userMessageId);

    const history = (useHermesStore.getState().messagesBySession[sessionId] ?? []).map(
      (message) => ({ role: message.role, content: message.content })
    );

    let assistantContent = "";
    appendMessage(sessionId, {
      id: assistantMessageId,
      sessionId,
      role: "assistant",
      content: assistantContent,
      createdAt,
    });

    try {
      for await (const delta of streamChat({
        messages: history,
        model,
        signal: abortController.signal,
      })) {
        if (streamRunIdRef.current !== runId || abortController.signal.aborted) {
          finalizeMessage(sessionId, assistantMessageId);
          return;
        }
        assistantContent += delta.content;
        appendMessage(sessionId, {
          id: assistantMessageId,
          sessionId,
          role: "assistant",
          content: assistantContent,
          createdAt,
        });
      }

      // After streaming completes, check for embedded ask_user / confirmation markers
      if (streamRunIdRef.current === runId) {
        const askUser = detectAskUser(assistantContent);
        if (askUser) {
          setPendingAskUser(askUser);
        } else {
          const confirmation = detectConfirmation(assistantContent);
          if (confirmation) setPendingConfirmation(confirmation);
        }
      }
    } catch (error) {
      if (!abortController.signal.aborted) {
        const errorText =
          error instanceof Error ? error.message : "Unable to stream response from Hermes.";
        appendMessage(sessionId, {
          id: assistantMessageId,
          sessionId,
          role: "assistant",
          content: assistantContent || `⚠ ${errorText}`,
          createdAt,
        });
      }
    } finally {
      finalizeMessage(sessionId, assistantMessageId);
      if (streamRunIdRef.current === runId) {
        setIsSending(false);
        sendingRef.current = false;
        if (abortRef.current === abortController) {
          abortRef.current = null;
        }
      }
    }
  };

  /** Called when the user answers the AskUser dialog. */
  const handleAskUserAnswer = (answer: string | string[]) => {
    const text = Array.isArray(answer) ? answer.join(", ") : answer;
    setPendingAskUser(null);
    void handleSend(text);
  };

  /** Called when the user dismisses the AskUser dialog (Escape / ✕). */
  const handleAskUserDismiss = () => {
    setPendingAskUser(null);
    void handleSend("(dismissed)");
  };

  /** Called when the user approves a dangerous tool call. */
  const handleConfirmApprove = () => {
    setPendingConfirmation(null);
    void handleSend("approved");
  };

  /** Called when the user denies a dangerous tool call. */
  const handleConfirmDeny = () => {
    setPendingConfirmation(null);
    void handleSend("denied");
  };

  const handleCreateSession = async () => {
    if (isCreatingSession) return;
    setIsCreatingSession(true);
    try {
      await createSession("New Hermes chat");
    } finally {
      setIsCreatingSession(false);
    }
  };

  return (
    <div className="flex-1 flex gap-6 box-border fluid-main-margin">
      <ThreadList />

      <section aria-label="Chat" className="flex-1 flex flex-col glass-panel rounded-3xl overflow-hidden relative responsive-panel">
        <div className="p-8 border-b border-border-subtle flex justify-between items-center bg-surface-container/20">
          <div>
            <h2 className="font-h1 text-2xl font-semibold text-on-surface">
              {activeSession?.title ?? "Hermes Chat"}
            </h2>
            <p className="text-[0.8125rem] text-text-muted mt-1">
              {activeSessionId
                ? "Live streaming enabled"
                : "Create or select a session to start chatting"}
            </p>
          </div>
          <button
            type="button"
            aria-label="Share thread"
            className="bg-surface-container p-3 rounded-xl hover:bg-primary/10 border border-border-subtle transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <span className="material-symbols-outlined text-primary" aria-hidden="true">share</span>
          </button>
        </div>

        {activeSessionId ? (
          <MessageList messages={messages} isStreaming={isStreaming || isSending} toolCallsByMessage={toolCallsByMessage} />
        ) : (
          <div className="flex-1 p-8 flex items-center justify-center">
            <div className="max-w-lg text-center">
              <h3 className="text-xl font-semibold text-on-surface">No active session</h3>
              <p className="text-sm text-text-muted mt-2">
                Start a fresh conversation to begin streaming responses from Hermes.
              </p>
              <button
                type="button"
                onClick={() => void handleCreateSession()}
                disabled={isCreatingSession}
                className="mt-6 px-4 py-2 rounded-xl bg-primary text-white hover:opacity-90 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                {isCreatingSession ? "Creating..." : "Start new session"}
              </button>
            </div>
          </div>
        )}

        {/* Bottom input area — only one of the three panels renders at a time */}
        {pendingAskUser ? (
          <AskUserDialog
            question={pendingAskUser.question}
            options={pendingAskUser.options}
            multiSelect={pendingAskUser.multiSelect}
            allowCustom={pendingAskUser.allowCustom}
            onAnswer={handleAskUserAnswer}
            onDismiss={handleAskUserDismiss}
          />
        ) : pendingConfirmation ? (
          <ConfirmationDialog
            toolName={pendingConfirmation.toolName}
            parameters={pendingConfirmation.parameters}
            warningText={pendingConfirmation.warningText}
            onApprove={handleConfirmApprove}
            onDeny={handleConfirmDeny}
          />
        ) : (
          <ChatInput
            onSend={handleSend}
            disabled={!activeSessionId || isStreaming || isSending}
            model={model}
            onModelChange={setModel}
          />
        )}
      </section>

      <aside
        aria-label="Swarm topology"
        className="hidden xl:flex xl:w-[35%] glass-panel rounded-3xl flex-col overflow-hidden relative"
      >
        <div className="p-6 border-b border-border-subtle">
          <h3 className="font-h1 text-xl font-semibold text-on-surface">
            Swarm Agents
          </h3>
          <div className="flex gap-2 mt-2">
            <span className="px-3 py-1 rounded-full bg-primary/10 text-primary text-[0.6875rem] uppercase font-bold tracking-wider">
              Tree Hierarchy
            </span>
            <span className="px-3 py-1 rounded-full bg-surface-container text-text-muted text-[0.6875rem] uppercase font-bold tracking-wider">
              Live Status
            </span>
          </div>
        </div>
        <div className="flex-1 relative flex items-center justify-center overflow-hidden">
          <svg
            aria-hidden="true"
            className="absolute inset-0 w-full h-full pointer-events-none"
          >
            <line
              className="topology-line"
              stroke="var(--color-primary)"
              strokeOpacity="0.25"
              strokeWidth="1"
              x1="50%"
              y1="15%"
              x2="25%"
              y2="35%"
            />
            <line
              className="topology-line"
              stroke="var(--color-primary)"
              strokeOpacity="0.25"
              strokeWidth="1"
              x1="50%"
              y1="15%"
              x2="75%"
              y2="35%"
            />
          </svg>

          <div className="absolute top-[8%] left-1/2 -translate-x-1/2 z-20">
            <div className="bg-surface-container border border-primary/20 w-28 rounded-xl p-2 flex flex-col items-center gap-1 shadow-[var(--shadow-glow)]">
              <div className="w-10 h-10 rounded-full border-2 border-primary/50 avatar-glow bg-primary-container flex items-center justify-center">
                <span className="material-symbols-outlined text-white text-sm" aria-hidden="true">
                  memory
                </span>
              </div>
              <div className="text-center">
                <div className="text-[0.6875rem] font-bold text-on-surface uppercase tracking-wider">
                  ORCHESTRATOR
                </div>
                <div className="text-[0.6875rem] text-primary/80 font-code">
                  V_CORE.ROOT
                </div>
              </div>
              <div className="flex items-center gap-1" aria-label="Status: Active">
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" aria-hidden="true" />
                <span className="text-[0.6875rem] text-primary font-bold">
                  ACTIVE
                </span>
              </div>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}
