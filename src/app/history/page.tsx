"use client";

import { ThreadList } from "@/components/chat/ThreadList";
import { ChatInput } from "@/components/chat/ChatInput";
import { useState, useEffect, useRef } from "react";

export default function HistoryPage() {
  const [showCard, setShowCard] = useState(true);
  const dialogRef = useRef<HTMLDivElement>(null);
  const dismissButtonRef = useRef<HTMLButtonElement>(null);

  // Focus the dialog when it opens
  useEffect(() => {
    if (showCard && dialogRef.current) {
      dialogRef.current.focus();
    }
  }, [showCard]);

  // Escape key dismissal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && showCard) {
        setShowCard(false);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [showCard]);

  return (
    <div className="flex-1 flex gap-6 box-border md:ml-[104px]">
      <ThreadList />

      {/* Center chat section */}
      <section aria-label="Chat" className="flex-1 flex flex-col glass-panel rounded-3xl overflow-hidden relative">
        <div className="p-8 border-b border-white/5 flex justify-between items-center bg-surface-container/20">
          <div>
            <h2 className="font-h1 text-2xl font-semibold text-on-surface">
              Quantum Swarm Logic
            </h2>
            <p className="text-[13px] text-text-muted mt-1">
              Initiated 2 hours ago · 4 active agents
            </p>
          </div>
          <button
            aria-label="Share thread"
            className="bg-surface-container p-3 rounded-xl hover:bg-primary/10 border border-white/5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <span className="material-symbols-outlined text-primary" aria-hidden="true">share</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-8 flex flex-col gap-8 custom-scrollbar">
          {/* User message */}
          <div className="flex justify-end">
            <div className="max-w-[85%] bg-surface-container-high rounded-3xl p-6 border border-white/5">
              <p className="text-[16px] text-on-surface">
                Can you visualize the decision-making process of the Swarm when
                navigating the conflict between Agent 7 and Agent 12 regarding
                the ethical threshold parameters?
              </p>
            </div>
          </div>

          {/* Assistant message */}
          <div className="flex gap-4">
            <div
              className="w-10 h-10 rounded-full bg-primary-container flex items-center justify-center shrink-0"
              aria-hidden="true"
            >
              <span className="material-symbols-outlined text-on-primary-container">smart_toy</span>
            </div>
            <div className="flex-1">
              <p className="text-[16px] text-on-surface leading-relaxed">
                Analyzing the inter-agent friction. Agent 7 (Safety Focus)
                flagged the proposed heuristic as potentially violating the
                3rd-tier ethical constraint. Agent 12 (Efficiency Focus)
                prioritized the throughput. The Swarm consensus mechanism
                successfully mediated this by synthesizing a hybrid threshold
                that maintains safety without compromising latency.
              </p>
              <div className="mt-6 p-4 rounded-2xl bg-terminal-bg border border-white/10 font-code text-[13px]">
                <div className="text-primary/80"># Mediation Logs</div>
                <div className="text-text-muted">
                  A07_WEIGHT: 0.82 | A12_WEIGHT: 0.18
                </div>
                <div className="text-secondary">
                  SYNTHESIS_STATUS: SUCCESSFUL
                </div>
                <div className="text-text-muted">BIAS_ADJUSTMENT: -0.042ms</div>
              </div>
            </div>
          </div>
        </div>

        <ChatInput />
      </section>

      {/* Right swarm visualizer — differentiated from home page with list-based layout */}
      <aside
        aria-label="Swarm visualizer"
        className="hidden xl:flex w-[35%] bg-surface-container rounded-3xl flex-col overflow-hidden relative border border-white/5"
      >
        <div className="p-6 border-b border-white/5">
          <h3 className="font-h1 text-xl font-semibold text-on-surface">
            Swarm Visualizer
          </h3>
          <div className="flex gap-2 mt-2">
            <span className="px-3 py-1 rounded-full bg-primary/10 text-primary text-[11px] uppercase font-bold tracking-wider">
              Real-time Simulation
            </span>
            <span className="px-3 py-1 rounded-full bg-surface-container-high text-text-muted text-[11px] uppercase font-bold tracking-wider">
              Historical Sync
            </span>
          </div>
        </div>

        <div className="flex-1 relative flex items-center justify-center overflow-hidden">
          <div className="relative z-10 grid grid-cols-3 gap-12">
            <div className="flex flex-col items-center gap-2 group">
              <div className="w-16 h-16 rounded-full border-2 border-primary/40 flex items-center justify-center bg-surface-container-low shadow-[0_0_16px_rgba(157,78,221,0.2)] animate-pulse">
                <span className="material-symbols-outlined text-primary" aria-hidden="true">hub</span>
              </div>
              <span className="text-[11px] text-text-muted font-code">AGENT_07</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <div className="w-16 h-16 rounded-full border-2 border-white/10 flex items-center justify-center bg-surface-container-low scale-110">
                <span className="material-symbols-outlined text-on-surface" aria-hidden="true">memory</span>
              </div>
              <span className="text-[11px] text-text-muted font-code">ORCHESTRATOR</span>
            </div>
            <div className="flex flex-col items-center gap-2 group">
              <div className="w-16 h-16 rounded-full border-2 border-primary/40 flex items-center justify-center bg-surface-container-low shadow-[0_0_16px_rgba(157,78,221,0.2)]">
                <span className="material-symbols-outlined text-primary" aria-hidden="true">dns</span>
              </div>
              <span className="text-[11px] text-text-muted font-code">AGENT_12</span>
            </div>
          </div>

          {/* Accessible dialog overlay */}
          {showCard && (
            <div
              ref={dialogRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby="agent-card-title"
              tabIndex={-1}
              className="absolute inset-x-6 top-24 z-30 bg-surface-container-high text-on-surface rounded-3xl p-6 shadow-2xl border border-white/10 focus:outline-none"
            >
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 bg-primary-container flex items-center justify-center rounded-full">
                  <span className="material-symbols-outlined text-white" aria-hidden="true">person</span>
                </div>
                <div>
                  <h4 id="agent-card-title" className="font-h1 text-[18px] font-bold leading-tight text-on-surface">
                    Code Review Agent
                  </h4>
                  <p className="text-[12px] text-text-muted font-code uppercase tracking-widest">
                    Name: sarah
                  </p>
                </div>
              </div>
              <div className="space-y-4">
                <section aria-labelledby="role-desc-heading">
                  <h5 id="role-desc-heading" className="text-[12px] font-bold uppercase tracking-wider text-primary mb-2">
                    Role Description
                  </h5>
                  <p className="text-[14px] leading-relaxed text-on-surface-variant">
                    Reviews the agent generated code and adds review issues if any.
                  </p>
                </section>
              </div>
              <div className="mt-8 pt-4 border-t border-white/5 flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="material-symbols-outlined text-[14px] text-primary" aria-hidden="true">token</span>
                  </div>
                  <span className="text-[11px] font-bold tracking-wider uppercase text-text-muted">
                    7 Tools
                  </span>
                </div>
                <button
                  ref={dismissButtonRef}
                  className="text-[13px] font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-sm"
                  onClick={() => setShowCard(false)}
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
