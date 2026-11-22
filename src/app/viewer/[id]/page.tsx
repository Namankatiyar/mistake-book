"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import { useParams, useRouter } from "next/navigation";
import { TagEditor } from "@/components/tag-editor";
import {
  Button,
  Icon,
  Kbd,
  MistakeDot,
  RevisionBadge,
  SourceChip,
  Tooltip,
} from "@/components/ui";
import { checkAttempt } from "@/lib/answer";
import { useObjectUrl } from "@/lib/hooks";
import { useLibrary } from "@/lib/library";
import {
  VIEWER_ORDER_KEY,
  mistakeById,
  type Question,
} from "@/lib/model";
import { useSettings } from "@/lib/settings";
import { chapterById, subjectById } from "@/lib/syllabus";
import { useToast } from "@/lib/toast";

const emptySubscribe = () => () => {};

let cachedRaw: string | null = null;
let cachedOrder: string[] = [];

function getSessionOrder(): string[] {
  if (typeof window === "undefined") return [];
  const raw = window.sessionStorage.getItem(VIEWER_ORDER_KEY);
  if (raw === cachedRaw) return cachedOrder;
  cachedRaw = raw;
  try {
    const parsed = JSON.parse(raw ?? "[]");
    cachedOrder = Array.isArray(parsed) ? (parsed as string[]) : [];
  } catch {
    cachedOrder = [];
  }
  return cachedOrder;
}

export default function ViewerPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const router = useRouter();
  const { ready, questions } = useLibrary();

  // The order is frozen at entry and kept until you return to the list.
  const order = useSyncExternalStore(
    emptySubscribe,
    getSessionOrder,
    () => null,
  );

  const ids = useMemo(() => {
    if (!ready || order === null) return null;
    const existing = new Set(questions.map((q) => q.id));
    let list = order.filter((x) => existing.has(x));
    if (!list.includes(id)) list = [id];
    return list;
  }, [ready, order, questions, id]);

  const question = ready ? questions.find((q) => q.id === id) : undefined;
  const index = ids ? ids.indexOf(id) : -1;
  const prevId = ids && index > 0 ? ids[index - 1] : undefined;
  const nextId =
    ids && index >= 0 && index < ids.length - 1 ? ids[index + 1] : undefined;

  const navigate = useCallback(
    (target: string) => router.replace(`/viewer/${target}`),
    [router],
  );
  const back = useCallback(() => router.push("/"), [router]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      if (e.altKey || e.ctrlKey || e.metaKey) return;

      const target = e.target as HTMLElement | null;
      const inDialog = !!target?.closest('[role="dialog"]');

      if (e.key === "Escape") {
        if (inDialog) return;
        back();
        return;
      }

      if (inDialog) return;

      // Keep native navigation inside multiline textareas, selects, or editable regions
      if (
        target &&
        (target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      ) {
        return;
      }

      if (e.key === "ArrowLeft" && prevId) {
        e.preventDefault();
        navigate(prevId);
      } else if (e.key === "ArrowRight" && nextId) {
        e.preventDefault();
        navigate(nextId);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [prevId, nextId, navigate, back]);

  if (!ready || ids === null) {
    return (
      <div className="flex h-dvh items-center justify-center">
        <p className="text-[14px] text-muted">Loading…</p>
      </div>
    );
  }

  if (!question) {
    return (
      <div className="flex h-dvh flex-col items-center justify-center gap-3">
        <p className="text-[16px] font-medium">Question not found</p>
        <Button onClick={back}>
          <Icon name="arrow-left" size={14} />
          Back to list
        </Button>
      </div>
    );
  }

  return (
    <ViewerQuestion
      key={question.id}
      question={question}
      prevId={prevId}
      nextId={nextId}
      onNavigate={navigate}
      onBack={back}
    />
  );
}

function ViewerQuestion({
  question,
  prevId,
  nextId,
  onNavigate,
  onBack,
}: {
  question: Question;
  prevId?: string;
  nextId?: string;
  onNavigate: (id: string) => void;
  onBack: () => void;
}) {
  const url = useObjectUrl(question.image);
  const { updateQuestion, countRevision, sources } = useLibrary();
  const { settings } = useSettings();
  const { push } = useToast();

  const [attempt, setAttempt] = useState("");
  const [phase, setPhase] = useState<"answer" | "result" | "add-key">("answer");
  const [correct, setCorrect] = useState(false);
  const [noteDraft, setNoteDraft] = useState("");
  const [keyDraft, setKeyDraft] = useState("");
  const [editing, setEditing] = useState(false);

  const mistake = mistakeById(question.mistakeId);
  const subject = subjectById(question.subjectId);
  const chapter = chapterById(question.chapterId);
  const source = question.sourceId
    ? sources.find((s) => s.id === question.sourceId)
    : undefined;

  /**
   * Revision rule: more than 5 seconds of visible time counts once.
   * The timer belongs to this question, dies when you leave it,
   * pauses while the tab is hidden, and counts at most once per local day
   * (the day guard lives in countRevision).
   */
  useEffect(() => {
    let acc = 0;
    let counted = false;
    let last: number | null =
      document.visibilityState === "visible" ? performance.now() : null;
    const onVis = () => {
      last = document.hidden ? null : performance.now();
    };
    const tick = setInterval(() => {
      const now = performance.now();
      if (last !== null) acc += now - last;
      last = document.hidden ? null : now;
      if (!counted && acc > 5000) {
        counted = true;
        clearInterval(tick);
        void countRevision(question.id);
      }
    }, 200);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clearInterval(tick);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [question.id, countRevision]);

  const hasKey = question.answerKey.trim().length > 0;

  const check = () => {
    if (phase !== "answer") return;
    if (!hasKey) {
      setPhase("add-key");
      return;
    }
    if (!attempt.trim()) return;
    setCorrect(checkAttempt(attempt, question.answerKey));
    setPhase("result");
  };

  const saveKey = async () => {
    const k = keyDraft.trim();
    if (!k) return;
    await updateQuestion(question.id, { answerKey: k });
    if (nextId) {
      onNavigate(nextId);
    } else {
      setKeyDraft("");
      setAttempt("");
      setPhase("answer");
    }
  };

  const saveNote = async () => {
    const n = noteDraft.trim();
    if (!n) return;
    await updateQuestion(question.id, { note: n });
  };

  const stash = async () => {
    await updateQuestion(question.id, { stashed: true });
    push("Stashed — find it under Stashed");
    if (nextId) onNavigate(nextId);
    else if (prevId) onNavigate(prevId);
    else onBack();
  };

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-bg">
      {/* Header bar with Back to list and question tags */}
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-line bg-surface px-3 sm:px-4">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <Tooltip
            content={
              <span className="inline-flex items-center gap-1.5">
                Back to list <Kbd>Esc</Kbd>
              </span>
            }
            side="bottom"
            align="start"
          >
            <Button
              variant="ghost"
              size="sm"
              onClick={onBack}
              className="shrink-0"
            >
              <Icon name="arrow-left" size={14} />
              Back to list
            </Button>
          </Tooltip>

          {settings.viewerTags && (
            <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-muted">
              {mistake && (
                <span className="inline-flex shrink-0 items-center gap-1.5 font-medium">
                  <MistakeDot tone={mistake.tone} />
                  {mistake.label}
                </span>
              )}
              {mistake && (chapter || subject || source) && (
                <span aria-hidden="true" className="shrink-0">
                  ·
                </span>
              )}
              {(chapter?.name || subject?.name) && (
                <span className="truncate">
                  {chapter?.name}
                  {chapter?.name && subject?.name ? " · " : ""}
                  {subject?.name}
                </span>
              )}
              {source && <SourceChip name={source.name} />}
            </div>
          )}
        </div>

        {settings.viewerTags && (
          <div className="shrink-0 pl-2">
            <RevisionBadge count={question.revisionCount} />
          </div>
        )}
      </header>

      {/* Main image area: fits image relative to available viewport, never cropped or overflowing */}
      <main className="relative flex min-h-0 min-w-0 flex-1 items-center justify-center overflow-hidden p-3 sm:p-4">
        {url && (
          <div className="relative flex h-full w-full min-h-0 min-w-0 items-center justify-center overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={url}
              alt={`Question — ${chapter?.name ?? "chapter"}`}
              className="block h-auto w-auto max-h-full max-w-full object-contain select-none rounded-md"
              style={{
                maxHeight: "100%",
                maxWidth: "100%",
                objectFit: "contain",
              }}
            />
          </div>
        )}
      </main>

      {/* Bottom controls panel */}
      <div className="shrink-0 border-t border-line bg-surface">
        <div className="mx-auto w-full max-w-[760px] space-y-2 px-4 py-3">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              check();
            }}
          >
            <input
              className="input tnum h-10 transition-colors focus:border-muted focus:outline-none"
              placeholder="Your answer"
              aria-label="Your answer"
              value={attempt}
              autoFocus
              disabled={phase === "result"}
              onChange={(e) => setAttempt(e.target.value)}
            />
          </form>

          {phase === "result" && (
            <div className="fade-in space-y-1.5">
              <span
                className={`badge ${correct ? "badge-green" : "badge-red"}`}
              >
                {correct ? "✔ Correct" : "✘ Incorrect"}
              </span>
              <p className="text-[14px]">
                <span className="text-muted">Answer: </span>
                <span className="tnum text-[16px] font-semibold">
                  {question.answerKey}
                </span>
              </p>
              {question.note ? (
                <p className="whitespace-pre-wrap text-[14px]">
                  {question.note}
                </p>
              ) : (
                <div className="flex items-start gap-1.5">
                  <textarea
                    className="input"
                    rows={2}
                    placeholder="Add a note — why did you miss it?"
                    aria-label="Add a note"
                    value={noteDraft}
                    onChange={(e) => setNoteDraft(e.target.value)}
                  />
                  <Button
                    size="sm"
                    className="mt-0.5"
                    disabled={!noteDraft.trim()}
                    onClick={() => void saveNote()}
                  >
                    Save note
                  </Button>
                </div>
              )}
            </div>
          )}

          {phase === "add-key" && (
            <div className="fade-in flex items-center gap-1.5">
              <input
                className="input tnum transition-colors focus:border-muted focus:outline-none"
                placeholder="Final answer only — option or number"
                aria-label="Answer key"
                autoFocus
                value={keyDraft}
                onChange={(e) => setKeyDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void saveKey();
                  } else if (e.key === "Escape") {
                    e.stopPropagation();
                    setPhase("answer");
                  }
                }}
              />
              <Button
                variant="primary"
                disabled={!keyDraft.trim()}
                onClick={() => void saveKey()}
              >
                Save key
              </Button>
              <Button variant="ghost" onClick={() => setPhase("answer")}>
                Cancel
              </Button>
            </div>
          )}

          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 pt-1">
            <div className="justify-self-start">
              {settings.viewerEdit && (
                <Tooltip content="Edit tags" side="top" align="start">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setEditing(true)}
                  >
                    <Icon name="pencil" size={14} />
                    <span className="hidden sm:inline">Edit tags</span>
                  </Button>
                </Tooltip>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Tooltip
                content={
                  <span className="inline-flex items-center gap-1.5">
                    Previous{" "}
                    <Kbd className="inline-flex items-center justify-center">
                      <Icon name="arrow-left" size={11} />
                    </Kbd>
                  </span>
                }
                side="top"
              >
                <Button
                  disabled={!prevId}
                  onClick={() => prevId && onNavigate(prevId)}
                >
                  Previous
                </Button>
              </Tooltip>
              <Tooltip
                content={
                  <span className="inline-flex items-center gap-1.5">
                    Press <Kbd>Enter</Kbd> to submit
                  </span>
                }
                side="top"
              >
                <Button
                  variant="primary"
                  className="min-w-32"
                  disabled={
                    phase !== "answer" || (hasKey && !attempt.trim())
                  }
                  onClick={check}
                >
                  {hasKey ? "Check" : "Add answer key"}
                </Button>
              </Tooltip>
              <Tooltip
                content={
                  <span className="inline-flex items-center gap-1.5">
                    Next{" "}
                    <Kbd className="inline-flex items-center justify-center">
                      <Icon name="arrow-right" size={11} />
                    </Kbd>
                  </span>
                }
                side="top"
              >
                <Button
                  disabled={!nextId}
                  onClick={() => nextId && onNavigate(nextId)}
                >
                  Next
                </Button>
              </Tooltip>
            </div>
            <div className="justify-self-end">
              <Tooltip
                content="Remove this question from mistakes (archive)"
                side="top"
                align="end"
              >
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => void stash()}
                >
                  <Icon name="archive" size={14} />
                  <span className="hidden sm:inline">Stash</span>
                </Button>
              </Tooltip>
            </div>
          </div>
        </div>
      </div>

      {editing && (
        <TagEditor
          question={question}
          open={editing}
          onClose={() => setEditing(false)}
        />
      )}
    </div>
  );
}
