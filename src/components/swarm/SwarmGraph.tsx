"use client";

/**
 * SwarmGraph — data-driven interactive graph visualizer for swarm agent topology.
 *
 * Accepts `agents` and `edges` derived from `delegate_task` parent–child
 * relationships and renders them as an interactive SVG graph with two view
 * modes:
 *   • Tree   — hierarchical Sugiyama-style layout (parent on top, children below)
 *   • Activity — force-directed layout; recently-active nodes repel outwards
 *
 * Supports zoom + pan via mouse-wheel / drag.  Clicking a node fires
 * `onAgentSelect(agentId)`.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Agent } from "@/types/hermes";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SwarmEdge {
  from: string;
  to: string;
}

export interface SwarmGraphProps {
  agents: Agent[];
  edges: SwarmEdge[];
  onAgentSelect?: (agentId: string) => void;
  /** Controlled view mode. Defaults to "tree". */
  viewMode?: "tree" | "activity";
  onViewModeChange?: (mode: "tree" | "activity") => void;
}

// ---------------------------------------------------------------------------
// Layout helpers
// ---------------------------------------------------------------------------

interface NodePosition {
  id: string;
  x: number;
  y: number;
  /** 0 for orchestrator, positive integer for subagents */
  depth: number;
}

/** Compute tree layout.  Root nodes (no parent in the agents list) sit at depth 0. */
function computeTreeLayout(
  agents: Agent[],
  edges: SwarmEdge[],
  width: number,
  height: number,
): NodePosition[] {
  if (agents.length === 0) return [];

  const idSet = new Set(agents.map((a) => a.id));

  // Build child-map from edges whose both ends exist in this session's agents
  const childMap: Map<string, string[]> = new Map();
  const parentMap: Map<string, string> = new Map();
  for (const edge of edges) {
    if (!idSet.has(edge.from) || !idSet.has(edge.to)) continue;
    const children = childMap.get(edge.from) ?? [];
    children.push(edge.to);
    childMap.set(edge.from, children);
    parentMap.set(edge.to, edge.from);
  }

  // Roots = agents with no incoming edge
  const roots = agents.filter((a) => !parentMap.has(a.id)).map((a) => a.id);

  // BFS to assign depth
  const depthMap: Map<string, number> = new Map();
  const queue: Array<{ id: string; depth: number }> = roots.map((id) => ({
    id,
    depth: 0,
  }));
  while (queue.length > 0) {
    const { id, depth } = queue.shift()!;
    if (depthMap.has(id)) continue;
    depthMap.set(id, depth);
    for (const child of childMap.get(id) ?? []) {
      queue.push({ id: child, depth: depth + 1 });
    }
  }
  // Assign any unreachable nodes to depth 1
  for (const a of agents) {
    if (!depthMap.has(a.id)) depthMap.set(a.id, 1);
  }

  // Group by depth
  const byDepth: Map<number, string[]> = new Map();
  for (const [id, d] of depthMap) {
    const arr = byDepth.get(d) ?? [];
    arr.push(id);
    byDepth.set(d, arr);
  }

  const maxDepth = Math.max(...Array.from(depthMap.values()));
  const verticalGap = height / (maxDepth + 2);

  const positions: NodePosition[] = [];
  for (const [depth, ids] of byDepth) {
    const count = ids.length;
    const horizontalGap = width / (count + 1);
    ids.forEach((id, i) => {
      positions.push({
        id,
        x: horizontalGap * (i + 1),
        y: verticalGap * (depth + 1),
        depth,
      });
    });
  }
  return positions;
}

/** Simple force-directed layout using iterative spring + repulsion simulation. */
function computeActivityLayout(
  agents: Agent[],
  edges: SwarmEdge[],
  width: number,
  height: number,
): NodePosition[] {
  if (agents.length === 0) return [];
  if (agents.length === 1) {
    return [{ id: agents[0].id, x: width / 2, y: height / 2, depth: 0 }];
  }

  const cx = width / 2;
  const cy = height / 2;
  const idSet = new Set(agents.map((a) => a.id));

  // Seed positions in a circle
  const nodeMap = new Map<
    string,
    { x: number; y: number; vx: number; vy: number }
  >();
  agents.forEach((a, i) => {
    const angle = (2 * Math.PI * i) / agents.length;
    const radius = Math.min(width, height) * 0.3;
    nodeMap.set(a.id, {
      x: cx + radius * Math.cos(angle),
      y: cy + radius * Math.sin(angle),
      vx: 0,
      vy: 0,
    });
  });

  const REPULSION = 3000;
  const SPRING_LENGTH = 100;
  const SPRING_K = 0.05;
  const DAMPING = 0.8;
  const CENTER_GRAVITY = 0.01;
  const ITER = 80;

  const edgePairs = edges.filter(
    (e) => idSet.has(e.from) && idSet.has(e.to),
  );

  for (let iter = 0; iter < ITER; iter++) {
    const forces = new Map<string, { fx: number; fy: number }>();
    for (const a of agents) forces.set(a.id, { fx: 0, fy: 0 });

    // Repulsion between all pairs
    const ids = Array.from(nodeMap.keys());
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const ni = nodeMap.get(ids[i])!;
        const nj = nodeMap.get(ids[j])!;
        const dx = ni.x - nj.x || 0.01;
        const dy = ni.y - nj.y || 0.01;
        const dist = Math.sqrt(dx * dx + dy * dy) || 0.01;
        const force = REPULSION / (dist * dist);
        const fx = (force * dx) / dist;
        const fy = (force * dy) / dist;
        forces.get(ids[i])!.fx += fx;
        forces.get(ids[i])!.fy += fy;
        forces.get(ids[j])!.fx -= fx;
        forces.get(ids[j])!.fy -= fy;
      }
    }

    // Spring attraction along edges
    for (const edge of edgePairs) {
      const ni = nodeMap.get(edge.from)!;
      const nj = nodeMap.get(edge.to)!;
      const dx = nj.x - ni.x;
      const dy = nj.y - ni.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 0.01;
      const stretch = dist - SPRING_LENGTH;
      const fx = SPRING_K * stretch * (dx / dist);
      const fy = SPRING_K * stretch * (dy / dist);
      forces.get(edge.from)!.fx += fx;
      forces.get(edge.from)!.fy += fy;
      forces.get(edge.to)!.fx -= fx;
      forces.get(edge.to)!.fy -= fy;
    }

    // Centre gravity — applied in the main integration loop below
    for (const [id, n] of nodeMap) {
      const f = forces.get(id)!;
      f.fx += CENTER_GRAVITY * (cx - n.x);
      f.fy += CENTER_GRAVITY * (cy - n.y);
      n.vx = (n.vx + f.fx) * DAMPING;
      n.vy = (n.vy + f.fy) * DAMPING;
      n.x += n.vx;
      n.y += n.vy;
      // Clamp to bounds
      n.x = Math.max(48, Math.min(width - 48, n.x));
      n.y = Math.max(48, Math.min(height - 48, n.y));
    }
  }

  // Active agents repel from centre
  const recentlyActiveIds = new Set(
    agents
      .filter((a) => a.status === "active" || a.status === "waiting")
      .map((a) => a.id),
  );
  for (const a of agents) {
    if (!recentlyActiveIds.has(a.id)) continue;
    const n = nodeMap.get(a.id)!;
    const dx = n.x - cx;
    const dy = n.y - cy;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    const push = 30;
    n.x += (push * dx) / dist;
    n.y += (push * dy) / dist;
    n.x = Math.max(48, Math.min(width - 48, n.x));
    n.y = Math.max(48, Math.min(height - 48, n.y));
  }

  // Build idSet → depth via parentAgentId (for sizing)
  const depthMap = new Map<string, number>();
  for (const a of agents) {
    if (!a.parentAgentId || !idSet.has(a.parentAgentId)) {
      depthMap.set(a.id, 0);
    }
  }
  for (const a of agents) {
    if (!depthMap.has(a.id)) depthMap.set(a.id, 1);
  }

  return agents.map((a) => ({
    id: a.id,
    x: nodeMap.get(a.id)!.x,
    y: nodeMap.get(a.id)!.y,
    depth: depthMap.get(a.id) ?? 1,
  }));
}

// ---------------------------------------------------------------------------
// Color + size helpers
// ---------------------------------------------------------------------------

function nodeRadius(agent: Agent, depth: number): number {
  if (depth === 0) return 28;
  const toolCount = agent.tools?.length ?? 0;
  return Math.max(18, Math.min(26, 18 + toolCount));
}

function nodeStatusColors(status: Agent["status"]): {
  fill: string;
  stroke: string;
  pulse: string;
} {
  switch (status) {
    case "active":
      return {
        fill: "hsl(var(--color-primary) / 0.2)",
        stroke: "hsl(var(--color-primary))",
        pulse: "hsl(var(--color-primary) / 0.5)",
      };
    case "waiting":
      return {
        fill: "hsl(50 80% 40% / 0.2)",
        stroke: "hsl(50 80% 55%)",
        pulse: "hsl(50 80% 55% / 0.4)",
      };
    case "error":
      return {
        fill: "hsl(0 70% 40% / 0.2)",
        stroke: "hsl(0 70% 60%)",
        pulse: "hsl(0 70% 60% / 0.4)",
      };
    case "done":
      return {
        fill: "hsl(140 60% 30% / 0.2)",
        stroke: "hsl(140 60% 50%)",
        pulse: "transparent",
      };
    default:
      return {
        fill: "hsl(var(--color-surface-container-high))",
        stroke: "hsl(var(--color-border-default))",
        pulse: "transparent",
      };
  }
}

// ---------------------------------------------------------------------------
// SVG defs — arrowhead marker
// ---------------------------------------------------------------------------

const ARROW_ID = "swarm-arrow";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SwarmGraph({
  agents,
  edges,
  onAgentSelect,
  viewMode: controlledMode,
  onViewModeChange,
}: SwarmGraphProps) {
  const [internalMode, setInternalMode] = useState<"tree" | "activity">(
    "tree",
  );
  const mode = controlledMode ?? internalMode;
  const setMode = (m: "tree" | "activity") => {
    setInternalMode(m);
    onViewModeChange?.(m);
  };

  // SVG pan / zoom state
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  const isPanning = useRef(false);
  const [isCursorGrabbing, setIsCursorGrabbing] = useState(false);
  const lastPointer = useRef({ x: 0, y: 0 });
  const svgRef = useRef<SVGSVGElement>(null);

  // Dimensions — read from the container via ResizeObserver
  const [dims, setDims] = useState({ width: 400, height: 400 });
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const e = entries[0];
      if (e) {
        setDims({
          width: e.contentRect.width,
          height: e.contentRect.height,
        });
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Recompute layout when agents, edges, mode or dims change
  const positions = useMemo<NodePosition[]>(() => {
    if (mode === "tree") {
      return computeTreeLayout(agents, edges, dims.width, dims.height);
    }
    return computeActivityLayout(agents, edges, dims.width, dims.height);
  }, [agents, edges, mode, dims]);

  const posMap = useMemo(() => {
    const m = new Map<string, NodePosition>();
    for (const p of positions) m.set(p.id, p);
    return m;
  }, [positions]);

  // Reset zoom
  const resetZoom = useCallback(() => {
    setTransform({ x: 0, y: 0, scale: 1 });
  }, []);

  // Wheel → zoom
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setTransform((prev) => {
      const factor = e.deltaY < 0 ? 1.1 : 0.9;
      const newScale = Math.max(0.2, Math.min(4, prev.scale * factor));
      return { ...prev, scale: newScale };
    });
  }, []);

  // Pointer drag → pan
  const handlePointerDown = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      if (e.target === svgRef.current || (e.target as Element).tagName.toLowerCase() === "svg") {
        isPanning.current = true;
        setIsCursorGrabbing(true);
        lastPointer.current = { x: e.clientX, y: e.clientY };
        (e.target as Element).setPointerCapture(e.pointerId);
      }
    },
    [],
  );

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isPanning.current) return;
    const dx = e.clientX - lastPointer.current.x;
    const dy = e.clientY - lastPointer.current.y;
    lastPointer.current = { x: e.clientX, y: e.clientY };
    setTransform((prev) => ({ ...prev, x: prev.x + dx, y: prev.y + dy }));
  }, []);

  const handlePointerUp = useCallback(() => {
    isPanning.current = false;
    setIsCursorGrabbing(false);
  }, []);

  const validEdges = useMemo(
    () =>
      edges.filter(
        (e) => posMap.has(e.from) && posMap.has(e.to) && e.from !== e.to,
      ),
    [edges, posMap],
  );

  // ---------------------------------------------------------------------------
  // Empty state
  // ---------------------------------------------------------------------------
  if (agents.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center px-6">
        <span
          className="material-symbols-outlined text-4xl text-text-muted"
          aria-hidden="true"
        >
          hub
        </span>
        <p className="text-sm font-medium text-on-surface-variant">
          No agents yet
        </p>
        <p className="text-xs text-text-muted leading-relaxed">
          Subagents spawned via{" "}
          <span className="font-code text-primary">delegate_task</span> will
          appear here.
        </p>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="flex flex-col flex-1 min-h-0 relative">
      {/* View mode toggle + reset */}
      <div className="flex items-center justify-between px-4 py-2 flex-shrink-0 gap-2">
        <div
          role="tablist"
          aria-label="Graph view mode"
          className="flex rounded-xl overflow-hidden border border-border-subtle"
        >
          {(["tree", "activity"] as const).map((m) => (
            <button
              key={m}
              role="tab"
              aria-selected={mode === m}
              type="button"
              onClick={() => setMode(m)}
              className={[
                "px-3 py-1 text-[0.6875rem] font-bold uppercase tracking-wider transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                mode === m
                  ? "bg-primary/10 text-primary"
                  : "text-text-muted hover:text-on-surface",
              ].join(" ")}
            >
              {m === "tree" ? "Tree" : "Activity"}
            </button>
          ))}
        </div>
        <button
          type="button"
          aria-label="Reset zoom"
          onClick={resetZoom}
          className="p-1 rounded-lg text-text-muted hover:text-on-surface hover:bg-surface-container-high transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          title="Reset zoom"
        >
          <span className="material-symbols-outlined text-base" aria-hidden="true">
            fit_screen
          </span>
        </button>
      </div>

      {/* SVG canvas */}
      <div ref={containerRef} className="flex-1 min-h-0 relative select-none">
        <svg
          ref={svgRef}
          width={dims.width}
          height={dims.height}
          aria-label="Swarm agent topology graph"
          style={{ cursor: isCursorGrabbing ? "grabbing" : "grab" }}
          onWheel={handleWheel}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
        >
          <defs>
            {/* Arrowhead marker */}
            <marker
              id={ARROW_ID}
              markerWidth="8"
              markerHeight="8"
              refX="7"
              refY="3"
              orient="auto"
            >
              <path
                d="M0,0 L0,6 L8,3 z"
                fill="hsl(var(--color-border-default))"
              />
            </marker>
            {/* Pulse animation keyframes via CSS filter */}
            <style>{`
              @keyframes sgPulse {
                0%   { opacity: 0.9; r: var(--pulse-r-start); }
                100% { opacity: 0;   r: var(--pulse-r-end);   }
              }
              .sg-pulse { animation: sgPulse 1.4s ease-out infinite; }
            `}</style>
          </defs>

          <g
            transform={`translate(${transform.x},${transform.y}) scale(${transform.scale})`}
          >
            {/* ── Edges ── */}
            {validEdges.map((edge, i) => {
              const from = posMap.get(edge.from)!;
              const to = posMap.get(edge.to)!;
              const toAgent = agents.find((a) => a.id === edge.to);
              const isInFlight =
                toAgent?.status === "active" ||
                toAgent?.status === "waiting";

              // Shorten line to not overlap node circles
              const fromAgent = agents.find((a) => a.id === edge.from);
              const rFrom = nodeRadius(
                fromAgent ?? agents[0],
                from.depth,
              );
              const rTo = nodeRadius(toAgent ?? agents[0], to.depth);
              const dx = to.x - from.x;
              const dy = to.y - from.y;
              const dist = Math.sqrt(dx * dx + dy * dy) || 1;
              const x1 = from.x + (rFrom * dx) / dist;
              const y1 = from.y + (rFrom * dy) / dist;
              const x2 = to.x - ((rTo + 6) * dx) / dist;
              const y2 = to.y - ((rTo + 6) * dy) / dist;

              return (
                <line
                  key={i}
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke={
                    isInFlight
                      ? "hsl(var(--color-primary) / 0.8)"
                      : "hsl(var(--color-border-default) / 0.5)"
                  }
                  strokeWidth={isInFlight ? 2 : 1.5}
                  strokeDasharray={isInFlight ? "none" : undefined}
                  markerEnd={`url(#${ARROW_ID})`}
                />
              );
            })}

            {/* ── Nodes ── */}
            {positions.map((pos) => {
              const agent = agents.find((a) => a.id === pos.id);
              if (!agent) return null;
              const r = nodeRadius(agent, pos.depth);
              const colors = nodeStatusColors(agent.status);
              const isActive =
                agent.status === "active" || agent.status === "waiting";

              return (
                <g
                  key={agent.id}
                  transform={`translate(${pos.x},${pos.y})`}
                  role="button"
                  tabIndex={0}
                  aria-label={`Agent: ${agent.name}, status: ${agent.status}`}
                  style={{ cursor: "pointer" }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onAgentSelect?.(agent.id);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onAgentSelect?.(agent.id);
                    }
                  }}
                >
                  {/* Pulse ring for active nodes */}
                  {isActive && (
                    <circle
                      className="sg-pulse"
                      cx={0}
                      cy={0}
                      r={r}
                      fill="none"
                      stroke={colors.pulse}
                      strokeWidth={3}
                      style={
                        {
                          "--pulse-r-start": `${r}px`,
                          "--pulse-r-end": `${r + 14}px`,
                        } as React.CSSProperties
                      }
                    />
                  )}

                  {/* Node circle */}
                  <circle
                    cx={0}
                    cy={0}
                    r={r}
                    fill={colors.fill}
                    stroke={colors.stroke}
                    strokeWidth={pos.depth === 0 ? 2.5 : 2}
                  />

                  {/* Icon */}
                  <text
                    x={0}
                    y={0}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize={r * 0.75}
                    fill={colors.stroke}
                    className="material-symbols-outlined"
                    style={{ userSelect: "none", pointerEvents: "none" }}
                  >
                    {pos.depth === 0 ? "memory" : "smart_toy"}
                  </text>

                  {/* Label */}
                  <text
                    x={0}
                    y={r + 14}
                    textAnchor="middle"
                    dominantBaseline="hanging"
                    fontSize={10}
                    fill="currentColor"
                    className="text-text-muted font-code"
                    style={{
                      userSelect: "none",
                      pointerEvents: "none",
                      fill: "hsl(var(--color-text-muted))",
                    }}
                  >
                    {agent.name.length > 12
                      ? agent.name.slice(0, 11) + "…"
                      : agent.name}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>
      </div>
    </div>
  );
}
