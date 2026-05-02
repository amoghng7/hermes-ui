"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/", icon: "terminal", label: "Interaction" },
  { href: "/history", icon: "history", label: "History" },
  { href: "/agents", icon: "hub", label: "Agents" },
  { href: "/tuning", icon: "tune", label: "Tuning" },
];

export const SidebarNav: React.FC = () => {
  const pathname = usePathname();

  return (
    <nav
      aria-label="App navigation"
      className="hidden md:flex fixed left-6 top-24 bottom-6 w-20 rounded-3xl border border-white/10 bg-surface-container-lowest/60 backdrop-blur-2xl shadow-[20px_0_40px_rgba(0,0,0,0.4)] flex-col items-center py-8 gap-8 z-40"
    >
      <div className="text-primary font-black font-outfit text-sm" aria-hidden="true">H AI</div>
      <div className="w-10 h-px bg-white/10" role="separator" />
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
                  : "text-on-surface-variant hover:text-primary hover:bg-white/5",
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
