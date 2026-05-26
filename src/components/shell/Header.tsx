"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useHermesStore } from "@/store/hermesStore";
import { useActiveProfile, useProfiles } from "@/store/hooks";

const links = [
  { href: "/", label: "Interaction" },
  { href: "/agents", label: "Agents" },
  { href: "/skills", label: "Skills" },
  { href: "/tuning", label: "Tuning" },
  { href: "/memory", label: "Memory" },
  { href: "/profiles", label: "Profiles" },
] as const;

export const Header: React.FC = () => {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [switchingProfileId, setSwitchingProfileId] = useState<string | null>(null);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const profileMenuButtonRef = useRef<HTMLButtonElement>(null);
  const profileMenuListRef = useRef<HTMLDivElement>(null);
  const profiles = useProfiles();
  const activeProfile = useActiveProfile();
  const setActiveProfile = useHermesStore((s) => s.setActiveProfile);

  useEffect(() => {
    if (!profileMenuOpen) return;
    const onDocMouseDown = (event: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setProfileMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, [profileMenuOpen]);

  const activeProfileName = activeProfile?.name ?? "No profile";
  const activeProfileInitials = activeProfileName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

  const handleProfileSwitch = async (profileId: string): Promise<void> => {
    if (switchingProfileId === profileId) return;
    setSwitchingProfileId(profileId);
    try {
      await setActiveProfile(profileId);
      setProfileMenuOpen(false);
    } finally {
      setSwitchingProfileId(null);
    }
  };

  const getProfileMenuItems = (): HTMLElement[] => {
    if (!profileMenuListRef.current) return [];
    return Array.from(
      profileMenuListRef.current.querySelectorAll<HTMLElement>('[data-profile-menu-item="true"]')
    );
  };

  const focusProfileMenuItem = (index: number): void => {
    const items = getProfileMenuItems();
    if (!items.length) return;
    const normalized = ((index % items.length) + items.length) % items.length;
    items[normalized]?.focus();
  };

  return (
    <header className="fixed top-0 w-full z-50 bg-surface-container-lowest/95 border-b border-border-default shadow-[var(--shadow-header)] flex justify-between items-center px-8 py-4">
      <div className="flex items-center gap-4">
        <span className="text-2xl font-bold text-primary font-outfit tracking-tight">
          Hermes
        </span>
      </div>

      {/* Desktop nav */}
      <nav aria-label="Main navigation" className="hidden md:flex gap-8">
        {links.map(({ href, label }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={[
                "font-outfit tracking-tight transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-sm",
                active
                  ? "text-primary border-b-2 border-primary pb-1"
                  : "text-on-surface-variant hover:text-on-surface",
              ].join(" ")}
            >
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Right controls */}
      <div className="flex items-center gap-2">
        <div ref={profileMenuRef} className="relative">
          <button
            ref={profileMenuButtonRef}
            type="button"
            aria-label="Profile menu"
            aria-haspopup="menu"
            aria-controls="profile-menu"
            aria-expanded={profileMenuOpen}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown") {
                event.preventDefault();
                setProfileMenuOpen(true);
                requestAnimationFrame(() => focusProfileMenuItem(0));
              } else if (event.key === "ArrowUp") {
                event.preventDefault();
                setProfileMenuOpen(true);
                requestAnimationFrame(() => focusProfileMenuItem(-1));
              } else if ((event.key === "Enter" || event.key === " ") && !profileMenuOpen) {
                event.preventDefault();
                setProfileMenuOpen(true);
                requestAnimationFrame(() => focusProfileMenuItem(0));
              } else if (event.key === "Escape" && profileMenuOpen) {
                event.preventDefault();
                setProfileMenuOpen(false);
              }
            }}
            onClick={() => setProfileMenuOpen((open) => !open)}
            className="flex items-center gap-2 pl-1.5 pr-3 py-1.5 rounded-full border border-border-default text-on-surface-variant hover:text-on-surface hover:bg-hover-subtle transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <span
              aria-hidden="true"
              className="h-7 w-7 rounded-full bg-primary text-white text-[0.6875rem] font-semibold flex items-center justify-center"
            >
              {activeProfileInitials || "NA"}
            </span>
            <span className="max-w-[8rem] truncate text-sm">{activeProfileName}</span>
            <span className="material-symbols-outlined text-[1.125rem]" aria-hidden="true">expand_more</span>
          </button>
          {profileMenuOpen && (
            <div
              ref={profileMenuListRef}
              id="profile-menu"
              role="menu"
              aria-label="Select profile"
              className="absolute right-0 top-[calc(100%+0.5rem)] z-50 min-w-[15rem] rounded-2xl border border-border-default bg-surface-container-low shadow-xl p-2"
              onKeyDown={(event) => {
                const items = getProfileMenuItems();
                if (!items.length) return;
                const currentIndex = items.findIndex((item) => item === document.activeElement);
                if (event.key === "Escape") {
                  event.preventDefault();
                  setProfileMenuOpen(false);
                  profileMenuButtonRef.current?.focus();
                } else if (event.key === "ArrowDown") {
                  event.preventDefault();
                  focusProfileMenuItem(currentIndex + 1);
                } else if (event.key === "ArrowUp") {
                  event.preventDefault();
                  focusProfileMenuItem(currentIndex - 1);
                } else if (event.key === "Home") {
                  event.preventDefault();
                  focusProfileMenuItem(0);
                } else if (event.key === "End") {
                  event.preventDefault();
                  focusProfileMenuItem(items.length - 1);
                }
              }}
            >
              <div className="max-h-64 overflow-auto flex flex-col gap-1">
                {profiles.map((profile) => {
                  const active = profile.id === activeProfile?.id;
                  return (
                    <button
                      key={profile.id}
                      type="button"
                      role="menuitemradio"
                      aria-checked={active}
                      data-profile-menu-item="true"
                      onClick={() => void handleProfileSwitch(profile.id)}
                      disabled={switchingProfileId === profile.id}
                      className={[
                        "w-full flex items-center justify-between px-3 py-2 rounded-xl text-sm transition-colors",
                        active ? "bg-primary/10 text-primary" : "text-on-surface hover:bg-hover-subtle",
                        switchingProfileId === profile.id ? "opacity-60 cursor-not-allowed" : "",
                      ].join(" ")}
                    >
                      <span className="truncate">{profile.name}</span>
                      {active && <span className="material-symbols-outlined text-[1rem]" aria-hidden="true">check</span>}
                    </button>
                  );
                })}
              </div>
              <div className="mt-2 pt-2 border-t border-border-default">
                <Link
                  href="/profiles"
                  role="menuitem"
                  data-profile-menu-item="true"
                  onClick={() => setProfileMenuOpen(false)}
                  className="block px-3 py-2 rounded-xl text-sm text-on-surface-variant hover:text-on-surface hover:bg-hover-subtle"
                >
                  Manage profiles
                </Link>
              </div>
            </div>
          )}
        </div>
        <button
          aria-label="Settings"
          className="p-2 text-on-surface-variant hover:text-on-surface hover:bg-hover-subtle transition-all rounded-full active:scale-95 duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <span className="material-symbols-outlined" aria-hidden="true">settings</span>
        </button>
        {/* Mobile hamburger */}
        {mobileOpen ? (
          <button
            aria-label="Close navigation"
            aria-expanded="true"
            aria-controls="mobile-nav"
            className="md:hidden p-2 text-on-surface-variant hover:text-on-surface hover:bg-hover-subtle transition-all rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            onClick={() => setMobileOpen(false)}
          >
            <span className="material-symbols-outlined" aria-hidden="true">close</span>
          </button>
        ) : (
          <button
            aria-label="Open navigation"
            aria-expanded="false"
            aria-controls="mobile-nav"
            className="md:hidden p-2 text-on-surface-variant hover:text-on-surface hover:bg-hover-subtle transition-all rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            onClick={() => setMobileOpen(true)}
          >
            <span className="material-symbols-outlined" aria-hidden="true">menu</span>
          </button>
        )}
      </div>

      {/* Mobile nav drawer */}
      {mobileOpen && (
        <nav
          id="mobile-nav"
          aria-label="Mobile navigation"
          className="md:hidden absolute top-full left-0 w-full bg-surface-container-lowest border-b border-border-default flex flex-col px-6 py-4 gap-4"
        >
          {links.map(({ href, label }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={[
                  "font-outfit tracking-tight py-3 px-4 rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                  active
                    ? "bg-primary/10 text-primary"
                    : "text-on-surface-variant hover:text-on-surface hover:bg-hover-subtle",
                ].join(" ")}
                onClick={() => setMobileOpen(false)}
              >
                {label}
              </Link>
            );
          })}
        </nav>
      )}
    </header>
  );
};
