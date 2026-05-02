"use client";

import { useState } from "react";

interface ChatInputProps {
  onSend?: (text: string) => void;
}

export const ChatInput: React.FC<ChatInputProps> = ({ onSend }) => {
  const [value, setValue] = useState("");

  const submit = () => {
    const trimmed = value.trim();
    if (!trimmed) return;
    onSend?.(trimmed);
    setValue("");
  };

  const onKeyDown: React.KeyboardEventHandler<HTMLInputElement> = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <div className="p-6">
      <div className="bg-surface-container rounded-[24px] border border-border-default flex items-center px-6 py-4 gap-4 focus-within:border-primary/40 transition-colors">
        <button
          aria-label="Attach file"
          className="text-text-muted hover:text-on-surface transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-sm"
        >
          <span className="material-symbols-outlined" aria-hidden="true">attach_file</span>
        </button>
        <label htmlFor="chat-input" className="sr-only">
          Message
        </label>
        <input
          id="chat-input"
          className="flex-1 bg-transparent border-none focus:ring-0 focus:outline-none text-on-surface placeholder:text-text-muted font-body text-[1rem]"
          placeholder="Probe the swarm history..."
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={onKeyDown}
        />
        <button
          aria-label="Send message"
          className="w-12 h-12 rounded-2xl bg-primary-container flex items-center justify-center hover:scale-105 active:scale-95 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          onClick={submit}
        >
          <span className="material-symbols-outlined text-white" aria-hidden="true">send</span>
        </button>
      </div>
    </div>
  );
};
