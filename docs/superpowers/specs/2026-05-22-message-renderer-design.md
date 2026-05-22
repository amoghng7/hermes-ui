# MessageRenderer Feature Design

## Goal

Build a `MessageRenderer` component that interprets message content and renders rich UI beyond plain text, matching Kimi-style message presentation.

## Architecture

- **MessageRenderer** (`src/components/chat/MessageRenderer.tsx`): Top-level renderer, dispatches to sub-renderers based on message role + content patterns.
- **MarkdownContent** (inline in MessageRenderer): Renders assistant markdown via `react-markdown` + `remark-gfm` + `rehype-highlight`. Custom renderers for code blocks, tables, task lists.
- **TerminalCard** (`src/components/chat/TerminalCard.tsx`): Detects `role="tool"` messages with shell/command output. Renders dark card with exit code badge, collapsible after 20 lines, virtualized after 100 lines.
- **ToolTimeline** (`src/components/chat/ToolTimeline.tsx`): Shows collapsed timeline widget after assistant messages. Lists tool name + icon + status badge. Expandable (animated) to show JSON params + result snippet + timestamps.
- **TodoChecklist** (`src/components/chat/TodoChecklist.tsx`): Renders GFM task-list content as interactive checklist.
- **FilePreview** (`src/components/chat/FilePreview.tsx`): Inline images with lightbox; PDF/text files with name + size + download link.
- **AgentBadge** (`src/components/chat/AgentBadge.tsx`): Colored badge for subagent origin.
- **Store update** (`src/store/hermesStore.ts`): Add `toolCallsBySession` state + `setToolCalls` action.

## Data Flow

1. `MessageList` maps over messages and renders `<MessageRenderer message={...} toolCalls={...} isStreaming={...} />`.
2. `MessageRenderer` checks `message.role`:
   - `"tool"` → `TerminalCard` or `FilePreview` (detected by content pattern)
   - `"assistant"` → `MarkdownContent` + `ToolTimeline` (if `toolCalls` provided)
   - `"user"` → plain text (no markdown to avoid XSS via user input)
3. `ToolTimeline` receives `toolCalls: ToolCall[]` sliced to the calls that occurred between the previous assistant message and this one.

## Security

- `react-markdown` with `rehype-sanitize` in production — blocks `<script>`, `javascript:` hrefs, event attributes.
- User messages rendered as plain `whitespace-pre-wrap` text, never via `react-markdown`.
- Image `src` attributes in `FilePreview` validated against `blob:`, `data:image/`, or relative paths only.

## Packages

- `react-markdown` ^9
- `remark-gfm` ^4
- `rehype-highlight` ^7 (uses `highlight.js` internally)
- `rehype-sanitize` ^6
