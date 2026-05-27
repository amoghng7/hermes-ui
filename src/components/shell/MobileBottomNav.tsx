"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { navItems } from "./navItems";

export const MobileBottomNav: React.FC = () => {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Mobile navigation"
      className="md:hidden fixed bottom-0 left-0 right-0 z-50 mobile-bottom-nav flex justify-around items-center px-2 py-3 safe-area-bottom"
    >
      {navItems.map(({ href, icon, label }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            aria-label={label}
            aria-current={active ? "page" : undefined}
            className={[
              "flex flex-col items-center gap-1 px-2 py-2 rounded-xl min-w-[44px] min-h-[48px] justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
              active
                ? "text-primary"
                : "text-on-surface-variant hover:text-on-surface",
            ].join(" ")}
          >
            <span className="material-symbols-outlined text-[24px]" aria-hidden="true">
              {icon}
            </span>
            {active && (
              <span className="text-[0.625rem] font-medium tracking-wide uppercase">
                {label}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
};
