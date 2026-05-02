# Hermes UI — Kimi-style Chat Shell for Hermes Agent

A Next.js 16 frontend providing a Kimi.com-style chat interface for the Hermes AI agent platform. Three-zone layout with thread sidebar, chat canvas, and contextual right panel (agent config, swarm visualization, tools).

## Architecture

```
src/
├── app/
│   ├── layout.tsx              # Root shell: <html>, fonts, Header + SidebarNav + <main>
│   ├── globals.css             # Tailwind v4 @theme, glass-panel, topology-line, scrollbar
│   ├── page.tsx                # / route — "Building a CRM website" demo screen
│   └── history/
│       └── page.tsx            # /history route — "Quantum Swarm Logic" demo screen
└── components/
    ├── shell/
    │   ├── Header.tsx          # Fixed top nav with active-state Link highlighting
    │   └── SidebarNav.tsx      # Fixed left icon-only nav (80px wide)
    └── chat/
        ├── ThreadList.tsx      # Left sidebar: thread groups (Today/Yesterday)
        └── ChatInput.tsx       # Glass-morphism chat composer with keyboard submit
```

**Stack:** Next.js 16.2.4 · React 19.2 · Tailwind CSS v4 (`@import "tailwindcss"` + `@theme` block) · TypeScript · Turbopack (default in v16)

**All components are client components** (`"use client"`) — they use `usePathname()`, `useState()`, and browser-only styling (backdrop-filter, webkit-scrollbar).

## Key Commands

- `npm run dev` — development server (Turbopack)
- `npm run build` — production build (Turbopack)
- `npm start` — production server
- `npm run lint` — ESLint

## Design System

### Color Tokens (all defined in `globals.css` `@theme` block)
- **Primary:** `primary` (#e0b6ff), `primary-container` (#9d4edd)
- **Surface:** `background` (#131317), `surface-container` (#1f1f24), `surface-glass` (rgba)
- **Text:** `on-surface` (#e4e1e7), `text-muted` (#8A8A93), `text-primary` (#EAEAEA)
- **Accents:** `secondary` (#e5b5ff), `tertiary` (#edc156), `error` (#ffb4ab)
- All 50+ Material 3-derived tokens are available. Use the exact names from `globals.css` — they're defined as CSS variables and Tailwind utilities.

### Custom CSS Classes
- `.glass-panel` — backdrop-blur(24px) + semi-transparent background + 1px border
- `.agent-card` — dark card with violet border glow, backdrop-blur(12px)
- `.topology-line` — animated dashed SVG stroke (used in swarm visualization)
- `.avatar-glow` — violet box-shadow ring
- `.custom-scrollbar` — thin 6px dark scrollbar (WebKit only)
- `.shimmer-text` — gradient text animation (violet → purple)

### Fonts
- **Headings:** Epilogue (font-h1, font-h2)
- **Body:** Be Vietnam Pro (font-body, font-button, font-body-small)
- **Brand:** Outfit (font-outfit)
- **Code:** JetBrains Mono (font-code)
- **Icons:** Material Symbols Outlined via Google Fonts CDN

## Layout Pattern

Three-zone fixed layout:

1. **Header** — `fixed top-0`, z-50, glass bg, 4 nav links (/, /history, /agents, /tuning)
2. **SidebarNav** — `fixed left-6 top-24 bottom-6`, 80px wide, icon buttons with active violet ring
3. **Main** — `pt-24 pb-6 px-6 flex`, `ml-[104px]` to clear the fixed sidebar
   - **ThreadList** — `w-1/5`, glass-panel, scrollable thread list
   - **Chat section** — `flex-1`, glass-panel, messages + ChatInput
   - **Right panel** — `w-[35%]`, glass-panel, swarm/agent visualization

### Route Conventions
- Homepage: `/` → `src/app/page.tsx` (CRM agent orchestration)
- History: `/history` → `src/app/history/page.tsx` (swarm visualization)
- Agents and Tuning: linked in Header but not yet implemented

## ChatInput Component

Controlled input with:
- `onSend` callback prop — fires on Enter (not Shift+Enter) or send button click
- Glass gradient glow on focus (violet gradient blur ring)
- Attach button (not yet wired), send button (primary-container bg)
- Clears input after send

## Current State & Roadmap

### What's built (static prototype)
- Visual shell matching Kimi's three-zone layout
- Violet glass-morphism design system
- Two demo screens with hardcoded messages, agent cards, and swarm SVGs
- Responsive sidebar navigation with active state

### What's not yet built
- **Hermes API wiring** — no `/api/chat` route, no SSE streaming, no state management
- **Real thread/session model** — ThreadList items are hardcoded `<Link>` + `<button>` elements
- **Right panel variants** — Agent config panel, Swarm timeline, Tools panel (only decorative Swarm view exists)
- **AskUserQuestion dialog** — not implemented
- **Mode switcher** — Header has nav links but no Chat/Code/Swarm/Document mode toggle
- **Mobile responsiveness** — fixed widths, no breakpoints for small screens
- **State management** — no Zustand/Jotai stores, no TanStack Query

### Next steps (in order)
1. Create `src/app/api/chat/route.ts` — SSE proxy to Hermes OpenAI-compatible endpoint
2. Add Zustand store for messages, threads, and swarm state
3. Refactor static message JSX into data-driven `MessageList` component
4. Wire ChatInput to the store and API
5. Build proper Agent config panel (profiles, skills toggles, model selector)
6. Build Swarm timeline panel with real multi-agent orchestration data
7. Add responsive breakpoints for mobile/tablet

## Code Patterns

### Active Link Detection
Both Header and SidebarNav use the pattern:
```tsx
const pathname = usePathname();
const active = pathname === href;
```
Then conditionally apply active styles (violet ring + colored text for active, neutral for inactive).

### Dynamic Class Joining
Use `[].join(" ")` for conditional classes — NOT template literals:
```tsx
className={[
  "base-class",
  condition ? "active-class" : "inactive-class",
].join(" ")}
```

### Inline Arbitrary Values
Tailwind v4 arbitrary values use the same `[value]` syntax as v3:
- `text-[13px]`, `text-[16px]` — specific font sizes
- `rounded-[24px]`, `rounded-[28px]` — non-standard border radii
- `shadow-[0_8px_32px_0_rgba(157,78,221,0.1)]` — complex box shadows
- `ml-[104px]` — fixed margins to clear sidebar

## File Do's and Don'ts

- ✅ Use `@/components/chat/ThreadList` import aliases (configured in tsconfig)
- ✅ All client components start with `"use client"` directive
- ✅ Tailwind v4 CSS-first: colors and fonts in `@theme`, custom classes below
- ❌ Don't add a `tailwind.config.ts` — Tailwind v4 uses CSS config
- ❌ Don't use `@apply` in CSS — Tailwind v4 discourages it; use component classes or inline utilities
- ❌ Don't reference external images — use Material Symbols icons or colored div placeholders
