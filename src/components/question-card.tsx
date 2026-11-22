"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useObjectUrl } from "@/lib/hooks";
import { useLibrary } from "@/lib/library";
import { mistakeById, type Question } from "@/lib/model";
import { useSettings } from "@/lib/settings";
import { chapterById } from "@/lib/syllabus";
import { TagEditor } from "./tag-editor";
import { Icon, IconButton, RevisionBadge, Tooltip } from "./ui";

function ToastProgressBar({ duration = 5000 }: { duration?: number }) {
  const [animating, setAnimating] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setAnimating(true);
    }, 20);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="absolute bottom-0 left-0 right-0 h-[2.5px] w-full overflow-hidden bg-line/40">
      <div
        className="h-full bg-fg/80"
        style={{
          width: animating ? "0%" : "100%",
          transition: animating ? `width ${duration}ms linear` : "none",
          willChange: "width",
        }}
      />
    </div>
  );
}

export function QuestionCard({
  question,
  onOpen,
}: {
  question: Question;
  onOpen: (id: string) => void;
}) {
  const url = useObjectUrl(question.image);
  const { stageDelete, cancelDelete, commitDelete, sources } = useLibrary();
  const { settings } = useSettings();
  const [editing, setEditing] = useState(false);

  const mistake = mistakeById(question.mistakeId);
  const chapter = chapterById(question.chapterId);
  const source = question.sourceId
    ? sources.find((s) => s.id === question.sourceId)
    : undefined;

  const handleDelete = () => {
    stageDelete(question.id);

    let isUndone = false;
    let isCommitted = false;

    const finalize = () => {
      if (isUndone || isCommitted) return;
      isCommitted = true;
      void commitDelete(question.id);
    };

    toast.custom(
      (t) => (
        <div className="toast-undo-card group relative flex w-[340px] items-center justify-between gap-3 overflow-hidden rounded-[10px] border border-line bg-surface px-3.5 py-2.5 text-fg shadow-lg select-none">
          <div className="flex items-center gap-2 min-w-0">
            <span className="truncate text-[13px] font-medium text-fg">
              Question deleted
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              isUndone = true;
              cancelDelete(question.id);
              toast.dismiss(t);
            }}
            className="shrink-0 cursor-pointer rounded-[6px] border border-line bg-soft px-2.5 py-1 text-[12px] font-medium text-fg transition-colors hover:bg-line/80 active:scale-95"
          >
            Undo
          </button>
          <ToastProgressBar duration={5000} />
        </div>
      ),
      {
        duration: 5000,
        onAutoClose: finalize,
        onDismiss: finalize,
      },
    );
  };

  return (
    <>
      <article
        role="button"
        tabIndex={0}
        onClick={() => onOpen(question.id)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onOpen(question.id);
          }
        }}
        className={`group flex h-full flex-col justify-between rounded-[20px] border border-line/70 dark:border-white/5 bg-surface p-3.5 transition-all hover:border-fg/20 hover:shadow-md cursor-pointer select-none ${
          question.stashed ? "opacity-60" : ""
        }`}
      >
        <div>
          {/* Top: Question Preview or Stylized Skeleton */}
          <div className="relative flex aspect-[16/10.5] w-full overflow-hidden rounded-[14px] bg-[#eae7df] dark:bg-[#1a1a1a] border border-black/5 dark:border-white/5">
            {url ? (
              <>
                {source && (
                  <span className="absolute top-2.5 left-2.5 z-10 rounded-[6px] bg-[#1e1e1e]/90 px-2 py-0.5 text-[11px] font-semibold tracking-wide text-white shadow-sm backdrop-blur-xs select-none">
                    {source.name}
                  </span>
                )}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={url}
                  alt={`Question — ${chapter?.name ?? "chapter"}`}
                  className="h-full w-full object-contain p-2"
                  loading="lazy"
                />
              </>
            ) : (
              <div className="flex h-full w-full flex-col justify-between bg-[#eae7df] p-3 text-neutral-800 select-none">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-[6px] bg-[#1f1f1f]/90 px-2 py-0.5 text-[11px] font-semibold tracking-wide text-white shadow-sm">
                      {source?.name ?? "PYQ"}
                    </span>
                    <div className="h-1.5 flex-1 rounded-full bg-[#ccc8bd]/90" />
                  </div>
                  <div className="mt-2.5 space-y-1.5">
                    <div className="h-1.5 w-[85%] rounded-full bg-[#ccc8bd]/90" />
                    <div className="h-1.5 w-[75%] rounded-full bg-[#ccc8bd]/90" />
                    <div className="h-1.5 w-[50%] rounded-full bg-[#ccc8bd]/90" />
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <div className="h-1.5 w-6 rounded-full bg-[#ccc8bd]/90" />
                  <div className="h-1.5 w-6 rounded-full bg-[#ccc8bd]/90" />
                  <div className="h-1.5 w-6 rounded-full bg-[#ccc8bd]/90" />
                  <div className="h-1.5 w-6 rounded-full bg-[#ccc8bd]/90" />
                </div>
              </div>
            )}
          </div>

          {/* Middle Row: Chapter Name, Revision Pill, Actions */}
          <div className="mt-3.5 flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <h3 className="truncate text-[17px] font-bold tracking-tight text-fg leading-none">
                {chapter?.name ?? "Unknown Chapter"}
              </h3>
              <RevisionBadge count={question.revisionCount} />
            </div>

            <div
              className="flex items-center gap-1.5 shrink-0"
              onClick={(e) => e.stopPropagation()}
            >
              <IconButton
                name="pencil"
                label="Edit tags"
                tooltipSide="top"
                size={17}
                className="!h-8 !w-8 text-neutral-400 hover:text-fg hover:bg-soft rounded-[8px]"
                onClick={(e) => {
                  e.stopPropagation();
                  setEditing(true);
                }}
              />
              <Tooltip content="Delete question" side="top" asChild>
                <button
                  type="button"
                  aria-label="Delete question"
                  className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-neutral-800/80 dark:bg-[#252525] border border-line/60 dark:border-white/5 text-neutral-300 dark:text-neutral-300 transition-all hover:bg-red-500/15 hover:border-red-500/30 hover:text-red-400 active:scale-95 cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete();
                  }}
                >
                  <Icon name="trash" size={17} />
                </button>
              </Tooltip>
            </div>
          </div>

          {/* Bottom Row: Mistake Reason */}
          {mistake && (
            <div className="mt-2.5 flex items-center gap-2 min-w-0">
              <span
                className="h-2.5 w-2.5 rounded-full shrink-0"
                style={{
                  backgroundColor:
                    mistake.tone === "red"
                      ? "#ef4444"
                      : mistake.tone === "orange"
                        ? "#f97316"
                        : "#eab308",
                }}
                aria-hidden="true"
              />
              <span className="truncate text-[13.5px] font-normal text-muted dark:text-neutral-400">
                {mistake.label}
              </span>
            </div>
          )}
        </div>

        {/* Answer & note preview when global setting is active */}
        {settings.showAnswers && (question.answerKey || question.note) && (
          <div
            className="fade-in mt-2 space-y-0.5 rounded-[8px] border border-line/60 bg-soft/40 px-2.5 py-1.5 text-[12px]"
            onClick={(e) => e.stopPropagation()}
          >
            {question.answerKey && (
              <p>
                <span className="text-muted">Ans: </span>
                <span className="tnum font-semibold text-fg">{question.answerKey}</span>
              </p>
            )}
            {question.note && <p className="line-clamp-2 text-muted">{question.note}</p>}
          </div>
        )}
      </article>

      {editing && (
        <TagEditor
          question={question}
          open={editing}
          onClose={() => setEditing(false)}
        />
      )}
    </>
  );
}
