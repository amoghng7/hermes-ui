"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { memo } from "react";

interface ThreadLinkItemProps {
  href: string;
  title: string;
  subtitle: string;
}

const ThreadLinkItem = memo(function ThreadLinkItem({
  href,
  title,
  subtitle,
}: ThreadLinkItemProps) {
  const pathname = usePathname();
  const active = pathname === href;

  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={[
        "flex flex-col gap-1 p-4 rounded-2xl text-left transition-all group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
        active
          ? "bg-primary/10 ring-1 ring-primary/50"
          : "hover:bg-hover-subtle",
      ].join(" ")}
    >
      <span
        className={[
          "font-medium text-[0.9375rem] transition-colors",
          active
            ? "text-primary"
            : "text-on-surface group-hover:text-primary",
        ].join(" ")}
      >
        {title}
      </span>
      <span className="text-[0.8125rem] text-text-muted truncate">{subtitle}</span>
    </Link>
  );
});

export const ThreadList: React.FC = () => {
  return (
    <aside
      aria-label="Conversation threads"
      className="hidden lg:flex lg:w-1/5 flex-col gap-4 bg-surface-container rounded-3xl p-6 overflow-hidden border border-border-subtle"
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-h2 text-xl font-semibold text-primary">Threads</h3>
        <button
          aria-label="Filter threads"
          className="text-text-muted hover:text-on-surface transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-sm"
        >
          <span className="material-symbols-outlined" aria-hidden="true">filter_list</span>
        </button>
      </div>
      <div className="flex flex-col gap-3 overflow-y-auto pr-2 custom-scrollbar">
        <div className="text-text-muted text-[0.75rem] font-medium uppercase tracking-wider mb-2">
          Today
        </div>
        <ThreadLinkItem
          href="/"
          title="Building a CRM website"
          subtitle="Analyzing multi-agent consensus..."
        />
        <ThreadLinkItem
          href="/history"
          title="Quantum Swarm Logic"
          subtitle="Tracing backpropagation events..."
        />

        <div className="text-text-muted text-[0.75rem] font-medium uppercase tracking-wider mt-4 mb-2">
          Yesterday
        </div>
        <button className="flex flex-col gap-1 p-4 rounded-2xl hover:bg-hover-subtle text-left transition-all group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
          <span className="font-medium text-[0.9375rem] text-on-surface group-hover:text-primary transition-colors">
            Semantic Drift Detection
          </span>
          <span className="text-[0.8125rem] text-text-muted truncate">
            Comparing vector embeddings...
          </span>
        </button>
        <button className="flex flex-col gap-1 p-4 rounded-2xl hover:bg-hover-subtle text-left transition-all group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
          <span className="font-medium text-[0.9375rem] text-on-surface group-hover:text-primary transition-colors">
            Heuristic Modeling
          </span>
          <span className="text-[0.8125rem] text-text-muted truncate">
            Simulating edge-case failures...
          </span>
        </button>
      </div>
    </aside>
  );
};
