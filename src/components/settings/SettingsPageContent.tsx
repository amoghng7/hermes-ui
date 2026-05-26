"use client";

import { useEffect, useMemo, useState } from "react";
import {
  deleteSession,
  getProfileSettings,
  listModels,
  listSessions,
  updateMemory,
  updateProfileSettings,
} from "@/lib/hermesClient";
import { useActiveProfile, useSessions } from "@/store/hooks";
import { useHermesStore } from "@/store/hermesStore";

type ProviderId = "openai" | "anthropic" | "ollama" | "local";
type ThemeMode = "light" | "dark" | "system";
type ChatDensity = "comfortable" | "compact";
type FontSize = "small" | "medium" | "large";

type ProviderState = {
  enabled: boolean;
  apiKey: string;
  baseUrl: string;
};

type ProviderTestState = {
  status: "idle" | "running" | "success" | "error";
  latencyMs?: number;
  error?: string;
};

type AppearanceSettings = {
  theme: ThemeMode;
  density: ChatDensity;
  fontSize: FontSize;
};

type PersistedSettings = {
  providers: Record<ProviderId, Omit<ProviderState, "apiKey">>;
  defaultProvider: ProviderId;
  gatewayUrl: string;
  appearance: AppearanceSettings;
};

type GatewayStatus = {
  state: "idle" | "checking" | "healthy" | "unhealthy";
  latencyMs?: number;
  message?: string;
  version?: string;
  uptime?: string;
};

const SETTINGS_STORAGE_KEY = "hermes-ui.settings.v1";
const VALID_PROVIDER_IDS: ReadonlySet<string> = new Set(["openai", "anthropic", "ollama", "local"]);
const VALID_THEMES: ReadonlySet<string> = new Set(["light", "dark", "system"]);
const VALID_DENSITIES: ReadonlySet<string> = new Set(["comfortable", "compact"]);
const VALID_FONT_SIZES: ReadonlySet<string> = new Set(["small", "medium", "large"]);
const PROVIDERS: Array<{ id: ProviderId; label: string }> = [
  { id: "openai", label: "OpenAI" },
  { id: "anthropic", label: "Anthropic" },
  { id: "ollama", label: "Ollama" },
  { id: "local", label: "Local" },
];

const DEFAULT_BASE_URLS: Record<ProviderId, string> = {
  openai: "https://api.openai.com/v1",
  anthropic: "https://api.anthropic.com",
  ollama: "http://localhost:11434",
  local: process.env.NEXT_PUBLIC_HERMES_BASE_URL ?? "http://localhost:8000",
};

const DEFAULT_PERSISTED_SETTINGS: PersistedSettings = {
  providers: {
    openai: { enabled: true, baseUrl: DEFAULT_BASE_URLS.openai },
    anthropic: { enabled: true, baseUrl: DEFAULT_BASE_URLS.anthropic },
    ollama: { enabled: false, baseUrl: DEFAULT_BASE_URLS.ollama },
    local: { enabled: true, baseUrl: DEFAULT_BASE_URLS.local },
  },
  defaultProvider: "local",
  gatewayUrl: process.env.NEXT_PUBLIC_HERMES_BASE_URL ?? "http://localhost:8000",
  appearance: {
    theme: "dark",
    density: "comfortable",
    fontSize: "medium",
  },
};
const CLEAR_SESSIONS_CONFIRM_TEXT = "clear sessions";
const RESET_MEMORY_CONFIRM_TEXT = "reset memory";
const FONT_SIZE_PX: Record<FontSize, string> = {
  small: "15px",
  medium: "16px",
  large: "17px",
};

function readPersistedSettings(): PersistedSettings {
  if (typeof window === "undefined") return DEFAULT_PERSISTED_SETTINGS;
  try {
    const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return DEFAULT_PERSISTED_SETTINGS;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const defaultProvider = typeof parsed["defaultProvider"] === "string" && VALID_PROVIDER_IDS.has(parsed["defaultProvider"])
      ? parsed["defaultProvider"] as ProviderId
      : DEFAULT_PERSISTED_SETTINGS.defaultProvider;
    const parsedProviders = typeof parsed["providers"] === "object" && parsed["providers"] !== null
      ? (parsed["providers"] as Record<string, unknown>)
      : {};
    const parsedAppearance = typeof parsed["appearance"] === "object" && parsed["appearance"] !== null
      ? (parsed["appearance"] as Record<string, unknown>)
      : {};
    return {
      providers: {
        openai: {
          enabled: typeof (parsedProviders["openai"] as Record<string, boolean> | null)?.["enabled"] === "boolean"
            ? (parsedProviders["openai"] as Record<string, boolean>)["enabled"]
            : DEFAULT_PERSISTED_SETTINGS.providers.openai.enabled,
          baseUrl: typeof (parsedProviders["openai"] as Record<string, string> | null)?.["baseUrl"] === "string"
            ? (parsedProviders["openai"] as Record<string, string>)["baseUrl"]
            : DEFAULT_PERSISTED_SETTINGS.providers.openai.baseUrl,
        },
        anthropic: {
          enabled: typeof (parsedProviders["anthropic"] as Record<string, boolean> | null)?.["enabled"] === "boolean"
            ? (parsedProviders["anthropic"] as Record<string, boolean>)["enabled"]
            : DEFAULT_PERSISTED_SETTINGS.providers.anthropic.enabled,
          baseUrl: typeof (parsedProviders["anthropic"] as Record<string, string> | null)?.["baseUrl"] === "string"
            ? (parsedProviders["anthropic"] as Record<string, string>)["baseUrl"]
            : DEFAULT_PERSISTED_SETTINGS.providers.anthropic.baseUrl,
        },
        ollama: {
          enabled: typeof (parsedProviders["ollama"] as Record<string, boolean> | null)?.["enabled"] === "boolean"
            ? (parsedProviders["ollama"] as Record<string, boolean>)["enabled"]
            : DEFAULT_PERSISTED_SETTINGS.providers.ollama.enabled,
          baseUrl: typeof (parsedProviders["ollama"] as Record<string, string> | null)?.["baseUrl"] === "string"
            ? (parsedProviders["ollama"] as Record<string, string>)["baseUrl"]
            : DEFAULT_PERSISTED_SETTINGS.providers.ollama.baseUrl,
        },
        local: {
          enabled: typeof (parsedProviders["local"] as Record<string, boolean> | null)?.["enabled"] === "boolean"
            ? (parsedProviders["local"] as Record<string, boolean>)["enabled"]
            : DEFAULT_PERSISTED_SETTINGS.providers.local.enabled,
          baseUrl: typeof (parsedProviders["local"] as Record<string, string> | null)?.["baseUrl"] === "string"
            ? (parsedProviders["local"] as Record<string, string>)["baseUrl"]
            : DEFAULT_PERSISTED_SETTINGS.providers.local.baseUrl,
        },
      },
      defaultProvider,
      gatewayUrl: typeof parsed["gatewayUrl"] === "string"
        ? parsed["gatewayUrl"]
        : DEFAULT_PERSISTED_SETTINGS.gatewayUrl,
      appearance: {
        theme: typeof parsedAppearance["theme"] === "string" && VALID_THEMES.has(parsedAppearance["theme"])
          ? parsedAppearance["theme"] as ThemeMode
          : DEFAULT_PERSISTED_SETTINGS.appearance.theme,
        density: typeof parsedAppearance["density"] === "string" && VALID_DENSITIES.has(parsedAppearance["density"])
          ? parsedAppearance["density"] as ChatDensity
          : DEFAULT_PERSISTED_SETTINGS.appearance.density,
        fontSize: typeof parsedAppearance["fontSize"] === "string" && VALID_FONT_SIZES.has(parsedAppearance["fontSize"])
          ? parsedAppearance["fontSize"] as FontSize
          : DEFAULT_PERSISTED_SETTINGS.appearance.fontSize,
      },
    };
  } catch {
    return DEFAULT_PERSISTED_SETTINGS;
  }
}
function resolveTheme(theme: ThemeMode): "light" | "dark" {
  if (theme === "system") {
    return typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }
  return theme;
}

function applyAppearanceSettings(appearance: AppearanceSettings): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const resolved = resolveTheme(appearance.theme);
  root.classList.toggle("dark", resolved === "dark");
  root.style.colorScheme = resolved;
  root.dataset.chatDensity = appearance.density;
  root.style.fontSize = FONT_SIZE_PX[appearance.fontSize];
}

async function requestWithTimeout(url: string, init: RequestInit = {}, timeoutMs = 12000): Promise<Response> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    window.clearTimeout(timeout);
  }
}

export function SettingsPageContent() {
  const activeProfile = useActiveProfile();
  const sessions = useSessions();
  const switchProfile = useHermesStore((s) => s.switchProfile);

  const [hydrated, setHydrated] = useState(false);
  const [models, setModels] = useState<string[]>(["hermes"]);
  const [defaultModel, setDefaultModel] = useState("hermes");
  const [defaultProvider, setDefaultProvider] = useState<ProviderId>("local");
  const [gatewayUrl, setGatewayUrl] = useState(DEFAULT_PERSISTED_SETTINGS.gatewayUrl);
  const [gatewayStatus, setGatewayStatus] = useState<GatewayStatus>({ state: "idle" });
  const [providerSettings, setProviderSettings] = useState<Record<ProviderId, ProviderState>>({
    openai: { enabled: true, apiKey: "", baseUrl: DEFAULT_BASE_URLS.openai },
    anthropic: { enabled: true, apiKey: "", baseUrl: DEFAULT_BASE_URLS.anthropic },
    ollama: { enabled: false, apiKey: "", baseUrl: DEFAULT_BASE_URLS.ollama },
    local: { enabled: true, apiKey: "", baseUrl: DEFAULT_BASE_URLS.local },
  });
  const [revealedKeys, setRevealedKeys] = useState<Record<ProviderId, boolean>>({
    openai: false,
    anthropic: false,
    ollama: false,
    local: false,
  });
  const [providerTests, setProviderTests] = useState<Record<ProviderId, ProviderTestState>>({
    openai: { status: "idle" },
    anthropic: { status: "idle" },
    ollama: { status: "idle" },
    local: { status: "idle" },
  });
  const [appearance, setAppearance] = useState<AppearanceSettings>(DEFAULT_PERSISTED_SETTINGS.appearance);
  const [savingProviderSettings, setSavingProviderSettings] = useState(false);
  const [dangerBusy, setDangerBusy] = useState<"sessions" | "memory" | null>(null);
  const [clearSessionsConfirm, setClearSessionsConfirm] = useState("");
  const [resetMemoryConfirm, setResetMemoryConfirm] = useState("");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isLocalGateway = useMemo(() => {
    try {
      const parsed = new URL(gatewayUrl);
      return parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
    } catch {
      return false;
    }
  }, [gatewayUrl]);

  useEffect(() => {
    const saved = readPersistedSettings();
    setDefaultProvider(saved.defaultProvider);
    setGatewayUrl(saved.gatewayUrl);
    setAppearance(saved.appearance);
    setProviderSettings((prev) => ({
      openai: { ...prev.openai, ...saved.providers.openai },
      anthropic: { ...prev.anthropic, ...saved.providers.anthropic },
      ollama: { ...prev.ollama, ...saved.providers.ollama },
      local: { ...prev.local, ...saved.providers.local },
    }));
    applyAppearanceSettings(saved.appearance);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const payload: PersistedSettings = {
      providers: {
        openai: { enabled: providerSettings.openai.enabled, baseUrl: providerSettings.openai.baseUrl },
        anthropic: { enabled: providerSettings.anthropic.enabled, baseUrl: providerSettings.anthropic.baseUrl },
        ollama: { enabled: providerSettings.ollama.enabled, baseUrl: providerSettings.ollama.baseUrl },
        local: { enabled: providerSettings.local.enabled, baseUrl: providerSettings.local.baseUrl },
      },
      defaultProvider,
      gatewayUrl,
      appearance,
    };
    window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(payload));
    applyAppearanceSettings(appearance);
  }, [hydrated, providerSettings, defaultProvider, gatewayUrl, appearance]);

  // Reconcile defaultProvider when its provider is disabled so the select
  // never renders with a value that is not present in its options.
  useEffect(() => {
    if (!hydrated) return;
    const enabled = PROVIDERS.filter((p) => providerSettings[p.id].enabled);
    if (enabled.length === 0) return;
    if (!enabled.some((p) => p.id === defaultProvider)) {
      setDefaultProvider(enabled[0].id);
    }
  }, [hydrated, providerSettings, defaultProvider]);

  useEffect(() => {
    if (!activeProfile) return;
    let cancelled = false;
    (async () => {
      try {
        const [settings, availableModels] = await Promise.all([
          getProfileSettings(activeProfile.id),
          listModels().catch(() => ["hermes"]),
        ]);
        if (cancelled) return;
        setModels(availableModels.length > 0 ? availableModels : ["hermes"]);
        setDefaultModel(settings.defaultModel || "hermes");
        setProviderSettings((prev) => ({
          ...prev,
          openai: { ...prev.openai, apiKey: settings.apiKeys.openai ?? "" },
          anthropic: { ...prev.anthropic, apiKey: settings.apiKeys.anthropic ?? "" },
          ollama: { ...prev.ollama, apiKey: settings.apiKeys.ollama ?? "" },
          local: { ...prev.local, apiKey: settings.apiKeys.local ?? "" },
        }));
      } catch {
        if (cancelled) return;
        setModels(["hermes"]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeProfile]);

  useEffect(() => {
    if (!hydrated) return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const listener = () => {
      if (appearance.theme === "system") applyAppearanceSettings(appearance);
    };
    media.addEventListener("change", listener);
    return () => media.removeEventListener("change", listener);
  }, [hydrated, appearance]);

  const saveProviderSettings = async (): Promise<void> => {
    if (!activeProfile) {
      setErrorMessage("Select an active profile before saving settings.");
      return;
    }

    setSavingProviderSettings(true);
    setErrorMessage(null);
    setStatusMessage(null);

    try {
      await updateProfileSettings(activeProfile.id, {
        defaultModel,
        apiKeys: {
          openai: providerSettings.openai.apiKey,
          anthropic: providerSettings.anthropic.apiKey,
          ollama: providerSettings.ollama.apiKey,
          local: providerSettings.local.apiKey,
        },
      });
      setStatusMessage("Provider and default model settings saved.");
    } catch (error: unknown) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to save provider settings.");
    } finally {
      setSavingProviderSettings(false);
    }
  };

  const runProviderTest = async (providerId: ProviderId): Promise<void> => {
    setProviderTests((prev) => ({ ...prev, [providerId]: { status: "running" } }));
    const start = performance.now();

    try {
      // Route provider connection tests through the Hermes gateway to avoid
      // CORS failures on remote providers (OpenAI/Anthropic).
      const gatewayBase = gatewayUrl.replace(/\/$/, "");
      const url = `${gatewayBase}/v1/models?provider=${providerId}`;

      const response = await requestWithTimeout(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} ${response.statusText}`);
      }

      const latencyMs = Math.round(performance.now() - start);
      setProviderTests((prev) => ({ ...prev, [providerId]: { status: "success", latencyMs } }));
    } catch (error: unknown) {
      setProviderTests((prev) => ({
        ...prev,
        [providerId]: {
          status: "error",
          error: error instanceof Error ? error.message : "Connection test failed.",
        },
      }));
    }
  };

  const checkGatewayHealth = async (): Promise<void> => {
    setGatewayStatus({ state: "checking" });
    setErrorMessage(null);
    try {
      const base = gatewayUrl.replace(/\/$/, "");
      const start = performance.now();
      const healthRes = await requestWithTimeout(`${base}/health`);
      const latencyMs = Math.round(performance.now() - start);

      if (!healthRes.ok) {
        throw new Error(`Health check failed (${healthRes.status})`);
      }

      let uptime: string | undefined;
      let message: string | undefined;

      const healthPayload = (await healthRes.json().catch(() => null)) as Record<string, unknown> | null;
      if (healthPayload) {
        const uptimeValue = healthPayload["uptime"];
        if (typeof uptimeValue === "string" || typeof uptimeValue === "number") {
          uptime = String(uptimeValue);
        }
        const statusValue = healthPayload["status"];
        if (typeof statusValue === "string") {
          message = statusValue;
        }
      }

      let version: string | undefined;
      const versionRes = await requestWithTimeout(`${base}/version`).catch(() => null);
      if (versionRes && versionRes.ok) {
        const versionPayload = (await versionRes.json().catch(() => null)) as Record<string, unknown> | null;
        if (versionPayload) {
          const candidate = versionPayload["version"] ?? versionPayload["tag"];
          if (typeof candidate === "string") version = candidate;
        }
      }

      setGatewayStatus({
        state: "healthy",
        latencyMs,
        uptime,
        version,
        message: message ?? "Online",
      });
    } catch (error: unknown) {
      setGatewayStatus({
        state: "unhealthy",
        message: error instanceof Error ? error.message : "Gateway unreachable",
      });
    }
  };

  const clearAllSessions = async (): Promise<void> => {
    if (!activeProfile) {
      setErrorMessage("Select an active profile before clearing sessions.");
      return;
    }

    if (clearSessionsConfirm.trim().toLowerCase() !== CLEAR_SESSIONS_CONFIRM_TEXT) {
      setErrorMessage(`Type "${CLEAR_SESSIONS_CONFIRM_TEXT}" to confirm bulk deletion.`);
      return;
    }

    setDangerBusy("sessions");
    setErrorMessage(null);
    setStatusMessage(null);

    try {
      const profileSessions = await listSessions(activeProfile.id);
      const deletions = await Promise.allSettled(profileSessions.map((session) => deleteSession(session.id)));
      const failed = deletions.filter((result) => result.status === "rejected").length;
      await switchProfile(activeProfile.id);
      setClearSessionsConfirm("");
      if (failed > 0) {
        setErrorMessage(`${failed} session deletions failed. Remaining sessions were reloaded.`);
      } else {
        setStatusMessage("All sessions cleared for the active profile.");
      }
    } catch (error: unknown) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to clear sessions.");
    } finally {
      setDangerBusy(null);
    }
  };

  const resetMemory = async (): Promise<void> => {
    if (!activeProfile) {
      setErrorMessage("Select an active profile before resetting memory.");
      return;
    }

    if (resetMemoryConfirm.trim().toLowerCase() !== RESET_MEMORY_CONFIRM_TEXT) {
      setErrorMessage(`Type "${RESET_MEMORY_CONFIRM_TEXT}" to confirm memory reset.`);
      return;
    }

    setDangerBusy("memory");
    setErrorMessage(null);
    setStatusMessage(null);

    try {
      await updateMemory(activeProfile.id, "");

      const base = gatewayUrl.replace(/\/$/, "");
      const authKey = process.env.NEXT_PUBLIC_HERMES_API_KEY;
      const headers: HeadersInit = {
        "Content-Type": "application/json",
      };
      if (authKey) {
        headers.Authorization = "Bearer ".concat(authKey);
      }

      await Promise.allSettled([
        requestWithTimeout(`${base}/v1/memory`, { method: "PUT", headers, body: JSON.stringify({ content: "" }) }),
        requestWithTimeout(`${base}/v1/memory/global`, {
          method: "PUT",
          headers,
          body: JSON.stringify({ content: "" }),
        }),
      ]);

      useHermesStore.setState({ memory: [] });
      setResetMemoryConfirm("");
      setStatusMessage("Profile memory reset. Global memory reset attempted.");
    } catch (error: unknown) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to reset memory.");
    } finally {
      setDangerBusy(null);
    }
  };

  return (
    <div className="w-full max-w-6xl mx-auto px-4 md:px-2 py-4 flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold font-outfit tracking-tight text-on-surface">Settings</h1>
        <p className="text-sm text-on-surface-variant mt-1">Model providers, gateway runtime status, appearance preferences, and destructive controls.</p>
      </div>

      <div aria-live="polite" className="flex flex-col gap-3">
      {statusMessage && (
        <div className="rounded-xl border border-primary/40 bg-primary/10 px-4 py-3 text-sm text-primary">
          {statusMessage}
        </div>
      )}
      {errorMessage && (
        <div role="alert" className="rounded-xl border border-status-error/40 bg-status-error/10 px-4 py-3 text-sm text-status-error">
          {errorMessage}
        </div>
      )}
      </div>

      <section className="rounded-2xl border border-border-default bg-surface-container-low p-5 flex flex-col gap-4">
        <div>
          <h2 className="text-lg font-semibold text-on-surface">Model providers</h2>
          <p className="text-sm text-on-surface-variant">Configure provider credentials and defaults for new sessions.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {PROVIDERS.map((provider) => {
            const config = providerSettings[provider.id];
            const test = providerTests[provider.id];
            return (
              <div key={provider.id} className="rounded-xl border border-border-default bg-surface-container p-4 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-on-surface">{provider.label}</h3>
                  <label className="flex items-center gap-2 text-xs text-on-surface-variant">
                    <input
                      type="checkbox"
                      checked={config.enabled}
                      onChange={(event) =>
                        setProviderSettings((prev) => ({
                          ...prev,
                          [provider.id]: { ...prev[provider.id], enabled: event.target.checked },
                        }))
                      }
                    />
                    Enabled
                  </label>
                </div>

                <label className="flex flex-col gap-1">
                  <span className="text-xs text-on-surface-variant uppercase tracking-wide">API key</span>
                  <div className="flex gap-2">
                    <input
                      type={revealedKeys[provider.id] ? "text" : "password"}
                      value={config.apiKey}
                      onChange={(event) =>
                        setProviderSettings((prev) => ({
                          ...prev,
                          [provider.id]: { ...prev[provider.id], apiKey: event.target.value },
                        }))
                      }
                      placeholder="••••••••"
                      className="w-full rounded-xl border border-border-default bg-surface-container-lowest px-3 py-2 text-sm text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    />
                    <button
                      type="button"
                      aria-pressed={revealedKeys[provider.id]}
                      aria-label={`${revealedKeys[provider.id] ? "Hide" : "Show"} ${provider.label} API key`}
                      onClick={() =>
                        setRevealedKeys((prev) => ({ ...prev, [provider.id]: !prev[provider.id] }))
                      }
                      className="px-3 py-2 rounded-xl border border-border-default text-xs text-on-surface-variant hover:bg-hover-subtle"
                    >
                      {revealedKeys[provider.id] ? "Hide" : "Show"}
                    </button>
                  </div>
                </label>

                <label className="flex flex-col gap-1">
                  <span className="text-xs text-on-surface-variant uppercase tracking-wide">Base URL</span>
                  <input
                    type="url"
                    value={config.baseUrl}
                    onChange={(event) =>
                      setProviderSettings((prev) => ({
                        ...prev,
                        [provider.id]: { ...prev[provider.id], baseUrl: event.target.value },
                      }))
                    }
                    className="rounded-xl border border-border-default bg-surface-container-lowest px-3 py-2 text-sm text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  />
                </label>

                <div className="flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => void runProviderTest(provider.id)}
                    disabled={test.status === "running"}
                    className="px-3 py-2 rounded-xl border border-border-default text-sm text-on-surface hover:bg-hover-subtle disabled:opacity-50"
                  >
                    {test.status === "running" ? "Testing…" : "Test connection"}
                  </button>
                  <p className="text-xs text-on-surface-variant text-right">
                    {test.status === "success" && `Latency: ${test.latencyMs}ms`}
                    {test.status === "error" && (test.error ?? "Connection failed")}
                    {test.status === "idle" && "No test run yet"}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="flex flex-col gap-1">
            <span className="text-xs text-on-surface-variant uppercase tracking-wide">Default provider</span>
            <select
              value={defaultProvider}
              onChange={(event) => setDefaultProvider(event.target.value as ProviderId)}
              className="rounded-xl border border-border-default bg-surface-container-lowest px-3 py-2 text-sm text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              {PROVIDERS.filter((provider) => providerSettings[provider.id].enabled).map((provider) => (
                <option key={provider.id} value={provider.id}>
                  {provider.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-on-surface-variant uppercase tracking-wide">Default model</span>
            <select
              value={defaultModel}
              onChange={(event) => setDefaultModel(event.target.value)}
              className="rounded-xl border border-border-default bg-surface-container-lowest px-3 py-2 text-sm text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              {models.map((model) => (
                <option key={model} value={model}>
                  {model}
                </option>
              ))}
            </select>
          </label>
        </div>

        <button
          type="button"
          onClick={() => void saveProviderSettings()}
          disabled={savingProviderSettings}
          className="self-start px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
        >
          {savingProviderSettings ? "Saving…" : "Save provider defaults"}
        </button>
      </section>

      <section className="rounded-2xl border border-border-default bg-surface-container-low p-5 flex flex-col gap-4">
        <div>
          <h2 className="text-lg font-semibold text-on-surface">Hermes gateway</h2>
          <p className="text-sm text-on-surface-variant">Gateway URL, live health checks, and runtime metadata.</p>
        </div>

        <label className="flex flex-col gap-1">
          <span className="text-xs text-on-surface-variant uppercase tracking-wide">Gateway URL</span>
          <input
            type="url"
            value={gatewayUrl}
            onChange={(event) => setGatewayUrl(event.target.value)}
            className="rounded-xl border border-border-default bg-surface-container-lowest px-3 py-2 text-sm text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          />
        </label>

        <div className="flex items-center gap-3 flex-wrap">
          <button
            type="button"
            onClick={() => void checkGatewayHealth()}
            disabled={gatewayStatus.state === "checking"}
            className="px-3 py-2 rounded-xl border border-border-default text-sm text-on-surface hover:bg-hover-subtle disabled:opacity-50"
          >
            {gatewayStatus.state === "checking" ? "Checking…" : "Check health"}
          </button>
          <span
            className={[
              "inline-flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-full border",
              gatewayStatus.state === "healthy"
                ? "border-primary/40 text-primary bg-primary/10"
                : gatewayStatus.state === "unhealthy"
                  ? "border-status-error/40 text-status-error bg-status-error/10"
                  : "border-border-default text-on-surface-variant bg-surface-container",
            ].join(" ")}
          >
            <span
              className={[
                "w-2 h-2 rounded-full",
                gatewayStatus.state === "healthy"
                  ? "bg-primary"
                  : gatewayStatus.state === "unhealthy"
                    ? "bg-status-error"
                    : "bg-on-surface-variant",
              ].join(" ")}
              aria-hidden="true"
            />
            {gatewayStatus.state === "checking"
              ? "Checking"
              : gatewayStatus.state === "healthy"
                ? "Healthy"
                : gatewayStatus.state === "unhealthy"
                  ? "Unhealthy"
                  : "Unknown"}
          </span>
          {gatewayStatus.latencyMs !== undefined && (
            <span className="text-xs text-on-surface-variant">Latency: {gatewayStatus.latencyMs}ms</span>
          )}
          {gatewayStatus.version && (
            <span className="text-xs text-on-surface-variant">Version: {gatewayStatus.version}</span>
          )}
          {gatewayStatus.uptime && (
            <span className="text-xs text-on-surface-variant">Uptime: {gatewayStatus.uptime}</span>
          )}
          {gatewayStatus.message && (
            <span className="text-xs text-on-surface-variant">{gatewayStatus.message}</span>
          )}
        </div>

        <div className="rounded-xl border border-border-default bg-surface-container p-4 flex flex-wrap items-center gap-3 justify-between">
          <p className="text-sm text-on-surface-variant">
            {isLocalGateway
              ? "Gateway appears local. Process controls require a server-managed child process endpoint."
              : "Gateway process controls are read-only for remote deployments."}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled
              className="px-3 py-2 rounded-xl border border-border-default text-sm text-on-surface-variant opacity-60 cursor-not-allowed"
            >
              Start gateway
            </button>
            <button
              type="button"
              disabled
              className="px-3 py-2 rounded-xl border border-border-default text-sm text-on-surface-variant opacity-60 cursor-not-allowed"
            >
              Stop gateway
            </button>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-border-default bg-surface-container-low p-5 flex flex-col gap-4">
        <div>
          <h2 className="text-lg font-semibold text-on-surface">Appearance</h2>
          <p className="text-sm text-on-surface-variant">Theme and readability controls stored in local browser settings.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <label className="flex flex-col gap-1">
            <span className="text-xs text-on-surface-variant uppercase tracking-wide">Theme</span>
            <select
              value={appearance.theme}
              onChange={(event) =>
                setAppearance((prev) => ({ ...prev, theme: event.target.value as ThemeMode }))
              }
              className="rounded-xl border border-border-default bg-surface-container-lowest px-3 py-2 text-sm text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <option value="light">Light</option>
              <option value="dark">Dark</option>
              <option value="system">System</option>
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs text-on-surface-variant uppercase tracking-wide">Chat density</span>
            <select
              value={appearance.density}
              onChange={(event) =>
                setAppearance((prev) => ({ ...prev, density: event.target.value as ChatDensity }))
              }
              className="rounded-xl border border-border-default bg-surface-container-lowest px-3 py-2 text-sm text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <option value="comfortable">Comfortable</option>
              <option value="compact">Compact</option>
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs text-on-surface-variant uppercase tracking-wide">Font size</span>
            <select
              value={appearance.fontSize}
              onChange={(event) =>
                setAppearance((prev) => ({ ...prev, fontSize: event.target.value as FontSize }))
              }
              className="rounded-xl border border-border-default bg-surface-container-lowest px-3 py-2 text-sm text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <option value="small">Small</option>
              <option value="medium">Medium</option>
              <option value="large">Large</option>
            </select>
          </label>
        </div>
      </section>

      <section className="rounded-2xl border border-status-error/40 bg-status-error/10 p-5 flex flex-col gap-4">
        <div>
          <h2 className="text-lg font-semibold text-status-error">Danger zone</h2>
          <p className="text-sm text-status-error/90">Destructive actions require explicit confirmation.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="rounded-xl border border-status-error/40 bg-surface-container-lowest p-4 flex flex-col gap-3">
            <h3 className="text-sm font-semibold text-status-error">Clear all sessions</h3>
            <p className="text-xs text-status-error/90">Delete all sessions in the active profile ({sessions.length} currently loaded).</p>
            <input
              type="text"
              value={clearSessionsConfirm}
              onChange={(event) => setClearSessionsConfirm(event.target.value)}
              placeholder={`Type "${CLEAR_SESSIONS_CONFIRM_TEXT}"`}
              className="rounded-xl border border-status-error/50 bg-surface-container-lowest px-3 py-2 text-sm text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-status-error"
            />
            <button
              type="button"
              onClick={() => void clearAllSessions()}
              disabled={
                dangerBusy !== null ||
                clearSessionsConfirm.trim().toLowerCase() !== CLEAR_SESSIONS_CONFIRM_TEXT
              }
              className="self-start px-4 py-2 rounded-xl bg-status-error text-on-surface text-sm font-medium hover:bg-status-error/90 disabled:opacity-50"
            >
              {dangerBusy === "sessions" ? "Clearing…" : "Clear all sessions"}
            </button>
          </div>

          <div className="rounded-xl border border-status-error/40 bg-surface-container-lowest p-4 flex flex-col gap-3">
            <h3 className="text-sm font-semibold text-status-error">Reset memory</h3>
            <p className="text-xs text-status-error/90">Reset profile memory and attempt global HONCHO memory reset.</p>
            <input
              type="text"
              value={resetMemoryConfirm}
              onChange={(event) => setResetMemoryConfirm(event.target.value)}
              placeholder={`Type "${RESET_MEMORY_CONFIRM_TEXT}"`}
              className="rounded-xl border border-status-error/50 bg-surface-container-lowest px-3 py-2 text-sm text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-status-error"
            />
            <button
              type="button"
              onClick={() => void resetMemory()}
              disabled={
                dangerBusy !== null ||
                resetMemoryConfirm.trim().toLowerCase() !== RESET_MEMORY_CONFIRM_TEXT
              }
              className="self-start px-4 py-2 rounded-xl bg-status-error text-on-surface text-sm font-medium hover:bg-status-error/90 disabled:opacity-50"
            >
              {dangerBusy === "memory" ? "Resetting…" : "Reset memory"}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
