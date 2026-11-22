"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { isValidChapter, subjectById, type ExamMode } from "./syllabus";

export type Theme = "system" | "light" | "dark";
export type { ExamMode };

export type Settings = {
  theme: Theme;
  examMode: ExamMode;
  /** Global show/hide for answer keys and notes in the list view. */
  showAnswers: boolean;
  /** Show the thin line of tags in the viewer. */
  viewerTags: boolean;
  /** Show the tag-editing panel in the viewer (off by default). */
  viewerEdit: boolean;
};

export const DEFAULT_SETTINGS: Settings = {
  theme: "system",
  examMode: "jee",
  showAnswers: false,
  viewerTags: true,
  viewerEdit: false,
};

const SETTINGS_KEY = "mb.settings";

export function readSettings(): Settings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<Settings>;
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      examMode: parsed.examMode === "neet" ? "neet" : "jee",
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

/** Runs before paint to avoid a theme flash. */
export const THEME_SCRIPT = `(function(){try{var s=JSON.parse(localStorage.getItem("mb.settings")||"{}");var t=s.theme||"system";var d=t==="dark"||(t==="system"&&window.matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.dataset.theme=d?"dark":"light";}catch(e){document.documentElement.dataset.theme="light";}})();`;

type SettingsContextValue = {
  settings: Settings;
  resolved: "light" | "dark";
  update: (patch: Partial<Settings>) => void;
};

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  // Start from defaults so server and client markup match; load after mount.
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [systemDark, setSystemDark] = useState(false);

  useEffect(() => {
    setSettings(readSettings());
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    setSystemDark(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const resolved: "light" | "dark" =
    settings.theme === "system"
      ? systemDark
        ? "dark"
        : "light"
      : settings.theme;

  useEffect(() => {
    document.documentElement.dataset.theme = resolved;
  }, [resolved]);

  const update = useCallback((patch: Partial<Settings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      try {
        window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
      } catch {
        // Storage unavailable; keep in-memory settings.
      }
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({ settings, resolved, update }),
    [settings, resolved, update],
  );

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used inside SettingsProvider");
  return ctx;
}

/* ---- Capture defaults: subject, chapter and source persist between uploads ---- */

export type CaptureDefaults = {
  subjectId: string;
  chapterId: string;
  sourceId: string | null;
};

const CAPTURE_KEY = "mb.captureDefaults";

export function readCaptureDefaults(): CaptureDefaults {
  const fallback: CaptureDefaults = {
    subjectId: "phy",
    chapterId: "phy-units",
    sourceId: null,
  };
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(CAPTURE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<CaptureDefaults>;
    const subjectId =
      parsed.subjectId && subjectById(parsed.subjectId)
        ? parsed.subjectId
        : fallback.subjectId;
    const chapterId =
      parsed.chapterId && isValidChapter(subjectId, parsed.chapterId)
        ? parsed.chapterId
        : (subjectById(subjectId)?.chapters[0]?.id ?? fallback.chapterId);
    return { subjectId, chapterId, sourceId: parsed.sourceId ?? null };
  } catch {
    return fallback;
  }
}

export function writeCaptureDefaults(d: CaptureDefaults): void {
  try {
    window.localStorage.setItem(CAPTURE_KEY, JSON.stringify(d));
  } catch {
    // Ignore.
  }
}
