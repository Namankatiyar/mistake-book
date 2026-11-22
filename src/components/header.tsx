"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { SettingsModal } from "./settings-modal";
import { useSettings } from "@/lib/settings";
import { useDriveSync } from "@/lib/sync-context";
import { Icon, IconButton, Tooltip } from "./ui";

export function Header() {
  const pathname = usePathname();
  const { settings, resolved, update } = useSettings();
  const { syncProgress, authStatus } = useDriveSync();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Cloud status pill state
  let dotColor = "bg-orange-500";
  let pillLabel = "Drive disconnected";
  let pillTooltip = "Drive disconnected — click to connect";
  let isSyncing = false;

  if (mounted) {
    if (syncProgress.status === "offline") {
      dotColor = "bg-neutral-400 dark:bg-neutral-500";
      pillLabel = "Offline";
      pillTooltip = "Offline (changes saved locally)";
    } else if (!authStatus.connected || syncProgress.status === "unauthenticated") {
      dotColor = "bg-orange-500";
      pillLabel = "Drive disconnected";
      pillTooltip = "Drive disconnected — click to connect";
    } else if (syncProgress.status === "syncing") {
      dotColor = "bg-amber-500";
      isSyncing = true;
      const count =
        syncProgress.pending > 0
          ? syncProgress.pending
          : syncProgress.total > 0
            ? Math.max(0, syncProgress.total - syncProgress.processed)
            : 0;
      pillLabel = count > 0 ? `Syncing (${count})…` : "Syncing…";
      pillTooltip =
        count > 0
          ? `Syncing ${count} pending items`
          : "Syncing changes to Google Drive…";
    } else if (syncProgress.status === "error") {
      const isReauth =
        syncProgress.lastError?.toLowerCase().includes("auth") ||
        syncProgress.lastError?.toLowerCase().includes("token") ||
        syncProgress.lastError?.toLowerCase().includes("unauthorized") ||
        syncProgress.lastError?.toLowerCase().includes("login");
      dotColor = isReauth ? "bg-orange-500" : "bg-red-500";
      pillLabel = isReauth ? "Re-auth needed" : "Sync error";
      pillTooltip = isReauth
        ? "Re-auth needed — click to reconnect"
        : syncProgress.lastError || "Sync error — click to view";
    } else if (syncProgress.pending > 0) {
      dotColor = "bg-amber-500";
      isSyncing = true;
      pillLabel = `Syncing (${syncProgress.pending})…`;
      pillTooltip = `${syncProgress.pending} changes pending sync`;
    } else {
      dotColor = "bg-emerald-500";
      pillLabel = "Cloud: Synced";
      pillTooltip = "Cloud: Synced";
    }
  }

  useEffect(() => {
    if (!dropdownOpen) return;
    const handlePointerDown = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    window.addEventListener("pointerdown", handlePointerDown);
    return () => window.removeEventListener("pointerdown", handlePointerDown);
  }, [dropdownOpen]);

  useEffect(() => {
    if (!dropdownOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDropdownOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [dropdownOpen]);

  // The viewer has no chrome.
  if (pathname.startsWith("/viewer")) return null;

  return (
    <>
      <header className="border-b border-line bg-bg">
        <div className="flex h-14 w-full items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-2.5">
            <Link href="/" className="flex items-center gap-2">
              <Image
                src="/mistake-book.png"
                alt="Mistake book icon"
                width={22}
                height={22}
                priority
                className="h-[22px] w-[22px] rounded-[4px] object-contain"
              />
              <span className="text-[16px] font-semibold text-fg">Mistake book</span>
            </Link>

            {/* Exam Mode Dropdown */}
            <div className="relative" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => setDropdownOpen((prev) => !prev)}
                className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface/80 px-2.5 py-0.5 text-[12px] font-medium text-muted hover:border-fg/20 hover:bg-soft hover:text-fg transition-colors select-none cursor-pointer"
                aria-haspopup="listbox"
                aria-expanded={dropdownOpen}
                aria-label="Switch exam mode"
              >
                <span>{settings.examMode === "neet" ? "NEET" : "JEE Mains"}</span>
                <Icon
                  name="chevron-down"
                  size={12}
                  className={`text-muted transition-transform duration-150 ${dropdownOpen ? "rotate-180 text-fg" : ""}`}
                />
              </button>

              {dropdownOpen && (
                <div
                  role="listbox"
                  className="absolute left-0 top-full z-50 mt-1.5 w-48 rounded-[8px] border border-line bg-surface p-1 shadow-md animate-in fade-in zoom-in-95 duration-100"
                >
                  <button
                    type="button"
                    role="option"
                    aria-selected={settings.examMode === "jee"}
                    onClick={() => {
                      update({ examMode: "jee" });
                      setDropdownOpen(false);
                    }}
                    className={`flex w-full items-center justify-between rounded-[6px] px-2.5 py-1.5 text-left text-[13px] transition-colors ${
                      settings.examMode === "jee"
                        ? "bg-soft font-medium text-fg"
                        : "text-muted hover:bg-soft/70 hover:text-fg"
                    }`}
                  >
                    <div>
                      <div className="font-medium text-fg">JEE Mains</div>
                      <div className="text-[11px] text-muted">Physics, Chem, Math</div>
                    </div>
                    {settings.examMode === "jee" && (
                      <Icon name="check" size={13} className="text-fg shrink-0" />
                    )}
                  </button>

                  <button
                    type="button"
                    role="option"
                    aria-selected={settings.examMode === "neet"}
                    onClick={() => {
                      update({ examMode: "neet" });
                      setDropdownOpen(false);
                    }}
                    className={`flex w-full items-center justify-between rounded-[6px] px-2.5 py-1.5 text-left text-[13px] transition-colors mt-0.5 ${
                      settings.examMode === "neet"
                        ? "bg-soft font-medium text-fg"
                        : "text-muted hover:bg-soft/70 hover:text-fg"
                    }`}
                  >
                    <div>
                      <div className="font-medium text-fg">NEET</div>
                      <div className="text-[11px] text-muted">Physics, Chem, Biology</div>
                    </div>
                    {settings.examMode === "neet" && (
                      <Icon name="check" size={13} className="text-fg shrink-0" />
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>

          <nav className="flex items-center gap-2">
            <Tooltip content={pillTooltip} side="bottom" asChild>
              <button
                type="button"
                onClick={() => setSettingsOpen(true)}
                className="inline-flex h-7 items-center gap-1.5 rounded-full border border-line bg-surface/80 px-2 sm:px-2.5 text-[12px] font-medium text-muted hover:border-fg/20 hover:bg-soft hover:text-fg transition-colors select-none cursor-pointer"
                aria-label={pillTooltip}
              >
                <span className="relative flex h-2 w-2 shrink-0 items-center justify-center">
                  {isSyncing && (
                    <span
                      className={`absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping ${dotColor}`}
                    />
                  )}
                  <span
                    className={`relative inline-flex h-2 w-2 rounded-full ${dotColor}`}
                  />
                </span>
                <span className="hidden sm:inline">{pillLabel}</span>
              </button>
            </Tooltip>
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
