"use client";

import { useState, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { AlertCircle, RefreshCw, RotateCw } from "lucide-react";
import { Button, ConfirmAction, IconButton, Kbd, Modal, Toggle } from "@/components/ui";
import { useLibrary } from "@/lib/library";
import { useSettings, type Theme, type ExamMode } from "@/lib/settings";
import { useDriveSync } from "@/lib/sync-context";
import { useToast } from "@/lib/toast";

const THEMES: { id: Theme; label: string }[] = [
  { id: "light", label: "Light" },
  { id: "system", label: "System" },
  { id: "dark", label: "Dark" },
];

const EXAM_MODES: { id: ExamMode; label: string }[] = [
  { id: "jee", label: "JEE Mains" },
  { id: "neet", label: "NEET" },
];

function GoogleIcon({ className = "h-4 w-4 shrink-0" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
      />
    </svg>
  );
}

function formatLastSynced(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  const timeStr = date.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
  if (isToday) {
    return `Last synced today at ${timeStr}`;
  }
  return `Last synced on ${date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  })} at ${timeStr}`;
}

function getSyncStatusLabel(status: string): string {
  switch (status) {
    case "syncing":
      return "Syncing changes…";
    case "offline":
      return "Offline (changes saved locally)";
    case "error":
      return "Sync error";
    case "unauthenticated":
      return "Drive disconnected";
    case "idle":
    default:
      return "Up to date";
  }
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h3 className="mb-2 text-[14px] font-semibold text-fg">{title}</h3>
      <div className="panel divide-y divide-line">{children}</div>
    </section>
  );
}

function Row({
  title,
  desc,
  control,
}: {
  title: string;
  desc?: string;
  control: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3">
      <div className="min-w-0">
        <p className="text-[14px] font-medium">{title}</p>
        {desc && <p className="text-[13px] text-muted">{desc}</p>}
      </div>
      {control}
    </div>
  );
}

export function SettingsModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { settings, update } = useSettings();
  const { sources, questions, addSource, deleteSource } = useLibrary();
  const {
    syncProgress,
    syncNow,
    restoreFromDrive,
    authStatus,
    connectDrive,
    disconnectDrive,
  } = useDriveSync();
  const { push } = useToast();
  const [name, setName] = useState("");
  const [confirmingDisconnect, setConfirmingDisconnect] = useState(false);
  const [confirmingRestore, setConfirmingRestore] = useState(false);
  const [isSyncingAction, setIsSyncingAction] = useState(false);
  const [isRestoringAction, setIsRestoringAction] = useState(false);
  const [avatarError, setAvatarError] = useState(false);

  const handleDisconnect = async () => {
    try {
      await disconnectDrive();
      setConfirmingDisconnect(false);
      push("Google Drive disconnected");
    } catch {
      push("Failed to disconnect Google Drive");
    }
  };

  const handleSyncNow = async () => {
    try {
      setIsSyncingAction(true);
      await syncNow();
      push("Sync complete");
    } catch (err) {
      push(`Sync failed: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setIsSyncingAction(false);
    }
  };

  const handleRestore = async () => {
    try {
      setIsRestoringAction(true);
      await restoreFromDrive();
      setConfirmingRestore(false);
      push("Restore completed from Google Drive");
    } catch (err) {
      push(`Restore failed: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setIsRestoringAction(false);
    }
  };

  const usage = (id: string) =>
    questions.filter((q) => q.sourceId === id).length;

  const create = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const existed = sources.some(
      (s) => s.name.toLowerCase() === trimmed.toLowerCase(),
    );
    const source = await addSource(trimmed);
    if (source) {
      push(existed ? "That source already exists" : `Added “${source.name}”`);
      setName("");
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      label="Settings"
      className="max-h-[85vh] h-[85vh] max-w-[580px] flex flex-col overflow-hidden"
    >
      {/* Modal Header */}
      <div className="flex flex-none items-center justify-between border-b border-line px-5 py-3.5">
        <div className="flex items-center gap-2">
          <h2 className="text-[16px] font-semibold">Settings</h2>
        </div>
        <IconButton name="x" label="Close settings" onClick={onClose} />
      </div>

      {/* Modal Body - Scrollable vertical content */}
      <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-6 space-y-6">
        <Section title="Appearance">
          <Row
            title="Target exam"
            desc="Switches between Mathematics (JEE) and Biology (NEET)."
            control={
              <div
                className="inline-flex h-7 flex-none overflow-hidden rounded-[6px] border border-line"
                role="group"
                aria-label="Target exam"
              >
                {EXAM_MODES.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    className={`px-2.5 text-[13px] ${
                      settings.examMode === m.id
                        ? "bg-soft font-medium text-fg"
                        : "bg-surface text-muted hover:text-fg"
                    }`}
                    aria-pressed={settings.examMode === m.id}
                    onClick={() => update({ examMode: m.id })}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            }
          />
          <Row
            title="Theme"
            desc="Dark is easier for late-night sessions."
            control={
              <div
                className="inline-flex h-7 flex-none overflow-hidden rounded-[6px] border border-line"
                role="group"
                aria-label="Theme"
              >
                {THEMES.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    className={`px-2.5 text-[13px] ${
                      settings.theme === t.id
                        ? "bg-soft font-medium text-fg"
                        : "bg-surface text-muted hover:text-fg"
                    }`}
                    aria-pressed={settings.theme === t.id}
                    onClick={() => update({ theme: t.id })}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            }
          />
        </Section>

        <Section title="Cloud Backup & Sync">
          {!authStatus.connected ? (
            <div className="p-4 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <p className="text-[14px] font-medium text-fg">Google Drive</p>
                  <p className="text-[13px] text-muted">
                    Connect your personal Google Drive to automatically back up questions and sync across devices.
                  </p>
                </div>
                <div className="shrink-0">
                  <Button
                    variant="outline"
                    onClick={connectDrive}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 font-medium hover:border-fg/30 hover:bg-soft"
                  >
                    <GoogleIcon className="h-4 w-4" />
                    <span>Connect Google Drive</span>
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* User Account Info & Disconnect */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3">
                <div className="flex items-center gap-3 min-w-0">
                  {authStatus.user?.picture && !avatarError ? (
                    <Image
                      src={authStatus.user.picture}
                      alt={authStatus.user.name || "Google account"}
                      width={36}
                      height={36}
                      unoptimized
                      onError={() => setAvatarError(true)}
                      className="h-9 w-9 rounded-full object-cover border border-line shrink-0"
                    />
                  ) : (
                    <div className="h-9 w-9 rounded-full bg-soft border border-line flex items-center justify-center text-[13px] font-semibold text-muted shrink-0">
                      {(authStatus.user?.name || authStatus.user?.email || "U")
                        .charAt(0)
                        .toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0">
                    {authStatus.user?.name ? (
                      <p className="text-[14px] font-medium text-fg truncate">
                        {authStatus.user.name}
                      </p>
                    ) : null}
                    <p className="text-[13px] text-muted truncate">
                      {authStatus.user?.email || "Connected to Google Drive"}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                  {confirmingDisconnect ? (
                    <div className="flex items-center gap-1.5 animate-in fade-in duration-150">
                      <span className="text-[12px] font-medium text-red">
                        Disconnect?
                      </span>
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={() => void handleDisconnect()}
                      >
                        Yes
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setConfirmingDisconnect(false)}
                      >
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-muted hover:text-red hover:bg-red-fill/20 text-[13px]"
                      onClick={() => setConfirmingDisconnect(true)}
                    >
                      Disconnect
                    </Button>
                  )}
                </div>
              </div>

              {/* Sync Status & Actions */}
              <div className="space-y-3 px-4 py-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`h-2 w-2 rounded-full ${
                          syncProgress.status === "syncing"
                            ? "bg-amber-500 animate-pulse"
                            : syncProgress.status === "error"
                              ? "bg-red-500"
                              : syncProgress.status === "offline"
                                ? "bg-neutral-400"
                                : "bg-emerald-500"
                        }`}
                      />
                      <span className="text-[14px] font-medium text-fg">
                        {getSyncStatusLabel(syncProgress.status)}
                      </span>
                    </div>
                    {syncProgress.lastSyncedAt ? (
                      <p className="text-[12px] text-muted mt-0.5">
                        {formatLastSynced(syncProgress.lastSyncedAt)}
                      </p>
                    ) : null}
                  </div>

                  <div className="flex flex-wrap items-center gap-2 pt-1 sm:pt-0">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={syncProgress.status === "syncing" || isSyncingAction}
                      onClick={() => void handleSyncNow()}
                      className="inline-flex items-center gap-1.5"
                    >
                      <RefreshCw
                        className={`h-3.5 w-3.5 ${
                          syncProgress.status === "syncing" || isSyncingAction
                            ? "animate-spin text-muted"
                            : ""
                        }`}
                      />
                      <span>Sync Now</span>
                    </Button>

                    {confirmingRestore ? (
                      <div className="flex items-center gap-1.5 animate-in fade-in duration-150">
                        <span className="text-[12px] font-medium text-orange">
                          Restore all from Drive?
                        </span>
                        <Button
                          size="sm"
                          variant="warn"
                          disabled={isRestoringAction}
                          onClick={() => void handleRestore()}
                        >
                          {isRestoringAction ? "Restoring…" : "Confirm"}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={isRestoringAction}
                          onClick={() => setConfirmingRestore(false)}
                        >
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={syncProgress.status === "syncing" || isRestoringAction}
                        onClick={() => setConfirmingRestore(true)}
                        className="text-muted hover:text-fg"
                      >
                        Restore from Drive
                      </Button>
                    )}
                  </div>
                </div>

                {/* Error message */}
                {syncProgress.lastError && (
                  <div className="rounded-[6px] bg-red-fill/60 border border-red/20 px-3 py-2 text-[12px] text-red flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                    <span className="break-words">{syncProgress.lastError}</span>
                  </div>
                )}
              </div>

              {/* Progress Bar during active sync or restore */}
              {(syncProgress.status === "syncing" ||
                (syncProgress.total > 0 && syncProgress.processed < syncProgress.total)) && (
                <div className="space-y-1.5 px-4 py-3 bg-soft/40">
                  <div className="flex items-center justify-between text-[12px]">
                    <span className="font-medium text-fg flex items-center gap-1.5">
                      <RotateCw className="h-3.5 w-3.5 animate-spin text-muted" />
                      <span>
                        {isRestoringAction
                          ? "Restoring questions and images…"
                          : "Syncing changes to Google Drive…"}
                      </span>
                    </span>
                    <span className="text-muted tnum font-mono text-[11px]">
                      {syncProgress.processed} / {syncProgress.total} (
                      {syncProgress.total > 0
                        ? Math.min(
                            100,
                            Math.round(
                              (syncProgress.processed / syncProgress.total) * 100
                            )
                          )
                        : 0}
                      %)
                    </span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-soft">
                    {syncProgress.total > 0 ? (
                      <div
                        className="h-full bg-fg transition-all duration-300 ease-out rounded-full"
                        style={{
                          width: `${Math.min(
                            100,
                            Math.round(
                              (syncProgress.processed / syncProgress.total) * 100
                            )
                          )}%`,
                        }}
                      />
                    ) : (
                      <div className="h-full w-1/3 bg-fg/70 rounded-full animate-pulse" />
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </Section>

        <Section title="List">
          <Row
            title="Show answers and notes"
            desc="Hidden by default. Each question also has its own toggle."
            control={
              <Toggle
                checked={settings.showAnswers}
                onChange={(v) => update({ showAnswers: v })}
                label="Show answers and notes in the list"
              />
            }
          />
        </Section>

        <Section title="Viewer">
          <Row
            title="Show tags"
            desc="The thin line of tags above the answer box."
            control={
              <Toggle
                checked={settings.viewerTags}
                onChange={(v) => update({ viewerTags: v })}
                label="Show tags in the viewer"
              />
            }
          />
          <Row
            title="Tag editing panel"
            desc="Adds an Edit tags button to the viewer. Off by default."
            control={
              <Toggle
                checked={settings.viewerEdit}
                onChange={(v) => update({ viewerEdit: v })}
                label="Show the tag editing panel in the viewer"
              />
            }
          />
        </Section>

        <Section title="Sources">
          <div className="flex items-center gap-1.5 px-4 py-3">
            <input
              className="input"
              placeholder="New source — e.g. Allen module 4, PYQ 2023"
              aria-label="New source name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void create();
                }
              }}
            />
            <Button
              variant="primary"
              disabled={!name.trim()}
              onClick={() => void create()}
            >
              Add
            </Button>
          </div>
          {sources.length === 0 ? (
            <p className="px-4 py-3 text-[13px] text-muted">
              No sources yet. Sources are single tags you manage yourself —
              deleting one leaves its questions untagged.
            </p>
          ) : (
            sources.map((s) => {
              const count = usage(s.id);
              return (
                <div
                  key={s.id}
                  className="flex items-center justify-between gap-3 px-4 py-2.5"
                >
                  <p className="min-w-0 truncate text-[14px]">{s.name}</p>
                  <span className="ml-auto flex items-center gap-2">
                    <span className="tnum text-[13px] text-muted">
                      {count} question{count === 1 ? "" : "s"}
                    </span>
                    <ConfirmAction
                      icon="trash"
                      label={`Delete source ${s.name}`}
                      warning={
                        count > 0
                          ? `Untags ${count} question${count === 1 ? "" : "s"}`
                          : "Delete source?"
                      }
                      confirmText="Delete"
                      tone={count > 0 ? "warn" : "danger"}
                      onConfirm={() => {
                        void deleteSource(s.id);
                        push(
                          count > 0
                            ? "Source deleted — questions untagged"
                            : "Source deleted",
                        );
                      }}
                    />
                  </span>
                </div>
              );
            })
          )}
        </Section>

        <Section title="Shortcuts">
          {[
            {
              label: "Stage a draft from a pasted image",
              keys: ["Ctrl", "V"],
            },
            {
              label: "Save instantly with active filters (or untagged)",
              keys: ["Ctrl", "Shift", "V"],
            },
            { label: "Save the current draft", keys: ["Enter"] },
            { label: "Previous / next in the viewer", keys: ["←", "→"] },
            { label: "Check in the viewer", keys: ["Enter"] },
            { label: "Back to the list", keys: ["Esc"] },
          ].map((s) => (
            <div
              key={s.label}
              className="flex items-center justify-between gap-4 px-4 py-2.5"
            >
              <p className="text-[13px] text-muted">{s.label}</p>
              <span className="flex items-center gap-1">
                {s.keys.map((k) => (
                  <Kbd key={k}>{k}</Kbd>
                ))}
              </span>
            </div>
          ))}
        </Section>

        <p className="text-[13px] text-muted pt-1">
          Your questions, images and sources live in this browser&apos;s
          IndexedDB. When connected, changes automatically back up to your personal
          Google Drive under the MistakeBook folder.
        </p>

        <div className="border-t border-line pt-3 flex flex-wrap items-center justify-between gap-2 text-[12px] text-muted">
          <span>Privacy &amp; Terms</span>
          <div className="flex items-center gap-3">
            <Link
              href="/privacy"
              onClick={onClose}
              className="text-muted hover:text-fg underline underline-offset-4"
            >
              Privacy Policy
            </Link>
            <span>•</span>
            <Link
              href="/terms"
              onClick={onClose}
              className="text-muted hover:text-fg underline underline-offset-4"
            >
              Terms of Service
            </Link>
          </div>
        </div>
      </div>
    </Modal>
  );
}
