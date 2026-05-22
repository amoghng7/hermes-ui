"use client";

/**
 * HermesProvider — thin client wrapper that bootstraps the Zustand store
 * on first mount and provides it to the React tree.
 *
 * Because Zustand stores are module-level singletons, no React context is
 * strictly required.  This component exists solely to:
 *   1. Trigger `bootstrapStore()` once on the client side.
 *   2. Poll for session updates every 30 seconds so the sidebar stays fresh
 *      when other clients (CLI, Telegram, etc.) create sessions.
 *   3. Give us a clear seam to wrap in tests or replace with a mock store.
 */

import { useEffect } from "react";
import { bootstrapStore, useHermesStore } from "@/store/hermesStore";
import { listSessions } from "@/lib/hermesClient";

const POLL_INTERVAL_MS = 30_000;

interface HermesProviderProps {
  children: React.ReactNode;
}

export function HermesProvider({ children }: HermesProviderProps) {
  useEffect(() => {
    bootstrapStore();

    const poll = async () => {
      const { activeProfileId, _setSessions } = useHermesStore.getState();
      if (!activeProfileId) return;
      try {
        const sessions = await listSessions(activeProfileId);
        _setSessions(sessions);
      } catch {
        // Silently tolerate gateway errors during background polling.
      }
    };

    const id = setInterval(() => { void poll(); }, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  return <>{children}</>;
}
