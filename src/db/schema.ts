import { pgTable, text, integer, boolean, customType } from "drizzle-orm/pg-core";

// Custom BYTEA mapping directly to Uint8Array for zero-overhead binary blob storage
export const bytea = customType<{ data: Uint8Array }>({
  dataType() {
    return "bytea";
  },
});

export const sources = pgTable("sources", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  createdAt: integer("created_at").notNull(),
});

export const questions = pgTable("questions", {
  id: text("id").primaryKey(),
  image: bytea("image").notNull(),
  createdAt: integer("created_at").notNull(),
  subjectId: text("subject_id").notNull(),
  chapterId: text("chapter_id").notNull(),
  mistakeId: text("mistake_id"),
  sourceId: text("source_id").references(() => sources.id, { onDelete: "set null" }),
  answerKey: text("answer_key").notNull().default(""),
  note: text("note").notNull().default(""),
  revisionCount: integer("revision_count").notNull().default(0),
  lastRevisionDay: text("last_revision_day"),
  stashed: boolean("stashed").notNull().default(false),
});

export type DbQuestion = typeof questions.$inferSelect;
export type DbSource = typeof sources.$inferSelect;
