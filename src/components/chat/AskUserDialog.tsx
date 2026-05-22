"use client";

import { useEffect, useRef, useState } from "react";

export interface AskUserDialogProps {
  /** The question text shown to the user. */
  question: string;
  /** Pre-defined options rendered as pill buttons (single-select) or checkboxes (multi-select). */
  options?: string[];
  /** When true the user may check multiple options before confirming. */
  multiSelect?: boolean;
  /** When true a free-text input is shown so the user can type a custom answer. */
  allowCustom?: boolean;
  /** Called when the user submits their answer. */
  onAnswer: (answer: string | string[]) => void;
  /** Called when the user presses Escape or the dismiss button. */
  onDismiss?: () => void;
}

/**
 * AskUserDialog — replaces ChatInput while the assistant is waiting for a
 * structured answer from the user (Kimi-style "AskUserQuestion" pattern).
 *
 * Animates in with a slide-up transition; slides back down on answer/dismiss.
 */
export function AskUserDialog({
  question,
  options = [],
  multiSelect = false,
  allowCustom = false,
  onAnswer,
  onDismiss,
}: AskUserDialogProps) {
  const [visible, setVisible] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [customText, setCustomText] = useState("");
  const customInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Trigger slide-up animation on mount and move keyboard focus into the dialog
  // so users don't lose their focus target when ChatInput is removed from the DOM.
  // The nested rAF ensures focus fires after React has committed the state update
  // from setVisible(true) and the browser has painted the transition start.
  useEffect(() => {
    const outer = requestAnimationFrame(() => {
      setVisible(true);
      requestAnimationFrame(() => {
        if (allowCustom) {
          customInputRef.current?.focus();
        } else {
          containerRef.current?.focus();
        }
      });
    });
    return () => cancelAnimationFrame(outer);
  }, [allowCustom]);

  const animateOut = (callback: () => void) => {
    setVisible(false);
    // Wait for the CSS transition to finish before calling the callback.
    // Guard with `called` to prevent both transitionend and the fallback
    // setTimeout from firing the callback twice.
    const el = containerRef.current;
    if (!el) {
      callback();
      return;
    }
    let called = false;
    const done = () => {
      if (called) return;
      called = true;
      el.removeEventListener("transitionend", done);
      callback();
    };
    el.addEventListener("transitionend", done);
    // Fallback in case transitionend never fires (e.g. reduced-motion)
    setTimeout(done, 350);
  };

  const handleDismiss = () => {
    if (onDismiss) animateOut(onDismiss);
  };

  // Keyboard: Escape → dismiss
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleDismiss();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  });

  const submitAnswer = (answer: string | string[]) => {
    animateOut(() => onAnswer(answer));
  };

  const handleSingleSelect = (option: string) => {
    submitAnswer(option);
  };

  const toggleMultiOption = (option: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(option)) next.delete(option);
      else next.add(option);
      return next;
    });
  };

  const handleConfirmMulti = () => {
    const answers: string[] = [];
    for (const option of selected) answers.push(option);
    if (allowCustom && customText.trim()) answers.push(customText.trim());
    if (answers.length > 0) submitAnswer(answers);
  };

  const handleCustomSubmit = () => {
    const trimmed = customText.trim();
    if (!trimmed) return;
    if (multiSelect) {
      const answers = [...selected, trimmed];
      submitAnswer(answers);
    } else {
      submitAnswer(trimmed);
    }
  };

  const hasSelection = selected.size > 0 || (allowCustom && customText.trim().length > 0);

  return (
    <div className="p-6">
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-label="Assistant question"
        tabIndex={-1}
        className={[
          "bg-surface-container rounded-[24px] border border-primary/30 px-6 py-5 flex flex-col gap-4",
          "transition-all duration-300 ease-out",
          visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4",
        ].join(" ")}
      >
        {/* Header row */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-2">
            <span
              className="material-symbols-outlined text-primary text-lg"
              aria-hidden="true"
            >
              help
            </span>
            <p className="text-on-surface font-body text-[0.9375rem] font-medium leading-snug">
              {question}
            </p>
          </div>
          {onDismiss && (
            <button
              type="button"
              aria-label="Dismiss question"
              onClick={handleDismiss}
              className="text-text-muted hover:text-on-surface transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-sm shrink-0"
            >
              <span className="material-symbols-outlined text-lg" aria-hidden="true">
                close
              </span>
            </button>
          )}
        </div>

        {/* Options */}
        {options.length > 0 && (
          <div
            role={multiSelect ? "group" : "listbox"}
            aria-label="Answer options"
            className="flex flex-wrap gap-2"
          >
            {options.map((option) =>
              multiSelect ? (
                <label
                  key={option}
                  className={[
                    "flex items-center gap-2 px-4 py-2 rounded-full border cursor-pointer",
                    "text-[0.875rem] font-body transition-colors",
                    "focus-within:ring-2 focus-within:ring-primary",
                    selected.has(option)
                      ? "bg-primary/15 border-primary/60 text-on-surface"
                      : "bg-surface-container-high border-border-subtle text-text-muted hover:border-primary/40 hover:text-on-surface",
                  ].join(" ")}
                >
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={selected.has(option)}
                    onChange={() => toggleMultiOption(option)}
                    aria-label={option}
                  />
                  {selected.has(option) && (
                    <span
                      className="material-symbols-outlined text-primary text-sm"
                      aria-hidden="true"
                    >
                      check
                    </span>
                  )}
                  {option}
                </label>
              ) : (
                <button
                  key={option}
                  type="button"
                  role="option"
                  aria-selected={false}
                  onClick={() => handleSingleSelect(option)}
                  className={[
                    "px-4 py-2 rounded-full border text-[0.875rem] font-body",
                    "transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                    "bg-surface-container-high border-border-subtle text-text-muted",
                    "hover:bg-primary/10 hover:border-primary/50 hover:text-on-surface",
                  ].join(" ")}
                >
                  {option}
                </button>
              )
            )}
          </div>
        )}

        {/* Custom text input */}
        {allowCustom && (
          <div className="flex gap-2">
            <label htmlFor="ask-user-custom-input" className="sr-only">
              Custom answer
            </label>
            <input
              ref={customInputRef}
              id="ask-user-custom-input"
              type="text"
              value={customText}
              onChange={(e) => setCustomText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleCustomSubmit();
                }
              }}
              placeholder={options.length > 0 ? "Or type a custom answer…" : "Type your answer…"}
              className={[
                "flex-1 bg-surface-container-high border border-border-default rounded-xl",
                "px-4 py-2 text-[0.875rem] text-on-surface placeholder:text-text-muted",
                "focus:outline-none focus:ring-2 focus:ring-primary/60 transition-colors",
              ].join(" ")}
            />
            {!multiSelect && (
              <button
                type="button"
                disabled={!customText.trim()}
                onClick={handleCustomSubmit}
                className={[
                  "px-4 py-2 rounded-xl text-[0.875rem] font-medium transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                  "bg-primary text-on-primary disabled:opacity-50 disabled:cursor-not-allowed",
                  "hover:opacity-90",
                ].join(" ")}
              >
                Send
              </button>
            )}
          </div>
        )}

        {/* Confirm button for multi-select */}
        {multiSelect && (
          <div className="flex justify-end">
            <button
              type="button"
              disabled={!hasSelection}
              onClick={handleConfirmMulti}
              className={[
                "px-5 py-2 rounded-xl text-[0.875rem] font-medium transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                "bg-primary text-on-primary disabled:opacity-50 disabled:cursor-not-allowed",
                "hover:opacity-90",
              ].join(" ")}
            >
              Confirm
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
