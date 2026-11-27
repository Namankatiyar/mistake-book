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
import { usePathname } from "next/navigation";
import { useObjectUrl } from "@/lib/hooks";
import { hasActiveQuestionImageHash } from "@/lib/idb";
import {
  computeImageHash,
  isClipboardHashSeen,
  markClipboardHashSeen,
} from "@/lib/image-hash";
import { useLibrary } from "@/lib/library";
import { newId } from "@/lib/model";
import {
  readCaptureDefaults,
  useSettings,
  writeCaptureDefaults,
  type CaptureDefaults,
} from "@/lib/settings";
import {
  chapterById,
  subjectById,
  subjectOfChapter,
} from "@/lib/syllabus";
import { useDriveSync } from "@/lib/sync-context";
import { mistakeById } from "@/lib/model";
import { toast } from "sonner";
import { MistakeField, SourceField, SubjectChapterFields } from "./fields";
import { Button, Icon, IconButton, Kbd, Modal } from "./ui";

export type ActiveCaptureFilters = {
  subjectId?: string | null;
  chapterId?: string | null;
  mistakeId?: string | null;
  sourceId?: string | null;
};

export type ClipboardPermissionState =
  | "granted"
  | "prompt"
  | "denied"
  | "unsupported";

type Draft = { key: string; blob: Blob | null; imageHash?: string };

const CaptureContext = createContext<{
  openModal: () => void;
  openPicker: () => void;
  openFileDialog: () => void;
  setActiveFilters: (filters: ActiveCaptureFilters | null) => void;
  clipboardSupported: boolean;
  clipboardPermission: ClipboardPermissionState;
  permissionPromptOpen: boolean;
  dismissPermissionPrompt: () => void;
  requestClipboardPermission: () => Promise<"granted" | "denied" | "unsupported">;
} | null>(null);

export function useCapture() {
  const ctx = useContext(CaptureContext);
  if (!ctx) throw new Error("useCapture must be used inside CaptureProvider");
  return ctx;
}

export function useRegisterActiveFilters(filters: ActiveCaptureFilters | null) {
  const { setActiveFilters } = useCapture();
  useEffect(() => {
    setActiveFilters(filters);
    return () => {
      setActiveFilters(null);
    };
  }, [filters, setActiveFilters]);
}

function getSessionFilters(): ActiveCaptureFilters | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem("mb.listState");
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const chapterId = parsed.chapterId || null;
    const subjectId =
      parsed.subjectId || (chapterId ? subjectOfChapter(chapterId)?.id ?? null : null);
    const mistakeId =
      parsed.mistake && parsed.mistake !== "all" && parsed.mistake !== "none"
        ? parsed.mistake
        : null;
    const sourceId =
      parsed.source && parsed.source !== "all" && parsed.source !== "none"
        ? parsed.source
        : null;
    return { subjectId, chapterId, mistakeId, sourceId };
  } catch {
    return null;
  }
}

const CLIPBOARD_GRANTED_KEY = "mb.clipboard_permission_granted";
const CLIPBOARD_DISMISSED_KEY = "mb.clipboard_permission_dismissed";
const PREFERRED_IMAGE_TYPES = ["image/png", "image/webp", "image/jpeg"] as const;

function pickBestImageMime(types: readonly string[]): string | null {
  for (const preferred of PREFERRED_IMAGE_TYPES) {
    if (types.includes(preferred)) return preferred;
  }
  return types.find((t) => t.startsWith("image/")) ?? null;
}

async function extractImagesFromClipboardItems(
  items: ClipboardItems,
): Promise<File[]> {
  const files: File[] = [];
  for (const item of items) {
    const type = pickBestImageMime(item.types);
    if (!type) continue;
    try {
      const blob = await item.getType(type);
      if (blob.size === 0) continue;
      const rawExt = type.split("/")[1]?.split("+")[0] || "png";
      const ext = rawExt === "jpeg" ? "jpg" : rawExt;
      files.push(new File([blob], `screenshot.${ext}`, { type }));
    } catch {
      // Skip unreadable clipboard image item
    }
  }
  return files;
}

async function extractClipboardFiles(): Promise<File[]> {
  if (typeof navigator === "undefined" || !navigator.clipboard?.read) return [];
  try {
    const items = await navigator.clipboard.read();
    return await extractImagesFromClipboardItems(items);
  } catch {
    return [];
  }
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
  const pathname = usePathname();
  const { addQuestion, sources, ready } = useLibrary();
  const { settings, update: updateSettings } = useSettings();
  const { authChecked, signInModalOpen } = useDriveSync();
  const [defaults, setDefaults] = useState<CaptureDefaults>({
    subjectId: "phy",
    chapterId: "phy-units",
    sourceId: null,
  });
  const [queue, setQueue] = useState<Draft[]>([]);
  const [dragging, setDragging] = useState(false);
  const [clipboardSupported, setClipboardSupported] = useState(false);
  const [clipboardPermission, setClipboardPermission] =
    useState<ClipboardPermissionState>("unsupported");
  const [permissionChecked, setPermissionChecked] = useState(false);
  const [permissionPromptOpen, setPermissionPromptOpen] = useState(false);

  const shiftHeld = useRef(false);
  const dragDepth = useRef(0);
  const pickerRef = useRef<HTMLInputElement>(null);
  const defaultsRef = useRef(defaults);
  defaultsRef.current = defaults;
  const sourcesRef = useRef(sources);
  sourcesRef.current = sources;
  const queueRef = useRef<Draft[]>(queue);
  queueRef.current = queue;
  const activeFiltersRef = useRef<ActiveCaptureFilters | null>(null);
  const lastInstantSaveTime = useRef(0);

  const pathnameRef = useRef(pathname);
  pathnameRef.current = pathname;
  const readyRef = useRef(ready);
  readyRef.current = ready;
  const autoCaptureRef = useRef(settings.autoClipboardCapture);
  autoCaptureRef.current = settings.autoClipboardCapture;
  const draggingRef = useRef(dragging);
  draggingRef.current = dragging;
  const clipboardSupportedRef = useRef(clipboardSupported);
  clipboardSupportedRef.current = clipboardSupported;
  const clipboardPermissionRef = useRef(clipboardPermission);
  clipboardPermissionRef.current = clipboardPermission;
  const permissionCheckedRef = useRef(permissionChecked);
  permissionCheckedRef.current = permissionChecked;
  const permissionPromptOpenRef = useRef(permissionPromptOpen);
  permissionPromptOpenRef.current = permissionPromptOpen;
  const authCheckedRef = useRef(authChecked);
  authCheckedRef.current = authChecked;
  const signInModalOpenRef = useRef(signInModalOpen);
  signInModalOpenRef.current = signInModalOpen;

  const checkTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isCheckingRef = useRef(false);
  const lastCheckAtRef = useRef(0);
  const didMountCheckRef = useRef(false);
  const blockedByAuthRef = useRef(false);
  const mountGraceUntilRef = useRef(0);

  const setActiveFilters = useCallback((filters: ActiveCaptureFilters | null) => {
    activeFiltersRef.current = filters;
  }, []);

  useEffect(() => {
    setDefaults(readCaptureDefaults());
    mountGraceUntilRef.current = Date.now() + 350;
  }, []);

  const markBlobSeen = useCallback((blob: Blob) => {
    void computeImageHash(blob)
      .then((hash) => {
        markClipboardHashSeen(hash);
        setQueue((prev) =>
          prev.map((d) =>
            d.blob === blob && !d.imageHash ? { ...d, imageHash: hash } : d,
          ),
        );
      })
      .catch(() => {
        // Ignore hash failures on manual capture
      });
  }, []);

  const filterNewClipboardFiles = useCallback(
    async (files: File[]): Promise<{ file: File; hash: string }[]> => {
      const results: { file: File; hash: string }[] = [];
      const batchSeen = new Set<string>();
      for (const file of files) {
        try {
          const hash = await computeImageHash(file);
          if (batchSeen.has(hash)) continue;
          if (queueRef.current.some((d) => d.imageHash === hash)) continue;
          if (isClipboardHashSeen(hash)) continue;
          if (await hasActiveQuestionImageHash(hash)) continue;
          batchSeen.add(hash);
          results.push({ file, hash });
        } catch {
          // Skip files that cannot be hashed
        }
      }
      return results;
    },
    [],
  );

  // Detect clipboard-read support and subscribe to permission changes
  useEffect(() => {
    const supported =
      typeof window !== "undefined" &&
      window.isSecureContext &&
      typeof navigator !== "undefined" &&
      typeof navigator.clipboard?.read === "function";
    setClipboardSupported(supported);

    if (!supported) {
      setClipboardPermission("unsupported");
      setPermissionChecked(true);
      return;
    }

    let cancelled = false;
    let permStatus: PermissionStatus | null = null;

    const applyFallbackPermission = () => {
      let granted = false;
      try {
        granted = window.localStorage.getItem(CLIPBOARD_GRANTED_KEY) === "true";
      } catch {
        // Ignore storage errors
      }
      if (!cancelled) {
        setClipboardPermission(granted ? "granted" : "prompt");
        setPermissionChecked(true);
      }
    };

    const initPermission = async () => {
      if (typeof navigator.permissions?.query !== "function") {
        applyFallbackPermission();
        return;
      }
      try {
        permStatus = await navigator.permissions.query({
          name: "clipboard-read" as PermissionName,
        });
        if (cancelled) return;
        setClipboardPermission(permStatus.state);
        setPermissionChecked(true);
        permStatus.onchange = () => {
          if (!permStatus) return;
          setClipboardPermission(permStatus.state);
          if (permStatus.state !== "prompt") {
            setPermissionPromptOpen(false);
          }
        };
      } catch {
        applyFallbackPermission();
      }
    };

    void initPermission();

    return () => {
      cancelled = true;
      if (permStatus) {
        permStatus.onchange = null;
      }
    };
  }, []);

  const dismissPermissionPrompt = useCallback(() => {
    setPermissionPromptOpen(false);
    try {
      window.localStorage.setItem(CLIPBOARD_DISMISSED_KEY, "true");
    } catch {
      // Ignore storage errors
    }
  }, []);

  const requestClipboardPermission = useCallback(async (): Promise<
    "granted" | "denied" | "unsupported"
  > => {
    try {
      window.localStorage.removeItem(CLIPBOARD_DISMISSED_KEY);
    } catch {
      // Ignore storage errors
    }

    const supported =
      clipboardSupportedRef.current ||
      (typeof window !== "undefined" &&
        window.isSecureContext &&
        typeof navigator !== "undefined" &&
        typeof navigator.clipboard?.read === "function");

    if (!supported) {
      return "unsupported";
    }

    try {
      // Must be the first await to preserve browser user activation
      const items = await navigator.clipboard.read();
      setClipboardPermission("granted");
      try {
        window.localStorage.setItem(CLIPBOARD_GRANTED_KEY, "true");
      } catch {
        // Ignore storage errors
      }
      setPermissionPromptOpen(false);

      const files = await extractImagesFromClipboardItems(items);
      const newItems = await filterNewClipboardFiles(files);
      if (newItems.length > 0 && queueRef.current.length === 0) {
        for (const item of newItems) {
          markClipboardHashSeen(item.hash);
        }
        setQueue(
          newItems.map(({ file, hash }) => ({
            key: newId(),
            blob: file,
            imageHash: hash,
          })),
        );
      } else {
        toast.success("Always-on clipboard detection enabled");
      }
      return "granted";
    } catch (err) {
      const name =
        err instanceof DOMException
          ? err.name
          : (err as { name?: string } | null)?.name;
      setClipboardPermission("denied");
      try {
        window.localStorage.removeItem(CLIPBOARD_GRANTED_KEY);
      } catch {
        // Ignore storage errors
      }
      setPermissionPromptOpen(false);
      updateSettings({ autoClipboardCapture: false });
      if (name === "NotAllowedError" || name === "SecurityError") {
        toast.info(
          "Clipboard access was blocked. You can re-enable it in your browser site settings.",
        );
      } else {
        toast.info(
          "Clipboard access could not be enabled. You can re-enable it in your browser site settings.",
        );
      }
      return "denied";
    }
  }, [filterNewClipboardFiles, updateSettings]);

  const enqueue = useCallback(
    (files: File[]) => {
      if (files.length === 0) return;
      setQueue((prev) => {
        if (prev.length > 0 && prev[0].blob === null) {
          const [first, ...rest] = prev;
          const attachedFirst: Draft = {
            ...first,
            blob: files[0],
            imageHash: undefined,
          };
          const additional = files
            .slice(1)
            .map((f) => ({ key: newId(), blob: f }));
          return [attachedFirst, ...rest, ...additional];
        }
        return [...prev, ...files.map((f) => ({ key: newId(), blob: f }))];
      });
      for (const file of files) {
        markBlobSeen(file);
      }
    },
    [markBlobSeen],
  );

  const replaceCurrentBlob = useCallback(
    (file: File) => {
      setQueue((prev) => {
        if (prev.length === 0) return [{ key: newId(), blob: file }];
        const [first, ...rest] = prev;
        return [{ ...first, blob: file, imageHash: undefined }, ...rest];
      });
      markBlobSeen(file);
    },
    [markBlobSeen],
  );

  const removeCurrentBlob = useCallback(() => {
    setQueue((prev) => {
      if (prev.length === 0) return prev;
      const [first, ...rest] = prev;
      return [{ ...first, blob: null, imageHash: undefined }, ...rest];
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
      if (files.length === 0) return;
      const now = Date.now();
      if (now - lastInstantSaveTime.current < 500) return;
      lastInstantSaveTime.current = now;

      const active = activeFiltersRef.current ?? getSessionFilters();
      const chapterId = active?.chapterId || "";
      const subjectId =
        active?.subjectId ||
        (chapterId ? subjectOfChapter(chapterId)?.id || "" : "");
      const mistakeId = active?.mistakeId || null;
      const sourceId =
        active?.sourceId && sourcesRef.current.some((s) => s.id === active.sourceId)
          ? active.sourceId
          : null;

      let saved = 0;
      for (const f of files) {
        const hash = await computeImageHash(f).catch(() => null);
        if (hash) markClipboardHashSeen(hash);
        const q = await addQuestion({
          image: f,
          subjectId,
          chapterId,
          mistakeId,
          sourceId,
          answerKey: "",
          note: "",
        });
        if (q) saved += 1;
      }

      if (saved > 0) {
        const parts: string[] = [];
        const ch = chapterId ? chapterById(chapterId) : null;
        const sub = subjectId ? subjectById(subjectId) : null;
        if (ch) {
          parts.push(ch.name);
        } else if (sub) {
          parts.push(sub.name);
        }
        if (mistakeId) {
          const m = mistakeById(mistakeId);
          if (m) parts.push(m.label);
        }
        if (sourceId) {
          const s = sourcesRef.current.find((src) => src.id === sourceId);
          if (s) parts.push(s.name);
        }

        if (parts.length > 0) {
          const target = parts.join(" · ");
          toast(
            saved === 1
              ? `Saved to ${target}`
              : `Saved ${saved} questions to ${target}`,
          );
        } else {
          toast(
            saved === 1
              ? "Saved question (untagged)"
              : `Saved ${saved} questions (untagged)`,
          );
        }
      }
    },
    [addQuestion],
  );

  // Track modifier keys and Ctrl+Shift+V shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      shiftHeld.current = e.shiftKey;

      const isV = e.key === "v" || e.key === "V" || e.code === "KeyV";
      const isModifier = e.ctrlKey || e.metaKey;

      if (isModifier && e.shiftKey && isV) {
        const target = e.target as HTMLElement | null;
        const isEditable =
          target &&
          (target.tagName === "INPUT" ||
            target.tagName === "TEXTAREA" ||
            target.isContentEditable);

        if (!isEditable) {
          e.preventDefault();
          void (async () => {
            const files = await extractClipboardFiles();
            if (files.length > 0) {
              await saveInstant(files);
            }
          })();
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      shiftHeld.current = e.shiftKey;
    };

    const handleBlur = () => {
      shiftHeld.current = false;
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", handleBlur);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", handleBlur);
    };
  }, [saveInstant]);

  // Ctrl+V stages a draft (pastes queue up); Ctrl+Shift+V saves instantly.
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      if (!e.clipboardData) return;
      const files = extractImageFiles(e.clipboardData);
      if (files.length === 0) return;
      const isShift = shiftHeld.current || (e as unknown as KeyboardEvent).shiftKey;
      e.preventDefault();
      if (isShift) {
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

  const runClipboardCheck = useCallback(async () => {
    if (isCheckingRef.current) return;
    const now = Date.now();
    if (now - lastCheckAtRef.current < 500) return;
    if (!clipboardSupportedRef.current || !permissionCheckedRef.current) return;
    if (!readyRef.current || !autoCaptureRef.current || draggingRef.current) return;
    if (pathnameRef.current?.startsWith("/viewer")) return;
    if (
      typeof document === "undefined" ||
      document.visibilityState !== "visible" ||
      !document.hasFocus()
    ) {
      return;
    }
    if (queueRef.current.length > 0) return;
    if (document.querySelector('[role="dialog"]') !== null) return;

    const permission = clipboardPermissionRef.current;

    if (permission === "granted") {
      lastCheckAtRef.current = now;
      isCheckingRef.current = true;
      try {
        const files = await extractClipboardFiles();
        if (files.length === 0) return;
        const newItems = await filterNewClipboardFiles(files);
        if (newItems.length === 0) return;
        if (
          !autoCaptureRef.current ||
          draggingRef.current ||
          pathnameRef.current?.startsWith("/viewer") ||
          queueRef.current.length > 0 ||
          document.querySelector('[role="dialog"]') !== null
        ) {
          return;
        }
        for (const item of newItems) {
          markClipboardHashSeen(item.hash);
        }
        setQueue(
          newItems.map(({ file, hash }) => ({
            key: newId(),
            blob: file,
            imageHash: hash,
          })),
        );
      } catch {
        // Silently ignore background clipboard read failures (e.g. NotAllowedError)
      } finally {
        isCheckingRef.current = false;
        lastCheckAtRef.current = Date.now();
      }
      return;
    }

    if (permission === "prompt") {
      if (!authCheckedRef.current || signInModalOpenRef.current) {
        blockedByAuthRef.current = true;
        return;
      }
      blockedByAuthRef.current = false;
      lastCheckAtRef.current = now;
      let dismissed = false;
      try {
        dismissed =
          window.localStorage.getItem(CLIPBOARD_DISMISSED_KEY) === "true";
      } catch {
        // Ignore storage errors
      }
      if (!dismissed && !permissionPromptOpenRef.current) {
        setPermissionPromptOpen(true);
      }
    }
  }, [filterNewClipboardFiles]);

  const scheduleClipboardCheck = useCallback(
    (delayMs = 100) => {
      if (checkTimerRef.current !== null) {
        clearTimeout(checkTimerRef.current);
      }
      const remainingMountGrace = Math.max(
        0,
        mountGraceUntilRef.current - Date.now(),
      );
      const effectiveDelay = Math.max(delayMs, remainingMountGrace);
      checkTimerRef.current = setTimeout(() => {
        checkTimerRef.current = null;
        void runClipboardCheck();
      }, effectiveDelay);
    },
    [runClipboardCheck],
  );

  // Trigger clipboard check on tab focus and visibility return
  useEffect(() => {
    const onFocus = () => {
      scheduleClipboardCheck(100);
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        scheduleClipboardCheck(100);
      }
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      if (checkTimerRef.current !== null) {
        clearTimeout(checkTimerRef.current);
        checkTimerRef.current = null;
      }
    };
  }, [scheduleClipboardCheck]);

  // Run once on mount after library & permission check become ready
  useEffect(() => {
    if (!ready || !permissionChecked || didMountCheckRef.current) return;
    didMountCheckRef.current = true;
    scheduleClipboardCheck(350);
  }, [ready, permissionChecked, scheduleClipboardCheck]);

  // Retry prompt check once auth status check completes (if deferred earlier)
  useEffect(() => {
    if (!authChecked || signInModalOpen || !blockedByAuthRef.current) return;
    blockedByAuthRef.current = false;
    scheduleClipboardCheck(100);
  }, [authChecked, signInModalOpen, scheduleClipboardCheck]);

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
      const hash =
        current.imageHash ??
        (await computeImageHash(current.blob).catch(() => null));
      if (hash) markClipboardHashSeen(hash);
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
      toast(remaining > 0 ? `Saved · ${remaining} more in queue` : "Saved");
    },
    [queue, addQuestion],
  );

  const discardDraft = useCallback(() => {
    const current = queueRef.current[0];
    if (current?.blob) {
      if (current.imageHash) {
        markClipboardHashSeen(current.imageHash);
      } else {
        void computeImageHash(current.blob)
          .then((hash) => markClipboardHashSeen(hash))
          .catch(() => {});
      }
    }
    setQueue((prev) => prev.slice(1));
  }, []);

  const value = useMemo(
    () => ({
      openModal,
      openPicker: openModal,
      openFileDialog,
      setActiveFilters,
      clipboardSupported,
      clipboardPermission,
      permissionPromptOpen,
      dismissPermissionPrompt,
      requestClipboardPermission,
    }),
    [
      openModal,
      openFileDialog,
      setActiveFilters,
      clipboardSupported,
      clipboardPermission,
      permissionPromptOpen,
      dismissPermissionPrompt,
      requestClipboardPermission,
    ],
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
      toast("Upload, paste, or drop a question image first");
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
                    <Kbd>Ctrl</Kbd> + <Kbd>V</Kbd> to paste screenshot
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
