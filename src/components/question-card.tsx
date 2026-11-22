"use client";

import { useState } from "react";
import { useObjectUrl } from "@/lib/hooks";
import { useLibrary } from "@/lib/library";
import { mistakeById, type Question } from "@/lib/model";
import { useSettings } from "@/lib/settings";
import { chapterById } from "@/lib/syllabus";
import { useToast } from "@/lib/toast";
import { TagEditor } from "./tag-editor";
import { ConfirmAction, IconButton, MistakeDot, RevisionBadge } from "./ui";

export function QuestionCard({
  question,
  onOpen,
}: {
  question: Question;
  onOpen: (id: string) => void;
}) {
  const url = useObjectUrl(question.image);
  const { deleteQuestion, sources } = useLibrary();
  const { settings } = useSettings();
  const { push } = useToast();
  const [editing, setEditing] = useState(false);

  const mistake = mistakeById(question.mistakeId);
  const chapter = chapterById(question.chapterId);
  const source = question.sourceId
    ? sources.find((s) => s.id === question.sourceId)
    : undefined;

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
        className={`group flex h-full flex-col justify-between rounded-[12px] border border-line bg-surface p-2 transition-all hover:border-fg/20 hover:shadow-sm sm:p-2 cursor-pointer select-none ${
          question.stashed ? "opacity-60" : ""
        }`}
      >
      <div>
        {/* Top: Image Preview / No image placeholder */}
        <div className="relative flex aspect-[16/10] w-full items-center justify-center overflow-hidden rounded-[8px] border border-line bg-bg">
          {url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={url}
              alt={`Question — ${chapter?.name ?? "chapter"}`}
              className="h-full w-full object-contain"
              loading="lazy"
            />
          ) : (
            <span className="text-[12px] text-muted">No image yet</span>
          )}
        </div>

        {/* Text information: Chapter name only */}
        <div className="mt-2 min-w-0">
          <div className="truncate text-[13.5px] font-semibold text-fg">
            {chapter?.name ?? "Unknown Chapter"}
          </div>

          {mistake && (
            <div className="mt-1 inline-flex items-center gap-1.5 truncate text-[11.5px] text-muted">
              <MistakeDot tone={mistake.tone} />
              <span>{mistake.label}</span>
            </div>
          )}
        </div>
      </div>

      {/* Answer & note preview when global setting is active */}
      {settings.showAnswers && (question.answerKey || question.note) && (
        <div
          className="fade-in mt-1.5 space-y-0.5 rounded-[5px] border border-line bg-soft/40 px-2 py-1 text-[11.5px]"
          onClick={(e) => e.stopPropagation()}
        >
          {question.answerKey && (
            <p>
              <span className="text-muted">Ans: </span>
              <span className="tnum font-medium">{question.answerKey}</span>
            </p>
          )}
          {question.note && <p className="line-clamp-2">{question.note}</p>}
        </div>
      )}

      {/* Thin sleek footer: 1 storey horizontal */}
      <footer
        className="mt-2 flex items-center justify-between gap-2 border-t border-line/50 pt-1.5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex min-w-0 items-center gap-1.5">
          <RevisionBadge count={question.revisionCount} />
          {source && (
            <span
              className="truncate text-[11.5px] text-muted max-w-[120px]"
              title={source.name}
            >
              {source.name}
            </span>
          )}
        </div>
        <div className="flex items-center gap-0.5 shrink-0">
          <IconButton
            name="pencil"
            label="Edit tags"
            tooltipSide="top"
            size={14}
            className="!h-6 !w-6"
            onClick={(e) => {
              e.stopPropagation();
              setEditing(true);
            }}
          />
          <ConfirmAction
            icon="trash"
            label="Delete question"
            tooltipSide="top"
            size={14}
            className="!h-6 !w-6"
            warning="Delete forever?"
            confirmText="Delete"
            onConfirm={() => {
              void deleteQuestion(question.id);
              push("Question deleted");
            }}
          />
        </div>
      </footer>
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
