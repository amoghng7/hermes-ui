"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export const ThreadList: React.FC = () => {
  const pathname = usePathname();

  const threadLink = (href: string, title: string, subtitle: string) => {
    const active = pathname === href;
    return (
      <Link
        href={href}
        aria-current={active ? "page" : undefined}
        className={[
          "flex flex-col gap-1 p-4 rounded-2xl text-left transition-all group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
          active
            ? "bg-primary/10 ring-1 ring-primary/50"
            : "hover:bg-white/5",
        ].join(" ")}
      >
        <span
          className={[
            "font-medium text-[15px] transition-colors",
            active
              ? "text-primary"
              : "text-on-surface group-hover:text-primary",
          ].join(" ")}
        >
          {title}
        </span>
        <span className="text-[13px] text-text-muted truncate">{subtitle}</span>
      </Link>
    );
  };

  return (
    <aside
      aria-label="Conversation threads"
      className="hidden lg:flex w-1/5 flex-col gap-4 bg-surface-container rounded-3xl p-6 overflow-hidden border border-white/5"
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-h2 text-xl font-semibold text-primary">Threads</h3>
        <button aria-label="Filter threads" className="text-text-muted hover:text-on-surface transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-sm">
          <span className="material-symbols-outlined" aria-hidden="true">filter_list</span>
        </button>
      </div>
      <div className="flex flex-col gap-3 overflow-y-auto pr-2 custom-scrollbar">
        <div className="text-text-muted text-xs font-medium uppercase tracking-wider mb-2">
          Today
        </div>
        {threadLink("/", "Building a CRM website", "Analyzing multi-agent consensus...")}
        {threadLink(
          "/history",
          "Quantum Swarm Logic",
          "Tracing backpropagation events..."
        )}

        <div className="text-text-muted text-xs font-medium uppercase tracking-wider mt-4 mb-2">
          Yesterday
        </div>
        <button className="flex flex-col gap-1 p-4 rounded-2xl hover:bg-white/5 text-left transition-all group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
          <span className="font-medium text-[15px] text-on-surface group-hover:text-primary transition-colors">
            Semantic Drift Detection
          </span>
          <span className="text-[13px] text-text-muted truncate">
            Comparing vector embeddings...
          </span>
        </button>
        <button className="flex flex-col gap-1 p-4 rounded-2xl hover:bg-white/5 text-left transition-all group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
          <span className="font-medium text-[15px] text-on-surface group-hover:text-primary transition-colors">
            Heuristic Modeling
          </span>
          <span className="text-[13px] text-text-muted truncate">
            Simulating edge-case failures...
          </span>
        </button>
      </div>
    </aside>
  );
};
