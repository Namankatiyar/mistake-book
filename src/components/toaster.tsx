"use client";

import { Toaster as SonnerToaster } from "sonner";
import { useSettings } from "@/lib/settings";

export function Toaster() {
  const { resolved } = useSettings();

  return (
    <SonnerToaster
      theme={resolved}
      position="bottom-right"
    />
  );
}
