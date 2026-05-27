"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useActiveProfile } from "@/store/hooks";
import { navItems } from "./navItems";

export const SidebarNav: React.FC = () => {
  const pathname = usePathname();
  const activeProfile = useActiveProfile();

  const activeProfileName = activeProfile?.name ?? "No profile";
  const activeProfileInitials = activeProfileName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <nav
      aria-label="App navigation"
      className="hidden md:flex fixed left-6 top-24 bottom-6 w-20 rounded-3xl border border-border-default bg-surface-container-lowest/95 shadow-[var(--shadow-sidebar)] flex-col items-center py-8 gap-8 z-40"
    >
      <div className="text-primary font-black font-outfit text-sm" aria-hidden="true">H AI</div>
      <div className="w-10 h-px bg-border-default" role="separator" />
      <div className="flex flex-col gap-6 flex-1">
        {navItems.map(({ href, icon, label }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              title={label}
              aria-label={label}
              aria-current={active ? "page" : undefined}
              className={[
                "p-3 rounded-2xl transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                active
                  ? "bg-surface-accent text-primary ring-1 ring-primary/30"
                  : "text-on-surface-variant hover:text-primary hover:bg-hover-subtle",
              ].join(" ")}
            >
              <span className="material-symbols-outlined" aria-hidden="true">{icon}</span>
            </Link>
          );
        })}
      </div>
      {/* Active profile chip */}
      <Link
        href="/profiles"
        title={activeProfileName}
        aria-label={`Active profile: ${activeProfileName}`}
        aria-current={pathname === "/profiles" ? "page" : undefined}
        className="flex flex-col items-center gap-1 p-2 rounded-2xl transition-all hover:bg-hover-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <span
          aria-hidden="true"
          className="h-8 w-8 rounded-full bg-primary text-on-primary-container text-xs font-semibold flex items-center justify-center"
        >
          {activeProfileInitials || "NA"}
        </span>
        <span className="text-[0.625rem] text-on-surface-variant truncate max-w-[3.5rem] text-center">
          {activeProfileName}
        </span>
      </Link>
    </nav>
  );
};
