---
description: "Use when creating, editing, or reviewing React components in src/components/ or src/app/. Enforces design system token usage, Tailwind v4 patterns, accessibility conventions, and component structure rules specific to this project."
applyTo: "src/**/*.tsx"
---

# Component Conventions

## File Structure

- All components are `"use client"` — this project has no Server Components in `src/components/`
- Named exports only (no default exports from component files)
- Props interfaces defined inline above the component

## Tailwind v4 Rules

- **No `tailwind.config.ts`** — do not create or reference it
- **No `@apply`** — Tailwind v4 discourages it; use utility classes inline
- **No hardcoded hex values** — always use design token names from `globals.css`
- Class merging pattern: `["base", condition ? "a" : "b"].join(" ")` — never template literals

```tsx
// Correct
className={["glass-panel p-4", isActive ? "ring-1 ring-primary/50" : ""].join(" ")}

// Wrong
className={`glass-panel p-4 ${isActive ? "ring-1 ring-primary/50" : ""}`}
```

## Design System Tokens

Key tokens from `globals.css` (`--color-*` prefix in CSS, bare name in Tailwind):

| Token | Use |
|---|---|
| `primary` | Accent color (#e0b6ff) — active states, focus rings, highlights |
| `primary-container` | Filled buttons, strong accents (#9d4edd) |
| `background` | Page background (#131317) |
| `surface-container` | Cards, panels (#1f1f24) |
| `surface-glass` | Glass overlay backgrounds (rgba) |
| `on-surface` | Body text (#e4e1e7) |
| `text-muted` | Secondary text, labels (#8A8A93) |
| `terminal-bg` | Code/terminal blocks (#050508) |

## Pre-built Component Classes

Prefer these over re-implementing:

- `.glass-panel` — panels floating over dark surfaces (backdrop-blur 24px + border)
- `.agent-card` — dark card with violet border glow (backdrop-blur 12px)
- `.topology-line` — animated dashed SVG stroke for swarm visualizations
- `.avatar-glow` — violet box-shadow ring for avatars
- `.custom-scrollbar` — 6px dark WebKit scrollbar

## Icons

Always use Material Symbols Outlined:

```tsx
<span className="material-symbols-outlined" aria-hidden="true">icon_name</span>
```

- Icon names are **lowercase with underscores**: `smart_toy`, `hub`, `tune`, `history`
- Always add `aria-hidden="true"` for decorative icons
- For interactive icon-only buttons, add `aria-label` on the button, not the span

## Active Link Detection

Used in all nav components — import `usePathname` from `next/navigation`:

```tsx
const pathname = usePathname();
const active = pathname === href;
// Active: "text-primary border-b-2 border-primary"
// Always: aria-current={active ? "page" : undefined}
```

## Navigation: Link vs Button

- `<Link href={...}>` for routes that exist and resolve (/, /history)
- `<button>` for inactive/demo items that have no route yet (/agents, /tuning)
- Both share identical visual styling — the distinction is semantic only

## Accessible Dialogs

Reference implementation: `src/app/history/page.tsx`

```tsx
// Required attributes
<div role="dialog" aria-modal="true" aria-labelledby="dialog-title" ref={dialogRef} tabIndex={-1}>

// Focus management
useEffect(() => { dialogRef.current?.focus(); }, []);

// Keyboard dismissal
useEffect(() => {
  const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
  document.addEventListener("keydown", onKey);
  return () => document.removeEventListener("keydown", onKey);
}, [onClose]);
```

## Agent Status Indicators

```tsx
{/* Pulse dot */}
<span className={["w-2 h-2 rounded-full", isActive ? "animate-pulse bg-primary" : "bg-text-muted"].join(" ")} />

{/* Status label */}
<span className="text-[11px] uppercase font-bold tracking-wider text-text-muted">
  {status}
</span>
```

## Typography Classes

| Class | Font | Use |
|---|---|---|
| `font-h1`, `font-h2` | Epilogue | Section headings |
| `font-body` | Be Vietnam Pro | Body text |
| `font-button` | Be Vietnam Pro 500 | Buttons, labels |
| `font-body-small` | Be Vietnam Pro small | Meta text |
| `font-code` | JetBrains Mono | Code, terminal output |
| `font-outfit` | Outfit | Brand elements |

## Layout Constants

- Header height: `pt-24` (96px) top offset for content below fixed header
- Sidebar width: `ml-[104px]` left offset accounting for 80px sidebar + 24px gap
- Three-column content: ThreadList `w-1/5` | Chat `flex-1` | Right panel `w-[35%]`
- Right panel hidden below xl: `hidden xl:flex`
