"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/", icon: "terminal", label: "Interaction" },
  { href: "/agents", icon: "hub", label: "Agents" },
  { href: "/tuning", icon: "tune", label: "Tuning" },
];

export const SidebarNav: React.FC = () => {
  const pathname = usePathname();

  return (
    <nav
      aria-label="App navigation"
      className="hidden md:flex fixed left-6 top-24 bottom-6 w-20 rounded-3xl border border-border-default bg-surface-container-lowest/95 shadow-[var(--shadow-sidebar)] flex-col items-center py-8 gap-8 z-40"
    >
      <div className="text-primary font-black font-outfit text-sm" aria-hidden="true">H AI</div>
      <div className="w-10 h-px bg-border-default" role="separator" />
      <div className="flex flex-col gap-6">
        {navItems.map(({ href, icon, label }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              aria-label={label}
              aria-current={active ? "page" : undefined}
              className={[
                "p-3 rounded-2xl transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                active
                  ? "bg-primary/10 text-primary ring-1 ring-primary/50"
                  : "text-on-surface-variant hover:text-primary hover:bg-hover-subtle",
              ].join(" ")}
            >
              <span className="material-symbols-outlined" aria-hidden="true">{icon}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
};
