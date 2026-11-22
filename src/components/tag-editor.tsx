"use client";

import { useState } from "react";
import { useLibrary } from "@/lib/library";
import type { Question } from "@/lib/model";
import { useToast } from "@/lib/toast";
import { MistakeField, SourceField, SubjectChapterFields } from "./fields";
import { Button, IconButton, Modal } from "./ui";

export function TagEditor({
  question,
  open,
  onClose,
}: {
  question: Question;
  open: boolean;
  onClose: () => void;
}) {
  const { updateQuestion } = useLibrary();
  const { push } = useToast();
  const [subjectId, setSubjectId] = useState(question.subjectId);
  const [chapterId, setChapterId] = useState(question.chapterId);
  const [mistakeId, setMistakeId] = useState<string | null>(question.mistakeId);
  const [sourceId, setSourceId] = useState<string | null>(question.sourceId);

  const save = async () => {
    await updateQuestion(question.id, {
      subjectId,
      chapterId,
      mistakeId,
      sourceId,
    });
    push("Tags updated");
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} label="Edit tags">
      <div
        className="flex flex-col"
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <h2 className="text-[16px] font-semibold">Edit tags</h2>
          <IconButton name="x" label="Close" onClick={onClose} />
        </div>
        <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2">
          <SubjectChapterFields
            subjectId={subjectId}
            chapterId={chapterId}
            onChange={(s, c) => {
              setSubjectId(s);
              setChapterId(c);
            }}
          />
          <MistakeField value={mistakeId} onChange={setMistakeId} />
          <SourceField value={sourceId} onChange={setSourceId} />
        </div>
        <div className="flex justify-end gap-2 border-t border-line px-4 py-3">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={() => void save()}>
            Save tags
          </Button>
        </div>
      </div>
    </Modal>
  );
}
