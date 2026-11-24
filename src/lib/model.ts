export type Question = {
  id: string;
  createdAt: number;
  updatedAt: number;
  syncedAt: number | null;
  subjectId: string;
  chapterId: string;
  mistakeId: string | null;
  sourceId: string | null;
  answerKey: string;
  note: string;
  revisionCount: number;
  /** Local day key (YYYY-MM-DD) of the last counted revision. */
  lastRevisionDay: string | null;
  stashed: boolean;
  driveFileId: string | null;
  isDeleted: boolean;
};

export type Source = {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  syncedAt: number | null;
  isDeleted: boolean;
};

export type MistakeTone = "red" | "orange" | "yellow";

export type MistakeType = {
  id: string;
  label: string;
  tone: MistakeTone;
};

export const MISTAKE_TYPES: MistakeType[] = [
  { id: "silly", label: "Silly mistake", tone: "yellow" },
  { id: "concept", label: "Didn't know the concept", tone: "red" },
  { id: "calc", label: "Calculation error", tone: "yellow" },
  { id: "misread", label: "Didn't read the question properly", tone: "yellow" },
  { id: "revision", label: "Lack of revision", tone: "orange" },
];

export function mistakeById(id: string | null): MistakeType | undefined {
  if (!id) return undefined;
  return MISTAKE_TYPES.find((m) => m.id === id);
}

export type SortKey = "least" | "new" | "old" | "most";

export const SORTS: { id: SortKey; label: string }[] = [
  { id: "least", label: "Least revised" },
  { id: "new", label: "Newest" },
  { id: "old", label: "Oldest" },
  { id: "most", label: "Most revised" },
];

export type StashMode = "active" | "stashed" | "all";

export function sortQuestions(list: Question[], sort: SortKey): Question[] {
  const arr = [...list];
  switch (sort) {
    case "least":
      arr.sort(
        (a, b) => a.revisionCount - b.revisionCount || b.createdAt - a.createdAt,
      );
      break;
    case "new":
      arr.sort((a, b) => b.createdAt - a.createdAt);
      break;
    case "old":
      arr.sort((a, b) => a.createdAt - b.createdAt);
      break;
    case "most":
      arr.sort(
        (a, b) => b.revisionCount - a.revisionCount || b.createdAt - a.createdAt,
      );
      break;
  }
  return arr;
}

/** Local calendar day, not UTC — the revision rule is per local day. */
export function todayKey(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

export function newId(): string {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
  } catch {
    // Non-secure context or unsupported
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export const VIEWER_ORDER_KEY = "mb.viewerOrder";
