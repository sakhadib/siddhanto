import type { Metadata, Viewport } from "next";
import Image from "next/image";
import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import "./globals.css";
import PrivacyToast from "@/components/PrivacyToast";

const plexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-plex-sans",
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-plex-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Siddhanto — calibrated decisions",
  description:
    "Describe a situation, ask typed questions, and read calibrated probabilities back from the JEV decision model.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f7f4ee",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${plexSans.variable} ${plexMono.variable}`}>
      <body className="min-h-[100dvh] antialiased">
        <div className="relative z-10 mx-auto flex min-h-[100dvh] w-full max-w-[1400px] flex-col px-5 sm:px-8">
          {/* Masthead — a drafting title block: rules above and below, no box. */}
          <header className="rise border-t-2 border-ink pt-4 [--i:0]" style={{ "--i": 0 } as React.CSSProperties}>
            <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2 pb-3">
              <a href="/" aria-label="Siddhanto home" className="press inline-block">
                <Image
                  src="/logo.png"
                  alt="Siddhanto"
                  width={168}
                  height={56}
                  priority
                  className="h-8 w-auto sm:h-9"
                />
              </a>
              <p className="font-mono text-[11px] leading-relaxed tracking-wide text-ink-faint uppercase">
                <span className="text-ink-soft">Engine</span> typesafe/jev-1.13
                <span className="mx-2 text-rule-strong" aria-hidden>
                  /
                </span>
                <span className="text-ink-soft">Calibrated</span> no / true / false
              </p>
            </div>
            <div className="border-b border-rule" />
          </header>

          <main className="flex-1 pb-16">{children}</main>

          <footer className="border-t border-rule py-6">
            <div className="flex flex-wrap items-center justify-between gap-3 font-mono text-[11px] tracking-wide text-ink-faint uppercase">
              <p>Siddhanto — structured decisions, calibrated probabilities.</p>
              <a href="/privacy" className="press text-ink-soft underline decoration-rule-strong underline-offset-4 hover:text-signal hover:decoration-signal">
                Privacy &amp; data policy
              </a>
            </div>
          </footer>
        </div>
        <PrivacyToast />
      </body>
    </html>
  );
}
