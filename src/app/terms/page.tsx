import type { Metadata } from "next";
import Link from "next/link";
import { LegalShell } from "@/components/legal-shell";
import {
  FileText,
  FolderLock,
  HeartHandshake,
  BarChart3,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Terms of Service · Mistake book",
  description:
    "Terms of Service for Mistake Book. Review our terms of use, educational guidelines, Google Drive integration policies, and privacy assurances.",
};

const SECTIONS = [
  { id: "acceptance", label: "1. Acceptance of Terms" },
  { id: "purpose", label: "2. Purpose & Educational Use" },
  { id: "ownership", label: "3. Content Ownership" },
  { id: "google-drive-terms", label: "4. Google Drive Permissions" },
  { id: "personal-files", label: "5. Zero Personal File Access" },
  { id: "no-data-sale", label: "6. Promise Never to Sell Data" },
  { id: "analytics", label: "7. Anonymous Analytics Tracking" },
  { id: "disclaimers", label: "8. Disclaimers & Liability" },
  { id: "modifications", label: "9. Modifications & Termination" },
];

export default function TermsPage() {
  return (
    <LegalShell
      title="Terms of Service"
      subtitle="These Terms of Service govern your use of Mistake Book. By using the app, you agree to these transparent terms designed to protect student work."
      lastUpdated="November 22, 2026"
      sections={SECTIONS}
    >
      {/* 1. Acceptance */}
      <section id="acceptance" className="scroll-mt-20">
        <h2 className="text-[20px] font-semibold text-fg">
          1. Acceptance of Terms
        </h2>
        <div className="mt-3 space-y-3 text-muted">
          <p>
            Welcome to <strong className="text-fg">Mistake Book</strong>. By accessing, browsing, or using this application,
            you acknowledge that you have read, understood, and agree to be bound by these Terms of Service
            and our accompanying{" "}
            <Link href="/privacy" className="text-fg underline hover:text-muted">
              Privacy Policy
            </Link>.
          </p>
          <p>
            If you do not agree with any part of these terms, you should refrain from using the application.
          </p>
        </div>
      </section>

      {/* 2. Educational Purpose */}
      <section id="purpose" className="scroll-mt-20">
        <h2 className="text-[20px] font-semibold text-fg">
          2. Purpose &amp; Educational Use
        </h2>
        <div className="mt-3 space-y-3 text-muted">
          <p>
            Mistake Book is an educational study tool engineered to help students preparing for competitive entrance examinations
            (such as JEE Mains, JEE Advanced, NEET, and related STEM tests) catalog, tag, review, and master questions they answered incorrectly.
          </p>
          <p>
            You agree to use the application solely for lawful educational purposes and in accordance with your personal study routine.
          </p>
        </div>
      </section>

      {/* 3. Ownership */}
      <section id="ownership" className="scroll-mt-20">
        <h2 className="text-[20px] font-semibold text-fg">
          3. Your Content &amp; Intellectual Property Ownership
        </h2>
        <div className="mt-3 space-y-3 text-muted">
          <p>
            <strong className="text-fg">You retain 100% ownership of everything you add to Mistake Book.</strong>
          </p>
          <p>
            Any screenshots, images, solutions, notes, tags, or question descriptions you paste, drop, or save within the application
            belong entirely to you. Mistake Book does not claim any ownership, copyright, or commercial rights over your study notes,
            examination questions, or uploaded media.
          </p>
          <p>
            Because the application operates locally in your browser, your files remain on your own hardware unless you choose
            to synchronize them to your personal Google Drive account.
          </p>
        </div>
      </section>

      {/* 4. Google Drive Permissions */}
      <section id="google-drive-terms" className="scroll-mt-20">
        <h2 className="text-[20px] font-semibold text-fg flex items-center gap-2">
          <FolderLock className="h-5 w-5 text-fg shrink-0" />
          <span>4. Google Drive Read &amp; Write Permissions</span>
        </h2>
        <div className="mt-3 space-y-3 text-muted">
          <p>
            Mistake Book provides an optional cloud sync feature connecting your personal Google Drive.
            When you initiate this feature, you authorize the application to use Google Drive read and write permissions:
          </p>
          <ul className="list-disc pl-5 space-y-1.5">
            <li>
              <strong className="text-fg">Scoped Application Access:</strong> The application requests access strictly through the
              standard Google OAuth scope <code className="text-fg text-[12px] font-mono">https://www.googleapis.com/auth/drive.file</code>.
            </li>
            <li>
              <strong className="text-fg">Dedicated App Storage:</strong> Read and write permissions are used exclusively to create, update,
              and sync your <code>MistakeBook/</code> folder, images, and manifest database in your Google Drive.
            </li>
            <li>
              <strong className="text-fg">Optional Feature:</strong> Google Drive backup is completely optional. You may disconnect your
              account at any time via Settings or directly through your Google Account controls.
            </li>
          </ul>
        </div>
      </section>

      {/* 5. Zero Personal File Access */}
      <section id="personal-files" className="scroll-mt-20">
        <div className="rounded-[10px] border border-emerald-500/30 bg-emerald-500/5 p-5">
          <h2 className="text-[18px] font-bold text-fg flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>5. Zero Personal File Access Commitment</span>
          </h2>
          <div className="mt-3 space-y-3 text-[14px] leading-relaxed text-fg/90">
            <p className="font-medium text-emerald-800 dark:text-emerald-300">
              We will never access any user&apos;s personal files.
            </p>
            <p className="text-muted">
              We pledge that the application will never access, scan, index, read, or modify your personal files, Google Docs,
              Google Sheets, Google Photos, or any files stored outside of the application&apos;s dedicated <code>MistakeBook</code> folder.
            </p>
            <p className="text-[13px] text-muted">
              Under Google&apos;s API policies and OAuth technical constraints, the application is restricted from even querying
              files that were not created directly by Mistake Book. Your personal drive content remains completely secure and untouched.
            </p>
          </div>
        </div>
      </section>

      {/* 6. Promise Never to Sell User Data */}
      <section id="no-data-sale" className="scroll-mt-20">
        <div className="rounded-[10px] border border-line bg-surface p-5">
          <h2 className="text-[18px] font-bold text-fg flex items-center gap-2">
            <HeartHandshake className="h-5 w-5 text-blue-600 dark:text-blue-400 shrink-0" />
            <span>6. We Promise Never to Sell Any User Data</span>
          </h2>
          <div className="mt-3 space-y-3 text-muted">
            <p className="text-[15px] font-medium text-fg">
              We promise never to sell any user data.
            </p>
            <p>
              Under no circumstances will your personal data, exam practice logs, revision frequency, mistake patterns,
              or contact information be sold, rented, monetized, or shared with third-party advertisers, coaching classes, or data aggregators.
            </p>
          </div>
        </div>
      </section>

      {/* 7. Analytics */}
      <section id="analytics" className="scroll-mt-20">
        <h2 className="text-[20px] font-semibold text-fg flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-fg shrink-0" />
          <span>7. Anonymous Vercel Analytics Tracking</span>
        </h2>
        <div className="mt-3 space-y-3 text-muted">
          <p>
            This application uses <strong className="text-fg">Vercel Analytics tracking</strong>.
            <strong className="text-fg"> Every user is anonymously tracked for analytics.</strong>
          </p>
          <p>
            Vercel Analytics provides high-level telemetry such as web vitals, page response times, and aggregated browser usage.
            No personal information, student identity, question content, or study notes are ever tracked or transmitted.
          </p>
        </div>
      </section>

      {/* 8. Disclaimers */}
      <section id="disclaimers" className="scroll-mt-20">
        <h2 className="text-[20px] font-semibold text-fg flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0" />
          <span>8. Disclaimers &amp; Limitation of Liability</span>
        </h2>
        <div className="mt-3 space-y-3 text-muted">
          <p>
            Mistake Book is provided on an <strong className="text-fg">&ldquo;as is&rdquo;</strong> and <strong className="text-fg">&ldquo;as available&rdquo;</strong> basis
            without warranty of any kind, either express or implied.
          </p>
          <p>
            While the software is designed with robust local database durability and automatic Google Drive syncing,
            we recommend that users maintain periodic backups of their crucial academic materials. To the fullest extent permitted
            by applicable law, Mistake Book and its maintainers shall not be liable for any indirect, incidental, or consequential
            damages resulting from the use or inability to use the software.
          </p>
        </div>
      </section>

      {/* 9. Modifications */}
      <section id="modifications" className="scroll-mt-20">
        <h2 className="text-[20px] font-semibold text-fg">
          9. Modifications &amp; Termination
        </h2>
        <div className="mt-3 space-y-3 text-muted">
          <p>
            We reserve the right to revise or modify these Terms of Service from time to time. Any revisions will be reflected
            on this page with an updated &ldquo;Last updated&rdquo; date. Your continued use of the application following the posting
            of revisions signifies your acceptance of the updated terms.
          </p>
          <p>
            For any questions regarding these terms, please consult our{" "}
            <Link href="/privacy" className="text-fg underline hover:text-muted">
              Privacy Policy
            </Link>.
          </p>
        </div>
      </section>
    </LegalShell>
  );
}
