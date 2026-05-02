import { ThreadList } from "@/components/chat/ThreadList";
import { ChatInput } from "@/components/chat/ChatInput";

const agents = [
  {
    name: "Architect",
    role: "System Design & Schema",
    status: "SYNTHESIZING",
    active: true,
    icon: "architecture",
    colorClass: "text-primary",
    dotClass: "bg-primary",
  },
  {
    name: "Lead Dev",
    role: "Core Logic Implementation",
    status: "IDLE",
    active: false,
    icon: "code",
    colorClass: "text-text-muted",
    dotClass: "bg-text-muted",
  },
  {
    name: "Reviewer",
    role: "Quality Assurance & Linting",
    status: "RUNNING",
    active: true,
    icon: "rate_review",
    colorClass: "text-secondary",
    dotClass: "bg-secondary",
  },
];

export default function HomePage() {
  return (
    <div className="flex-1 flex gap-6 box-border md:ml-[104px]">
      <ThreadList />

      {/* Center chat section */}
      <section aria-label="Chat" className="flex-1 flex flex-col glass-panel rounded-3xl overflow-hidden relative">
        <div className="p-8 border-b border-white/5 flex justify-between items-center bg-surface-container/20">
          <div>
            <h2 className="font-h1 text-2xl font-semibold text-on-surface">
              Building a CRM website
            </h2>
            <p className="text-[13px] text-text-muted mt-1">
              Initiated 2 hours ago · 7 active agents
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
                Build a CRM website for me
              </p>
            </div>
          </div>

          {/* Assistant message with agent cards */}
          <div className="flex gap-4">
            <div
              className="w-10 h-10 rounded-full bg-primary-container flex items-center justify-center shrink-0"
              aria-hidden="true"
            >
              <span className="material-symbols-outlined text-on-primary-container">smart_toy</span>
            </div>
            <div className="flex-1">
              <p className="text-[16px] text-on-surface leading-relaxed mb-4">
                Spinning up 6 agents to work in parallel on your request:
              </p>

              <ul
                aria-label="Active agents"
                className="flex flex-col gap-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar mb-6 list-none"
              >
                {agents.map((agent) => (
                  <li
                    key={agent.name}
                    className={[
                      "agent-card flex items-center gap-4 p-4 rounded-2xl",
                      agent.active ? "opacity-100" : "opacity-70",
                    ].join(" ")}
                  >
                    <div
                      className={[
                        "w-10 h-10 rounded-full border flex items-center justify-center",
                        agent.active
                          ? "border-primary/30 bg-primary-container/20"
                          : "border-white/10 bg-surface-container",
                      ].join(" ")}
                      aria-hidden="true"
                    >
                      <span className="material-symbols-outlined text-primary text-sm">
                        {agent.icon}
                      </span>
                    </div>
                    <div className="flex-1">
                      <div className="font-medium text-[15px] text-on-surface">
                        {agent.name}
                      </div>
                      <div className="text-[13px] text-text-muted">
                        {agent.role}
                      </div>
                    </div>
                    <div className="flex items-center gap-2" aria-label={`Status: ${agent.status}`}>
                      <span
                        className={[
                          "w-2 h-2 rounded-full",
                          agent.dotClass,
                          agent.active ? "animate-pulse" : "",
                        ].join(" ")}
                        aria-hidden="true"
                      />
                      <span
                        className={[
                          "text-[11px] font-bold uppercase tracking-wider",
                          agent.colorClass,
                        ].join(" ")}
                      >
                        {agent.status}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        <ChatInput />
      </section>

      {/* Right swarm panel */}
      <aside
        aria-label="Swarm topology"
        className="hidden xl:flex w-[35%] glass-panel rounded-3xl flex-col overflow-hidden relative"
      >
        <div className="p-6 border-b border-white/5">
          <h3 className="font-h1 text-xl font-semibold text-on-surface">
            Swarm Agents
          </h3>
          <div className="flex gap-2 mt-2">
            <span className="px-3 py-1 rounded-full bg-primary/10 text-primary text-[11px] uppercase font-bold tracking-wider">
              Tree Hierarchy
            </span>
            <span className="px-3 py-1 rounded-full bg-surface-container text-text-muted text-[11px] uppercase font-bold tracking-wider">
              Live Status
            </span>
          </div>
        </div>
        <div className="flex-1 relative flex items-center justify-center overflow-hidden">
          <svg
            aria-hidden="true"
            className="absolute inset-0 w-full h-full pointer-events-none"
          >
            <line
              className="topology-line"
              stroke="rgba(224, 182, 255, 0.25)"
              strokeWidth="1"
              x1="50%"
              y1="15%"
              x2="25%"
              y2="35%"
            />
            <line
              className="topology-line"
              stroke="rgba(224, 182, 255, 0.25)"
              strokeWidth="1"
              x1="50%"
              y1="15%"
              x2="75%"
              y2="35%"
            />
          </svg>

          <div className="absolute top-[8%] left-1/2 -translate-x-1/2 z-20">
            <div className="bg-surface-container border border-primary/30 w-28 rounded-xl p-2 flex flex-col items-center gap-1 border-t-2 border-t-primary">
              <div className="w-10 h-10 rounded-full border-2 border-primary/50 avatar-glow bg-primary-container flex items-center justify-center">
                <span className="material-symbols-outlined text-white text-sm" aria-hidden="true">
                  memory
                </span>
              </div>
              <div className="text-center">
                <div className="text-[11px] font-bold text-on-surface uppercase tracking-wider">
                  ORCHESTRATOR
                </div>
                <div className="text-[11px] text-primary/80 font-code">
                  V_CORE.ROOT
                </div>
              </div>
              <div className="flex items-center gap-1" aria-label="Status: Active">
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" aria-hidden="true" />
                <span className="text-[11px] text-primary font-bold">
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
