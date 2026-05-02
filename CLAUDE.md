# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```
npm run dev      # Development server (Turbopack, default for Next.js 16)
npm run build    # Production build
npm start        # Production server
npm run lint     # ESLint
```

No test runner is configured yet.

## Architecture

Next.js 16 App Router with React 19 and Tailwind CSS v4. All components are `"use client"` (they depend on `usePathname()`, `useState()`, and browser-only CSS like `backdrop-filter`).

```
src/
├── app/
│   ├── layout.tsx       # Root shell: <html dark>, fonts, Header + SidebarNav + <main>
│   ├── globals.css      # Tailwind v4 @theme (60+ color tokens), glass-panel, scrollbar, animations
│   ├── page.tsx         # / route — "Building a CRM website" demo with agent cards + swarm SVG
│   └── history/
│       └── page.tsx     # /history route — "Quantum Swarm Logic" demo with swarm visualizer
└── components/
    ├── shell/
    │   ├── Header.tsx       # Fixed top nav, 4 links: /, /history, /agents, /tuning
    │   └── SidebarNav.tsx   # Fixed left icon bar (80px), violet ring on active
    └── chat/
        ├── ThreadList.tsx   # Left sidebar: thread groups (Today/Yesterday), mixed <Link>/<button>
        └── ChatInput.tsx    # Glass input with onSend callback, Enter to submit
```

**Layout:** Three-zone fixed layout — Header (z-50, top-0), SidebarNav (fixed left-6 top-24 bottom-6), Main (pt-24 ml-[104px] flex). Within Main: ThreadList (w-1/5) | Chat (flex-1) | Right panel (w-[35%]).

**Import alias:** `@/*` maps to `src/*` (configured in tsconfig.json).

## Design System

### Tailwind v4 Configuration
Colors and fonts are defined in `globals.css` via `@theme` block — there is **no** `tailwind.config.ts`. Do not add one. Do not use `@apply`; Tailwind v4 discourages it. Use inline utilities or component classes instead.

### Key Color Tokens
- **Primary:** `primary` (#e0b6ff), `primary-container` (#9d4edd)
- **Surfaces:** `background` (#131317), `surface-container` (#1f1f24), `surface-glass` (rgba)
- **Text:** `on-surface` (#e4e1e7), `text-muted` (#8A8A93), `text-primary` (#EAEAEA)
- **Terminal:** `terminal-bg` (#050508)
- All 60+ tokens derive from Material 3. Use exact names from `globals.css`.

### Custom CSS Classes
- `.glass-panel` — `backdrop-blur(24px)` + `rgba(20,20,28,0.4)` bg + 1px white/6 border
- `.agent-card` — dark card with violet border glow, `backdrop-blur(12px)`
- `.topology-line` — animated dashed SVG stroke (swarm visualization)
- `.avatar-glow` — violet box-shadow ring
- `.custom-scrollbar` — 6px WebKit scrollbar (dark track, subtle thumb)
- `.shimmer-text` — gradient text animation (violet → purple)

### Fonts (loaded via Google Fonts CDN in layout.tsx)
- Headings: Epilogue (`font-h1`, `font-h2`)
- Body: Be Vietnam Pro (`font-body`, `font-button`, `font-body-small`)
- Brand: Outfit (`font-outfit`)
- Code: JetBrains Mono (`font-code`)
- Icons: Material Symbols Outlined (`material-symbols-outlined` class + `<span>` element, FILL/wght variations in CSS)

## Code Patterns

### Active Link Detection
Used in Header and SidebarNav:
```tsx
const pathname = usePathname();
const active = pathname === href;
// then conditionally apply: active → violet ring + colored text, inactive → neutral
```

### Dynamic Class Joining
Use `[].join(" ")` — not template literals:
```tsx
className={["base-class", condition ? "on" : "off"].join(" ")}
```

### Inline Arbitrary Values
Tailwind arbitrary values (`[value]` syntax): `text-[13px]`, `rounded-[24px]`, `shadow-[0_8px_32px_0_rgba(157,78,221,0.1)]`, `ml-[104px]`.

### ChatInput Component API
```tsx
<ChatInput onSend={(text: string) => void} />
```
Controlled input, fires on Enter (not Shift+Enter). Clears after send. `onSend` is optional.

## Current State

This is a **static prototype** — two demo screens with hardcoded messages, agent cards, and swarm SVGs. There is no API layer, no state management library, no database, and no real thread/session model. The ThreadList mixes `Link` (for active routes) and `button` (for inactive items). Routes /agents and /tuning are linked in the shell but return 404.

**What's built:** Visual shell, violet glass-morphism design system, route-aware navigation.

**What's pending:** API routes (`/api/chat` for SSE streaming), state management (Zustand store for messages/threads/swarm), responsive breakpoints, and any real data integration with Hermes backend.
