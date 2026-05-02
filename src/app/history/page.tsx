"use client";

import { ThreadList } from "@/components/chat/ThreadList";
import { ChatInput } from "@/components/chat/ChatInput";
import { useState } from "react";

export default function HistoryPage() {
  const [showCard, setShowCard] = useState(true);

  return (
    <div className="flex-1 flex gap-6 box-border ml-[104px]">
      <ThreadList />

      {/* Center chat section */}
      <section className="flex-1 flex flex-col glass-panel rounded-3xl overflow-hidden relative">
        <div className="p-8 border-b border-white/5 flex justify-between items-center bg-neutral-900/20">
          <div>
            <h2 className="font-h1 text-2xl font-semibold text-on-surface">
              Quantum Swarm Logic
            </h2>
            <p className="text-[13px] text-text-muted mt-1">
              Initiated 2 hours ago · 4 active agents
            </p>
          </div>
          <button className="glass-panel p-3 rounded-xl hover:bg-violet-600/10 transition-colors">
            <span className="material-symbols-outlined text-primary">share</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-8 flex flex-col gap-8 custom-scrollbar">
          {/* User message */}
          <div className="flex justify-end">
            <div className="max-w-[85%] glass-panel rounded-3xl p-6 bg-white/5">
              <p className="text-[16px] text-on-surface">
                Can you visualize the decision-making process of the Swarm when
                navigating the conflict between Agent 7 and Agent 12 regarding
                the ethical threshold parameters?
              </p>
            </div>
          </div>

          {/* Assistant message */}
          <div className="flex gap-4">
            <div className="w-10 h-10 rounded-full bg-primary-container flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-on-primary-container">
                smart_toy
              </span>
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
                <div className="text-violet-400"># Mediation Logs</div>
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

      {/* Right swarm visualizer */}
      <aside className="w-[35%] glass-panel rounded-3xl flex flex-col overflow-hidden relative">
        <div className="p-6 border-b border-white/5">
          <h3 className="font-h1 text-xl font-semibold text-on-surface">
            Swarm Visualizer
          </h3>
          <div className="flex gap-2 mt-2">
            <span className="px-3 py-1 rounded-full bg-violet-600/20 text-primary text-[10px] uppercase font-bold tracking-tighter">
              Real-time Simulation
            </span>
            <span className="px-3 py-1 rounded-full bg-white/5 text-text-muted text-[10px] uppercase font-bold tracking-tighter">
              Historical Sync
            </span>
          </div>
        </div>

        <div className="flex-1 relative flex items-center justify-center overflow-hidden">
          <div className="absolute w-[300px] h-[300px] bg-violet-600/20 rounded-full blur-[100px] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />

          <div className="relative z-10 grid grid-cols-3 gap-12">
            <div className="flex flex-col items-center gap-2 group">
              <div className="w-16 h-16 rounded-full border-2 border-violet-500/50 flex items-center justify-center bg-neutral-950 shadow-[0_0_20px_rgba(157,78,221,0.3)] animate-pulse">
                <span className="material-symbols-outlined text-violet-400">
                  hub
                </span>
              </div>
              <span className="text-[10px] text-text-muted font-code">
                AGENT_07
              </span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <div className="w-16 h-16 rounded-full border-2 border-white/10 flex items-center justify-center bg-neutral-950 scale-110">
                <span className="material-symbols-outlined text-white">
                  memory
                </span>
              </div>
              <span className="text-[10px] text-text-muted font-code">
                ORCHESTRATOR
              </span>
            </div>
            <div className="flex flex-col items-center gap-2 group">
              <div className="w-16 h-16 rounded-full border-2 border-violet-500/50 flex items-center justify-center bg-neutral-950 shadow-[0_0_20px_rgba(157,78,221,0.3)]">
                <span className="material-symbols-outlined text-violet-400">
                  dns
                </span>
              </div>
              <span className="text-[10px] text-text-muted font-code">
                AGENT_12
              </span>
            </div>
          </div>

          {showCard && (
            <div className="absolute inset-x-6 top-24 z-30 glass-panel bg-neutral-900/90 text-neutral-100 rounded-3xl p-6 shadow-2xl backdrop-blur-3xl border border-white/20">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 bg-primary-container flex items-center justify-center shadow-lg rounded-full overflow-hidden">
                  <span className="material-symbols-outlined text-white">
                    person
                  </span>
                </div>
                <div>
                  <h4 className="font-h1 text-[18px] font-bold leading-tight text-white">
                    Code Review Agent
                  </h4>
                  <p className="text-[12px] text-text-muted font-code uppercase tracking-widest">
                    Name: sarah
                  </p>
                </div>
              </div>
              <div className="space-y-6">
                <section>
                  <h5 className="text-[12px] font-bold uppercase tracking-wider text-primary mb-2">
                    Role Description
                  </h5>
                  <p className="text-[14px] leading-relaxed opacity-80 text-white">
                    Reviews the agent generated code and adds review issues if
                    any.
                  </p>
                </section>
              </div>
              <div className="mt-8 pt-4 border-t border-white/5 flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-violet-500/20 flex items-center justify-center">
                    <span className="material-symbols-outlined text-[14px] text-primary">
                      token
                    </span>
                  </div>
                  <span className="text-[10px] font-bold tracking-tighter uppercase opacity-40 text-white">
                    7 Tools
                  </span>
                </div>
                <button
                  className="text-[12px] font-bold text-primary hover:underline"
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
