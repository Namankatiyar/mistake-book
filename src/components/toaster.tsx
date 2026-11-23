"use client";

import { Toaster as SonnerToaster } from "sonner";
import { useSettings } from "@/lib/settings";

export function Toaster() {
  const { resolved } = useSettings();

  return (
    <SonnerToaster
      theme={resolved}
      position="bottom-center"
      toastOptions={{
        className: "!rounded-full !border !border-line !bg-surface !text-fg !shadow-lg",
        style: {
          borderRadius: "9999px",
        },
        classNames: {
          toast: "!rounded-full !border !border-line !bg-surface !text-fg !shadow-lg",
          actionButton: "!rounded-full !bg-fg !text-bg hover:!opacity-90 active:!scale-95 transition-all !font-medium !text-[12px] !px-3 !py-1 cursor-pointer",
          cancelButton: "!rounded-full !bg-soft !text-fg hover:!bg-line/80 active:!scale-95 transition-all !font-medium !text-[12px] !px-3 !py-1 cursor-pointer",
          closeButton: "!rounded-full",
        },
      }}
    />
  );
}
