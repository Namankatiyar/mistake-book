"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { useCapture } from "@/components/capture";
import { QuestionCard } from "@/components/question-card";
import {
  Button,
  Icon,
  IconButton,
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
import { SYLLABUS, subjectById } from "@/lib/syllabus";

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
  const { settings, update } = useSettings();
  const { openModal, openPicker } = useCapture();
  const handleAddQuestions = openModal || openPicker;
  const router = useRouter();
  const [state, setState] = useSessionState<ListState>("mb.listState", INITIAL);

  const set = (patch: Partial<ListState>) =>
    setState((prev) => ({ ...prev, ...patch }));

  const counts = useMemo(() => {
    const bySubject = new Map<string, number>();
    const byChapter = new Map<string, number>();
    let total = 0;
    for (const q of questions) {
      if (q.stashed) continue;
      total += 1;
      bySubject.set(q.subjectId, (bySubject.get(q.subjectId) ?? 0) + 1);
      byChapter.set(q.chapterId, (byChapter.get(q.chapterId) ?? 0) + 1);
    }
    return { bySubject, byChapter, total };
  }, [questions]);

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
  }, [questions, state]);

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

  const mobileSubject = state.subjectId ? subjectById(state.subjectId) : null;

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
          {SYLLABUS.map((s) => {
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
                      className={expanded ? "rotate-90" : ""}
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
      </aside>

      {/* Question column */}
      <main className="min-w-0 flex-1">
        <div className="toolbar-container sticky top-0 z-20 border-b border-line bg-bg py-3">
          <div className="mb-2 grid grid-cols-2 gap-2 lg:hidden">
            <Select
              small
              aria-label="Filter by subject"
              value={state.subjectId ?? ""}
              onChange={(e) =>
                set({ subjectId: e.target.value || null, chapterId: null })
              }
            >
              <option value="">All subjects</option>
              {SYLLABUS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
            <SearchableChapterSelect
              small
              className="w-full"
              aria-label="Filter by chapter"
              value={state.chapterId ?? ""}
              subjectId={mobileSubject?.id}
              disabled={!mobileSubject}
              allOptionLabel="All chapters"
              onChange={(chId) => set({ chapterId: chId || null })}
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
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
              <IconButton
                className="toolbar-actions-eye"
                name={settings.showAnswers ? "eye-off" : "eye"}
                label={
                  settings.showAnswers
                    ? "Hide answers and notes in list"
                    : "Show answers and notes in list"
                }
                active={settings.showAnswers}
                onClick={() => update({ showAnswers: !settings.showAnswers })}
              />
            </div>
          </div>
        </div>

        <div className="w-full space-y-6 py-6">
          {!ready ? (
            <p className="py-10 text-[14px] text-muted">
              Opening your local library…
            </p>
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
            <div className="py-10">
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
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
              {filtered.map((q) => (
                <QuestionCard key={q.id} question={q} onOpen={openViewer} />
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
