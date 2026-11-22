"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { SettingsModal } from "./settings-modal";
import { useSettings } from "@/lib/settings";
import { IconButton } from "./ui";

export function Header() {
  const pathname = usePathname();
  const { resolved, update } = useSettings();
  const [settingsOpen, setSettingsOpen] = useState(false);

  // The viewer has no chrome.
  if (pathname.startsWith("/viewer")) return null;

  return (
    <>
      <header className="border-b border-line bg-bg">
        <div className="flex h-14 w-full items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-baseline gap-2">
            <span className="text-[16px] font-semibold">Mistake book</span>
            <span className="text-[13px] text-muted">JEE Mains</span>
          </Link>
          <nav className="flex items-center gap-2">
            <IconButton
              name="cog"
              label="Settings"
              tooltipSide="bottom"
              active={settingsOpen}
              onClick={() => setSettingsOpen(true)}
            />
            <IconButton
              name={resolved === "dark" ? "sun" : "moon"}
              label={resolved === "dark" ? "Switch to light theme" : "Switch to dark theme"}
              tooltipSide="bottom"
              onClick={() =>
                update({ theme: resolved === "dark" ? "light" : "dark" })
              }
            />
          </nav>
        </div>
      </header>
      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />
    </>
  );
}
