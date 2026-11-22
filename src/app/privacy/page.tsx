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
  Lock,
  Mail,
  Trash2,
  ExternalLink,
  Database,
  FileCheck2,
  UserCheck,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Privacy Policy · Mistake book",
  description:
    "Privacy Policy for Mistake Book (mistake.ojeet.tech). Learn how we handle Google OAuth user data, Google Drive permissions, local-first storage, analytics, and data deletion in strict compliance with the Google API Services User Data Policy.",
};

const SECTIONS = [
  { id: "intro", label: "1. Overview & Application Identity" },
  { id: "data-collection", label: "2. Data We Collect" },
  { id: "google-scopes", label: "3. Google API Data & Scopes" },
  { id: "limited-use", label: "4. Google Limited Use Disclosure" },
  { id: "data-usage", label: "5. How We Use Information" },
  { id: "personal-files", label: "6. Zero Personal File Access" },
  { id: "data-sale", label: "7. Promise Never to Sell Data" },
  { id: "analytics", label: "8. Analytics & Anonymous Telemetry" },
  { id: "storage-security", label: "9. Data Storage & Security" },
  { id: "retention-deletion", label: "10. Retention & Data Deletion" },
  { id: "user-rights", label: "11. Your Privacy Rights (GDPR/CCPA)" },
  { id: "children", label: "12. Children's Privacy" },
  { id: "contact", label: "13. Contact & Privacy Inquiries" },
];

export default function PrivacyPage() {
  return (
    <LegalShell
      title="Privacy Policy"
      subtitle="Comprehensive Privacy Policy for Mistake Book (mistake.ojeet.tech). Transparent disclosures on student data protection, Google OAuth integration, Google Drive permissions, and adherence to the Google API Services User Data Policy."
      lastUpdated="November 22, 2026"
      sections={SECTIONS}
    >
      {/* 1. Overview & Application Identity */}
      <section id="intro" className="scroll-mt-20">
        <h2 className="text-[20px] font-semibold text-fg flex items-center gap-2">
          <FileCheck2 className="h-5 w-5 text-fg shrink-0" />
          <span>1. Overview &amp; Application Identity</span>
        </h2>
        <div className="mt-3 space-y-3 text-muted">
          <p>
            Welcome to <strong className="text-fg">Mistake Book</strong> (&ldquo;we&rdquo;, &ldquo;us&rdquo;, or &ldquo;our&rdquo;),
            accessible via <strong className="text-fg">https://mistake.ojeet.tech</strong> (the &ldquo;Application&rdquo; or &ldquo;Service&rdquo;).
            Mistake Book is an educational study management tool engineered to help students preparing for competitive examinations
            (such as JEE Mains, JEE Advanced, NEET, and related STEM tests) catalog, tag, review, and master examination questions they previously answered incorrectly.
          </p>
          <p>
            Mistake Book is built upon a <strong className="text-fg">local-first privacy architecture</strong>. By default, your question screenshots,
            notes, tags, syllabus progress, and mistake logs remain entirely on your local device (stored securely in your web browser&apos;s IndexedDB and local storage).
            The Application is fully functional offline and does not require account creation to be used.
          </p>
          <p>
            To enable optional cross-device synchronization and offsite backup, the Application allows users to connect their personal Google Drive account.
            This Privacy Policy clearly details what information is collected, how Google user data is accessed, processed, and safeguarded, and how you retain total ownership and control over your data.
          </p>
        </div>
      </section>

      {/* 2. Data We Collect */}
      <section id="data-collection" className="scroll-mt-20">
        <h2 className="text-[20px] font-semibold text-fg flex items-center gap-2">
          <Database className="h-5 w-5 text-fg shrink-0" />
          <span>2. Information We Collect</span>
        </h2>
        <div className="mt-3 space-y-3 text-muted">
          <p>
            We collect only the minimum amount of data required to provide and improve the Application&apos;s educational features:
          </p>

          <div className="space-y-3 pt-1">
            <div className="rounded-[8px] border border-line bg-surface p-4">
              <h3 className="text-[14px] font-semibold text-fg">
                A. Information You Provide Directly
              </h3>
              <ul className="mt-2 list-disc pl-5 space-y-1.5 text-[13px] text-muted">
                <li>
                  <strong className="text-fg">Question Screenshots &amp; Media:</strong> Images or diagrams of exam questions pasted or uploaded into the Application.
                </li>
                <li>
                  <strong className="text-fg">Study &amp; Tag Metadata:</strong> Academic subject assignments (Physics, Chemistry, Mathematics), chapter classifications, mistake taxonomy labels (e.g., conceptual error, calculation mistake, question misread), study notes, correct answer keys, and test source names (e.g., specific test series or mock exams).
                </li>
                <li>
                  <strong className="text-fg">Revision Metrics:</strong> Timestamps of revision attempts, repetition intervals, and question mastery states.
                </li>
              </ul>
            </div>

            <div className="rounded-[8px] border border-line bg-surface p-4">
              <h3 className="text-[14px] font-semibold text-fg">
                B. Information Received from Google APIs (When Connecting Cloud Backup)
              </h3>
              <ul className="mt-2 list-disc pl-5 space-y-1.5 text-[13px] text-muted">
                <li>
                  <strong className="text-fg">User Profile &amp; Identity:</strong> Your Google email address, full name, and avatar picture URL.
                </li>
                <li>
                  <strong className="text-fg">Application Storage:</strong> Only the files, folders, and synchronization manifests created directly by Mistake Book in your personal Google Drive.
                </li>
              </ul>
            </div>

            <div className="rounded-[8px] border border-line bg-surface p-4">
              <h3 className="text-[14px] font-semibold text-fg">
                C. Information Collected Automatically
              </h3>
              <p className="mt-1 text-[13px] text-muted">
                We use <strong className="text-fg">Vercel Analytics</strong> to collect aggregate, privacy-respecting telemetry regarding application performance and Core Web Vitals (such as page response speed, crash diagnostics, browser engine, operating system family, and approximate screen resolution). No cross-site advertising cookies or personally identifiable information (PII) are ever collected.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Google API Data & Scopes */}
      <section id="google-scopes" className="scroll-mt-20">
        <h2 className="text-[20px] font-semibold text-fg flex items-center gap-2">
          <HardDrive className="h-5 w-5 text-fg shrink-0" />
          <span>3. Google API Data Access &amp; OAuth Scopes</span>
        </h2>
        <div className="mt-3 space-y-3 text-muted">
          <p>
            When you choose to connect optional cloud backup via Google Drive, Mistake Book requests access through Google OAuth 2.0.
            Below is the full, transparent breakdown of every Google OAuth scope requested, why it is needed, and how the data is handled:
          </p>

          <div className="space-y-4 pt-1">
            {/* Scope 1: drive.file */}
            <div className="rounded-[8px] border border-line bg-surface p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-semibold text-fg text-[14px] flex items-center gap-2">
                  <KeyRound className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  <span>Google Drive App-Specific Storage</span>
                </span>
                <span className="rounded bg-soft px-2 py-0.5 text-[11px] font-mono text-fg">
                  Per-File Access
                </span>
              </div>
              <code className="mt-2 block rounded bg-soft px-3 py-2 text-[12px] font-mono text-fg break-all">
                https://www.googleapis.com/auth/drive.file
              </code>
              <div className="mt-3 space-y-2 text-[13px] text-muted">
                <p>
                  <strong className="text-fg">Data Accessed:</strong> Read, write, create, and delete permissions strictly limited to files and folders created directly by Mistake Book.
                </p>
                <p>
                  <strong className="text-fg">Purpose:</strong> Used exclusively to create and manage the dedicated <code>MistakeBook/</code> backup directory in your personal Google Drive, upload cropped question images into Subject and Chapter subdirectories, save the encrypted <code>manifest.json</code> metadata index, and download question snapshots when restoring your library onto a new device.
                </p>
                <p className="font-medium text-emerald-800 dark:text-emerald-400">
                  <strong className="text-fg">Boundary:</strong> This scope does not and cannot grant access to any other files, Google Docs, Sheets, Photos, or folders stored elsewhere in your Google Drive.
                </p>
              </div>
            </div>

            {/* Scope 2: email */}
            <div className="rounded-[8px] border border-line bg-surface p-4">
              <span className="font-semibold text-fg text-[14px] flex items-center gap-2">
                <Mail className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <span>Google Account Email</span>
              </span>
              <code className="mt-2 block rounded bg-soft px-3 py-2 text-[12px] font-mono text-fg break-all">
                https://www.googleapis.com/auth/userinfo.email (email)
              </code>
              <div className="mt-3 space-y-2 text-[13px] text-muted">
                <p>
                  <strong className="text-fg">Data Accessed:</strong> Your primary Google account email address.
                </p>
                <p>
                  <strong className="text-fg">Purpose:</strong> To identify your active cloud synchronization session, display your connected email in the Application Settings modal, authenticate backup requests, and verify session ownership.
                </p>
              </div>
            </div>

            {/* Scope 3: profile */}
            <div className="rounded-[8px] border border-line bg-surface p-4">
              <span className="font-semibold text-fg text-[14px] flex items-center gap-2">
                <UserCheck className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                <span>Google Basic Profile</span>
              </span>
              <code className="mt-2 block rounded bg-soft px-3 py-2 text-[12px] font-mono text-fg break-all">
                https://www.googleapis.com/auth/userinfo.profile (profile) &amp; openid
              </code>
              <div className="mt-3 space-y-2 text-[13px] text-muted">
                <p>
                  <strong className="text-fg">Data Accessed:</strong> Your display name, avatar picture URL, and OpenID Connect subject identifier.
                </p>
                <p>
                  <strong className="text-fg">Purpose:</strong> To render your profile picture and name inside the Application navigation bar and settings modal, providing clear visual confirmation of which account is connected for cloud sync.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4. Google Limited Use Disclosure */}
      <section id="limited-use" className="scroll-mt-20">
        <div className="rounded-[10px] border border-blue-500/30 bg-blue-500/5 p-5">
          <h2 className="text-[18px] font-bold text-fg flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-blue-600 dark:text-blue-400 shrink-0" />
            <span>4. Google API Services User Data Policy &amp; Limited Use Disclosure</span>
          </h2>
          <div className="mt-3 space-y-3 text-[14px] leading-relaxed text-fg/90">
            <p className="font-medium text-blue-900 dark:text-blue-300">
              Mistake Book adheres strictly to Google&apos;s rigorous API requirements and user data protections:
            </p>
            <div className="rounded-[8px] border border-blue-500/30 bg-surface p-4 font-medium text-fg">
              Mistake Book&apos;s use and transfer to any other app of information received from Google APIs will adhere to the{" "}
              <a
                href="https://developers.google.com/terms/api-services-user-data-policy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 dark:text-blue-400 underline inline-flex items-center gap-1 hover:text-fg"
              >
                <span>Google API Services User Data Policy</span>
                <ExternalLink className="h-3 w-3 inline" />
              </a>
              , including the Limited Use requirements.
            </div>
            <p className="text-muted">
              In accordance with the Google Limited Use requirements, we explicitly confirm the following commitments:
            </p>
            <ul className="list-disc pl-5 space-y-2 text-[13px] text-muted">
              <li>
                <strong className="text-fg">Prominent User-Facing Features Only:</strong> We access, process, and use Google user data solely to provide user-facing features that are prominent in the Application user interface (specifically, optional cloud backup, cross-device sync of student mistake notes, and displaying connected account status).
              </li>
              <li>
                <strong className="text-fg">No Transfer to Third Parties:</strong> We do not transfer, sell, or disclose Google user data to any external parties or services, except where strictly required to provide the core service (e.g., communicating directly with Google&apos;s own APIs), to comply with applicable laws, or as part of a merger/acquisition with prior notice.
              </li>
              <li>
                <strong className="text-fg">Zero Advertising Usage:</strong> Information received from Google APIs is never used or transferred for serving advertisements, personalized ads, targeted promotions, or retargeting campaigns.
              </li>
              <li>
                <strong className="text-fg">No AI / Machine Learning Training:</strong> Google user data, question snapshots, and notes are never used to train, retrain, fine-tune, or evaluate generalized machine learning or artificial intelligence models.
              </li>
              <li>
                <strong className="text-fg">Strict Human Access Restrictions:</strong> No humans (including developers, contractors, or support personnel) will read, inspect, or access your Google user data or Google Drive files, unless:
                <ol className="list-decimal pl-5 mt-1 space-y-1">
                  <li>You give explicit, affirmative written agreement for resolving a specific technical support issue;</li>
                  <li>It is strictly necessary for security purposes (such as investigating security vulnerabilities or abuse);</li>
                  <li>It is required to comply with applicable law or a valid legal order; or</li>
                  <li>The data is aggregated and anonymized for internal technical operations.</li>
                </ol>
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* 5. How We Use Information */}
      <section id="data-usage" className="scroll-mt-20">
        <h2 className="text-[20px] font-semibold text-fg">
          5. How We Use Your Information (Purposes of Processing)
        </h2>
        <div className="mt-3 space-y-3 text-muted">
          <p>
            All data collected or accessed is processed strictly for educational purposes and essential application operations:
          </p>
          <ul className="list-disc pl-5 space-y-2 text-[13px] text-muted">
            <li>
              <strong className="text-fg">Cataloging &amp; Spaced Revision:</strong> Organizing your question mistakes by subject and chapter, scheduling periodic review sessions, and logging mastery progress.
            </li>
            <li>
              <strong className="text-fg">Cloud Synchronization:</strong> Uploading question images and metadata manifests to your personal Google Drive account when enabled, ensuring your study materials remain safe if your browser cache is cleared.
            </li>
            <li>
              <strong className="text-fg">Multi-Device Restoration:</strong> Allowing you to restore your entire mistake notebook onto a new computer, tablet, or phone with a single click.
            </li>
            <li>
              <strong className="text-fg">Session Security &amp; Token Encryption:</strong> Storing short-lived, encrypted authentication tokens in HttpOnly cookies to keep your Google Drive connection secure without exposing credentials to client scripts.
            </li>
            <li>
              <strong className="text-fg">Application Reliability &amp; Performance:</strong> Monitoring anonymous crash reports, page response times, and Core Web Vitals to fix bugs and improve performance.
            </li>
          </ul>
        </div>
      </section>

      {/* 6. Zero Personal File Access */}
      <section id="personal-files" className="scroll-mt-20">
        <div className="rounded-[10px] border border-emerald-500/30 bg-emerald-500/5 p-5">
          <h2 className="text-[18px] font-bold text-fg flex items-center gap-2">
            <FolderLock className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>6. Zero Personal File Access Guarantee</span>
          </h2>
          <div className="mt-3 space-y-3 text-[14px] leading-relaxed text-fg/90">
            <p className="font-medium text-emerald-800 dark:text-emerald-300">
              We will never access any user&apos;s personal files under any circumstance.
            </p>
            <p className="text-muted">
              Because of Google&apos;s restricted per-file security model (<code>drive.file</code>),
              Mistake Book has no technical capability, permission, or code to search, list, read, open, or alter:
            </p>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[13px] text-muted pt-1">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>Personal Google Docs &amp; Sheets</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>Private Google Photos &amp; videos</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>Existing personal Drive folders</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>Shared drives or school/work folders</span>
              </li>
            </ul>
            <p className="text-[13px] text-muted pt-2 border-t border-line/60">
              The Application is technically isolated to the single <code>MistakeBook/</code> directory it creates. Everything else in your Google Drive remains completely private, untouched, and invisible to us.
            </p>
          </div>
        </div>
      </section>

      {/* 7. Promise Never to Sell User Data */}
      <section id="data-sale" className="scroll-mt-20">
        <div className="rounded-[10px] border border-line bg-surface p-5">
          <h2 className="text-[18px] font-bold text-fg flex items-center gap-2">
            <HeartHandshake className="h-5 w-5 text-blue-600 dark:text-blue-400 shrink-0" />
            <span>7. Promise Never to Sell Any User Data</span>
          </h2>
          <div className="mt-3 space-y-3 text-muted">
            <p className="text-[15px] font-medium text-fg">
              We promise never to sell, monetize, or commercialize any user data.
            </p>
            <p>
              We do not sell, rent, monetize, license, or exchange your personal information, question screenshots,
              academic performance, mistake frequencies, study habits, notes, or email addresses with advertisers, data brokers,
              educational coaching institutes, test-prep companies, or any commercial third parties whatsoever.
            </p>
            <p>
              Mistake Book is built as a pure educational utility for students. Your academic progress is your personal asset, not a product to be monetized.
            </p>
          </div>
        </div>
      </section>

      {/* 8. Analytics & Anonymous Telemetry */}
      <section id="analytics" className="scroll-mt-20">
        <h2 className="text-[20px] font-semibold text-fg flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-fg shrink-0" />
          <span>8. Analytics &amp; Anonymous Telemetry</span>
        </h2>
        <div className="mt-3 space-y-3 text-muted">
          <p>
            This Application uses <strong className="text-fg">Vercel Analytics</strong> to monitor system health, measure page load performance, and diagnose technical errors.
          </p>
          <div className="rounded-[8px] border border-line bg-soft/50 p-4">
            <p className="font-semibold text-fg text-[14px]">
              Every user is anonymously tracked for analytics.
            </p>
            <p className="mt-1 text-[13px] text-muted">
              Vercel Analytics is built privacy-first. It does not use invasive cross-site tracking cookies, does not persist long-term tracking identifiers, and does not build advertising profiles.
            </p>
          </div>
          <p>
            <strong>What Vercel Analytics measures:</strong>
          </p>
          <ul className="list-disc pl-5 space-y-1.5 text-[13px]">
            <li>Aggregated page visit counts, navigation timings, and page response latencies.</li>
            <li>Browser engine (e.g., Chromium, WebKit), operating system family, and screen resolution categories.</li>
            <li>Core Web Vitals metrics (Largest Contentful Paint, First Input Delay, Cumulative Layout Shift).</li>
          </ul>
          <p>
            <strong>What is NEVER sent to analytics:</strong>
          </p>
          <ul className="list-disc pl-5 space-y-1.5 text-[13px]">
            <li>Your name, email address, Google account details, or user ID.</li>
            <li>The content of your question screenshots, notes, solutions, or answers.</li>
            <li>Which specific subjects or chapters you study.</li>
            <li>Any personally identifiable information (PII).</li>
          </ul>
        </div>
      </section>

      {/* 9. Data Storage & Security */}
      <section id="storage-security" className="scroll-mt-20">
        <h2 className="text-[20px] font-semibold text-fg flex items-center gap-2">
          <Lock className="h-5 w-5 text-fg shrink-0" />
          <span>9. Data Storage, Security &amp; Token Handling</span>
        </h2>
        <div className="mt-3 space-y-3 text-muted">
          <p>
            We implement industry-standard technical safeguards to protect your data across every layer:
          </p>
          <ul className="list-disc pl-5 space-y-2 text-[13px]">
            <li>
              <strong className="text-fg">Encryption in Transit:</strong> All communications between your browser, our servers, and Google APIs use transport layer security (HTTPS / TLS 1.3 encryption).
            </li>
            <li>
              <strong className="text-fg">Authenticated Token Encryption:</strong> Google OAuth access and refresh tokens are encrypted on the server using <strong className="text-fg">AES-256-GCM authenticated encryption</strong> before being sealed into session cookies. Tokens are never stored in plain text, are never logged to console or external monitoring, and are never accessible to client-side scripts.
            </li>
            <li>
              <strong className="text-fg">Secure Cookie Configuration:</strong> The authentication cookie (<code>mb_drive_session</code>) is configured with strict <code>HttpOnly</code>, <code>Secure</code>, and <code>SameSite=Lax</code> flags, preventing cross-site scripting (XSS) and unauthorized cross-origin access.
            </li>
            <li>
              <strong className="text-fg">Direct Client-to-Drive Architecture:</strong> Question uploads stream directly between your browser and Google&apos;s verified Drive endpoints via short-lived access tokens, ensuring your question snapshots are never routed through or stored on intermediate servers.
            </li>
            <li>
              <strong className="text-fg">Sandboxed Local Storage:</strong> Offline database tables and blob images reside within your browser&apos;s origin-isolated IndexedDB database (<code>idb://mistake-book-db</code>).
            </li>
          </ul>
        </div>
      </section>

      {/* 10. Retention & Data Deletion */}
      <section id="retention-deletion" className="scroll-mt-20">
        <h2 className="text-[20px] font-semibold text-fg flex items-center gap-2">
          <Trash2 className="h-5 w-5 text-rose-600 dark:text-rose-400 shrink-0" />
          <span>10. Data Retention &amp; Step-by-Step Data Deletion Instructions</span>
        </h2>
        <div className="mt-3 space-y-3 text-muted">
          <p>
            We adhere to data minimization principles. Below are our retention timelines and clear, self-service instructions for permanently deleting your data:
          </p>

          <div className="rounded-[8px] border border-line bg-surface p-4 text-[13px] space-y-2">
            <h3 className="font-semibold text-fg text-[14px]">Data Retention Periods:</h3>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                <strong className="text-fg">Local Browser Data:</strong> Retained locally on your device indefinitely until you clear your browser site data or use the in-app &ldquo;Clear All Data&rdquo; button.
              </li>
              <li>
                <strong className="text-fg">Google Drive Backups:</strong> Retained in your personal Google Drive storage until you choose to delete the <code>MistakeBook/</code> folder.
              </li>
              <li>
                <strong className="text-fg">Authentication Session:</strong> The encrypted session cookie automatically expires after 1 year, or is deleted immediately when you click &ldquo;Disconnect&rdquo;.
              </li>
            </ul>
          </div>

          <p className="font-semibold text-fg pt-2">
            Step-by-Step Instructions to Delete Your Data:
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div className="rounded-[8px] border border-line bg-surface p-4">
              <span className="font-semibold text-fg text-[13px] flex items-center gap-1.5">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-soft text-[11px] font-bold">1</span>
                <span>Disconnect Cloud Sync In-App</span>
              </span>
              <p className="mt-2 text-[12px] text-muted leading-relaxed">
                Open the Application settings (<code className="text-fg">⚙ Settings &rarr; Cloud Backup &rarr; Disconnect</code>).
                This immediately invalidates your session, clears the encrypted session cookie, and halts all synchronization.
              </p>
            </div>

            <div className="rounded-[8px] border border-line bg-surface p-4">
              <span className="font-semibold text-fg text-[13px] flex items-center gap-1.5">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-soft text-[11px] font-bold">2</span>
                <span>Revoke Google OAuth Access</span>
              </span>
              <p className="mt-2 text-[12px] text-muted leading-relaxed">
                Visit your{" "}
                <a
                  href="https://myaccount.google.com/permissions"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-fg underline hover:text-muted inline-flex items-center gap-0.5"
                >
                  <span>Google Account Third-Party Access</span>
                  <ExternalLink className="h-3 w-3 inline" />
                </a>{" "}
                settings, select &ldquo;Mistake Book&rdquo;, and click &ldquo;Remove Access&rdquo;. Google will instantly revoke all OAuth refresh tokens.
              </p>
            </div>

            <div className="rounded-[8px] border border-line bg-surface p-4">
              <span className="font-semibold text-fg text-[13px] flex items-center gap-1.5">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-soft text-[11px] font-bold">3</span>
                <span>Delete Google Drive Backup Files</span>
              </span>
              <p className="mt-2 text-[12px] text-muted leading-relaxed">
                Open{" "}
                <a
                  href="https://drive.google.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-fg underline hover:text-muted inline-flex items-center gap-0.5"
                >
                  <span>Google Drive</span>
                  <ExternalLink className="h-3 w-3 inline" />
                </a>
                , locate the dedicated <code>MistakeBook/</code> folder, move it to the Trash, and empty your trash to permanently delete all cloud backups.
              </p>
            </div>

            <div className="rounded-[8px] border border-line bg-surface p-4">
              <span className="font-semibold text-fg text-[13px] flex items-center gap-1.5">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-soft text-[11px] font-bold">4</span>
                <span>Erase Local Browser Database</span>
              </span>
              <p className="mt-2 text-[12px] text-muted leading-relaxed">
                Clearing your browser site data or IndexedDB cache for <code>mistake.ojeet.tech</code> immediately and permanently removes all stored question images and database tables from your local hardware.
              </p>
            </div>
          </div>

          <p className="text-[13px] text-muted pt-2">
            You may also contact us at{" "}
            <a href="mailto:privacy@ojeet.tech" className="text-fg underline hover:text-muted">
              privacy@ojeet.tech
            </a>{" "}
            with the subject line &ldquo;Data Deletion Request&rdquo; to request assistance or verification that no residual data exists.
          </p>
        </div>
      </section>

      {/* 11. Your Privacy Rights */}
      <section id="user-rights" className="scroll-mt-20">
        <h2 className="text-[20px] font-semibold text-fg">
          11. Your Privacy Rights (GDPR, CCPA &amp; Global Privacy)
        </h2>
        <div className="mt-3 space-y-3 text-muted">
          <p>
            Regardless of your geographic location, we extend full data sovereignty rights to every user:
          </p>
          <ul className="list-disc pl-5 space-y-2 text-[13px]">
            <li>
              <strong className="text-fg">Right to Access &amp; Portability:</strong> You can export or inspect your full question repository and manifest index at any time directly from the Application or your Google Drive folder.
            </li>
            <li>
              <strong className="text-fg">Right to Rectification:</strong> You can edit question metadata, mistake tags, answer keys, and notes directly inside the Application UI.
            </li>
            <li>
              <strong className="text-fg">Right to Erasure (&ldquo;Right to be Forgotten&rdquo;):</strong> You have the right to delete all your question media, backup manifests, and session tokens through the self-service steps described in Section 10.
            </li>
            <li>
              <strong className="text-fg">Right to Withdraw Consent:</strong> You may disconnect Google Drive sync and revoke OAuth tokens at any time without penalty.
            </li>
            <li>
              <strong className="text-fg">Non-Discrimination:</strong> We will never deny services, degrade quality, or alter functionality because you choose to exercise your privacy rights or opt out of cloud sync.
            </li>
          </ul>
        </div>
      </section>

      {/* 12. Children's Privacy */}
      <section id="children" className="scroll-mt-20">
        <h2 className="text-[20px] font-semibold text-fg">
          12. Children&apos;s Privacy &amp; Educational Protections
        </h2>
        <div className="mt-3 space-y-3 text-muted">
          <p>
            Mistake Book is an educational study aid designed for secondary and senior secondary students preparing for competitive entrance examinations (typically ages 15 and older).
            We do not knowingly collect personal information from children under the age of 13 (or under 16 in certain jurisdictions) without verified parental or guardian consent.
          </p>
          <p>
            Because the Application operates locally by default and requires no account creation, young students can use Mistake Book completely anonymously without transmitting personal data.
            If you believe a student under the applicable age threshold has provided personal information without consent, please notify us immediately at{" "}
            <a href="mailto:privacy@ojeet.tech" className="text-fg underline hover:text-muted">
              privacy@ojeet.tech
            </a>
            , and we will take immediate steps to remove the information.
          </p>
        </div>
      </section>

      {/* 13. Contact & Privacy Inquiries */}
      <section id="contact" className="scroll-mt-20">
        <h2 className="text-[20px] font-semibold text-fg flex items-center gap-2">
          <Mail className="h-5 w-5 text-fg shrink-0" />
          <span>13. Contact Us &amp; Privacy Officer</span>
        </h2>
        <div className="mt-3 space-y-3 text-muted">
          <p>
            If you have questions, feedback, compliance requests, or need assistance exercising your privacy rights, our team is available to assist you:
          </p>
          <div className="rounded-[8px] border border-line bg-surface p-4 text-[13px] space-y-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <p className="text-[12px] font-semibold uppercase tracking-wider text-muted">
                  Application Name
                </p>
                <p className="font-medium text-fg mt-0.5">Mistake Book</p>
                <p className="text-muted text-[12px]">Hosted at https://mistake.ojeet.tech</p>
              </div>
              <div>
                <p className="text-[12px] font-semibold uppercase tracking-wider text-muted">
                  Developer &amp; Publisher
                </p>
                <p className="font-medium text-fg mt-0.5">ojeet.tech</p>
                <p className="text-muted text-[12px]">Educational Technology Team</p>
              </div>
              <div>
                <p className="text-[12px] font-semibold uppercase tracking-wider text-muted">
                  Privacy &amp; Data Protection Officer
                </p>
                <a
                  href="mailto:privacy@ojeet.tech"
                  className="font-medium text-fg underline hover:text-muted block mt-0.5"
                >
                  privacy@ojeet.tech
                </a>
              </div>
              <div>
                <p className="text-[12px] font-semibold uppercase tracking-wider text-muted">
                  General &amp; Technical Support
                </p>
                <a
                  href="mailto:support@ojeet.tech"
                  className="font-medium text-fg underline hover:text-muted block mt-0.5"
                >
                  support@ojeet.tech
                </a>
              </div>
            </div>
            <p className="pt-2 text-[12px] text-muted border-t border-line/60">
              We commit to reviewing and responding to all privacy inquiries and data requests within thirty (30) days of receipt.
            </p>
          </div>
          <p className="pt-2 text-[13px]">
            You may also review our accompanying{" "}
            <Link href="/terms" className="text-fg underline hover:text-muted font-medium">
              Terms of Service
            </Link>{" "}
            governing the use of Mistake Book.
          </p>
        </div>
      </section>
    </LegalShell>
  );
}
