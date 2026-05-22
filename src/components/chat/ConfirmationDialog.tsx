"use client";

import { useEffect, useRef, useState } from "react";

export interface ConfirmationDialogProps {
  /** Name of the tool about to be executed. */
  toolName: string;
  /** Parameters the tool will be called with. */
  parameters: Record<string, unknown>;
  /** Optional warning text about the action's consequences. */
  warningText?: string;
  /** Called when the user approves the action. */
  onApprove: () => void;
  /** Called when the user denies the action. */
  onDeny: () => void;
}

/**
 * ConfirmationDialog — shown before executing a potentially destructive tool
 * call (e.g. `rm -rf`, `DELETE` requests).  Presents tool details and
 * Approve / Deny buttons.
 */
export function ConfirmationDialog({
  toolName,
  parameters,
  warningText,
  onApprove,
  onDeny,
}: ConfirmationDialogProps) {
  const [visible, setVisible] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Trigger slide-up animation on mount
  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const animateOut = (callback: () => void) => {
    setVisible(false);
    const el = containerRef.current;
    if (!el) {
      callback();
      return;
    }
    // Guard with `called` to prevent both transitionend and the fallback
    // setTimeout from firing the callback twice.
    let called = false;
    const done = () => {
      if (called) return;
      called = true;
      el.removeEventListener("transitionend", done);
      callback();
    };
    el.addEventListener("transitionend", done);
    setTimeout(done, 350);
  };

  const handleApprove = () => animateOut(onApprove);
  const handleDeny = () => animateOut(onDeny);

  // Keyboard: Escape → deny
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleDeny();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  });

  const paramsJson = JSON.stringify(parameters, null, 2);

  return (
    <div className="p-6">
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-label="Confirm dangerous action"
        className={[
          "bg-surface-container rounded-[24px] border border-status-error/40 px-6 py-5 flex flex-col gap-4",
          "transition-all duration-300 ease-out",
          visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4",
        ].join(" ")}
      >
        {/* Warning header */}
        <div className="flex items-start gap-3">
          <span
            className="material-symbols-outlined text-status-error text-xl mt-0.5 shrink-0"
            aria-hidden="true"
          >
            warning
          </span>
          <div className="flex flex-col gap-1">
            <p className="text-on-surface font-body text-[0.9375rem] font-semibold">
              Confirm dangerous action
            </p>
            {warningText && (
              <p className="text-text-muted text-[0.8125rem]">{warningText}</p>
            )}
          </div>
        </div>

        {/* Tool info */}
        <div className="bg-surface-container-high rounded-xl border border-border-subtle p-4 flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <span
              className="material-symbols-outlined text-tertiary text-base"
              aria-hidden="true"
            >
              build
            </span>
            <span className="font-code text-[0.8125rem] text-tertiary font-semibold">
              {toolName}
            </span>
          </div>
          {Object.keys(parameters).length > 0 && (
            <pre className="font-code text-[0.75rem] text-text-muted leading-relaxed whitespace-pre-wrap break-all">
              {paramsJson}
            </pre>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={handleDeny}
            className={[
              "px-5 py-2 rounded-xl text-[0.875rem] font-medium transition-colors",
              "border border-border-default text-on-surface bg-surface-container-high",
              "hover:bg-surface-container hover:border-border-subtle",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
            ].join(" ")}
          >
            Deny
          </button>
          <button
            type="button"
            onClick={handleApprove}
            className={[
              "px-5 py-2 rounded-xl text-[0.875rem] font-medium transition-colors",
              "bg-status-error text-white hover:opacity-90",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-status-error",
            ].join(" ")}
          >
            Approve
          </button>
        </div>
      </div>
    </div>
  );
}
