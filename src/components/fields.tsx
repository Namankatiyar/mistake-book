"use client";

import { useState } from "react";
import { useLibrary } from "@/lib/library";
import { MISTAKE_TYPES } from "@/lib/model";
import { SYLLABUS, subjectById } from "@/lib/syllabus";
import { Button, Field, Icon, SearchableChapterSelect, Select } from "./ui";

export function SubjectChapterFields({
  subjectId,
  chapterId,
  onChange,
}: {
  subjectId: string;
  chapterId: string;
  onChange: (subjectId: string, chapterId: string) => void;
}) {
  const subject = subjectById(subjectId) ?? SYLLABUS[0];
  return (
    <>
      <Field label="Subject">
        <Select
          className="w-full"
          value={subject.id}
          onChange={(e) => {
            const next = subjectById(e.target.value) ?? SYLLABUS[0];
            onChange(next.id, next.chapters[0].id);
          }}
        >
          {SYLLABUS.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Chapter">
        <SearchableChapterSelect
          className="w-full"
          subjectId={subject.id}
          value={chapterId}
          onChange={(nextChapterId, nextSubjectId) =>
            onChange(nextSubjectId ?? subject.id, nextChapterId)
          }
        />
      </Field>
    </>
  );
}

export function MistakeField({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (v: string | null) => void;
}) {
  return (
    <Field label="Mistake type">
      <Select
        className="w-full"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value || null)}
      >
        <option value="">No mistake label</option>
        {MISTAKE_TYPES.map((m) => (
          <option key={m.id} value={m.id}>
            {m.label}
          </option>
        ))}
      </Select>
    </Field>
  );
}

const NEW_SOURCE = "__new__";

export function SourceField({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (v: string | null) => void;
}) {
  const { sources, addSource } = useLibrary();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");

  const create = async () => {
    const source = await addSource(name);
    if (source) onChange(source.id);
    setName("");
    setCreating(false);
  };

  if (creating) {
    return (
      <Field label="New source">
        <span className="flex gap-1.5">
          <input
            className="input"
            autoFocus
            data-esc-local
            value={name}
            placeholder="e.g. Allen module 4"
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              // Keep Enter/Escape local so the draft form doesn't save or close.
              if (e.key === "Enter") {
                e.preventDefault();
                e.stopPropagation();
                void create();
              } else if (e.key === "Escape") {
                e.preventDefault();
                e.stopPropagation();
                setCreating(false);
                setName("");
              }
            }}
          />
          <Button size="sm" variant="primary" className="h-8" onClick={() => void create()} disabled={!name.trim()}>
            Add
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-8"
            onClick={() => {
              setCreating(false);
              setName("");
            }}
          >
            <Icon name="x" size={14} />
          </Button>
        </span>
      </Field>
    );
  }

  return (
    <Field label="Source">
      <Select
        className="w-full"
        value={value ?? ""}
        onChange={(e) => {
          if (e.target.value === NEW_SOURCE) {
            setCreating(true);
          } else {
            onChange(e.target.value || null);
          }
        }}
      >
        <option value="">No source</option>
        {sources.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
        <option value={NEW_SOURCE}>New source…</option>
      </Select>
    </Field>
  );
}
