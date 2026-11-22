import { pgTable, text, integer, boolean, customType, bigint } from "drizzle-orm/pg-core";

// Custom BYTEA mapping directly to Uint8Array for zero-overhead binary blob storage
export const bytea = customType<{ data: Uint8Array }>({
  dataType() {
    return "bytea";
  },
});

export const sources = pgTable("sources", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
  updatedAt: bigint("updated_at", { mode: "number" }).notNull(),
  syncedAt: bigint("synced_at", { mode: "number" }),
  isDeleted: boolean("is_deleted").notNull().default(false),
});

export const questions = pgTable("questions", {
  id: text("id").primaryKey(),
  image: bytea("image").notNull(),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
  updatedAt: bigint("updated_at", { mode: "number" }).notNull(),
  syncedAt: bigint("synced_at", { mode: "number" }),
  subjectId: text("subject_id").notNull(),
  chapterId: text("chapter_id").notNull(),
  mistakeId: text("mistake_id"),
  sourceId: text("source_id").references(() => sources.id, { onDelete: "set null" }),
  answerKey: text("answer_key").notNull().default(""),
  note: text("note").notNull().default(""),
  revisionCount: integer("revision_count").notNull().default(0),
  lastRevisionDay: text("last_revision_day"),
  stashed: boolean("stashed").notNull().default(false),
  driveFileId: text("drive_file_id"),
  isDeleted: boolean("is_deleted").notNull().default(false),
});

export const syncQueue = pgTable("sync_queue", {
  id: text("id").primaryKey(),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id").notNull(),
  action: text("action").notNull(),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
  attempts: integer("attempts").notNull().default(0),
  lastAttemptAt: bigint("last_attempt_at", { mode: "number" }),
  lastError: text("last_error"),
  status: text("status").notNull().default("pending"),
});

export const syncMetadata = pgTable("sync_metadata", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: bigint("updated_at", { mode: "number" }).notNull(),
});

export type DbQuestion = typeof questions.$inferSelect;
export type DbSource = typeof sources.$inferSelect;
export type DbSyncQueue = typeof syncQueue.$inferSelect;
export type DbSyncMetadata = typeof syncMetadata.$inferSelect;
