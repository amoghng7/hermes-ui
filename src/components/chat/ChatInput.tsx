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
      <div className="relative group">
        <div className="absolute -inset-1 bg-gradient-to-r from-violet-600/20 to-primary-container/20 rounded-[28px] blur opacity-25 group-focus-within:opacity-100 transition duration-1000" />
        <div className="relative bg-surface-container rounded-[24px] border border-white/10 flex items-center px-6 py-4 gap-4">
          <button className="text-text-muted">
            <span className="material-symbols-outlined">attach_file</span>
          </button>
          <input
            className="flex-1 bg-transparent border-none focus:ring-0 focus:outline-none text-on-surface placeholder:text-text-muted font-body"
            placeholder="Probe the swarm history..."
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={onKeyDown}
          />
          <button
            className="w-12 h-12 rounded-2xl bg-primary-container flex items-center justify-center hover:scale-105 active:scale-95 transition-all"
            onClick={submit}
          >
            <span className="material-symbols-outlined text-white">send</span>
          </button>
        </div>
      </div>
    </div>
  );
};
