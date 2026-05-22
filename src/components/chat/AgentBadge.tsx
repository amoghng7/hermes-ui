"use client";

/** Colored origin badge for messages coming from a named subagent. */
export interface AgentBadgeProps {
  /** Display name of the agent (e.g. "researcher-1"). */
  name: string;
  /** Optional role label (e.g. "Researcher", "Coder"). */
  role?: string;
}

/** Deterministic hue from a string name — same name always → same color. */
function nameToHue(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) & 0xffffffff;
  }
  return Math.abs(hash) % 360;
}

export function AgentBadge({ name, role }: AgentBadgeProps) {
  const hue = nameToHue(name);
  const bg = `hsl(${hue} 40% 25%)`;
  const text = `hsl(${hue} 70% 75%)`;
  const border = `hsl(${hue} 50% 40%)`;

  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[0.6875rem] font-bold uppercase tracking-wider border"
      style={{ background: bg, color: text, borderColor: border }}
      aria-label={`Message from ${name}${role ? ` (${role})` : ""}`}
    >
      <span className="material-symbols-outlined text-[0.875rem]" aria-hidden="true">
        smart_toy
      </span>
      {name}
      {role && <span className="opacity-70">· {role}</span>}
    </span>
  );
}
