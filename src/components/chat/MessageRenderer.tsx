"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import type { Components } from "react-markdown";
import type { ToolCall, Message } from "@/types/hermes";
import { TerminalCard, parseTerminalContent } from "@/components/chat/TerminalCard";
import { TodoChecklist, parseTaskList } from "@/components/chat/TodoChecklist";
import { FilePreview, parseFileContent } from "@/components/chat/FilePreview";
import { ToolTimeline } from "@/components/chat/ToolTimeline";
import { AgentBadge } from "@/components/chat/AgentBadge";

// ---------------------------------------------------------------------------
// Sanitization schema — extends defaultSchema to allow className (for hljs)
// ---------------------------------------------------------------------------

const sanitizeSchema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    code: [...(defaultSchema.attributes?.["code"] ?? []), "className"],
    span: [...(defaultSchema.attributes?.["span"] ?? []), "className"],
  },
};

// ---------------------------------------------------------------------------
// Custom markdown component renderers
// ---------------------------------------------------------------------------

const markdownComponents: Components = {
  // Fenced code blocks
  pre({ children }) {
    return (
      <pre className="bg-surface-container-lowest rounded-xl overflow-x-auto my-3 p-4 text-[0.8125rem] font-code leading-relaxed">
        {children}
      </pre>
    );
  },
  code({ className, children, ...props }) {
    const isBlock = Boolean(className?.startsWith("language-"));
    if (isBlock) {
      return (
        <code className={className} {...props}>
          {children}
        </code>
      );
    }
    // Inline code
    return (
      <code
        className="font-code text-[0.875em] bg-surface-container px-1.5 py-0.5 rounded text-secondary"
        {...props}
      >
        {children}
      </code>
    );
  },
  // Tables
  table({ children }) {
    return (
      <div className="overflow-x-auto my-3">
        <table className="w-full border-collapse text-[0.9rem]">{children}</table>
      </div>
    );
  },
  th({ children }) {
    return (
      <th className="border border-border-default px-3 py-2 text-left font-semibold bg-surface-container-high text-on-surface">
        {children}
      </th>
    );
  },
  td({ children }) {
    return (
      <td className="border border-border-default px-3 py-2 text-on-surface-variant">
        {children}
      </td>
    );
  },
  // Headings
  h1({ children }) {
    return <h1 className="font-h1 text-2xl font-bold text-on-surface mt-4 mb-2">{children}</h1>;
  },
  h2({ children }) {
    return <h2 className="font-h2 text-xl font-semibold text-on-surface mt-3 mb-2">{children}</h2>;
  },
  h3({ children }) {
    return <h3 className="text-lg font-semibold text-on-surface mt-3 mb-1">{children}</h3>;
  },
  // Blockquote
  blockquote({ children }) {
    return (
      <blockquote className="border-l-4 border-primary/50 pl-4 my-2 text-text-muted italic">
        {children}
      </blockquote>
    );
  },
  // Horizontal rule
  hr() {
    return <hr className="border-border-default my-4" />;
  },
  // Links
  a({ href, children }) {
    const safe = href && /^(https?:|mailto:|\/)/.test(href) ? href : "#";
    return (
      <a
        href={safe}
        target={safe.startsWith("http") ? "_blank" : undefined}
        rel={safe.startsWith("http") ? "noopener noreferrer" : undefined}
        className="text-primary underline hover:opacity-80 transition-opacity"
      >
        {children}
      </a>
    );
  },
  // Paragraphs
  p({ children }) {
    return <p className="text-[1rem] text-on-surface leading-relaxed mb-2 last:mb-0">{children}</p>;
  },
  // Unordered lists
  ul({ children }) {
    return <ul className="list-disc list-inside space-y-1 my-2 text-on-surface">{children}</ul>;
  },
  // Ordered lists
  ol({ children }) {
    return <ol className="list-decimal list-inside space-y-1 my-2 text-on-surface">{children}</ol>;
  },
};

// ---------------------------------------------------------------------------
// Subagent detection — detect "[agent-name]: content" prefix pattern
// ---------------------------------------------------------------------------

interface SubagentMessage {
  agentName: string;
  agentRole?: string;
  content: string;
}

function parseSubagentMessage(content: string): SubagentMessage | null {
  // Pattern: "[AgentName (Role)]: actual content"
  const match = /^\[([^\]]+?)(?:\s+\(([^)]+)\))?\]:\s*([\s\S]*)$/.exec(content.trim());
  if (match) {
    return {
      agentName: match[1] ?? "",
      agentRole: match[2],
      content: match[3] ?? "",
    };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export interface MessageRendererProps {
  message: Message;
  toolCalls?: ToolCall[];
  isStreaming?: boolean;
}

export function MessageRenderer({ message, toolCalls, isStreaming }: MessageRendererProps) {
  const { role, content } = message;

  // ── User messages: plain text only (no markdown to avoid XSS from user input)
  if (role === "user") {
    return (
      <p className="text-[1rem] text-on-surface whitespace-pre-wrap break-words">{content}</p>
    );
  }

  // ── Tool result messages
  if (role === "tool") {
    // Try terminal card first
    const terminalData = parseTerminalContent(content);
    if (terminalData) {
      return (
        <TerminalCard
          output={terminalData.output}
          exitCode={terminalData.exitCode}
          command={terminalData.command}
        />
      );
    }

    // Try file preview
    const fileData = parseFileContent(content);
    if (fileData) {
      return <FilePreview {...fileData} />;
    }

    // Fallback: show raw tool output in a terminal-style card
    return <TerminalCard output={content} toolName="tool" />;
  }

  // ── Assistant / system messages: rich markdown

  // Check for subagent message pattern
  const subagent = parseSubagentMessage(content);
  const renderContent = subagent ? subagent.content : content;

  // Detect task list — if the content has task items, render TodoChecklist after markdown
  const taskItems = parseTaskList(renderContent);
  const hasTaskList = taskItems.length > 0;

  // For streaming, append cursor marker to the markdown content
  const displayContent = isStreaming ? renderContent + " ▍" : renderContent;

  return (
    <div className="space-y-1">
      {/* Subagent badge */}
      {subagent && (
        <div className="mb-2">
          <AgentBadge name={subagent.agentName} role={subagent.agentRole} />
        </div>
      )}

      {/* Main content */}
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[
          [rehypeHighlight, { ignoreMissing: true }],
          [rehypeSanitize, sanitizeSchema],
        ]}
        components={markdownComponents}
      >
        {displayContent}
      </ReactMarkdown>

      {/* Interactive checklist — rendered below markdown when task items detected */}
      {hasTaskList && <TodoChecklist items={taskItems} />}

      {/* Tool timeline */}
      {toolCalls && toolCalls.length > 0 && (
        <ToolTimeline toolCalls={toolCalls} />
      )}
    </div>
  );
}
