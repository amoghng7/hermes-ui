"use client";

import { ThreadList } from "@/components/chat/ThreadList";
import { ChatInput } from "@/components/chat/ChatInput";

const agents = [
  {
    name: "Architect",
    role: "System Design & Schema",
    status: "SYNTHESIZING",
    active: true,
    color: "bg-primary",
  },
  {
    name: "Lead Dev",
    role: "Core Logic Implementation",
    status: "IDLE",
    active: false,
    color: "bg-text-muted",
  },
  {
    name: "Reviewer",
    role: "Quality Assurance & Linting",
    status: "RUNNING",
    active: true,
    color: "bg-secondary",
  },
];

export default function HomePage() {
  return (
    <div className="flex-1 flex gap-6 box-border ml-[104px]">
      <ThreadList />

      {/* Center chat section */}
      <section className="flex-1 flex flex-col glass-panel rounded-3xl overflow-hidden relative">
        <div className="p-8 border-b border-white/5 flex justify-between items-center bg-neutral-900/20">
          <div>
            <h2 className="font-h1 text-2xl font-semibold text-on-surface">
              Building a CRM website
            </h2>
            <p className="text-[13px] text-text-muted mt-1">
              Initiated 2 hours ago · 7 active agents
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
                Build a CRM website for me
              </p>
            </div>
          </div>

          {/* Assistant message with agent cards */}
          <div className="flex gap-4">
            <div className="w-10 h-10 rounded-full bg-primary-container flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-on-primary-container">
                smart_toy
              </span>
            </div>
            <div className="flex-1">
              <p className="text-[16px] text-on-surface leading-relaxed mb-4">
                Spinning up 6 agents to work parallely for your request:
              </p>

              <div className="flex flex-col gap-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar mb-6">
                {agents.map((agent) => (
                  <div
                    key={agent.name}
                    className={[
                      "agent-card flex items-center gap-4 p-4 rounded-2xl border",
                      agent.active
                        ? "border-white/10"
                        : "border-white/5 opacity-80",
                    ].join(" ")}
                  >
                    <div
                      className={[
                        "w-10 h-10 rounded-full overflow-hidden border grayscale",
                        agent.active
                          ? "border-violet-400/50"
                          : "border-white/10",
                      ].join(" ")}
                    >
                      <div className="w-full h-full bg-primary-container/30 flex items-center justify-center">
                        <span className="material-symbols-outlined text-primary text-sm">
                          {agent.name === "Architect"
                            ? "architecture"
                            : agent.name === "Lead Dev"
                              ? "code"
                              : "rate_review"}
                        </span>
                      </div>
                    </div>
                    <div className="flex-1">
                      <div className="font-medium text-[15px] text-on-surface">
                        {agent.name}
                      </div>
                      <div className="text-[13px] text-text-muted">
                        {agent.role}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={[
                          "w-2 h-2 rounded-full",
                          agent.color,
                          agent.active ? "animate-pulse" : "",
                        ].join(" ")}
                      />
                      <span
                        className={[
                          "text-[10px] font-bold uppercase tracking-tighter",
                          agent.active
                            ? agent.color === "bg-primary"
                              ? "text-primary"
                              : "text-secondary"
                            : "text-text-muted",
                        ].join(" ")}
                      >
                        {agent.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <ChatInput />
      </section>

      {/* Right swarm panel */}
      <aside className="w-[35%] glass-panel rounded-3xl flex flex-col overflow-hidden relative">
        <div className="p-6 border-b border-white/5">
          <h3 className="font-h1 text-xl font-semibold text-on-surface">
            Swarm Agents
          </h3>
          <div className="flex gap-2 mt-2">
            <span className="px-3 py-1 rounded-full bg-violet-600/20 text-primary text-[10px] uppercase font-bold tracking-tighter">
              Tree Hierarchy
            </span>
            <span className="px-3 py-1 rounded-full bg-white/5 text-text-muted text-[10px] uppercase font-bold tracking-tighter">
              Live Status
            </span>
          </div>
        </div>
        <div className="flex-1 relative flex items-center justify-center overflow-hidden">
          <svg
            className="absolute inset-0 w-full h-full pointer-events-none"
            style={{
              filter: "drop-shadow(0 0 4px rgba(224, 182, 255, 0.2))",
            }}
          >
            <line
              className="topology-line"
              stroke="rgba(224, 182, 255, 0.3)"
              strokeWidth="1"
              x1="50%"
              y1="15%"
              x2="25%"
              y2="35%"
            />
            <line
              className="topology-line"
              stroke="rgba(224, 182, 255, 0.3)"
              strokeWidth="1"
              x1="50%"
              y1="15%"
              x2="75%"
              y2="35%"
            />
          </svg>

          <div className="absolute top-[8%] left-1/2 -translate-x-1/2 z-20">
            <div className="agent-card w-28 rounded-xl p-2 flex flex-col items-center gap-1 border-t-2 border-t-primary">
              <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-primary avatar-glow">
                <div className="w-full h-full bg-primary-container flex items-center justify-center">
                  <span className="material-symbols-outlined text-white text-sm">
                    memory
                  </span>
                </div>
              </div>
              <div className="text-center">
                <div className="text-[9px] font-bold text-on-surface uppercase tracking-wider">
                  ORCHESTRATOR
                </div>
                <div className="text-[7px] text-primary/80 font-code">
                  V_CORE.ROOT
                </div>
              </div>
              <div className="flex items-center gap-1">
                <span className="w-1 h-1 rounded-full bg-primary animate-pulse" />
                <span className="text-[7px] text-primary font-bold">
                  ACTIVE
                </span>
              </div>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}
