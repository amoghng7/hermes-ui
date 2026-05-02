import type { Metadata } from "next";
import "./globals.css";
import { Header } from "@/components/shell/Header";
import { SidebarNav } from "@/components/shell/SidebarNav";

export const metadata: Metadata = {
  title: "Hermes AI Prototype",
  description: "Kimi-style UI shell for Hermes Agent — multi-agent swarm visualization",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <head>
        {/* Fonts */}
        <link
          href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&family=Epilogue:wght@400;600;700&family=Be+Vietnam+Pro:wght@300;400;500;600&family=JetBrains+Mono:wght@400&display=swap"
          rel="stylesheet"
        />
        {/* Material Symbols */}
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-background text-on-surface font-body overflow-hidden">
        <div className="min-h-screen bg-background text-on-surface overflow-hidden flex flex-col">
          <Header />
          <SidebarNav />
          <main className="pt-24 pb-6 px-6 flex-1 flex">{children}</main>
        </div>
      </body>
    </html>
  );
}
