"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export const SidebarNav: React.FC = () => {
  const pathname = usePathname();

  const iconLink = (href: string, icon: string) => {
    const active = pathname === href;
    if (active) {
      return (
        <Link
          href={href}
          className="p-3 bg-violet-600/20 text-violet-400 rounded-2xl ring-1 ring-violet-500/50 active:scale-110 duration-300"
        >
          <span className="material-symbols-outlined">{icon}</span>
        </Link>
      );
    }
    return (
      <Link
        href={href}
        className="p-3 text-neutral-500 hover:text-violet-300 hover:bg-white/5 transition-all rounded-2xl"
      >
        <span className="material-symbols-outlined">{icon}</span>
      </Link>
    );
  };

  return (
    <nav className="fixed left-6 top-24 bottom-6 w-20 rounded-3xl border border-white/10 bg-neutral-950/60 backdrop-blur-2xl shadow-[20px_0_40px_rgba(0,0,0,0.4)] flex flex-col items-center py-8 gap-8 z-40">
      <div className="text-violet-500 font-black font-outfit text-sm">H AI</div>
      <div className="w-10 h-px bg-white/10" />
      <div className="flex flex-col gap-6">
        {iconLink("/", "terminal")}
        {iconLink("/history", "history")}
        {iconLink("/agents", "hub")}
        {iconLink("/tuning", "tune")}
      </div>
    </nav>
  );
};
