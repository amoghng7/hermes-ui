"use client";

import { useEffect, useRef, useState } from "react";
import {
  createProfile,
  deleteProfile,
  getProfileSettings,
  listMcpServers,
  listModels,
  listProfiles,
  listSessions,
  listSkills,
  updateProfileSettings,
} from "@/lib/hermesClient";
import { useHermesStore } from "@/store/hermesStore";
import { useActiveProfile, useProfiles } from "@/store/hooks";
import type { McpServer, Profile, ProfileSettings, Skill } from "@/types/hermes";

const PROVIDERS = ["openai", "anthropic", "google", "xai"] as const;

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function formatLastActive(profile: Profile): string {
  const raw = profile.lastActiveAt ?? profile.createdAt;
  if (!raw) return "Unknown";
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return date.toLocaleString();
}

export function ProfilesPageContent() {
  const storeProfiles = useProfiles();
  const activeProfile = useActiveProfile();
  const setActiveProfile = useHermesStore((s) => s.setActiveProfile);

  const [profiles, setProfiles] = useState<Profile[]>(storeProfiles);
  const [sessionCounts, setSessionCounts] = useState<Record<string, number>>({});
  const [skills, setSkills] = useState<Skill[]>([]);
  const [mcpServers, setMcpServers] = useState<McpServer[]>([]);
  const [models, setModels] = useState<string[]>(["hermes"]);
  const [settingsByProfile, setSettingsByProfile] = useState<Record<string, ProfileSettings>>({});
  const [settingsStatusByProfile, setSettingsStatusByProfile] = useState<Record<string, "idle" | "loading" | "loaded" | "error">>({});
  const [settingsErrorByProfile, setSettingsErrorByProfile] = useState<Record<string, string>>({});
  const [revealedKeys, setRevealedKeys] = useState<Record<string, boolean>>({});
  const [expandedProfileId, setExpandedProfileId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [switchingId, setSwitchingId] = useState<string | null>(null);
  const [savingSettingsId, setSavingSettingsId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createColor, setCreateColor] = useState("#6d5efc");
  const [createDescription, setCreateDescription] = useState("");
  const [creating, setCreating] = useState(false);
  const createDialogRef = useRef<HTMLDivElement>(null);
  const createNameInputRef = useRef<HTMLInputElement>(null);

  const refreshProfilesRef = useRef<() => Promise<void>>(async () => undefined);

  useEffect(() => {
    let cancelled = false;
    const doRefresh = async () => {
      setLoading(true);
      setError(null);
      try {
        const [profileList, skillList, serverList, modelList] = await Promise.all([
          listProfiles(),
          listSkills().catch(() => []),
          listMcpServers().catch(() => []),
          listModels().catch(() => ["hermes"]),
        ]);
        if (cancelled) return;
        setProfiles(profileList);
        useHermesStore.setState({ profiles: profileList });
        setSkills(skillList);
        setMcpServers(serverList);
        setModels(modelList.length > 0 ? modelList : ["hermes"]);

        const sessionResults = await Promise.allSettled(profileList.map((p) => listSessions(p.id)));
        if (cancelled) return;
        const nextCounts: Record<string, number> = {};
        profileList.forEach((profile, idx) => {
          nextCounts[profile.id] =
            sessionResults[idx]?.status === "fulfilled" ? sessionResults[idx].value.length : 0;
        });
        setSessionCounts(nextCounts);
      } catch (err: unknown) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load profiles.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    refreshProfilesRef.current = doRefresh;
    void doRefresh();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!createOpen) return;
    requestAnimationFrame(() => createNameInputRef.current?.focus());
  }, [createOpen]);

  // `force` is only used by the Retry action after a failed load.
  async function loadSettings(profileId: string, force = false): Promise<void> {
    const status = settingsStatusByProfile[profileId];
    if (status === "loading") return;
    if (!force && status === "loaded") return;
    setSettingsStatusByProfile((prev) => ({ ...prev, [profileId]: "loading" }));
    setSettingsErrorByProfile((prev) => {
      const next = { ...prev };
      delete next[profileId];
      return next;
    });
    try {
      const settings = await getProfileSettings(profileId);
      setSettingsByProfile((prev) => ({ ...prev, [profileId]: settings }));
      setSettingsStatusByProfile((prev) => ({ ...prev, [profileId]: "loaded" }));
    } catch (err: unknown) {
      setSettingsStatusByProfile((prev) => ({ ...prev, [profileId]: "error" }));
      setSettingsErrorByProfile((prev) => ({
        ...prev,
        [profileId]: err instanceof Error ? err.message : "Failed to load profile settings.",
      }));
    }
  }

  async function handleSwitch(profileId: string): Promise<void> {
    setSwitchingId(profileId);
    setError(null);
    try {
      await setActiveProfile(profileId);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to switch profile.");
    } finally {
      setSwitchingId(null);
    }
  }

  async function handleCreateProfile(): Promise<void> {
    const name = createName.trim();
    if (!name) return;

    setCreating(true);
    setError(null);
    try {
      const created = await createProfile(name, {
        color: createColor,
        description: createDescription.trim() || undefined,
      });
      const next = [created, ...profiles];
      setProfiles(next);
      useHermesStore.setState({ profiles: next });
      await setActiveProfile(created.id);
      setCreateOpen(false);
      setCreateName("");
      setCreateDescription("");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create profile.");
    } finally {
      setCreating(false);
    }
  }

  async function saveSettings(profileId: string): Promise<void> {
    const current = settingsByProfile[profileId];
    if (!current || settingsStatusByProfile[profileId] !== "loaded") {
      setError("Profile settings are not loaded yet. Use Retry to load settings before saving.");
      return;
    }
    setSavingSettingsId(profileId);
    setError(null);
    try {
      const saved = await updateProfileSettings(profileId, current);
      setSettingsByProfile((prev) => ({ ...prev, [profileId]: saved }));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save profile settings.");
    } finally {
      setSavingSettingsId(null);
    }
  }

  async function handleDeleteProfile(profile: Profile): Promise<void> {
    if (deleteConfirm !== profile.name) return;
    setDeletingId(profile.id);
    setError(null);
    try {
      await deleteProfile(profile.id);
      await refreshProfilesRef.current();
      setSettingsByProfile((prev) => {
        const next = { ...prev };
        delete next[profile.id];
        return next;
      });
      setSettingsStatusByProfile((prev) => {
        const next = { ...prev };
        delete next[profile.id];
        return next;
      });
      setSettingsErrorByProfile((prev) => {
        const next = { ...prev };
        delete next[profile.id];
        return next;
      });
      if (activeProfile?.id === profile.id) {
        const remaining = useHermesStore.getState().profiles;
        if (remaining[0]) {
          await setActiveProfile(remaining[0].id);
        } else {
          useHermesStore.setState({
            activeProfileId: null,
            sessions: [],
            activeSessionId: null,
            memory: [],
            streamingSessionId: null,
            streamingMessageId: null,
            messagesBySession: {},
            toolCallsBySession: {},
            agents: {},
          });
        }
      }
      setExpandedProfileId(null);
      setDeleteConfirm("");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to delete profile.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="w-full max-w-6xl mx-auto px-4 md:px-2 py-4 flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold font-outfit tracking-tight text-on-surface">Profiles</h1>
          <p className="text-sm text-on-surface-variant mt-1">
            Switch isolated Hermes workspaces and manage profile-specific defaults.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          Create profile
        </button>
      </div>

      {error && (
        <div role="alert" className="rounded-xl border border-status-error/40 bg-status-error/10 px-4 py-3 text-sm text-status-error">
          {error}
        </div>
      )}

      {loading && <p className="text-sm text-on-surface-variant">Loading profiles…</p>}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {profiles.map((profile) => {
          const isActive = activeProfile?.id === profile.id;
          const cardColor = profile.color ?? "#6d5efc";
          const settingsStatus = settingsStatusByProfile[profile.id] ?? "idle";
          const settingsLoaded = settingsStatus === "loaded";
          const settingsLoading = settingsStatus === "loading";
          const settingsErrored = settingsStatus === "error";
          const profileSettings = settingsByProfile[profile.id];
          const settingsError = settingsErrorByProfile[profile.id];
          // Backend count if available, otherwise local settings count.
          const skillsCount =
            profile.skillsCount ??
            settingsByProfile[profile.id]?.enabledSkillIds.length ??
            0;
          return (
            <section
              key={profile.id}
              className={[
                "rounded-2xl border bg-surface-container-low p-4 flex flex-col gap-4",
                isActive ? "border-primary ring-1 ring-primary/50" : "border-border-default",
              ].join(" ")}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <span
                    aria-hidden="true"
                    className="h-10 w-10 rounded-full text-white text-sm font-semibold flex items-center justify-center shrink-0"
                    style={{ backgroundColor: cardColor }}
                  >
                    {initials(profile.name)}
                  </span>
                  <div className="min-w-0">
                    <h2 className="font-semibold text-on-surface truncate">{profile.name}</h2>
                    <p className="text-xs text-on-surface-variant truncate">
                      {profile.description || "No description"}
                    </p>
                  </div>
                </div>
                {isActive && (
                  <span className="material-symbols-outlined text-primary" aria-hidden="true">
                    check_circle
                  </span>
                )}
              </div>

              <dl className="grid grid-cols-3 gap-2 text-xs">
                <div className="rounded-xl bg-surface-container-high px-3 py-2">
                  <dt className="text-on-surface-variant">Sessions</dt>
                  <dd className="text-on-surface font-semibold mt-1">
                    {profile.sessionCount ?? sessionCounts[profile.id] ?? 0}
                  </dd>
                </div>
                <div className="rounded-xl bg-surface-container-high px-3 py-2">
                  <dt className="text-on-surface-variant">Skills</dt>
                  <dd className="text-on-surface font-semibold mt-1">{skillsCount}</dd>
                </div>
                <div className="rounded-xl bg-surface-container-high px-3 py-2">
                  <dt className="text-on-surface-variant">Last active</dt>
                  <dd className="text-on-surface font-semibold mt-1 truncate" title={formatLastActive(profile)}>
                    {formatLastActive(profile)}
                  </dd>
                </div>
              </dl>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => void handleSwitch(profile.id)}
                  disabled={isActive || switchingId === profile.id}
                  className="px-3 py-2 rounded-xl text-sm font-medium border border-border-default text-on-surface hover:bg-hover-subtle disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  {isActive ? "Active" : switchingId === profile.id ? "Switching…" : "Switch"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const next = expandedProfileId === profile.id ? null : profile.id;
                    setExpandedProfileId(next);
                    setDeleteConfirm("");
                    if (next) void loadSettings(next);
                  }}
                  className="px-3 py-2 rounded-xl text-sm font-medium border border-border-default text-on-surface hover:bg-hover-subtle transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  {expandedProfileId === profile.id ? "Hide settings" : "Profile settings"}
                </button>
              </div>

              {expandedProfileId === profile.id && (
                <div className="rounded-xl border border-border-default bg-surface-container-high p-4 flex flex-col gap-4">
                  {settingsLoading && (
                    <p className="text-sm text-on-surface-variant">Loading profile settings…</p>
                  )}
                  {settingsErrored && (
                    <div className="flex items-center justify-between gap-3 rounded-lg border border-status-error/30 bg-status-error/10 px-3 py-2">
                      <p className="text-sm text-status-error">{settingsError ?? "Failed to load settings."}</p>
                      <button
                        type="button"
                        onClick={() => void loadSettings(profile.id, true)}
                        className="px-2 py-1 rounded-lg border border-status-error/40 text-xs text-status-error hover:bg-status-error/10"
                      >
                        Retry
                      </button>
                    </div>
                  )}
                  {settingsStatus === "loaded" && profileSettings && (
                    <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {PROVIDERS.map((provider) => {
                      const keyId = `${profile.id}:${provider}`;
                      return (
                        <label key={provider} className="flex flex-col gap-1">
                          <span className="text-xs text-on-surface-variant uppercase tracking-wide">{provider} API key</span>
                          <div className="flex items-center gap-2">
                            <input
                              type={revealedKeys[keyId] ? "text" : "password"}
                              value={profileSettings.apiKeys[provider] ?? ""}
                              disabled={!settingsLoaded || settingsLoading}
                              onChange={(event) =>
                                setSettingsByProfile((prev) => ({
                                  ...prev,
                                  [profile.id]: {
                                    ...profileSettings,
                                    apiKeys: {
                                      ...profileSettings.apiKeys,
                                      [provider]: event.target.value,
                                    },
                                  },
                                }))
                              }
                              placeholder="sk-..."
                              className="w-full rounded-xl border border-border-default bg-surface-container-lowest px-3 py-2 text-sm text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                            />
                            <button
                              type="button"
                              disabled={!settingsLoaded || settingsLoading}
                              onClick={() => setRevealedKeys((prev) => ({ ...prev, [keyId]: !prev[keyId] }))}
                              className="px-2 py-2 rounded-lg border border-border-default text-xs text-on-surface-variant hover:bg-hover-subtle disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {revealedKeys[keyId] ? "Hide" : "Reveal"}
                            </button>
                          </div>
                        </label>
                      );
                    })}
                  </div>

                  <label className="flex flex-col gap-1">
                    <span className="text-xs text-on-surface-variant uppercase tracking-wide">Default model</span>
                    <select
                      value={profileSettings.defaultModel}
                      disabled={!settingsLoaded || settingsLoading}
                      onChange={(event) =>
                        setSettingsByProfile((prev) => ({
                          ...prev,
                          [profile.id]: { ...profileSettings, defaultModel: event.target.value },
                        }))
                      }
                      className="rounded-xl border border-border-default bg-surface-container-lowest px-3 py-2 text-sm text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    >
                      {models.map((model) => (
                        <option key={model} value={model}>{model}</option>
                      ))}
                    </select>
                  </label>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <fieldset className="rounded-xl border border-border-default p-3">
                      <legend className="text-xs text-on-surface-variant px-1">Enabled skills</legend>
                      <div className="max-h-40 overflow-auto flex flex-col gap-2 mt-1">
                        {skills.map((skill) => {
                          const checked = profileSettings.enabledSkillIds.includes(skill.id);
                          return (
                            <label key={skill.id} className="flex items-center gap-2 text-sm text-on-surface">
                              <input
                                type="checkbox"
                                checked={checked}
                                disabled={!settingsLoaded || settingsLoading}
                                onChange={(event) =>
                                  setSettingsByProfile((prev) => ({
                                    ...prev,
                                    [profile.id]: {
                                      ...profileSettings,
                                      enabledSkillIds: event.target.checked
                                        ? [...profileSettings.enabledSkillIds, skill.id]
                                        : profileSettings.enabledSkillIds.filter((id) => id !== skill.id),
                                    },
                                  }))
                                }
                              />
                              <span>{skill.name}</span>
                            </label>
                          );
                        })}
                      </div>
                    </fieldset>
                    <fieldset className="rounded-xl border border-border-default p-3">
                      <legend className="text-xs text-on-surface-variant px-1">Enabled MCP servers</legend>
                      <div className="max-h-40 overflow-auto flex flex-col gap-2 mt-1">
                        {mcpServers.map((server) => {
                          const checked = profileSettings.enabledMcpServerIds.includes(server.id);
                          return (
                            <label key={server.id} className="flex items-center gap-2 text-sm text-on-surface">
                              <input
                                type="checkbox"
                                checked={checked}
                                disabled={!settingsLoaded || settingsLoading}
                                onChange={(event) =>
                                  setSettingsByProfile((prev) => ({
                                    ...prev,
                                    [profile.id]: {
                                      ...profileSettings,
                                      enabledMcpServerIds: event.target.checked
                                        ? [...profileSettings.enabledMcpServerIds, server.id]
                                        : profileSettings.enabledMcpServerIds.filter((id) => id !== server.id),
                                    },
                                  }))
                                }
                              />
                              <span>{server.name}</span>
                            </label>
                          );
                        })}
                      </div>
                    </fieldset>
                  </div>

                  <button
                    type="button"
                    onClick={() => void saveSettings(profile.id)}
                    disabled={savingSettingsId === profile.id || !settingsLoaded || settingsLoading}
                    className="self-start px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    {savingSettingsId === profile.id ? "Saving…" : "Save settings (encrypted at rest)"}
                  </button>

                  <div className="rounded-xl border border-status-error/40 bg-status-error/10 p-3 flex flex-col gap-2">
                    <p className="text-sm font-semibold text-status-error">Danger zone</p>
                    <p className="text-xs text-status-error/90">
                      Type <strong>{profile.name}</strong> to confirm deletion.
                    </p>
                    <input
                      value={deleteConfirm}
                      onChange={(event) => setDeleteConfirm(event.target.value)}
                      className="rounded-xl border border-status-error/40 bg-white/80 px-3 py-2 text-sm text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-status-error"
                      placeholder={profile.name}
                    />
                    <button
                      type="button"
                      onClick={() => void handleDeleteProfile(profile)}
                      disabled={deleteConfirm !== profile.name || deletingId === profile.id}
                      className="self-start px-4 py-2 rounded-xl bg-status-error text-white text-sm font-medium hover:bg-status-error/90 disabled:opacity-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-status-error"
                    >
                      {deletingId === profile.id ? "Deleting…" : "Delete profile"}
                    </button>
                  </div>
                    </>
                  )}
                </div>
              )}
            </section>
          );
        })}
      </div>

      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-profile-dialog-title"
            ref={createDialogRef}
            tabIndex={-1}
            onKeyDown={(event) => {
              if (event.key === "Escape" && !creating) setCreateOpen(false);
            }}
            className="w-full max-w-md rounded-2xl border border-border-default bg-surface-container-low p-5 flex flex-col gap-4"
          >
            <h2 id="create-profile-dialog-title" className="text-lg font-semibold text-on-surface">Create profile</h2>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-on-surface-variant">Name</span>
              <input
                ref={createNameInputRef}
                value={createName}
                onChange={(event) => setCreateName(event.target.value)}
                className="rounded-xl border border-border-default bg-surface-container-lowest px-3 py-2 text-sm text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                placeholder="Engineering"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-on-surface-variant">Avatar color</span>
              <input
                type="color"
                value={createColor}
                onChange={(event) => setCreateColor(event.target.value)}
                className="h-10 w-20 rounded-lg border border-border-default bg-surface-container-lowest"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-on-surface-variant">Description (optional)</span>
              <textarea
                value={createDescription}
                onChange={(event) => setCreateDescription(event.target.value)}
                rows={3}
                className="rounded-xl border border-border-default bg-surface-container-lowest px-3 py-2 text-sm text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                placeholder="Profile for product experiments"
              />
            </label>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setCreateOpen(false)}
                disabled={creating}
                className="px-4 py-2 rounded-xl border border-border-default text-sm text-on-surface-variant hover:bg-hover-subtle"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleCreateProfile()}
                disabled={creating || createName.trim().length === 0}
                className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
              >
                {creating ? "Creating…" : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
