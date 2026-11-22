"use client";

import { useState, type ReactNode } from "react";
import { Button, ConfirmAction, IconButton, Kbd, Modal, Toggle } from "@/components/ui";
import { useLibrary } from "@/lib/library";
import { useSettings, type Theme, type ExamMode } from "@/lib/settings";
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
  const { push } = useToast();
  const [name, setName] = useState("");

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
              label: "Save instantly with the current labels",
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
          IndexedDB, on this machine. Nothing is uploaded anywhere.
        </p>
      </div>
    </Modal>
  );
}
