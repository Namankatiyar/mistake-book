"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { GoogleDriveIcon } from "./drive-invite-modal";
import { SettingsModal } from "./settings-modal";
import { useSettings } from "@/lib/settings";
import { useDriveSync } from "@/lib/sync-context";
import { Icon, IconButton, Tooltip } from "./ui";

export function Header() {
  const pathname = usePathname();
  const { settings, resolved, update } = useSettings();
  const { syncProgress, authStatus, openSignInModal } = useDriveSync();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isOffline = mounted && syncProgress.status === "offline";
  const isReauth =
    mounted &&
    syncProgress.status === "error" &&
    Boolean(
      syncProgress.lastError?.toLowerCase().includes("auth") ||
        syncProgress.lastError?.toLowerCase().includes("token") ||
        syncProgress.lastError?.toLowerCase().includes("unauthorized") ||
        syncProgress.lastError?.toLowerCase().includes("login")
    );

  const isDriveDisconnected =
    !isOffline &&
    (!mounted ||
      !authStatus.connected ||
      syncProgress.status === "unauthenticated" ||
      isReauth);

  // Cloud status pill state (for connected / offline / error states)
  let dotColor = "bg-emerald-500";
  let pillLabel = "Synced";
  let pillTooltip = "Synced";
  let isSyncing = false;

  if (mounted) {
    if (isOffline) {
      dotColor = "bg-neutral-400 dark:bg-neutral-500";
      pillLabel = "Offline";
      pillTooltip = "Offline (changes saved locally)";
    } else if (syncProgress.status === "syncing") {
      dotColor = "bg-amber-500";
      isSyncing = true;
      const percent =
        syncProgress.total > 0
          ? Math.min(
              100,
              Math.max(
                0,
                Math.round((syncProgress.processed / syncProgress.total) * 100)
              )
            )
          : 0;
      pillLabel = `Syncing ${percent}%`;
      pillTooltip =
        syncProgress.total > 0
          ? `Syncing changes (${percent}% — ${syncProgress.processed}/${syncProgress.total})`
          : `Syncing changes (${percent}%)`;
    } else if (syncProgress.status === "error" && !isReauth) {
      dotColor = "bg-red-500";
      pillLabel = "Sync error";
      pillTooltip = syncProgress.lastError || "Sync error — click to view";
    } else if (syncProgress.pending > 0) {
      dotColor = "bg-amber-500";
      isSyncing = true;
      const percent =
        syncProgress.total > 0
          ? Math.min(
              100,
              Math.max(
                0,
                Math.round((syncProgress.processed / syncProgress.total) * 100)
              )
            )
          : 0;
      pillLabel = `Syncing ${percent}%`;
      pillTooltip = `${syncProgress.pending} changes pending sync (${percent}%)`;
    } else {
      dotColor = "bg-emerald-500";
      pillLabel = "Synced";
      pillTooltip = "Synced";
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
        <div className="flex h-14 w-full items-center justify-between px-3 sm:px-6 gap-2">
          <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
            {/* App logo: Hidden on narrow screens to keep only the exam mode switcher on the left */}
            <Link
              href="/"
              className="hidden sm:flex items-center gap-2 shrink-0"
              aria-label="Mistake book"
            >
              <Image
                src="/mistake-book.png"
                alt="Mistake book icon"
                width={22}
                height={22}
                priority
                className="h-[22px] w-[22px] rounded-[4px] object-contain shrink-0"
              />
              <span className="text-[16px] font-semibold text-fg">Mistake book</span>
            </Link>

            {/* Exam Mode Dropdown */}
            <div className="relative shrink-0" ref={dropdownRef}>
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

          <nav className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {isDriveDisconnected ? (
              <Tooltip
                content="Connect Google Drive to back up and sync your questions"
                side="bottom"
                asChild
              >
                <button
                  type="button"
                  onClick={openSignInModal}
                  className="inline-flex h-7 items-center gap-1.5 rounded-full bg-fg text-bg px-2.5 sm:px-3 text-[12px] font-medium hover:opacity-90 active:scale-[0.98] transition-all select-none cursor-pointer shadow-xs whitespace-nowrap shrink-0"
                  aria-label="Connect Google Drive"
                >
                  <GoogleDriveIcon className="h-3.5 w-3.5 shrink-0" />
                  <span>Connect Google Drive</span>
                </button>
              </Tooltip>
            ) : (
              <Tooltip content={pillTooltip} side="bottom" asChild>
                <button
                  type="button"
                  onClick={() => setSettingsOpen(true)}
                  className="inline-flex h-7 items-center gap-1.5 rounded-full border border-line bg-surface/80 px-2 sm:px-2.5 text-[12px] font-medium text-muted hover:border-fg/20 hover:bg-soft hover:text-fg transition-colors select-none cursor-pointer whitespace-nowrap shrink-0"
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
                  <span className={isSyncing ? "tnum" : ""}>{pillLabel}</span>
                </button>
              </Tooltip>
            )}
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
