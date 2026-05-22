"use client";

import { useEffect, useState } from "react";

export interface TodoItem {
  id: string;
  label: string;
  checked: boolean;
}

export interface TodoChecklistProps {
  items: TodoItem[];
  /** Called when a user toggles a checkbox. Pass to wire Hermes todo update. */
  onToggle?: (id: string, checked: boolean) => void;
}

/**
 * Parse GFM task-list markdown into TodoItems.
 * Matches lines like "- [ ] label" or "- [x] label".
 */
export function parseTaskList(markdown: string): TodoItem[] {
  const lines = markdown.split("\n");
  const items: TodoItem[] = [];
  let index = 0;
  for (const line of lines) {
    const match = /^[-*]\s+\[([ xX])\]\s+(.+)$/.exec(line.trim());
    if (match) {
      items.push({
        id: `todo-${index}`,
        label: match[2] ?? "",
        checked: match[1] !== " ",
      });
      index++;
    }
  }
  return items;
}

export function TodoChecklist({ items, onToggle }: TodoChecklistProps) {
  const [localItems, setLocalItems] = useState<TodoItem[]>(items);

  // Sync local state when the prop is updated (e.g. streaming tool results)
  useEffect(() => {
    setLocalItems(items);
  }, [items]);

  const handleToggle = (id: string) => {
    const item = localItems.find((i) => i.id === id);
    if (!item) return;
    const newChecked = !item.checked;
    setLocalItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, checked: newChecked } : i))
    );
    onToggle?.(id, newChecked);
  };

  if (localItems.length === 0) return null;

  const doneCount = localItems.filter((i) => i.checked).length;

  return (
    <div className="rounded-xl border border-border-subtle bg-surface-container p-4 my-2">
      <div className="flex items-center gap-2 mb-3">
        <span className="material-symbols-outlined text-[1rem] text-primary" aria-hidden="true">
          checklist
        </span>
        <span className="text-[0.75rem] font-bold uppercase tracking-wider text-text-muted">
          Tasks · {doneCount}/{localItems.length}
        </span>
      </div>
      <ul className="space-y-2" role="list">
        {localItems.map((item) => (
          <li key={item.id} className="flex items-start gap-3">
            <button
              type="button"
              role="checkbox"
              aria-checked={item.checked}
              onClick={() => handleToggle(item.id)}
              className={[
                "mt-0.5 w-5 h-5 rounded border flex-shrink-0 flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                item.checked
                  ? "bg-primary border-primary"
                  : "border-border-default bg-transparent",
              ].join(" ")}
              aria-label={item.checked ? `Uncheck: ${item.label}` : `Check: ${item.label}`}
            >
              {item.checked && (
                <span className="material-symbols-outlined text-[0.875rem] text-on-primary" aria-hidden="true">
                  check
                </span>
              )}
            </button>
            <span
              className={[
                "text-[0.9375rem] leading-snug",
                item.checked ? "line-through text-text-muted" : "text-on-surface",
              ].join(" ")}
            >
              {item.label}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
