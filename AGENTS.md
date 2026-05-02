<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Hermes UI

Custom frontend for [Hermes Agent](https://hermes-agent.nousresearch.com/docs/) — an autonomous, self-improving AI agent by Nous Research. This UI surfaces agent swarms, real-time task orchestration, and session history for power users.

Full developer guide: [CLAUDE.md](CLAUDE.md) | Design system & brand: [.github/copilot-instructions.md](.github/copilot-instructions.md)

## Quick Commands

```
npm run dev      # Dev server (Turbopack)
npm run build    # Production build
npm run lint     # ESLint
```

No test runner is configured.

## Stack

- **Next.js 16** App Router + **React 19** + **TypeScript 5**
- **Tailwind CSS v4** — tokens defined via `@theme` in `globals.css` only. No `tailwind.config.ts`. Do not add one. Do not use `@apply`.
- No state management library yet (Zustand planned). No test runner.

## Architecture

See [CLAUDE.md §Architecture](CLAUDE.md) for full file tree and layout zone details. Key facts:

- All components are `"use client"` (browser-only CSS + hooks)
- Three-zone fixed layout: `Header` (z-50) | `SidebarNav` (z-40, 80 px) | `Main` (`ml-[104px]`)
- Import alias: `@/*` → `src/*`

## Design System

See [CLAUDE.md §Design System](CLAUDE.md) for all tokens and custom classes. Critical rules:

- Use **exact token names** from `globals.css` — never hardcode hex values
- Icons: `<span className="material-symbols-outlined" aria-hidden="true">icon_name</span>` (lowercase names)
- Class merging: `["base", condition ? "a" : "b"].join(" ")` — not template literals
- `glass-panel`, `agent-card`, `topology-line`, `avatar-glow`, `custom-scrollbar` — prefer these over re-implementing

## Hermes Backend Integration

This is currently a **static prototype**. The planned backend is the Hermes gateway server (SQLite sessions, 20 platform adapters, SSE-compatible API).

- **SSE streaming**: `/api/chat` will stream agent responses as Server-Sent Events from the Hermes agent loop
- **Sessions**: Hermes persists sessions in SQLite via `gateway/session.py`. UI threads map to Hermes session IDs
- **Swarm state**: Agent cards and SVG topology reflect real-time tool execution state emitted by the agent loop
- **Gateway target**: Use the `api_server` or `webhook` Hermes platform adapter. Consult [Hermes architecture docs](https://hermes-agent.nousresearch.com/docs/developer-guide/architecture) before designing any API route — do not assume a generic REST/JSON convention

## Pending Work (what's missing)

| Area | Detail |
|---|---|
| `/api/chat` | SSE endpoint wired to Hermes gateway |
| State | Zustand store for `messages`, `threads`, `swarmState` |
| Routes | `/agents` and `/tuning` return 404 |
| Responsive | Mobile/tablet breakpoints not implemented |
| Data | All threads/messages/agents are hardcoded demo data |

## Code Conventions

### Active link detection (all nav components)
```tsx
const active = pathname === href;
// Apply: "text-primary border-b-2 border-primary" when active
// Always: aria-current={active ? "page" : undefined}
```

### Navigation: mixed Link/button pattern
- `<Link>` for routes that exist; `<button>` for inactive/demo items — see `ThreadList.tsx`

### Accessible dialogs — see `src/app/history/page.tsx` for reference
- `role="dialog"` + `aria-modal="true"` + `aria-labelledby`
- `useRef` + `useEffect` for focus on open; Escape key to dismiss

### Agent status indicators
- Pulse dot: `w-2 h-2 rounded-full animate-pulse` + status color token
- Status label: `text-[11px] uppercase font-bold tracking-wider`
