"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const links = [
  { href: "/", label: "Interaction" },
  { href: "/agents", label: "Agents" },
  { href: "/tuning", label: "Tuning" },
] as const;

export const Header: React.FC = () => {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

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
        <button
          aria-label="Account"
          className="p-2 text-on-surface-variant hover:text-on-surface hover:bg-hover-subtle transition-all rounded-full active:scale-95 duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <span className="material-symbols-outlined" aria-hidden="true">account_circle</span>
        </button>
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
