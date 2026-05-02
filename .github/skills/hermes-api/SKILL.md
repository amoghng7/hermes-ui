---
name: hermes-api
description: "Implement the /api/chat SSE endpoint and Hermes gateway integration. Use when building the API route that connects the frontend to the Hermes agent, implementing SSE streaming, wiring threads/sessions to Hermes session keys, or designing message payload shapes for the api_server adapter."
argument-hint: "What to implement: e.g. 'SSE chat route', 'session management', 'message payload'"
---

# Hermes API Integration

## When to Use

- Implementing `/api/chat` route or any Next.js API route talking to Hermes
- Designing request/response payloads for the Hermes `api_server` adapter
- Mapping UI thread IDs to Hermes session keys
- Handling SSE streaming from the Hermes agent loop

## Background

Hermes exposes its agent loop via the `api_server` platform adapter (`gateway/platforms/api_server.py`). The gateway is a long-running Python process — Next.js routes act as a thin proxy, forwarding user messages and streaming the agent's SSE response back to the browser.

Full backend architecture: [Hermes Architecture](https://hermes-agent.nousresearch.com/docs/developer-guide/architecture) | [Gateway Internals](https://hermes-agent.nousresearch.com/docs/developer-guide/gateway-internals)

## Session Keys

Hermes identifies sessions with the format:
```
agent:main:{platform}:{chat_type}:{chat_id}
```

For the `api_server` adapter this becomes something like:
```
agent:main:api_server:private:{userId or threadId}
```

**Never construct session keys manually.** Let the gateway compute them from the platform + chat context. Map UI thread IDs → `chat_id` when calling the gateway.

## Next.js Route Implementation

### 1. Route file location
```
src/app/api/chat/route.ts
```

### 2. Streaming via ReadableStream + SSE
```ts
// src/app/api/chat/route.ts
export const runtime = "nodejs"; // SSE requires Node.js runtime, not Edge

export async function POST(req: Request) {
  const { message, threadId } = await req.json();

  const hermesResponse = await fetch(
    `${process.env.HERMES_GATEWAY_URL}/chat`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, session_id: threadId }),
    }
  );

  // Forward the SSE stream directly to the browser
  return new Response(hermesResponse.body, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
```

### 3. Consuming SSE on the client
```ts
const source = new EventSource("/api/chat"); // or fetch with ReadableStream

// Each SSE event is a partial agent response or tool-call update
// Parse: data: {"type": "token"|"tool_call"|"done", "content": "..."}
```

## Environment Variables

Add to `.env.local`:
```
HERMES_GATEWAY_URL=http://localhost:8765   # default api_server port
```

Never commit API keys. Use `process.env` — not hardcoded values.

## Payload Conventions

The `api_server` adapter is a REST-to-gateway bridge, NOT a generic chat API. Consult `gateway/platforms/api_server.py` in the Hermes repo for the actual request schema before writing payload code. Do not assume OpenAI-compatible shapes.

Key gateway concepts:
- **Session isolation**: Each session key → one `AIAgent` instance with its own SQLite conversation history
- **Two-level guard**: When an agent is already running, new messages are queued (not dropped)
- **Interrupts**: Send a `/stop` command to cancel a running agent turn

## Zustand State Shape (planned)

When wiring state management, the store should reflect real Hermes session lifecycle:

```ts
interface ChatStore {
  threads: Thread[];           // maps to Hermes session keys
  activeThreadId: string | null;
  messages: Record<string, Message[]>;
  swarmState: SwarmState;      // agent cards + topology from agent:step events
  streamingContent: string;    // in-progress token stream
}
```

## Checklist

- [ ] `HERMES_GATEWAY_URL` in `.env.local` (not hardcoded)
- [ ] `export const runtime = "nodejs"` on the route (SSE incompatible with Edge)
- [ ] Thread IDs map to session `chat_id` — do not send raw DB IDs as session keys
- [ ] Handle `Connection: keep-alive` / `Cache-Control: no-cache` headers
- [ ] Consult `api_server.py` in the Hermes repo before finalizing payload shapes
