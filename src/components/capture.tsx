"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useObjectUrl } from "@/lib/hooks";
import { useLibrary } from "@/lib/library";
import { newId } from "@/lib/model";
import {
  readCaptureDefaults,
  writeCaptureDefaults,
  type CaptureDefaults,
} from "@/lib/settings";
import { chapterById } from "@/lib/syllabus";
import { useToast } from "@/lib/toast";
import { MistakeField, SourceField, SubjectChapterFields } from "./fields";
import { Button, Icon, IconButton, Kbd, Modal } from "./ui";

type Draft = { key: string; blob: Blob | null };

const CaptureContext = createContext<{
  openModal: () => void;
  openPicker: () => void;
  openFileDialog: () => void;
} | null>(null);

export function useCapture() {
  const ctx = useContext(CaptureContext);
  if (!ctx) throw new Error("useCapture must be used inside CaptureProvider");
  return ctx;
}

function isImageFile(file: File): boolean {
  if (file.type && file.type.startsWith("image/")) return true;
  const ext = file.name.split(".").pop()?.toLowerCase();
  return ext
    ? ["png", "jpg", "jpeg", "webp", "gif", "bmp", "avif"].includes(ext)
    : false;
}

function extractImageFiles(data: DataTransfer | null): File[] {
  if (!data) return [];
  const out: File[] = [];
  if (data.files && data.files.length > 0) {
    for (const f of Array.from(data.files)) {
      if (f && isImageFile(f)) out.push(f);
    }
    if (out.length > 0) return out;
  }
  if (data.items) {
    for (const item of Array.from(data.items)) {
      if (item.kind === "file") {
        const f = item.getAsFile();
        if (f && isImageFile(f)) out.push(f);
      }
    }
  }
  return out;
}

function imageFiles(list: Iterable<File | null>): File[] {
  return Array.from(list).filter(
    (f): f is File => !!f && isImageFile(f),
  );
}

export function CaptureProvider({ children }: { children: ReactNode }) {
  const { addQuestion, sources } = useLibrary();
  const { push } = useToast();
  const [defaults, setDefaults] = useState<CaptureDefaults>({
    subjectId: "phy",
    chapterId: "phy-units",
    sourceId: null,
  });
  const [queue, setQueue] = useState<Draft[]>([]);
  const [dragging, setDragging] = useState(false);
  const shiftHeld = useRef(false);
  const dragDepth = useRef(0);
  const pickerRef = useRef<HTMLInputElement>(null);
  const defaultsRef = useRef(defaults);
  defaultsRef.current = defaults;
  const sourcesRef = useRef(sources);
  sourcesRef.current = sources;

  useEffect(() => {
    setDefaults(readCaptureDefaults());
  }, []);

  const enqueue = useCallback((files: File[]) => {
    if (files.length === 0) return;
    setQueue((prev) => {
      if (prev.length > 0 && prev[0].blob === null) {
        const [first, ...rest] = prev;
        const attachedFirst: Draft = { ...first, blob: files[0] };
        const additional = files.slice(1).map((f) => ({ key: newId(), blob: f }));
        return [attachedFirst, ...rest, ...additional];
      }
      return [
        ...prev,
        ...files.map((f) => ({ key: newId(), blob: f })),
      ];
    });
  }, []);

  const replaceCurrentBlob = useCallback((file: File) => {
    setQueue((prev) => {
      if (prev.length === 0) return [{ key: newId(), blob: file }];
      const [first, ...rest] = prev;
      return [{ ...first, blob: file }, ...rest];
    });
  }, []);

  const removeCurrentBlob = useCallback(() => {
    setQueue((prev) => {
      if (prev.length === 0) return prev;
      const [first, ...rest] = prev;
      return [{ ...first, blob: null }, ...rest];
    });
  }, []);

  const openModal = useCallback(() => {
    setQueue((prev) => {
      if (prev.length > 0) return prev;
      return [{ key: newId(), blob: null }];
    });
  }, []);

  const openFileDialog = useCallback(() => pickerRef.current?.click(), []);
  const openPicker = openModal;

  const saveInstant = useCallback(
    async (files: File[]) => {
      const d = defaultsRef.current;
      const sourceId =
        d.sourceId && sourcesRef.current.some((s) => s.id === d.sourceId)
          ? d.sourceId
          : null;
      let saved = 0;
      for (const f of files) {
        const q = await addQuestion({
          image: f,
          subjectId: d.subjectId,
          chapterId: d.chapterId,
          mistakeId: null,
          sourceId,
          answerKey: "",
          note: "",
        });
        if (q) saved += 1;
      }
      if (saved > 0) {
        const chapter = chapterById(d.chapterId)?.name ?? "chapter";
        push(
          saved === 1
            ? `Saved to ${chapter}`
            : `Saved ${saved} questions to ${chapter}`,
        );
      }
    },
    [addQuestion, push],
  );

  // Track Shift because ClipboardEvent doesn't expose modifier keys.
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "Shift") shiftHeld.current = true;
    };
    const up = (e: KeyboardEvent) => {
      if (e.key === "Shift") shiftHeld.current = false;
    };
    const blur = () => {
      shiftHeld.current = false;
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
    };
  }, []);

  // Ctrl+V stages a draft (pastes queue up); Ctrl+Shift+V saves instantly.
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      if (!e.clipboardData) return;
      const files = extractImageFiles(e.clipboardData);
      if (files.length === 0) return;
      e.preventDefault();
      if (shiftHeld.current) {
        void saveInstant(files);
      } else {
        enqueue(files);
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [enqueue, saveInstant]);

  // Drag and drop anywhere.
  useEffect(() => {
    const hasFiles = (e: DragEvent) =>
      !!e.dataTransfer && Array.from(e.dataTransfer.types).includes("Files");
    const onEnter = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      dragDepth.current += 1;
      setDragging(true);
    };
    const onOver = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
    };
    const onLeave = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      dragDepth.current = Math.max(0, dragDepth.current - 1);
      if (dragDepth.current === 0) setDragging(false);
    };
    const onDrop = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      dragDepth.current = 0;
      setDragging(false);
      enqueue(extractImageFiles(e.dataTransfer));
    };
    window.addEventListener("dragenter", onEnter);
    window.addEventListener("dragover", onOver);
    window.addEventListener("dragleave", onLeave);
    window.addEventListener("drop", onDrop);
    return () => {
      window.removeEventListener("dragenter", onEnter);
      window.removeEventListener("dragover", onOver);
      window.removeEventListener("dragleave", onLeave);
      window.removeEventListener("drop", onDrop);
    };
  }, [enqueue]);

  const saveDraft = useCallback(
    async (values: {
      subjectId: string;
      chapterId: string;
      sourceId: string | null;
      mistakeId: string | null;
      answerKey: string;
      note: string;
    }) => {
      const current = queue[0];
      if (!current || !current.blob) return;
      const q = await addQuestion({ image: current.blob, ...values });
      if (!q) return;
      const next: CaptureDefaults = {
        subjectId: values.subjectId,
        chapterId: values.chapterId,
        sourceId: values.sourceId,
      };
      setDefaults(next);
      writeCaptureDefaults(next);
      setQueue((prev) => prev.slice(1));
      const remaining = queue.length - 1;
      push(remaining > 0 ? `Saved · ${remaining} more in queue` : "Saved");
    },
    [queue, addQuestion, push],
  );

  const discardDraft = useCallback(() => {
    setQueue((prev) => prev.slice(1));
  }, []);

  const value = useMemo(
    () => ({ openModal, openPicker: openModal, openFileDialog }),
    [openModal, openFileDialog],
  );
  const current = queue[0];

  return (
    <CaptureContext.Provider value={value}>
      {children}
      <input
        ref={pickerRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          enqueue(imageFiles(e.target.files ?? []));
          e.target.value = "";
        }}
      />
      {dragging && (
        <div className="drag-overlay-backdrop pointer-events-none fixed inset-0 z-[60] flex items-center justify-center border-2 border-dashed border-line bg-bg/85">
          <div className="drag-overlay-card flex flex-col items-center gap-2 text-muted">
            <Icon name="image" size={28} />
            <p className="text-[16px] font-medium text-fg">
              Drop images to add questions
            </p>
            <p className="text-[13px]">
              Each image becomes one draft with the current labels
            </p>
          </div>
        </div>
      )}
      {current && (
        <DraftModal
          key={current.key}
          blob={current.blob}
          defaults={defaults}
          remaining={queue.length - 1}
          onSave={saveDraft}
          onDiscard={discardDraft}
          onAttach={enqueue}
          onReplaceBlob={replaceCurrentBlob}
          onRemoveBlob={removeCurrentBlob}
          openFileDialog={openFileDialog}
        />
      )}
    </CaptureContext.Provider>
  );
}

function DraftModal({
  blob,
  defaults,
  remaining,
  onSave,
  onDiscard,
  onAttach,
  onReplaceBlob,
  onRemoveBlob,
  openFileDialog,
}: {
  blob: Blob | null;
  defaults: CaptureDefaults;
  remaining: number;
  onSave: (values: {
    subjectId: string;
    chapterId: string;
    sourceId: string | null;
    mistakeId: string | null;
    answerKey: string;
    note: string;
  }) => Promise<void>;
  onDiscard: () => void;
  onAttach: (files: File[]) => void;
  onReplaceBlob: (file: File) => void;
  onRemoveBlob: () => void;
  openFileDialog: () => void;
}) {
  const url = useObjectUrl(blob ?? undefined);
  const { sources } = useLibrary();
  const { push } = useToast();
  const [subjectId, setSubjectId] = useState(defaults.subjectId);
  const [chapterId, setChapterId] = useState(defaults.chapterId);
  const [sourceId, setSourceId] = useState<string | null>(
    defaults.sourceId && sources.some((s) => s.id === defaults.sourceId)
      ? defaults.sourceId
      : null,
  );
  // Mistake type, note and answer key reset for every question.
  const [mistakeId, setMistakeId] = useState<string | null>(null);
  const [answerKey, setAnswerKey] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const replaceRef = useRef<HTMLInputElement>(null);

  const submit = async () => {
    if (saving) return;
    if (!blob) {
      push("Upload, paste, or drop a question image first");
      return;
    }
    setSaving(true);
    await onSave({ subjectId, chapterId, sourceId, mistakeId, answerKey, note });
    setSaving(false);
  };

  return (
    <Modal open onClose={onDiscard} label="Add question" className="max-w-[960px]">
      <div
        onKeyDown={(e) => {
          if (e.key !== "Enter") return;
          const target = e.target as HTMLElement;
          const inTextarea = target.tagName === "TEXTAREA";
          if (inTextarea && !(e.ctrlKey || e.metaKey)) return;
          if (target.tagName === "BUTTON") return;
          e.preventDefault();
          void submit();
        }}
      >
        <input
          ref={replaceRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const files = imageFiles(e.target.files ?? []);
            if (files.length > 0) {
              onReplaceBlob(files[0]);
              if (files.length > 1) {
                onAttach(files.slice(1));
              }
            }
            e.target.value = "";
          }}
        />
        <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
          <div className="flex items-center gap-2">
            <h2 className="text-[16px] font-semibold">Add question</h2>
            {remaining > 0 && (
              <span className="badge badge-neutral tnum">
                {remaining} more queued
              </span>
            )}
          </div>
          <IconButton name="x" label="Discard this draft" onClick={onDiscard} />
        </div>

        {/* Two column layout: Left = image upload / preview, Right = question metadata editing */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 p-5">
          {/* Left Column: Image upload / preview */}
          <div className="flex flex-col min-h-[300px] md:min-h-[390px]">
            {url ? (
              <div
                className="group relative frame flex flex-1 w-full items-center justify-center overflow-hidden rounded-[8px] border border-line bg-bg min-h-[280px] max-h-[52vh]"
                onDragOver={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  const files = extractImageFiles(e.dataTransfer);
                  if (files.length > 0) {
                    onReplaceBlob(files[0]);
                    if (files.length > 1) {
                      onAttach(files.slice(1));
                    }
                  }
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={url}
                  alt="Pasted question"
                  className="max-h-[52vh] w-auto max-w-full object-contain p-2"
                />
                <div className="absolute right-2.5 top-2.5 flex items-center gap-1.5 opacity-90 transition-opacity hover:opacity-100">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => replaceRef.current?.click()}
                    className="bg-surface/90 text-xs shadow-sm backdrop-blur-sm"
                  >
                    <Icon name="upload" size={13} />
                    Change image
                  </Button>
                  <IconButton
                    name="trash"
                    label="Remove image"
                    onClick={onRemoveBlob}
                    className="bg-surface/90 shadow-sm backdrop-blur-sm"
                  />
                </div>
              </div>
            ) : (
              <div
                role="button"
                tabIndex={0}
                aria-label="Upload question image"
                onClick={openFileDialog}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    openFileDialog();
                  }
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsDragOver(true);
                }}
                onDragEnter={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsDragOver(true);
                }}
                onDragLeave={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsDragOver(false);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsDragOver(false);
                  const files = extractImageFiles(e.dataTransfer);
                  if (files.length > 0) onAttach(files);
                }}
                className={`group relative flex flex-1 w-full cursor-pointer flex-col items-center justify-center rounded-[8px] border-2 border-dashed p-6 text-center transition-all min-h-[280px] ${
                  isDragOver
                    ? "border-fg bg-soft/60"
                    : "border-line hover:border-fg/40 hover:bg-soft/30 focus-visible:border-fg focus-visible:outline-none"
                }`}
              >
                <div className="mb-3.5 flex h-12 w-12 items-center justify-center rounded-full bg-soft text-fg transition-transform group-hover:scale-105">
                  <Icon name="upload" size={22} />
                </div>
                <p className="text-[14px] font-medium text-fg">
                  Drop question image here, or{" "}
                  <span className="text-fg underline underline-offset-2">browse files</span>
                </p>
                <div className="mt-3 flex flex-wrap items-center justify-center gap-2 text-[12px] text-muted">
                  <span className="inline-flex items-center gap-1">
                    <Kbd>Ctrl</Kbd>+<Kbd>V</Kbd> to paste screenshot
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>Drag & drop</span>
                  <span aria-hidden="true">·</span>
                  <span>PNG, JPG, WebP</span>
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Question data editing */}
          <div className="flex flex-col justify-between space-y-3.5">
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <SubjectChapterFields
                  subjectId={subjectId}
                  chapterId={chapterId}
                  onChange={(s, c) => {
                    setSubjectId(s);
                    setChapterId(c);
                  }}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <SourceField value={sourceId} onChange={setSourceId} />
                <MistakeField value={mistakeId} onChange={setMistakeId} />
              </div>
              <label className="block min-w-0">
                <span className="mb-1 block text-[13px] font-medium text-muted">
                  Answer key
                </span>
                <input
                  className="input tnum w-full"
                  autoFocus={!!blob}
                  value={answerKey}
                  placeholder="Final answer only — option or number"
                  onChange={(e) => setAnswerKey(e.target.value)}
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-[13px] font-medium text-muted">
                  Note
                </span>
                <textarea
                  className="input w-full resize-none"
                  rows={3}
                  value={note}
                  placeholder="Why did you get it wrong? Plain text."
                  onChange={(e) => setNote(e.target.value)}
                />
              </label>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-line px-5 py-3.5">
          <p className="hidden items-center gap-1.5 text-[13px] text-muted sm:flex">
            <Kbd>Enter</Kbd> saves
            <span aria-hidden="true">·</span>
            <Kbd>Esc</Kbd> discards
          </p>
          <div className="flex items-center gap-2 ml-auto">
            <Button variant="ghost" onClick={onDiscard}>
              Discard
            </Button>
            <Button
              variant="primary"
              onClick={() => void submit()}
              disabled={saving || !blob}
            >
              {remaining > 0 ? `Save and next (${remaining} left)` : "Save question"}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
