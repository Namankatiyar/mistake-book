"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Atom } from "loading-dev";
import { ShieldCheck, FileText, FileDown } from "lucide-react";
import { useCapture } from "@/components/capture";
import { ExportModal } from "@/components/export-modal";
import { QuestionCard } from "@/components/question-card";
import {
  Button,
  Icon,
  Kbd,
  SearchableChapterSelect,
  Select,
  SubjectIcon,
} from "@/components/ui";
import { useSessionState } from "@/lib/hooks";
import { useLibrary } from "@/lib/library";
import {
  MISTAKE_TYPES,
  SORTS,
  VIEWER_ORDER_KEY,
  sortQuestions,
  type SortKey,
  type StashMode,
} from "@/lib/model";
import { useSettings } from "@/lib/settings";
import {
  getSyllabus,
  subjectOfChapter,
} from "@/lib/syllabus";

type ListState = {
  subjectId: string | null;
  chapterId: string | null;
  mistake: string; // 'all' | 'none' | mistake id
  source: string; // 'all' | 'none' | source id
  sort: SortKey;
  stash: StashMode;
  expanded: Record<string, boolean>;
};

const INITIAL: ListState = {
  subjectId: null,
  chapterId: null,
  mistake: "all",
  source: "all",
  sort: "least",
  stash: "active",
  expanded: {},
};

const STASH_MODES: { id: StashMode; label: string }[] = [
  { id: "active", label: "Active" },
  { id: "stashed", label: "Stashed" },
  { id: "all", label: "All" },
];

export default function ListPage() {
  const { ready, questions, sources } = useLibrary();
  const { settings } = useSettings();
  const { openModal, openPicker } = useCapture();
  const handleAddQuestions = openModal || openPicker;
  const router = useRouter();
  const [state, setState] = useSessionState<ListState>("mb.listState", INITIAL);
  const [exportOpen, setExportOpen] = useState(false);

  const syllabus = useMemo(
    () => getSyllabus(settings.examMode),
    [settings.examMode],
  );

  const set = (patch: Partial<ListState>) =>
    setState((prev) => ({ ...prev, ...patch }));

  // When switching exam modes, if the active filter belongs to a different mode, reset to All
  useEffect(() => {
    if (state.subjectId && !syllabus.some((s) => s.id === state.subjectId)) {
      setState((prev) => ({ ...prev, subjectId: null, chapterId: null }));
    }
  }, [syllabus, state.subjectId, setState]);

  const counts = useMemo(() => {
    const activeSubjectIds = new Set(syllabus.map((s) => s.id));
    const bySubject = new Map<string, number>();
    const byChapter = new Map<string, number>();
    let total = 0;
    for (const q of questions) {
      if (q.stashed) continue;
      if (activeSubjectIds.has(q.subjectId)) {
        total += 1;
      }
      bySubject.set(q.subjectId, (bySubject.get(q.subjectId) ?? 0) + 1);
      byChapter.set(q.chapterId, (byChapter.get(q.chapterId) ?? 0) + 1);
    }
    return { bySubject, byChapter, total };
  }, [questions, syllabus]);

  const filtered = useMemo(() => {
    let list = questions.filter((q) =>
      state.stash === "active"
        ? !q.stashed
        : state.stash === "stashed"
          ? q.stashed
          : true,
    );
    if (state.chapterId) {
      list = list.filter((q) => q.chapterId === state.chapterId);
    } else if (state.subjectId) {
      list = list.filter((q) => q.subjectId === state.subjectId);
    } else {
      const activeSubjectIds = new Set(syllabus.map((s) => s.id));
      list = list.filter((q) => activeSubjectIds.has(q.subjectId));
    }
    if (state.mistake === "none") {
      list = list.filter((q) => !q.mistakeId);
    } else if (state.mistake !== "all") {
      list = list.filter((q) => q.mistakeId === state.mistake);
    }
    if (state.source === "none") {
      list = list.filter((q) => !q.sourceId);
    } else if (state.source !== "all") {
      list = list.filter((q) => q.sourceId === state.source);
    }
    return sortQuestions(list, state.sort);
  }, [questions, state, syllabus]);

  const openViewer = (id: string) => {
    // Freeze the filtered, sorted order for the viewer session.
    try {
      window.sessionStorage.setItem(
        VIEWER_ORDER_KEY,
        JSON.stringify(filtered.map((q) => q.id)),
      );
    } catch {
      // Ignore.
    }
    router.push(`/viewer/${id}`);
  };

  const hasFilters =
    !!state.subjectId ||
    !!state.chapterId ||
    state.mistake !== "all" ||
    state.source !== "all" ||
    state.stash !== "active";

  return (
    <div className="mx-auto flex max-w-[1400px] gap-8 px-4 sm:px-6">
      {/* Sidebar tree: subject → chapter */}
      <aside className="sticky top-0 hidden max-h-dvh w-64 shrink-0 self-start overflow-y-auto py-6 pr-3.5 lg:block">
        <button
          type="button"
          className="side-row flex items-center"
          data-selected={!state.subjectId && !state.chapterId ? true : undefined}
          onClick={() => set({ subjectId: null, chapterId: null })}
        >
          <span className="flex-1">All questions</span>
          <span className="tnum">{counts.total}</span>
        </button>
        <div className="mt-3 space-y-1">
          {syllabus.map((s) => {
            const expanded = !!state.expanded[s.id];
            return (
              <div key={s.id}>
                <button
                  type="button"
                  className="side-row flex items-center"
                  data-selected={
                    state.subjectId === s.id && !state.chapterId
                      ? true
                      : undefined
                  }
                  aria-expanded={expanded}
                  aria-label={`${expanded ? "Collapse" : "Expand"} ${s.name}`}
                  onClick={() =>
                    set({
                      subjectId: s.id,
                      chapterId: null,
                      expanded: { ...state.expanded, [s.id]: !expanded },
                    })
                  }
                >
                  <span
                    className="flex h-5 w-5 flex-none items-center justify-center rounded-[4px]"
                    aria-hidden="true"
                  >
                    <Icon
                      name="chevron-right"
                      size={13}
                      className={`transition-transform duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:duration-0 ${
                        expanded ? "rotate-90" : ""
                      }`}
                    />
                  </span>
                  <SubjectIcon subject={s.id} size={15} />
                  <span className="min-w-0 flex-1 truncate text-left">
                    {s.name}
                  </span>
                  <span className="tnum">
                    {counts.bySubject.get(s.id) ?? 0}
                  </span>
                </button>
                {expanded && (
                  <div className="ml-[14px] mt-0.5 space-y-0.5 border-l border-line pl-2">
                    {s.chapters.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        className="side-row flex items-center"
                        data-selected={
                          state.chapterId === c.id ? true : undefined
                        }
                        onClick={() =>
                          set({ subjectId: s.id, chapterId: c.id })
                        }
                      >
                        <span className="min-w-0 flex-1 truncate">
                          {c.name}
                        </span>
                        <span className="tnum">
                          {counts.byChapter.get(c.id) ?? 0}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <div className="mt-6 rounded-[8px] border border-line bg-surface/50 p-3 text-[12px] leading-relaxed text-muted">
          You can directly drag and drop images onto here or press{" "}
          <Kbd>Ctrl + V</Kbd> to add mistakes
        </div>

        <div className="mt-4 border-t border-line/70 py-3">
          <Button
            variant="primary"
            size="sm"
            onClick={() => setExportOpen(true)}
            className="w-full"
          >
            <FileDown className="h-3.5 w-3.5 shrink-0" />
            Export to PDF
          </Button>
        </div>

        <div className="border-t border-line/70 pt-3 space-y-1">
          <div className="px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-muted">
            Legal &amp; Privacy
          </div>
          <Link
            href="/privacy"
            className="side-row flex items-center gap-2 text-muted hover:text-fg"
          >
            <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
            <span className="flex-1">Privacy Policy</span>
          </Link>
          <Link
            href="/terms"
            className="side-row flex items-center gap-2 text-muted hover:text-fg"
          >
            <FileText className="h-3.5 w-3.5 shrink-0" />
            <span className="flex-1">Terms of Service</span>
          </Link>
          <div className="px-1.5 pt-2 text-[11px] text-muted">
            &copy; {new Date().getFullYear()} ojeet tools
          </div>
        </div>
      </aside>

      {/* Question column */}
      <main className="min-w-0 flex-1">
        <div className="toolbar-container sticky top-0 z-20 border-b border-line bg-bg py-3">
          <div className="mb-2 lg:hidden">
            <SearchableChapterSelect
              small
              className="w-full"
              aria-label="Filter by chapter"
              value={state.chapterId ?? ""}
              subjectId={state.subjectId}
              allOptionLabel="All chapters"
              onChange={(chId, subId) => {
                if (!chId) {
                  set({ chapterId: null });
                } else {
                  set({
                    chapterId: chId,
                    subjectId: state.subjectId ?? subId ?? subjectOfChapter(chId)?.id ?? null,
                  });
                }
              }}
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <SearchableChapterSelect
              small
              className="hidden lg:inline-block w-[180px]"
              aria-label="Filter by chapter"
              value={state.chapterId ?? ""}
              subjectId={state.subjectId}
              allOptionLabel="All chapters"
              onChange={(chId, subId) => {
                if (!chId) {
                  set({ chapterId: null });
                } else {
                  set({
                    chapterId: chId,
                    subjectId: state.subjectId ?? subId ?? subjectOfChapter(chId)?.id ?? null,
                  });
                }
              }}
            />
            <Select
              small
              className="w-[168px]"
              aria-label="Filter by mistake type"
              value={state.mistake}
              onChange={(e) => set({ mistake: e.target.value })}
            >
              <option value="all">All mistakes</option>
              <option value="none">No mistake label</option>
              {MISTAKE_TYPES.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </Select>
            <Select
              small
              className="w-[140px]"
              aria-label="Filter by source"
              value={state.source}
              onChange={(e) => set({ source: e.target.value })}
            >
              <option value="all">All sources</option>
              <option value="none">No source</option>
              {sources.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
            <Select
              small
              className="w-[132px]"
              aria-label="Sort order"
              value={state.sort}
              onChange={(e) => set({ sort: e.target.value as SortKey })}
            >
              {SORTS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </Select>
            <div
              className="inline-flex h-7 flex-none overflow-hidden rounded-[6px] border border-line"
              role="group"
              aria-label="Stash filter"
            >
              {STASH_MODES.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  className={`px-2.5 text-[13px] ${
                    state.stash === m.id
                      ? "bg-soft font-medium text-fg"
                      : "bg-surface text-muted hover:text-fg"
                  }`}
                  aria-pressed={state.stash === m.id}
                  onClick={() => set({ stash: m.id })}
                >
                  {m.label}
                </button>
              ))}
            </div>
            <div className="toolbar-actions">
              <Button variant="primary" size="sm" onClick={handleAddQuestions}>
                <Icon name="plus" size={14} />
                Add questions
              </Button>
            </div>
          </div>
        </div>

        <div className="w-full space-y-6 py-6">
          {!ready ? (
            <div
              className="flex min-h-[50vh] flex-col items-center justify-center gap-3"
              role="status"
              aria-label="Loading library"
            >
              <Atom size={48} className="text-muted" />
              <p className="text-[12px] text-muted tracking-wide">loading...</p>
            </div>
          ) : questions.length === 0 ? (
            <div className="panel p-6 sm:p-8">
              <h1 className="text-[20px] font-semibold">
                Paste your first mistake
              </h1>
              <p className="mt-1 text-[14px] text-muted">
                Screenshot a question you got wrong and paste it here.
                Everything stays on this machine.
              </p>
              <div className="mt-5 space-y-2.5 text-[14px]">
                <p className="flex flex-wrap items-center gap-1.5">
                  <Kbd>Ctrl</Kbd>+<Kbd>V</Kbd>
                  <span className="text-muted">
                    stages a draft — Enter saves, several pastes queue up
                  </span>
                </p>
                <p className="flex flex-wrap items-center gap-1.5">
                  <Kbd>Ctrl</Kbd>+<Kbd>Shift</Kbd>+<Kbd>V</Kbd>
                  <span className="text-muted">
                    saves instantly into the current subject, chapter and
                    source
                  </span>
                </p>
                <p className="text-muted">
                  Or drag and drop images anywhere on this page.
                </p>
              </div>
              <Button variant="primary" className="mt-6" onClick={handleAddQuestions}>
                <Icon name="upload" size={14} />
                Add questions
              </Button>
            </div>
          ) : filtered.length === 0 ? (
            <div>
              <p className="text-[14px] text-muted">
                Nothing matches these filters.
              </p>
              {hasFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-3"
                  onClick={() =>
                    set({
                      subjectId: null,
                      chapterId: null,
                      mistake: "all",
                      source: "all",
                      stash: "active",
                    })
                  }
                >
                  Clear filters
                </Button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4">
              {filtered.map((q) => (
                <QuestionCard key={q.id} question={q} onOpen={openViewer} />
              ))}
            </div>
          )}
        </div>

        <footer className="mt-8 border-t border-line pt-4 pb-10 flex flex-wrap items-center justify-between gap-3 text-[12px] text-muted lg:hidden">
          <span>&copy; {new Date().getFullYear()} ojeet tools</span>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => setExportOpen(true)}
              className="text-muted hover:text-fg underline underline-offset-4 flex items-center gap-1.5"
            >
              <FileDown className="h-3.5 w-3.5" />
              Export to PDF
            </button>
            <Link
              href="/privacy"
              className="text-muted hover:text-fg underline underline-offset-4"
            >
              Privacy Policy
            </Link>
            <Link
              href="/terms"
              className="text-muted hover:text-fg underline underline-offset-4"
            >
              Terms of Service
            </Link>
          </div>
        </footer>
      </main>

      <ExportModal
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        initialSubjectId={state.subjectId}
        initialChapterId={state.chapterId}
        initialMistake={state.mistake}
        initialSource={state.source}
        initialStash={state.stash}
      />
    </div>
  );
}
