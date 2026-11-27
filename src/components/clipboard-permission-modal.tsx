"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { ClipboardCheck } from "lucide-react";
import { useCapture } from "@/components/capture";

export function ClipboardPermissionModal() {
  const pathname = usePathname();
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

  const handleAllow = () => {
    if (requesting) return;
    setRequesting(true);
    // Invoke directly inside click handler to preserve browser user activation.
    void requestClipboardPermission().finally(() => {
      setRequesting(false);
    });
  };

  const isOpen =
    mounted && permissionPromptOpen && !pathname?.startsWith("/viewer");

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

  useEffect(() => {
    if (!isOpen) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen]);

  if (!isOpen) {
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
        className="relative w-full max-w-[420px] rounded-[24px] sm:rounded-[28px] border border-line bg-surface px-8 pt-9 pb-8 sm:px-10 sm:pt-11 sm:pb-9 shadow-2xl flex flex-col items-center text-center animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-6 flex items-center justify-center text-fg">
          <ClipboardCheck
            className="w-[46px] h-[46px] shrink-0"
            strokeWidth={1.6}
            aria-hidden="true"
          />
        </div>

        <h2
          id="clipboard-permission-title"
          className="text-[20px] sm:text-[22px] font-semibold text-fg leading-snug tracking-tight mb-2.5 max-w-[340px]"
        >
          Allow clipboard access to auto-detect copied images.
        </h2>

        <p
          id="clipboard-permission-desc"
          className="text-[14px] sm:text-[15px] text-muted leading-relaxed mb-7 sm:mb-8 max-w-[320px]"
        >
          MistakeBook only checks your current image locally — never your clipboard history.
        </p>

        <button
          type="button"
          disabled={requesting}
          onClick={handleAllow}
          className="w-full h-12 rounded-[12px] sm:rounded-[14px] bg-[#18181b] text-white hover:bg-[#27272a] active:bg-[#09090b] dark:bg-white dark:text-[#18181b] dark:hover:bg-neutral-100 dark:active:bg-neutral-200 disabled:opacity-60 font-semibold text-[15px] sm:text-[16px] transition-colors cursor-pointer flex items-center justify-center shadow-sm"
        >
          {requesting ? "Requesting…" : "Allow access"}
        </button>

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
