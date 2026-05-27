import type { Metadata } from "next";
import "./globals.css";
import { Header } from "@/components/shell/Header";
import { SidebarNav } from "@/components/shell/SidebarNav";
import { MobileBottomNav } from "@/components/shell/MobileBottomNav";
import { HermesProvider } from "@/components/providers/HermesProvider";
import { Outfit, Epilogue, JetBrains_Mono, Inter } from "next/font/google";

const outfit = Outfit({
  subsets: ["latin"],
  weight: ["400", "700", "900"],
  variable: "--nf-outfit",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  variable: "--nf-inter",
  display: "swap",
});

const epilogue = Epilogue({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--nf-epilogue",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--nf-jetbrains-mono",
  display: "swap",
});

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
    <html
      lang="en"
      className={[
        "dark",
        outfit.variable,
        inter.variable,
        epilogue.variable,
        jetbrainsMono.variable,
      ].join(" ")}
    >
      <head>
        {/* Material Symbols — kept on CDN; next/font doesn't support variable icon fonts */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@400,0&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-background text-on-surface font-body">
        <HermesProvider>
          <div className="min-h-screen bg-background text-on-surface md:overflow-hidden flex flex-col">
            <Header />
            <SidebarNav />
            <main className="pt-24 pb-24 md:pb-6 px-4 md:px-6 flex-1 flex">{children}</main>
            <MobileBottomNav />
          </div>
        </HermesProvider>
      </body>
    </html>
  );
}
