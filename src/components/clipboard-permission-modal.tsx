"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { ClipboardCheck, ShieldCheck } from "lucide-react";
import { useCapture } from "@/components/capture";
import { useSettings } from "@/lib/settings";

export function ClipboardPermissionModal() {
  const pathname = usePathname();
  const { update } = useSettings();
  const {
    permissionPromptOpen,
    dismissPermissionPrompt,
    requestClipboardPermission,
  } = useCapture();
  const [mounted, setMounted] = useState(false);
  const [requesting, setRequesting] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleDismiss = useCallback(() => {
    dismissPermissionPrompt();
  }, [dismissPermissionPrompt]);

  const handleTurnOff = useCallback(() => {
    update({ autoClipboardCapture: false });
    dismissPermissionPrompt();
  }, [update, dismissPermissionPrompt]);

  const handleAllow = () => {
    if (requesting) return;
    setRequesting(true);
    // Invoke directly inside click handler to preserve browser user activation.
    void requestClipboardPermission().finally(() => {
      setRequesting(false);
    });
  };

  useEffect(() => {
    if (!permissionPromptOpen) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        handleDismiss();
      }
    };

    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [permissionPromptOpen, handleDismiss]);

  useEffect(() => {
    if (!permissionPromptOpen) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [permissionPromptOpen]);

  if (!mounted || !permissionPromptOpen || pathname?.startsWith("/viewer")) {
    return null;
  }

  const content = (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="clipboard-permission-title"
      aria-describedby="clipboard-permission-desc"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/40 dark:bg-black/70 backdrop-blur-[2px] animate-in fade-in duration-200"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) {
          handleDismiss();
        }
      }}
    >
      <div
        className="relative w-full max-w-[420px] rounded-[24px] sm:rounded-[28px] border border-line bg-surface px-8 pt-9 pb-8 sm:px-10 sm:pt-10 sm:pb-9 shadow-2xl flex flex-col items-center text-center animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl border border-line bg-soft text-fg">
          <ClipboardCheck className="h-6 w-6" aria-hidden="true" />
        </div>

        <h2
          id="clipboard-permission-title"
          className="text-[20px] sm:text-[22px] font-semibold text-fg leading-snug tracking-tight mb-2.5 max-w-[340px]"
        >
          Enable always-on clipboard detection
        </h2>

        <p
          id="clipboard-permission-desc"
          className="text-[14px] sm:text-[15px] text-muted leading-relaxed mb-5 max-w-[330px]"
        >
          Automatically open a question draft when you switch back to this tab with a new screenshot on your clipboard.
        </p>

        <div className="w-full rounded-[14px] border border-line bg-soft/70 px-4 py-3 text-left mb-6 flex items-start gap-2.5">
          <ShieldCheck className="h-4 w-4 shrink-0 text-fg mt-0.5" aria-hidden="true" />
          <div className="text-[12.5px] leading-relaxed text-muted">
            <p className="font-semibold text-fg">
              We do not have access to your clipboard history.
            </p>
            <p className="mt-0.5">
              MistakeBook only checks the current image on your clipboard locally on your device when you return to this tab.
            </p>
          </div>
        </div>

        <button
          type="button"
          disabled={requesting}
          onClick={handleAllow}
          className="w-full h-12 rounded-[12px] sm:rounded-[14px] bg-[#18181b] text-white hover:bg-[#27272a] active:bg-[#09090b] dark:bg-white dark:text-[#18181b] dark:hover:bg-neutral-100 dark:active:bg-neutral-200 disabled:opacity-60 font-semibold text-[15px] sm:text-[16px] transition-colors cursor-pointer flex items-center justify-center shadow-sm"
        >
          {requesting ? "Requesting access…" : "Allow always-on access"}
        </button>

        <div className="mt-3.5 sm:mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
          <button
            type="button"
            onClick={handleTurnOff}
            className="text-[13.5px] sm:text-[14px] text-muted hover:text-fg font-normal transition-colors cursor-pointer py-1 px-2"
          >
            Turn off auto-detect
          </button>
          <button
            type="button"
            onClick={handleDismiss}
            className="text-[13.5px] sm:text-[14px] text-muted hover:text-fg font-normal transition-colors cursor-pointer py-1 px-2"
          >
            Not now
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
