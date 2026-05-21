"use client";

/**
 * HermesProvider — thin client wrapper that bootstraps the Zustand store
 * on first mount and provides it to the React tree.
 *
 * Because Zustand stores are module-level singletons, no React context is
 * strictly required.  This component exists solely to:
 *   1. Trigger `bootstrapStore()` once on the client side.
 *   2. Give us a clear seam to wrap in tests or replace with a mock store.
 */

import { useEffect } from "react";
import { bootstrapStore } from "@/store/hermesStore";

interface HermesProviderProps {
  children: React.ReactNode;
}

export function HermesProvider({ children }: HermesProviderProps) {
  useEffect(() => {
    bootstrapStore();
  }, []);

  return <>{children}</>;
}
