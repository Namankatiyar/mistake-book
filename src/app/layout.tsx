import type { Metadata } from "next";
import type { ReactNode } from "react";
import Script from "next/script";
import { Analytics } from "@vercel/analytics/react";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "./globals.css";
import { CaptureProvider } from "@/components/capture";
import { Header } from "@/components/header";
import { Toaster } from "@/components/toaster";
import { LibraryProvider } from "@/lib/library";
import { SettingsProvider, THEME_SCRIPT } from "@/lib/settings";
import { SyncProvider } from "@/lib/sync-context";
import { ToastProvider } from "@/lib/toast";

export const metadata: Metadata = {
  title: "Mistake book · JEE Mains",
  description:
    "A local mistake notebook for JEE Mains prep. Paste questions you got wrong, label them, and revise them fast.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <Script id="theme-script" strategy="beforeInteractive">
          {THEME_SCRIPT}
        </Script>
      </head>
      <body>
        <SettingsProvider>
          <ToastProvider>
            <LibraryProvider>
              <SyncProvider>
                <CaptureProvider>
                  <Header />
                  {children}
                </CaptureProvider>
              </SyncProvider>
            </LibraryProvider>
          </ToastProvider>
          <Toaster />
        </SettingsProvider>
        <Analytics />
      </body>
    </html>
  );
}
