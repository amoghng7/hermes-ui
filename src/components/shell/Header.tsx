"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

export const Header: React.FC = () => {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const links = [
    { href: "/", label: "Interaction" },
    { href: "/history", label: "History" },
    { href: "/agents", label: "Agents" },
    { href: "/tuning", label: "Tuning" },
  ];

  const navLink = (href: string, label: string) => {
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
  };

  return (
    <header className="fixed top-0 w-full z-50 bg-surface-container-lowest/80 backdrop-blur-3xl border-b border-white/10 shadow-[0_4px_24px_0_rgba(0,0,0,0.3)] flex justify-between items-center px-8 py-4">
      <div className="flex items-center gap-4">
        <span className="text-2xl font-bold text-primary font-outfit tracking-tight">
          Hermes
        </span>
      </div>

      {/* Desktop nav */}
      <nav aria-label="Main navigation" className="hidden md:flex gap-8">
        {links.map(({ href, label }) => navLink(href, label))}
      </nav>

      {/* Right controls */}
      <div className="flex items-center gap-2">
        <button
          aria-label="Account"
          className="p-2 text-on-surface-variant hover:text-on-surface hover:bg-white/5 transition-all rounded-full active:scale-95 duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <span className="material-symbols-outlined" aria-hidden="true">account_circle</span>
        </button>
        <button
          aria-label="Settings"
          className="p-2 text-on-surface-variant hover:text-on-surface hover:bg-white/5 transition-all rounded-full active:scale-95 duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <span className="material-symbols-outlined" aria-hidden="true">settings</span>
        </button>
        {/* Mobile hamburger */}
        <button
          aria-label={mobileOpen ? "Close navigation" : "Open navigation"}
          aria-expanded={mobileOpen ? "true" : "false"}
          aria-controls="mobile-nav"
          className="md:hidden p-2 text-on-surface-variant hover:text-on-surface hover:bg-white/5 transition-all rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          onClick={() => setMobileOpen((v) => !v)}
        >
          <span className="material-symbols-outlined" aria-hidden="true">
            {mobileOpen ? "close" : "menu"}
          </span>
        </button>
      </div>

      {/* Mobile nav drawer */}
      {mobileOpen && (
        <nav
          id="mobile-nav"
          aria-label="Mobile navigation"
          className="md:hidden absolute top-full left-0 w-full bg-surface-container-lowest border-b border-white/10 flex flex-col px-6 py-4 gap-4"
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
                    : "text-on-surface-variant hover:text-on-surface hover:bg-white/5",
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
