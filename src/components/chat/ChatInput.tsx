"use client";

import { useEffect, useRef, useState } from "react";
import { callTool, listModels } from "@/lib/hermesClient";

interface ChatInputProps {
  onSend: (text: string) => Promise<void>;
  disabled?: boolean;
  model: string;
  onModelChange: (model: string) => void;
}

const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;

function extractFileReference(result: unknown): string | null {
  if (typeof result === "string" && result.trim()) return result;
  if (result && typeof result === "object") {
    const maybeRef = (result as Record<string, unknown>).reference;
    if (typeof maybeRef === "string" && maybeRef.trim()) return maybeRef;
    const maybePath = (result as Record<string, unknown>).path;
    if (typeof maybePath === "string" && maybePath.trim()) return maybePath;
    const maybeFileId = (result as Record<string, unknown>).file_id;
    if (typeof maybeFileId === "string" && maybeFileId.trim()) {
      return `file:${maybeFileId}`;
    }
  }
  return null;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Failed to read file contents."));
    reader.onload = () => {
      if (typeof reader.result !== "string") {
        reject(new Error("File data could not be processed as text."));
        return;
      }
      const commaIndex = reader.result.indexOf(",");
      resolve(commaIndex >= 0 ? reader.result.slice(commaIndex + 1) : reader.result);
    };
    reader.readAsDataURL(file);
  });
}

export const ChatInput: React.FC<ChatInputProps> = ({
  onSend,
  disabled = false,
  model,
  onModelChange,
}) => {
  const [value, setValue] = useState("");
  const [models, setModels] = useState<string[]>(["hermes"]);
  const [attachments, setAttachments] = useState<string[]>([]);
  const [isAttaching, setIsAttaching] = useState(false);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const textAreaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    let mounted = true;
    listModels()
      .then((availableModels) => {
        if (!mounted || availableModels.length === 0) return;
        setModels(availableModels);
      })
      .catch(() => {
        // Non-fatal: model endpoint might not be available.
      });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const textArea = textAreaRef.current;
    if (!textArea) return;
    textArea.style.height = "auto";
    textArea.style.height = `${Math.min(textArea.scrollHeight, 220)}px`;
  }, [value]);

  const submit = async () => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    const previousValue = value;
    const previousAttachments = attachments;
    const textWithAttachments =
      attachments.length > 0
        ? `${trimmed}\n\nAttached files:\n${attachments.map((item) => `- ${item}`).join("\n")}`
        : trimmed;
    setValue("");
    setAttachments([]);
    setAttachmentError(null);
    try {
      await onSend(textWithAttachments);
    } catch (error) {
      const message =
        error instanceof Error && error.message.trim()
          ? `Message failed to send: ${error.message}`
          : "Message failed to send.";
      setValue(previousValue);
      setAttachments(previousAttachments);
      setAttachmentError(message);
    }
  };

  const onKeyDown: React.KeyboardEventHandler<HTMLTextAreaElement> = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void submit();
    }
  };

  const handleAttach = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_ATTACHMENT_BYTES) {
      setAttachmentError("Attachment is too large (max 5MB).");
      event.target.value = "";
      return;
    }
    setIsAttaching(true);
    setAttachmentError(null);
    try {
      const contentBase64 = await fileToBase64(file);
      const toolResult = await callTool("file", {
        filename: file.name,
        mime_type: file.type || "application/octet-stream",
        size_bytes: file.size,
        content_base64: contentBase64,
      });
      const reference = extractFileReference(toolResult);
      if (!reference) {
        setAttachmentError("Attachment upload failed. No file reference returned.");
        return;
      }
      setAttachments((previous) => [...previous, reference]);
    } catch {
      setAttachmentError("Attachment upload failed.");
    } finally {
      setIsAttaching(false);
      event.target.value = "";
    }
  };

  return (
    <div className="p-6">
      <div className="bg-surface-container rounded-[24px] border border-border-default flex items-end px-6 py-4 gap-4 focus-within:border-primary/40 transition-colors">
        <button
          type="button"
          aria-label="Attach file"
          disabled={disabled || isAttaching}
          className="text-text-muted hover:text-on-surface transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-sm disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={() => fileInputRef.current?.click()}
        >
          <span className="material-symbols-outlined" aria-hidden="true">attach_file</span>
        </button>
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={handleAttach}
        />
        <label htmlFor="model-select" className="sr-only">Model</label>
        <select
          id="model-select"
          value={model}
          disabled={disabled}
          onChange={(event) => onModelChange(event.target.value)}
          className="bg-transparent text-text-muted text-sm border border-border-subtle rounded-lg px-2 py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-60"
        >
          {models.map((modelName) => (
            <option key={modelName} value={modelName} className="bg-surface-container text-on-surface">
              {modelName}
            </option>
          ))}
        </select>
        <label htmlFor="chat-input" className="sr-only">
          Message
        </label>
        <textarea
          ref={textAreaRef}
          id="chat-input"
          rows={1}
          disabled={disabled}
          className="flex-1 bg-transparent border-none focus:ring-0 focus:outline-none text-on-surface placeholder:text-text-muted font-body text-[1rem] resize-none disabled:opacity-60"
          placeholder="Probe the swarm history..."
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={onKeyDown}
        />
        <button
          type="button"
          aria-label="Send message"
          disabled={disabled || isAttaching}
          className="w-12 h-12 rounded-2xl bg-primary-container flex items-center justify-center hover:scale-105 active:scale-95 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-70 disabled:cursor-not-allowed"
          onClick={() => void submit()}
        >
          <span className="material-symbols-outlined text-white" aria-hidden="true">
            send
          </span>
        </button>
      </div>
      {(attachments.length > 0 || isAttaching || attachmentError) && (
        <div className="mt-3 text-xs text-text-muted flex flex-wrap gap-2">
          {attachments.map((attachment) => (
            <span key={attachment} className="px-2 py-1 rounded-full bg-surface-container-high border border-border-subtle">
              {attachment}
            </span>
          ))}
          {isAttaching && <span className="animate-pulse">Uploading…</span>}
          {attachmentError && <span className="text-secondary">{attachmentError}</span>}
        </div>
      )}
    </div>
  );
};
