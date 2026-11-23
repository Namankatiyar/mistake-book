import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import Script from "next/script";
import { Analytics } from "@vercel/analytics/next";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "./globals.css";
import { CaptureProvider } from "@/components/capture";
import { DriveInviteModal } from "@/components/drive-invite-modal";
import { Header } from "@/components/header";
import { PwaRegister } from "@/components/pwa-register";
import { Toaster } from "@/components/toaster";
import { LibraryProvider } from "@/lib/library";
import { SettingsProvider, THEME_SCRIPT } from "@/lib/settings";
import { SyncProvider } from "@/lib/sync-context";
import { ToastProvider } from "@/lib/toast";

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fafafa" },
    { media: "(prefers-color-scheme: dark)", color: "#141414" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export const metadata: Metadata = {
  title: "Mistake book · JEE Mains & NEET",
  description:
    "A local mistake notebook for JEE Mains and NEET prep. Paste questions you got wrong, label them, and revise them fast.",
  manifest: "/manifest.webmanifest",
  applicationName: "Mistake Book",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Mistake Book",
  },
  formatDetection: {
    telephone: false,
  },
  openGraph: {
    title: "Mistake book · JEE Mains & NEET",
    description:
      "A local mistake notebook for JEE Mains and NEET prep. Paste questions you got wrong, label them, and revise them fast.",
    type: "website",
  },
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { url: "/mistake-book.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
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
        <PwaRegister />
        <SettingsProvider>
          <ToastProvider>
            <LibraryProvider>
              <SyncProvider>
                <CaptureProvider>
                  <Header />
                  {children}
                  <DriveInviteModal />
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
