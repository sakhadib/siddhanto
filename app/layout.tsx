import type { Metadata, Viewport } from "next";
import "./globals.css";
import PrivacyToast from "@/components/PrivacyToast";

export const metadata: Metadata = {
  title: "Siddhanto",
  description: "Ask structured questions about a situation and get calibrated decisions.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-zinc-50 text-zinc-900 antialiased">
        <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4">
          <header className="border-b border-zinc-200 py-5">
            <a href="/" aria-label="Siddhanto home">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo.png" alt="Siddhanto" className="h-9 w-auto" />
            </a>
            <p className="mt-1 text-sm text-zinc-500">Structured decisions, calibrated probabilities.</p>
          </header>
          <main className="flex-1 py-6">{children}</main>
          <footer className="border-t border-zinc-200 py-4 text-center text-xs text-zinc-500">
            <a href="/privacy" className="hover:text-red-600">
              Privacy &amp; Data policy
            </a>
          </footer>
        </div>
        <PrivacyToast />
      </body>
    </html>
  );
}
