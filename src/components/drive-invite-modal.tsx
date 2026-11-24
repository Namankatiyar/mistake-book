"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { useDriveSync } from "@/lib/sync-context";

const STORAGE_VISIT_COUNT = "mb.visit_count";
const STORAGE_DISMISSED = "mb.drive_invite_dismissed";
const STORAGE_SIGNED_IN = "mb.has_signed_in";

export function GoogleDriveIcon({ className = "w-[54px] h-[48px]" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 87.3 78"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M6.6 66.85L10.45 73.5C11.25 74.9 12.4 76 13.75 76.8L27.5 53H0C0 54.55 0.4 56.1 1.2 57.5L6.6 66.85Z"
        fill="#0066DA"
      />
      <path
        d="M43.65 25L29.9 1.2C28.55 2 27.4 3.1 26.6 4.5L1.2 48.5C0.4 49.9 0 51.45 0 53H27.5L43.65 25Z"
        fill="#00AC47"
      />
      <path
        d="M73.55 76.8C74.9 76 76.05 74.9 76.85 73.5L86.1 57.5C86.9 56.1 87.3 54.55 87.3 53H59.8L73.55 76.8Z"
        fill="#EA4335"
      />
      <path
        d="M43.65 25L57.4 1.2C56.05 0.4 54.5 0 52.9 0H34.4C32.8 0 31.25 0.4 29.9 1.2L43.65 25Z"
        fill="#00832D"
      />
      <path
        d="M59.8 53H27.5L13.75 76.8C15.1 77.6 16.65 78 18.25 78H69.05C70.65 78 72.2 77.6 73.55 76.8L59.8 53Z"
        fill="#2684FC"
      />
      <path
        d="M73.4 26.5L60.7 4.5C59.9 3.1 58.75 2 57.4 1.2L43.65 25L59.8 53H87.3C87.3 51.45 86.9 49.9 86.1 48.5L73.4 26.5Z"
        fill="#FFBA00"
      />
    </svg>
  );
}

export function DriveInviteModal() {
  const pathname = usePathname();
  const { authStatus, authChecked, connectDrive, signInModalOpen, closeSignInModal } = useDriveSync();
  const [mounted, setMounted] = useState(false);
  const [autoOpen, setAutoOpen] = useState(false);

  const isOpen = autoOpen || signInModalOpen;

  // Initialize visit count and determine whether modal should appear
  useEffect(() => {
    setMounted(true);
    if (typeof window === "undefined") return;

    // Guard against React StrictMode running double-effects on the same page load
    const win = window as unknown as { __mb_visit_counted?: boolean };
    let visitCount = 0;
    try {
      const stored = parseInt(localStorage.getItem(STORAGE_VISIT_COUNT) || "0", 10);
      if (!win.__mb_visit_counted) {
        win.__mb_visit_counted = true;
        visitCount = stored + 1;
        localStorage.setItem(STORAGE_VISIT_COUNT, String(visitCount));
      } else {
        visitCount = stored;
      }
    } catch {
      visitCount = 1;
    }

    // Only proceed once auth status check has resolved
    if (!authChecked) return;

    // Check if user has already dismissed the invite or ever signed in
    let isDismissed = false;
    let hasSignedInEarlier = false;
    try {
      isDismissed = localStorage.getItem(STORAGE_DISMISSED) === "true";
      hasSignedInEarlier =
        authStatus.connected || localStorage.getItem(STORAGE_SIGNED_IN) === "true";
    } catch {
      // ignore
    }

    // If currently connected, persist that user has signed in
    if (authStatus.connected) {
      try {
        localStorage.setItem(STORAGE_SIGNED_IN, "true");
      } catch {
        // ignore
      }
    }

    // Trigger on second visit or later, only if never signed in earlier and not dismissed
    if (visitCount >= 2 && !isDismissed && !hasSignedInEarlier) {
      setAutoOpen(true);
    }
  }, [authChecked, authStatus.connected]);

  const handleDismiss = useCallback(() => {
    setAutoOpen(false);
    closeSignInModal();
    try {
      localStorage.setItem(STORAGE_DISMISSED, "true");
    } catch {
      // ignore
    }
  }, [closeSignInModal]);

  const handleSignIn = useCallback(() => {
    try {
      localStorage.setItem(STORAGE_SIGNED_IN, "true");
      localStorage.setItem(STORAGE_DISMISSED, "true");
    } catch {
      // ignore
    }
    setAutoOpen(false);
    closeSignInModal();
    connectDrive();
  }, [closeSignInModal, connectDrive]);

  // Handle keyboard Escape to dismiss
  useEffect(() => {
    if (!isOpen) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        handleDismiss();
      }
    };

    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [isOpen, handleDismiss]);

  // Prevent background scrolling while modal is active
  useEffect(() => {
    if (!isOpen) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen]);

  // Never render in server context, when closed, or in standalone viewer
  if (!mounted || !isOpen || pathname?.startsWith("/viewer")) {
    return null;
  }

  const content = (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="drive-invite-title"
      aria-describedby="drive-invite-desc"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/40 dark:bg-black/70 backdrop-blur-[2px] animate-in fade-in duration-200"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) {
          handleDismiss();
        }
      }}
    >
      <div
        className="relative w-full max-w-[420px] rounded-[24px] sm:rounded-[28px] border border-line bg-surface px-8 pt-9 pb-8 sm:px-10 sm:pt-11 sm:pb-9 shadow-2xl flex flex-col items-center text-center animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Google Drive Logo */}
        <div className="mb-6 flex items-center justify-center">
          <GoogleDriveIcon className="w-[52px] h-[46px] shrink-0" />
        </div>

        {/* Heading */}
        <h2
          id="drive-invite-title"
          className="text-[20px] sm:text-[22px] font-semibold text-fg leading-snug tracking-tight mb-2.5 max-w-[340px]"
        >
          Sign in with Google to sync your data with Drive.
        </h2>

        {/* Description */}
        <p
          id="drive-invite-desc"
          className="text-[14px] sm:text-[15px] text-muted leading-relaxed mb-7 sm:mb-8 max-w-[320px]"
        >
          Allow Drive access permissions for features to work as expected.
        </p>

        {/* Sign In Primary Action */}
        <button
          type="button"
          onClick={handleSignIn}
          className="w-full h-12 rounded-[12px] sm:rounded-[14px] bg-[#18181b] text-white hover:bg-[#27272a] active:bg-[#09090b] dark:bg-white dark:text-[#18181b] dark:hover:bg-neutral-100 dark:active:bg-neutral-200 font-semibold text-[15px] sm:text-[16px] transition-colors cursor-pointer flex items-center justify-center shadow-sm"
        >
          Sign in
        </button>

        {/* Not Now Secondary Action */}
        <button
          type="button"
          onClick={handleDismiss}
          className="mt-3.5 sm:mt-4 text-[14px] sm:text-[15px] text-muted hover:text-fg font-normal transition-colors cursor-pointer py-1 px-3"
        >
          Not now
        </button>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
