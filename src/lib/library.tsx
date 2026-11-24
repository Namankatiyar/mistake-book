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
import {
  enqueueSyncItem,
  loadAll,
  loadQuestionsPaginated,
  putQuestion,
  putQuestions,
  putQuestionWithImage,
  putSource,
  removeQuestion,
  removeSource,
} from "./idb";
import { newId, todayKey, type Question, type Source } from "./model";
import { cacheImageBlob, evictImage } from "./image-cache";
import { useToast } from "./toast";

export type NewQuestion = {
  image: Blob;
  subjectId: string;
  chapterId: string;
  mistakeId: string | null;
  sourceId: string | null;
  answerKey: string;
  note: string;
};

export type LibraryContextValue = {
  ready: boolean;
  questions: Question[];
  allQuestions: Question[];
  page: number;
  pageSize: number;
  totalPages: number;
  totalQuestions: number;
  setPage: (page: number | ((prev: number) => number)) => void;
  nextPage: () => void;
  prevPage: () => void;
  sources: Source[];
  addQuestion: (input: NewQuestion) => Promise<Question | null>;
  updateQuestion: (id: string, patch: Partial<Question>) => Promise<void>;
  deleteQuestion: (id: string) => Promise<void>;
  stageDelete: (id: string) => void;
  cancelDelete: (id: string) => void;
  commitDelete: (id: string) => Promise<void>;
  resetRevisions: (id: string) => Promise<void>;
  /** Counts one revision, at most once per local day. */
  countRevision: (id: string) => Promise<void>;
  addSource: (name: string) => Promise<Source | null>;
  deleteSource: (id: string) => Promise<void>;
};

export const LibraryContext = createContext<LibraryContextValue | null>(null);

export function LibraryProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [sources, setSources] = useState<Source[]>([]);
  const [pendingDeleteIds, setPendingDeleteIds] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const pageSize = 30;

  const questionsRef = useRef<Question[]>(questions);
  questionsRef.current = questions;
  const pendingDeleteIdsRef = useRef<Set<string>>(pendingDeleteIds);
  pendingDeleteIdsRef.current = pendingDeleteIds;
  const sourcesRef = useRef<Source[]>(sources);
  sourcesRef.current = sources;
  const { push } = useToast();

  useEffect(() => {
    const handleBeforeUnload = () => {
      for (const id of pendingDeleteIdsRef.current) {
        void removeQuestion(id);
        void enqueueSyncItem("question", id, "delete");
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      for (const id of pendingDeleteIdsRef.current) {
        void removeQuestion(id);
        void enqueueSyncItem("question", id, "delete");
      }
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const reload = async () => {
      try {
        // Fast initial fetch: load first 30 questions and sources to get ready immediately
        const initialData = await loadQuestionsPaginated({ page: 1, pageSize: 30 });
        if (cancelled) return;
        setQuestions(initialData.questions);
        setSources(initialData.sources);
        setReady(true);

        // If there are more questions, load remaining questions in background so allQuestions has complete dataset
        if (initialData.total > 30) {
          const fullData = await loadAll();
          if (cancelled) return;
          setQuestions(fullData.questions);
        }
      } catch {
        if (cancelled) return;
        setReady(true);
        push("Couldn't open local storage in this browser");
      }
    };

    void reload();

    const handleReload = () => {
      void reload();
    };
    window.addEventListener("mb:library-reload", handleReload);

    return () => {
      cancelled = true;
      window.removeEventListener("mb:library-reload", handleReload);
    };
  }, [push]);

  const addQuestion = useCallback(
    async (input: NewQuestion): Promise<Question | null> => {
      const now = Date.now();
      const q: Question = {
        id: newId(),
        createdAt: now,
        updatedAt: now,
        syncedAt: null,
        subjectId: input.subjectId,
        chapterId: input.chapterId,
        mistakeId: input.mistakeId,
        sourceId: input.sourceId,
        answerKey: input.answerKey.trim(),
        note: input.note.trim(),
        revisionCount: 0,
        lastRevisionDay: null,
        stashed: false,
        driveFileId: null,
        isDeleted: false,
      };
      try {
        await putQuestionWithImage(q, input.image);
        await enqueueSyncItem("question", q.id, "upsert");
      } catch {
        push("Couldn't save — browser storage may be full");
        return null;
      }
      cacheImageBlob(q.id, input.image);
      setQuestions((prev) => [q, ...prev]);
      return q;
    },
    [push],
  );

  const updateQuestion = useCallback(
    async (id: string, patch: Partial<Question>) => {
      const current = questionsRef.current.find((q) => q.id === id);
      if (!current) return;
      const next: Question = { ...current, ...patch, id, updatedAt: Date.now() };
      try {
        await putQuestion(next);
        await enqueueSyncItem("question", id, "upsert");
      } catch {
        push("Couldn't save changes");
        return;
      }
      setQuestions((prev) => prev.map((q) => (q.id === id ? next : q)));
    },
    [push],
  );

  const stageDelete = useCallback((id: string) => {
    setPendingDeleteIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }, []);

  const cancelDelete = useCallback((id: string) => {
    setPendingDeleteIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const commitDelete = useCallback(
    async (id: string) => {
      try {
        await removeQuestion(id);
        await enqueueSyncItem("question", id, "delete");
      } catch {
        push("Couldn't delete question");
        return;
      } finally {
        evictImage(id);
        setQuestions((prev) => prev.filter((q) => q.id !== id));
        setPendingDeleteIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }
    },
    [push],
  );

  const deleteQuestion = useCallback(
    async (id: string) => {
      await commitDelete(id);
    },
    [commitDelete],
  );

  const resetRevisions = useCallback(
    async (id: string) => {
      await updateQuestion(id, { revisionCount: 0, lastRevisionDay: null });
    },
    [updateQuestion],
  );

  const countRevision = useCallback(
    async (id: string) => {
      const current = questionsRef.current.find((q) => q.id === id);
      if (!current) return;
      const today = todayKey();
      if (current.lastRevisionDay === today) return;
      await updateQuestion(id, {
        revisionCount: current.revisionCount + 1,
        lastRevisionDay: today,
      });
    },
    [updateQuestion],
  );

  const addSource = useCallback(
    async (name: string): Promise<Source | null> => {
      const trimmed = name.trim();
      if (!trimmed) return null;
      const existing = sourcesRef.current.find(
        (s) => s.name.toLowerCase() === trimmed.toLowerCase(),
      );
      if (existing) return existing;
      const now = Date.now();
      const source: Source = {
        id: newId(),
        name: trimmed,
        createdAt: now,
        updatedAt: now,
        syncedAt: null,
        isDeleted: false,
      };
      try {
        await putSource(source);
        await enqueueSyncItem("source", source.id, "upsert");
      } catch {
        push("Couldn't save source");
        return null;
      }
      setSources((prev) =>
        [...prev, source].sort((a, b) => a.name.localeCompare(b.name)),
      );
      return source;
    },
    [push],
  );

  const deleteSource = useCallback(
    async (id: string) => {
      try {
        await removeSource(id);
        await enqueueSyncItem("source", id, "delete");
      } catch {
        push("Couldn't delete source");
        return;
      }
      const affected = questionsRef.current
        .filter((q) => q.sourceId === id)
        .map((q) => ({ ...q, sourceId: null, updatedAt: Date.now() }));
      try {
        await putQuestions(affected);
        for (const q of affected) {
          await enqueueSyncItem("question", q.id, "upsert");
        }
      } catch {
        push("Couldn't update questions referencing this source");
      }
      const affectedIds = new Set(affected.map((q) => q.id));
      setQuestions((prev) =>
        prev.map((q) => (affectedIds.has(q.id) ? { ...q, sourceId: null, updatedAt: Date.now() } : q)),
      );
      setSources((prev) => prev.filter((s) => s.id !== id));
    },
    [push],
  );

  const visibleQuestions = useMemo(() => {
    if (pendingDeleteIds.size === 0) return questions;
    return questions.filter((q) => !pendingDeleteIds.has(q.id));
  }, [questions, pendingDeleteIds]);

  const totalQuestions = visibleQuestions.length;
  const totalPages = Math.max(1, Math.ceil(totalQuestions / pageSize));

  const paginatedQuestions = useMemo(() => {
    const safePage = Math.min(Math.max(1, page), totalPages);
    const start = (safePage - 1) * pageSize;
    return visibleQuestions.slice(start, start + pageSize);
  }, [visibleQuestions, page, totalPages, pageSize]);

  const nextPage = useCallback(() => {
    setPage((p) => Math.min(totalPages, p + 1));
  }, [totalPages]);

  const prevPage = useCallback(() => {
    setPage((p) => Math.max(1, p - 1));
  }, []);

  const value = useMemo(
    () => ({
      ready,
      questions: paginatedQuestions,
      allQuestions: visibleQuestions,
      page,
      pageSize,
      totalPages,
      totalQuestions,
      setPage,
      nextPage,
      prevPage,
      sources,
      addQuestion,
      updateQuestion,
      deleteQuestion,
      stageDelete,
      cancelDelete,
      commitDelete,
      resetRevisions,
      countRevision,
      addSource,
      deleteSource,
    }),
    [
      ready,
      paginatedQuestions,
      visibleQuestions,
      page,
      pageSize,
      totalPages,
      totalQuestions,
      nextPage,
      prevPage,
      sources,
      addQuestion,
      updateQuestion,
      deleteQuestion,
      stageDelete,
      cancelDelete,
      commitDelete,
      resetRevisions,
      countRevision,
      addSource,
      deleteSource,
    ],
  );

  return (
    <LibraryContext.Provider value={value}>{children}</LibraryContext.Provider>
  );
}

export function useLibrary(): LibraryContextValue {
  const ctx = useContext(LibraryContext);
  if (!ctx) throw new Error("useLibrary must be used inside LibraryProvider");
  return ctx;
}
