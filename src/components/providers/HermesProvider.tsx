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
    let mounted = true;
    let isPolling = false;
    let pollVersion = 0;
    let intervalId: ReturnType<typeof setInterval> | null = null;

    const poll = async () => {
      if (!mounted || isPolling) return;
      isPolling = true;
      const version = ++pollVersion;
      const { activeProfileId, _setSessions } = useHermesStore.getState();
      if (!activeProfileId) { isPolling = false; return; }
      try {
        const sessions = await listSessions(activeProfileId);
        // Discard results if unmounted, a newer poll started, or the profile changed.
        const current = useHermesStore.getState();
        if (mounted && version === pollVersion && current.activeProfileId === activeProfileId) {
          _setSessions(sessions);
        }
      } catch {
        // Silently tolerate gateway errors during background polling.
      } finally {
        isPolling = false;
      }
    };

    // Await bootstrap before polling so the first poll finds a valid activeProfileId.
    // bootstrapStore() already handles its own errors internally.
    bootstrapStore().then(() => {
      if (!mounted) return;
      void poll();
      intervalId = setInterval(() => { void poll(); }, POLL_INTERVAL_MS);
    }).catch(() => {/* bootstrapStore is already error-safe */});

    return () => {
      mounted = false;
      if (intervalId !== null) clearInterval(intervalId);
    };
  }, []);

  return <>{children}</>;
}
