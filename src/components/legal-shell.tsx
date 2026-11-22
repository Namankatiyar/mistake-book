"use client";

import { type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ShieldCheck,
  FileText,
  ArrowLeft,
  Lock,
  EyeOff,
  FolderLock,
  HeartHandshake,
  BarChart3,
} from "lucide-react";

interface SectionLink {
  id: string;
  label: string;
}

interface LegalShellProps {
  title: string;
  subtitle: string;
  lastUpdated: string;
  sections?: SectionLink[];
  children: ReactNode;
}

export function LegalShell({
  title,
  subtitle,
  lastUpdated,
  sections = [],
  children,
}: LegalShellProps) {
  const pathname = usePathname();
  const isPrivacy = pathname.startsWith("/privacy");
  const isTerms = pathname.startsWith("/terms");

  return (
    <div className="mx-auto flex max-w-[1400px] gap-8 px-4 py-6 sm:px-6">
      {/* Left Navigation Sidebar */}
      <aside className="sticky top-16 hidden max-h-[calc(100vh-5rem)] w-64 shrink-0 self-start overflow-y-auto pr-3 lg:block">
        <Link
          href="/"
          className="side-row mb-4 inline-flex items-center gap-2 font-medium text-fg hover:text-fg"
        >
          <ArrowLeft className="h-4 w-4 shrink-0" />
          <span>Back to Question Book</span>
        </Link>

        <div className="space-y-1">
          <div className="px-1.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-muted">
            Legal & Compliance
          </div>
          <Link
            href="/privacy"
            className="side-row flex items-center gap-2"
            data-selected={isPrivacy ? true : undefined}
          >
            <ShieldCheck className="h-4 w-4 shrink-0" />
            <span className="flex-1">Privacy Policy</span>
          </Link>
          <Link
            href="/terms"
            className="side-row flex items-center gap-2"
            data-selected={isTerms ? true : undefined}
          >
            <FileText className="h-4 w-4 shrink-0" />
            <span className="flex-1">Terms of Service</span>
          </Link>
        </div>

        {/* On this page links */}
        {sections.length > 0 && (
          <div className="mt-6 border-t border-line/70 pt-4">
            <div className="px-1.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-muted">
              On this page
            </div>
            <nav className="mt-1 space-y-0.5">
              {sections.map((s) => (
                <a
                  key={s.id}
                  href={`#${s.id}`}
                  className="side-row block truncate text-[12px] text-muted hover:text-fg"
                >
                  {s.label}
                </a>
              ))}
            </nav>
          </div>
        )}

        {/* Core Commitments Box */}
        <div className="mt-6 rounded-[8px] border border-line bg-surface/60 p-3.5 text-[12px] leading-relaxed">
          <div className="font-semibold text-fg mb-2 flex items-center gap-1.5">
            <Lock className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
            <span>Our Privacy Commitments</span>
          </div>
          <ul className="space-y-2 text-muted">
            <li className="flex items-start gap-1.5">
              <FolderLock className="h-3.5 w-3.5 text-muted shrink-0 mt-0.5" />
              <span>
                <strong className="text-fg font-medium">Zero Personal File Access:</strong> We strictly access only our own MistakeBook backup folder.
              </span>
            </li>
            <li className="flex items-start gap-1.5">
              <HeartHandshake className="h-3.5 w-3.5 text-muted shrink-0 mt-0.5" />
              <span>
                <strong className="text-fg font-medium">Never Sell Data:</strong> We promise never to sell or monetize your data.
              </span>
            </li>
            <li className="flex items-start gap-1.5">
              <EyeOff className="h-3.5 w-3.5 text-muted shrink-0 mt-0.5" />
              <span>
                <strong className="text-fg font-medium">Anonymous Analytics:</strong> Vercel Analytics tracks aggregate metrics only; never personal files or questions.
              </span>
            </li>
          </ul>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="min-w-0 flex-1 pb-16">
        {/* Mobile top navigation banner */}
        <div className="mb-6 flex flex-col gap-3 border-b border-line pb-4 lg:hidden">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-[13px] font-medium text-muted hover:text-fg"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Back to Question Book</span>
          </Link>
          <div className="inline-flex rounded-[6px] border border-line p-1 bg-surface">
            <Link
              href="/privacy"
              className={`flex-1 rounded-[4px] py-1 px-3 text-center text-[13px] font-medium transition-colors ${
                isPrivacy
                  ? "bg-soft text-fg"
                  : "text-muted hover:text-fg"
              }`}
            >
              Privacy Policy
            </Link>
            <Link
              href="/terms"
              className={`flex-1 rounded-[4px] py-1 px-3 text-center text-[13px] font-medium transition-colors ${
                isTerms
                  ? "bg-soft text-fg"
                  : "text-muted hover:text-fg"
              }`}
            >
              Terms of Service
            </Link>
          </div>
        </div>

        {/* Page Header */}
        <div className="border-b border-line pb-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-line bg-surface/70 px-2.5 py-0.5 text-[11px] font-medium text-muted mb-3">
            <span>Last updated: {lastUpdated}</span>
          </div>
          <h1 className="text-[28px] font-bold tracking-tight text-fg sm:text-[32px]">
            {title}
          </h1>
          <p className="mt-2 text-[15px] leading-relaxed text-muted max-w-3xl">
            {subtitle}
          </p>
        </div>

        {/* Core Highlights Row */}
        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-[8px] border border-line bg-surface p-3.5">
            <div className="flex items-center gap-2 text-[13px] font-semibold text-fg">
              <FolderLock className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>Personal Files Protected</span>
            </div>
            <p className="mt-1.5 text-[12px] leading-relaxed text-muted">
              Google Drive permissions are limited exclusively to our app folder. We will never access or read any of your personal files.
            </p>
          </div>

          <div className="rounded-[8px] border border-line bg-surface p-3.5">
            <div className="flex items-center gap-2 text-[13px] font-semibold text-fg">
              <HeartHandshake className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0" />
              <span>No Sale of User Data</span>
            </div>
            <p className="mt-1.5 text-[12px] leading-relaxed text-muted">
              We promise never to sell, broker, or monetize your questions, notes, or personal data to advertisers or third parties.
            </p>
          </div>

          <div className="rounded-[8px] border border-line bg-surface p-3.5">
            <div className="flex items-center gap-2 text-[13px] font-semibold text-fg">
              <BarChart3 className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
              <span>Anonymous Analytics</span>
            </div>
            <p className="mt-1.5 text-[12px] leading-relaxed text-muted">
              We use Vercel Analytics for aggregate performance and stability metrics. Every user is tracked anonymously without PII.
            </p>
          </div>

          <div className="rounded-[8px] border border-line bg-surface p-3.5">
            <div className="flex items-center gap-2 text-[13px] font-semibold text-fg">
              <Lock className="h-4 w-4 text-purple-600 dark:text-purple-400 shrink-0" />
              <span>Local-First Architecture</span>
            </div>
            <p className="mt-1.5 text-[12px] leading-relaxed text-muted">
              All questions and images reside locally on your device in IndexedDB. Google Drive cloud sync is completely optional.
            </p>
          </div>
        </div>

        {/* Content Body */}
        <div className="mt-8 space-y-10 text-[14px] leading-relaxed text-fg/90">
          {children}
        </div>

        {/* Bottom Switcher */}
        <div className="mt-14 border-t border-line pt-6 flex flex-wrap items-center justify-between gap-4 text-[13px]">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 font-medium text-muted hover:text-fg transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Return to Question Book</span>
          </Link>
          <div className="flex items-center gap-4 text-muted">
            <Link
              href="/privacy"
              className={`hover:text-fg transition-colors ${isPrivacy ? "font-semibold text-fg underline underline-offset-4" : ""}`}
            >
              Privacy Policy
            </Link>
            <span>•</span>
            <Link
              href="/terms"
              className={`hover:text-fg transition-colors ${isTerms ? "font-semibold text-fg underline underline-offset-4" : ""}`}
            >
              Terms of Service
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
