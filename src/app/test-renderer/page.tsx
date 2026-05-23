"use client";

import type { Message, ToolCall } from "@/types/hermes";
import { MessageRenderer } from "@/components/chat/MessageRenderer";

const MOCK_MESSAGES: Message[] = [
  {
    id: "1",
    role: "user",
    content: "Can you show me a markdown example?",
    sessionId: "test",
    createdAt: new Date().toISOString(),
  },
  {
    id: "2",
    role: "assistant",
    content: `# Hello World

Here is some **bold** text and *italic* text, plus \`inline code\`.

## Code Block

\`\`\`typescript
function greet(name: string): string {
  return \`Hello, \${name}!\`;
}
console.log(greet("Hermes"));
\`\`\`

## Table

| Name | Role | Status |
|------|------|--------|
| Alice | Engineer | Active |
| Bob | Designer | Idle |

## Task List

- [x] Install react-markdown
- [x] Add syntax highlighting
- [ ] Deploy to production
`,
    sessionId: "test",
    createdAt: new Date().toISOString(),
  },
  {
    id: "3",
    role: "tool",
    content: JSON.stringify({
      tool: "terminal",
      output: `$ npm run build
> hermes-ui@0.1.0 build
> next build

✓ Compiled successfully
Build complete in 12.3s
Exit code: 0`,
      exit_code: 0,
    }),
    sessionId: "test",
    createdAt: new Date().toISOString(),
  },
  {
    id: "4",
    role: "tool",
    content: JSON.stringify({
      tool: "terminal",
      output: `$ npm test
FAIL src/components/Button.test.tsx
  ● Button › renders correctly
    Expected: "Click me"
    Received: "Press me"
Exit code: 1`,
      exit_code: 1,
    }),
    sessionId: "test",
    createdAt: new Date().toISOString(),
  },
  {
    id: "5",
    role: "tool",
    content: `![screenshot](https://via.placeholder.com/400x200 "Sample image")`,
    sessionId: "test",
    createdAt: new Date().toISOString(),
  },
  {
    id: "6",
    role: "assistant",
    content: `[BuildBot (CI Runner)]: All tests passed! Build artifact uploaded to S3.`,
    sessionId: "test",
    createdAt: new Date().toISOString(),
  },
];

const MOCK_TOOL_CALLS: ToolCall[] = [
  {
    id: "tc1",
    name: "terminal",
    arguments: JSON.stringify({ command: "npm run build" }),
    calledAt: new Date(Date.now() - 3000).toISOString(),
    result: {
      toolCallId: "tc1",
      output: JSON.stringify({ exit_code: 0, output: "Build complete" }),
      success: true,
      returnedAt: new Date().toISOString(),
    },
  },
  {
    id: "tc2",
    name: "read_file",
    arguments: JSON.stringify({ path: "/src/index.ts" }),
    calledAt: new Date(Date.now() - 2000).toISOString(),
    result: {
      toolCallId: "tc2",
      output: JSON.stringify({ content: "export default {};" }),
      success: true,
      returnedAt: new Date().toISOString(),
    },
  },
];

export default function TestRendererPage() {
  // Original MessageRenderer dev harness
  return (
    <div className="min-h-screen bg-background p-8">
      <h1 className="text-2xl font-bold text-on-surface mb-8">MessageRenderer Test Page</h1>
      <div className="max-w-3xl mx-auto space-y-6">
        {MOCK_MESSAGES.map((msg) => {
          const isUser = msg.role === "user";
          return (
            <div key={msg.id} className={isUser ? "flex justify-end" : "flex gap-4"}>
              {!isUser && (
                <div className="w-10 h-10 rounded-full bg-primary-container flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-on-primary-container">smart_toy</span>
                </div>
              )}
              <div
                className={
                  isUser
                    ? "max-w-[85%] bg-surface-container-high rounded-3xl p-6 border border-border-subtle"
                    : "max-w-[85%] bg-surface-container rounded-3xl p-6 border border-border-subtle"
                }
              >
                <MessageRenderer
                  message={msg}
                  toolCalls={msg.id === "2" ? MOCK_TOOL_CALLS : []}
                  isStreaming={false}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
