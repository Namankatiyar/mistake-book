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
  loadAll,
  putQuestion,
  putQuestions,
  putSource,
  removeQuestion,
  removeSource,
} from "./idb";
import { newId, todayKey, type Question, type Source } from "./model";
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

type LibraryContextValue = {
  ready: boolean;
  questions: Question[];
  sources: Source[];
  addQuestion: (input: NewQuestion) => Promise<Question | null>;
  updateQuestion: (id: string, patch: Partial<Question>) => Promise<void>;
  deleteQuestion: (id: string) => Promise<void>;
  resetRevisions: (id: string) => Promise<void>;
  /** Counts one revision, at most once per local day. */
  countRevision: (id: string) => Promise<void>;
  addSource: (name: string) => Promise<Source | null>;
  deleteSource: (id: string) => Promise<void>;
};

const LibraryContext = createContext<LibraryContextValue | null>(null);

export function LibraryProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [sources, setSources] = useState<Source[]>([]);
  const questionsRef = useRef<Question[]>(questions);
  questionsRef.current = questions;
  const sourcesRef = useRef<Source[]>(sources);
  sourcesRef.current = sources;
  const { push } = useToast();

  useEffect(() => {
    let cancelled = false;
    loadAll()
      .then((data) => {
        if (cancelled) return;
        setQuestions(data.questions);
        setSources(data.sources);
        setReady(true);
      })
      .catch(() => {
        if (cancelled) return;
        setReady(true);
        push("Couldn't open local storage in this browser");
      });
    return () => {
      cancelled = true;
    };
  }, [push]);

  const addQuestion = useCallback(
    async (input: NewQuestion): Promise<Question | null> => {
      const q: Question = {
        id: newId(),
        image: input.image,
        createdAt: Date.now(),
        subjectId: input.subjectId,
        chapterId: input.chapterId,
        mistakeId: input.mistakeId,
        sourceId: input.sourceId,
        answerKey: input.answerKey.trim(),
        note: input.note.trim(),
        revisionCount: 0,
        lastRevisionDay: null,
        stashed: false,
      };
      try {
        await putQuestion(q);
      } catch {
        push("Couldn't save — browser storage may be full");
        return null;
      }
      setQuestions((prev) => [q, ...prev]);
      return q;
    },
    [push],
  );

  const updateQuestion = useCallback(
    async (id: string, patch: Partial<Question>) => {
      const current = questionsRef.current.find((q) => q.id === id);
      if (!current) return;
      const next: Question = { ...current, ...patch, id };
      try {
        await putQuestion(next);
      } catch {
        push("Couldn't save changes");
        return;
      }
      setQuestions((prev) => prev.map((q) => (q.id === id ? next : q)));
    },
    [push],
  );

  const deleteQuestion = useCallback(async (id: string) => {
    await removeQuestion(id);
    setQuestions((prev) => prev.filter((q) => q.id !== id));
  }, []);

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
      const source: Source = {
        id: newId(),
        name: trimmed,
        createdAt: Date.now(),
      };
      await putSource(source);
      setSources((prev) =>
        [...prev, source].sort((a, b) => a.name.localeCompare(b.name)),
      );
      return source;
    },
    [],
  );

  const deleteSource = useCallback(async (id: string) => {
    await removeSource(id);
    const affected = questionsRef.current
      .filter((q) => q.sourceId === id)
      .map((q) => ({ ...q, sourceId: null }));
    await putQuestions(affected);
    const affectedIds = new Set(affected.map((q) => q.id));
    setQuestions((prev) =>
      prev.map((q) => (affectedIds.has(q.id) ? { ...q, sourceId: null } : q)),
    );
    setSources((prev) => prev.filter((s) => s.id !== id));
  }, []);

  const value = useMemo(
    () => ({
      ready,
      questions,
      sources,
      addQuestion,
      updateQuestion,
      deleteQuestion,
      resetRevisions,
      countRevision,
      addSource,
      deleteSource,
    }),
    [
      ready,
      questions,
      sources,
      addQuestion,
      updateQuestion,
      deleteQuestion,
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
