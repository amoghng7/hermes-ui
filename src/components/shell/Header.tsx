"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export const Header: React.FC = () => {
  const pathname = usePathname();

  const navLink = (href: string, label: string) => {
    const active = pathname === href;
    if (active) {
      return (
        <Link
          href={href}
          className="text-violet-400 border-b-2 border-violet-500 pb-1 font-outfit tracking-tight"
        >
          {label}
        </Link>
      );
    }
    return (
      <Link
        href={href}
        className="text-neutral-400 hover:text-neutral-200 transition-colors font-outfit tracking-tight"
      >
        {label}
      </Link>
    );
  };

  return (
    <header className="fixed top-0 w-full z-50 bg-neutral-950/40 backdrop-blur-3xl border-b border-white/10 shadow-[0_8px_32px_0_rgba(157,78,221,0.1)] flex justify-between items-center px-8 py-4">
      <div className="flex items-center gap-4">
        <span className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-violet-400 to-violet-600 font-outfit tracking-tight">
          Hermes
        </span>
      </div>
      <nav className="hidden md:flex gap-8">
        {navLink("/", "Interaction")}
        {navLink("/history", "History")}
        {navLink("/agents", "Agents")}
        {navLink("/tuning", "Tuning")}
      </nav>
      <div className="flex items-center gap-4">
        <button className="p-2 text-neutral-400 hover:bg-white/5 transition-all rounded-full active:scale-95 duration-200">
          <span className="material-symbols-outlined">account_circle</span>
        </button>
        <button className="p-2 text-neutral-400 hover:bg-white/5 transition-all rounded-full active:scale-95 duration-200">
          <span className="material-symbols-outlined">settings</span>
        </button>
      </div>
    </header>
  );
};
