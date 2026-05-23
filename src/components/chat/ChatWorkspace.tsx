"use client";

/**
 * ChatWorkspace — the center chat panel and right swarm-topology panel.
 *
 * Reads the active session from the Zustand store and handles all streaming
 * / message logic.  Extracted from the home page so it can be reused by
 * dynamic session routes (`/s/[sessionId]`).
 */

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChatInput } from "@/components/chat/ChatInput";
import { MessageList } from "@/components/chat/MessageList";
import { AskUserDialog } from "@/components/chat/AskUserDialog";
import { ConfirmationDialog } from "@/components/chat/ConfirmationDialog";
import { SessionAgentsPanel } from "@/components/agents/SessionAgentsPanel";
import { streamChat } from "@/lib/hermesClient";
import {
  useActiveSession,
  useIsStreaming,
  useMessages,
  usePendingAskUser,
  usePendingConfirmation,
  useToolCallsByMessage,
} from "@/store/hooks";
import { useHermesStore } from "@/store/hermesStore";
import type { Agent, AskUserRequest, ConfirmationRequest, Message } from "@/types/hermes";

function makeMessageId(prefix: string): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Generate a collision-resistant agent ID when none is provided by the backend. */
function generateAgentId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `agent-${crypto.randomUUID()}`;
  }
  return `agent-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Maximum accumulated argument string length before emitting a dev-mode
 * warning for a delegate_task call that hasn't parsed to valid JSON.
 * Exceeding this in a real stream likely indicates a malformed payload.
 */
const MAX_DELEGATE_TASK_ARG_LENGTH = 2000;

// ---------------------------------------------------------------------------
// Detection helpers — parse ask_user / confirmation_required markers from
// assistant message content.  The Hermes backend embeds these as JSON blocks.
// ---------------------------------------------------------------------------

/**
 * Scan backwards from the final "}" in `content` using a brace-depth counter
 * that ignores braces inside JSON string values.  Returns `{ start, parsed }`
 * where `start` is the index of the opening "{", `end` is the index of the
 * closing "}", and `parsed` is the decoded JSON object, or `null` if no valid
 * JSON object is found.
 */
function findTrailingJsonBlock(
  content: string,
): { start: number; end: number; parsed: Record<string, unknown> } | null {
  // Collect all closing-brace positions in one forward pass so we can iterate
  // backwards without repeated string scans when multiple closing braces are tried.
  // Braces that fall inside string literals are included but are safely ignored by
  // the inString tracking in the inner backward scan below.
  const closingBraces: number[] = [];
  for (let i = 0; i < content.length; i++) {
    if (content[i] === "}") closingBraces.push(i);
  }

  for (let bi = closingBraces.length - 1; bi >= 0; bi--) {
    const lastClose = closingBraces[bi];
    let depth = 0;
    let inString = false;
    let escaped = false;

    for (let i = lastClose; i >= 0; i--) {
      const ch = content[i];

      if (ch === "\\" && !escaped) {
        escaped = true;
        continue;
      }

      if (ch === '"' && !escaped) {
        inString = !inString;
        escaped = false;
        continue;
      }

      escaped = false;

      if (inString) continue;

      if (ch === "}") depth++;
      else if (ch === "{") {
        depth--;
        if (depth === 0) {
          try {
            const parsed: unknown = JSON.parse(content.slice(i, lastClose + 1));
            if (
              parsed !== null &&
              typeof parsed === "object" &&
              !Array.isArray(parsed)
            ) {
              return {
                start: i,
                end: lastClose,
                parsed: parsed as Record<string, unknown>,
              };
            }
          } catch {
            // Not valid JSON — try the next earlier closing brace.
          }
          break;
        }
      }
    }
  }

  return null;
}

function extractTrailingJson(content: string): Record<string, unknown> | null {
  return findTrailingJsonBlock(content)?.parsed ?? null;
}

function stripTrailingJson(content: string): string {
  const result = findTrailingJsonBlock(content);
  if (!result) return content;

  // Use result.end (the closing "}" index) already computed by findTrailingJsonBlock.
  const afterBlock = content.slice(result.end + 1);
  if (afterBlock.trim().length > 0) return content;

  return content.slice(0, result.start).trimEnd();
}

function detectAskUser(content: string): AskUserRequest | null {
  const obj = extractTrailingJson(content);
  if (!obj) return null;

  if (obj["type"] === "ask_user" && typeof obj["question"] === "string") {
    return {
      question: obj["question"],
      options: Array.isArray(obj["options"])
        ? (obj["options"] as unknown[]).filter((o): o is string => typeof o === "string")
        : undefined,
      multiSelect: Boolean(obj["multiSelect"]),
      allowCustom: Boolean(obj["allowCustom"]),
    };
  }

  const inner = obj["ask_user"];
  if (inner !== null && typeof inner === "object" && !Array.isArray(inner)) {
    const req = inner as Record<string, unknown>;
    if (typeof req["question"] === "string") {
      return {
        question: req["question"],
        options: Array.isArray(req["options"])
          ? (req["options"] as unknown[]).filter((o): o is string => typeof o === "string")
          : undefined,
        multiSelect: Boolean(req["multiSelect"]),
        allowCustom: Boolean(req["allowCustom"]),
      };
    }
  }

  return null;
}

function detectConfirmation(content: string): ConfirmationRequest | null {
  const obj = extractTrailingJson(content);
  if (!obj) return null;

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
// delegate_task helper — extract an Agent from a completed delegate_task call
// ---------------------------------------------------------------------------

/** Accumulates streaming tool-call argument chunks for a single tool call. */
type ToolCallAccumulator = { id: string; name: string; args: string; done: boolean };

function agentFromDelegateTaskArgs(
  callId: string,
  args: Record<string, unknown>
): Agent {
  const id =
    typeof args["agent_id"] === "string"
      ? args["agent_id"]
      : typeof args["id"] === "string"
        ? args["id"]
        : callId || generateAgentId();

  const name =
    typeof args["agent_name"] === "string"
      ? args["agent_name"]
      : typeof args["name"] === "string"
        ? args["name"]
        : "Subagent";

  const task =
    typeof args["task"] === "string" ? args["task"] : undefined;

  const description =
    typeof args["description"] === "string"
      ? args["description"]
      : typeof args["role"] === "string"
        ? args["role"]
        : undefined;

  const tools = Array.isArray(args["tools"])
    ? (args["tools"] as unknown[]).filter((t): t is string => typeof t === "string")
    : undefined;

  const parentAgentId =
    typeof args["parent_agent_id"] === "string"
      ? args["parent_agent_id"]
      : "orchestrator";

  return {
    id,
    name,
    status: "active",
    description,
    task,
    tools,
    parentAgentId,
    updatedAt: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ChatWorkspace() {
  const router = useRouter();
  const activeSession = useActiveSession();
  const activeSessionId = activeSession?.id ?? null;
  const messages = useMessages(activeSessionId);
  const isStreaming = useIsStreaming(activeSessionId);
  const toolCallsByMessage = useToolCallsByMessage(activeSessionId, messages);
  const appendMessage = useHermesStore((state) => state.appendMessage);
  const addUserMessage = useHermesStore((state) => state.addUserMessage);
  const finalizeMessage = useHermesStore((state) => state.finalizeMessage);
  const createSession = useHermesStore((state) => state.createSession);
  const setPendingAskUser = useHermesStore((state) => state.setPendingAskUser);
  const setPendingConfirmation = useHermesStore((state) => state.setPendingConfirmation);
  const upsertAgent = useHermesStore((state) => state.upsertAgent);
  const pendingAskUser = usePendingAskUser();
  const pendingConfirmation = usePendingConfirmation();

  const [model, setModel] = useState("hermes");
  const [isSending, setIsSending] = useState(false);
  const [isCreatingSession, setIsCreatingSession] = useState(false);
  const sendingRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const streamRunIdRef = useRef(0);
  // Accumulates streaming tool call argument chunks keyed by call index.
  // `done` is set to true once arguments have been fully parsed to avoid
  // re-parsing every subsequent chunk for the same call.
  const toolCallAccumRef = useRef<Map<number, ToolCallAccumulator>>(new Map());

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
    if (!activeSessionId) {
      throw new Error("No active session. Please select or create a conversation first.");
    }
    if (sendingRef.current) {
      throw new Error("Please wait for the current message to finish sending before sending another.");
    }

    const runId = streamRunIdRef.current + 1;
    streamRunIdRef.current = runId;
    abortRef.current?.abort();
    const abortController = new AbortController();
    abortRef.current = abortController;
    sendingRef.current = true;
    setIsSending(true);
    // Reset accumulated tool-call state for this new request.
    toolCallAccumRef.current = new Map();
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
    // Add user message without touching streaming state (streaming is for the assistant).
    addUserMessage(sessionId, userMessage);

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

        // ── delegate_task detection (SSE tool_calls) ────────────────────────
        if (delta.toolCallsDelta) {
          for (const tc of delta.toolCallsDelta) {
            const acc = toolCallAccumRef.current.get(tc.index) ?? { id: "", name: "", args: "", done: false };
            if (tc.id && !acc.id) acc.id = tc.id;
            if (tc.name && !acc.name) acc.name = tc.name;
            if (tc.argumentsDelta) acc.args += tc.argumentsDelta;
            toolCallAccumRef.current.set(tc.index, acc);

            if (!acc.done && acc.name === "delegate_task" && acc.args) {
              try {
                const parsedArgs = JSON.parse(acc.args);
                if (parsedArgs !== null && typeof parsedArgs === "object" && !Array.isArray(parsedArgs)) {
                  upsertAgent(sessionId, agentFromDelegateTaskArgs(acc.id, parsedArgs as Record<string, unknown>));
                  acc.done = true;
                }
              } catch {
                // Arguments not yet complete JSON — wait for more chunks.
                // In development, log malformed args after a reasonable length.
                if (process.env.NODE_ENV === "development" && acc.args.length > MAX_DELEGATE_TASK_ARG_LENGTH) {
                  console.warn("[delegate_task] unusually large unparseable args:", acc.args.slice(0, 200));
                }
              }
            }
          }
        }
      }

      // ── Stream finished cleanly — mark all still-active agents as done ────
      if (streamRunIdRef.current === runId) {
        const agents = useHermesStore.getState().agents[sessionId] ?? [];
        for (const agent of agents) {
          if (agent.status === "active" || agent.status === "waiting") {
            upsertAgent(sessionId, { ...agent, status: "done", updatedAt: new Date().toISOString() });
          }
        }

        const applyMarkerStrip = () => {
          assistantContent = stripTrailingJson(assistantContent);
          appendMessage(sessionId, {
            id: assistantMessageId,
            sessionId,
            role: "assistant",
            content: assistantContent,
            createdAt,
          });
        };

        const askUser = detectAskUser(assistantContent);
        if (askUser) {
          applyMarkerStrip();
          setPendingAskUser(askUser);
        } else {
          const confirmation = detectConfirmation(assistantContent);
          if (confirmation) {
            applyMarkerStrip();
            setPendingConfirmation(confirmation);
          }
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

  const handleAskUserAnswer = (answer: string | string[]) => {
    const text = Array.isArray(answer) ? answer.join(", ") : answer;
    setPendingAskUser(null);
    void handleSend(text);
  };

  const handleAskUserDismiss = () => {
    setPendingAskUser(null);
    void handleSend("(dismissed)");
  };

  const handleConfirmApprove = () => {
    setPendingConfirmation(null);
    void handleSend("approved");
  };

  const handleConfirmDeny = () => {
    setPendingConfirmation(null);
    void handleSend("denied");
  };

  const handleCreateSession = async () => {
    if (isCreatingSession) return;
    setIsCreatingSession(true);
    try {
      const session = await createSession("New Hermes chat");
      router.push(`/s/${session.id}`);
    } finally {
      setIsCreatingSession(false);
    }
  };

  return (
    <>
      {/* Center chat panel */}
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

      {/* Right swarm topology panel — live session agents */}
      <SessionAgentsPanel sessionId={activeSessionId} />
    </>
  );
}
