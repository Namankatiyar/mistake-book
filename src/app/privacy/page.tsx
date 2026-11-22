import type { Metadata } from "next";
import Link from "next/link";
import { LegalShell } from "@/components/legal-shell";
import {
  ShieldCheck,
  FolderLock,
  HeartHandshake,
  BarChart3,
  HardDrive,
  KeyRound,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Privacy Policy · Mistake book",
  description:
    "Privacy Policy for Mistake Book. Learn how we protect your personal files, never sell your data, and use anonymous analytics and scoped Google Drive permissions.",
};

const SECTIONS = [
  { id: "intro", label: "1. Overview & Philosophy" },
  { id: "google-drive", label: "2. Google Drive Permissions" },
  { id: "personal-files", label: "3. Zero Personal File Access" },
  { id: "data-sale", label: "4. Promise Never to Sell Data" },
  { id: "analytics", label: "5. Vercel Analytics Tracking" },
  { id: "local-storage", label: "6. Local-First Data Storage" },
  { id: "user-control", label: "7. Your Rights & Data Deletion" },
  { id: "contact", label: "8. Contact & Updates" },
];

export default function PrivacyPage() {
  return (
    <LegalShell
      title="Privacy Policy"
      subtitle="At Mistake Book, we believe student study notes and mistake logs are strictly private. Here is a clear, transparent breakdown of how your data is handled."
      lastUpdated="November 22, 2026"
      sections={SECTIONS}
    >
      {/* 1. Overview */}
      <section id="intro" className="scroll-mt-20">
        <h2 className="text-[20px] font-semibold text-fg">
          1. Overview &amp; Local-First Philosophy
        </h2>
        <div className="mt-3 space-y-3 text-muted">
          <p>
            Mistake Book is built from the ground up on a <strong className="text-fg">local-first architecture</strong>.
            Unlike traditional cloud services where every keystroke and image upload is sent directly to a central server,
            Mistake Book keeps your question images, tags, answers, notes, and revision history directly in your device&apos;s
            own web browser (via IndexedDB and local storage).
          </p>
          <p>
            You can use the application entirely offline or without signing in. When you choose to connect optional
            cloud backup via Google Drive, you retain full ownership and control over your files.
          </p>
        </div>
      </section>

      {/* 2. Google Drive Permissions */}
      <section id="google-drive" className="scroll-mt-20">
        <h2 className="text-[20px] font-semibold text-fg flex items-center gap-2">
          <HardDrive className="h-5 w-5 text-fg shrink-0" />
          <span>2. Google Drive Read &amp; Write Permissions</span>
        </h2>
        <div className="mt-3 space-y-3 text-muted">
          <p>
            To provide optional cloud backup and cross-device synchronization, Mistake Book requests
            permission to interact with your Google Drive account.
          </p>
          <div className="rounded-[8px] border border-line bg-surface p-4">
            <h3 className="text-[14px] font-semibold text-fg flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              <span>Exact Scope Requested:</span>
            </h3>
            <code className="mt-2 block rounded bg-soft px-3 py-2 text-[12px] font-mono text-fg break-all">
              https://www.googleapis.com/auth/drive.file
            </code>
            <p className="mt-2 text-[13px] leading-relaxed text-muted">
              We purposefully utilize the restricted <strong className="text-fg font-medium">drive.file</strong> scope rather than
              full drive access. This scope grants the application read and write permissions <strong className="text-fg">only</strong> to
              files and folders created directly by Mistake Book (specifically within the application&apos;s dedicated <code>MistakeBook/</code> folder).
            </p>
          </div>
          <p>
            <strong>What we use read &amp; write permissions for:</strong>
          </p>
          <ul className="list-disc pl-5 space-y-1.5">
            <li>
              <strong className="text-fg">Write permissions:</strong> Uploading your cropped mistake question screenshots and
              updating your encrypted sync manifest (metadata including subject, chapter, mistake tags, and revision counts) into
              your private <code>MistakeBook</code> folder.
            </li>
            <li>
              <strong className="text-fg">Read permissions:</strong> Checking whether existing backup questions or changes exist
              so you can restore your library onto a new browser, device, or phone.
            </li>
          </ul>
        </div>
      </section>

      {/* 3. Zero Personal File Access */}
      <section id="personal-files" className="scroll-mt-20">
        <div className="rounded-[10px] border border-emerald-500/30 bg-emerald-500/5 p-5">
          <h2 className="text-[18px] font-bold text-fg flex items-center gap-2">
            <FolderLock className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>3. Zero Personal File Access Guarantee</span>
          </h2>
          <div className="mt-3 space-y-3 text-[14px] leading-relaxed text-fg/90">
            <p className="font-medium text-emerald-800 dark:text-emerald-300">
              We will never access any user&apos;s personal files under any circumstance.
            </p>
            <p className="text-muted">
              Because of Google&apos;s strict per-file security model (<code className="text-[12px] font-mono text-fg">drive.file</code>),
              Mistake Book has no technical ability, permission, or code to view, search, open, read, copy, or alter:
            </p>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[13px] text-muted pt-1">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>Personal Google Docs &amp; Sheets</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>Private Google Photos or videos</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>Existing Drive folders and files</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>Shared drives or corporate assets</span>
              </li>
            </ul>
            <p className="text-[13px] text-muted pt-2 border-t border-line/60">
              The application only sees files that it created itself in your Google Drive. Everything else in your Drive
              remains strictly invisible and inaccessible to us.
            </p>
          </div>
        </div>
      </section>

      {/* 4. Promise Never to Sell User Data */}
      <section id="data-sale" className="scroll-mt-20">
        <div className="rounded-[10px] border border-line bg-surface p-5">
          <h2 className="text-[18px] font-bold text-fg flex items-center gap-2">
            <HeartHandshake className="h-5 w-5 text-blue-600 dark:text-blue-400 shrink-0" />
            <span>4. We Promise Never to Sell Any User Data</span>
          </h2>
          <div className="mt-3 space-y-3 text-muted">
            <p className="text-[15px] font-medium text-fg">
              We promise never to sell any user data.
            </p>
            <p>
              We do not sell, rent, monetize, license, or exchange your personal information, question screenshots,
              revision patterns, study habits, notes, or email addresses with advertisers, data brokers, educational coaching
              institutes, or any third party whatsoever.
            </p>
            <p>
              Mistake Book is built as a pure educational utility for students preparing for competitive exams like
              JEE Mains and NEET. Your focus should be on cracking your exams, not worrying about surveillance capitalism or data brokers.
            </p>
          </div>
        </div>
      </section>

      {/* 5. Vercel Analytics Tracking */}
      <section id="analytics" className="scroll-mt-20">
        <h2 className="text-[20px] font-semibold text-fg flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-fg shrink-0" />
          <span>5. Vercel Analytics Tracking &amp; Anonymous Telemetry</span>
        </h2>
        <div className="mt-3 space-y-3 text-muted">
          <p>
            This app uses <strong className="text-fg">Vercel Analytics</strong> tracking to monitor application health,
            page performance (Core Web Vitals), and diagnose crashes or client errors.
          </p>
          <div className="rounded-[8px] border border-line bg-soft/50 p-4">
            <p className="font-semibold text-fg text-[14px]">
              Every user is anonymously tracked for analytics.
            </p>
            <p className="mt-1 text-[13px] text-muted">
              Vercel Analytics is privacy-friendly by design. It does not use invasive cross-site tracking cookies
              and does not collect personal identifiers.
            </p>
          </div>
          <p>
            <strong>What Vercel Analytics collects:</strong>
          </p>
          <ul className="list-disc pl-5 space-y-1.5">
            <li>Anonymized aggregate page views and navigation timing (e.g., page load speeds, response times).</li>
            <li>General technical indicators such as browser engine (e.g. Chrome, Safari), operating system, and screen size.</li>
            <li>Aggregated web vitals (Largest Contentful Paint, First Input Delay, Cumulative Layout Shift).</li>
          </ul>
          <p>
            <strong>What is NEVER sent to analytics:</strong>
          </p>
          <ul className="list-disc pl-5 space-y-1.5">
            <li>Your name, email address, or Google account details.</li>
            <li>The content of your questions, images, notes, or answers.</li>
            <li>Which specific subjects or chapters you study.</li>
            <li>Any personally identifiable information (PII).</li>
          </ul>
        </div>
      </section>

      {/* 6. Local Storage */}
      <section id="local-storage" className="scroll-mt-20">
        <h2 className="text-[20px] font-semibold text-fg">
          6. Local-First Data Storage &amp; Cookies
        </h2>
        <div className="mt-3 space-y-3 text-muted">
          <p>
            Mistake Book stores the majority of its functional state on your local device:
          </p>
          <ul className="list-disc pl-5 space-y-1.5">
            <li>
              <strong className="text-fg">IndexedDB:</strong> Stores high-resolution question snapshots, subject tags, chapter assignments,
              answers, and study notes directly inside your browser cache.
            </li>
            <li>
              <strong className="text-fg">Local &amp; Session Storage:</strong> Stores your active UI preferences (e.g., light/dark theme preference,
              active exam mode JEE vs NEET, and sort filters).
            </li>
            <li>
              <strong className="text-fg">HttpOnly Cookies:</strong> A temporary, secure session token is used strictly to maintain
              your authenticated Google Drive backup connection with the server. It is never used for advertising or marketing tracking.
            </li>
          </ul>
        </div>
      </section>

      {/* 7. User Control & Deletion */}
      <section id="user-control" className="scroll-mt-20">
        <h2 className="text-[20px] font-semibold text-fg">
          7. Your Rights, Data Portability &amp; Deletion
        </h2>
        <div className="mt-3 space-y-3 text-muted">
          <p>
            You hold total authority over your data at all times:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div className="rounded-[8px] border border-line bg-surface p-3.5">
              <h3 className="font-semibold text-fg text-[13px]">Disconnect Cloud Sync Anytime</h3>
              <p className="mt-1 text-[12px] text-muted">
                You can disconnect Google Drive in one click from the Settings modal (<code className="text-fg">⚙ Settings &rarr; Cloud Backup &rarr; Disconnect</code>).
              </p>
            </div>
            <div className="rounded-[8px] border border-line bg-surface p-3.5">
              <h3 className="font-semibold text-fg text-[13px]">Revoke Google OAuth Access</h3>
              <p className="mt-1 text-[12px] text-muted">
                You can revoke access to Mistake Book at any time directly through your{" "}
                <a
                  href="https://myaccount.google.com/permissions"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-fg underline hover:text-muted"
                >
                  Google Account Security Settings
                </a>.
              </p>
            </div>
            <div className="rounded-[8px] border border-line bg-surface p-3.5">
              <h3 className="font-semibold text-fg text-[13px]">Delete Drive Backups</h3>
              <p className="mt-1 text-[12px] text-muted">
                Because backup files live in your own Google Drive, you can delete the <code>MistakeBook</code> folder directly from your Drive trash at any time.
              </p>
            </div>
            <div className="rounded-[8px] border border-line bg-surface p-3.5">
              <h3 className="font-semibold text-fg text-[13px]">Clear Local Browser Data</h3>
              <p className="mt-1 text-[12px] text-muted">
                Clearing your browser cache and site data for Mistake Book completely erases all local question images and database tables from your machine.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 8. Contact & Updates */}
      <section id="contact" className="scroll-mt-20">
        <h2 className="text-[20px] font-semibold text-fg">
          8. Contact &amp; Updates to this Policy
        </h2>
        <div className="mt-3 space-y-3 text-muted">
          <p>
            We may update this Privacy Policy from time to time to reflect operational or legal changes. When changes are made,
            the &ldquo;Last updated&rdquo; timestamp at the top of this document will be updated.
          </p>
          <p>
            If you have questions regarding this policy or our privacy practices, you can view the source or consult our{" "}
            <Link href="/terms" className="text-fg underline hover:text-muted">
              Terms of Service
            </Link>.
          </p>
        </div>
      </section>
    </LegalShell>
  );
}
