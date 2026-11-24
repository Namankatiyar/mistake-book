import { sqliteTable, text, integer, customType } from "drizzle-orm/sqlite-core";

// Custom BLOB mapping directly to Uint8Array for zero-overhead binary blob storage
export const blob = customType<{ data: Uint8Array; driverData: Uint8Array }>({
  dataType() {
    return "blob";
  },
  fromDriver(value: Uint8Array): Uint8Array {
    return value;
  },
  toDriver(value: Uint8Array): Uint8Array {
    return value;
  },
});

// Backward-compatibility alias
export const bytea = blob;

export const sources = sqliteTable("sources", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  createdAt: integer("created_at", { mode: "number" }).notNull(),
  updatedAt: integer("updated_at", { mode: "number" }).notNull(),
  syncedAt: integer("synced_at", { mode: "number" }),
  isDeleted: integer("is_deleted", { mode: "boolean" }).notNull().default(false),
});

export const questions = sqliteTable("questions", {
  id: text("id").primaryKey(),
  createdAt: integer("created_at", { mode: "number" }).notNull(),
  updatedAt: integer("updated_at", { mode: "number" }).notNull(),
  syncedAt: integer("synced_at", { mode: "number" }),
  subjectId: text("subject_id").notNull(),
  chapterId: text("chapter_id").notNull(),
  mistakeId: text("mistake_id"),
  sourceId: text("source_id").references(() => sources.id, { onDelete: "set null" }),
  answerKey: text("answer_key").notNull().default(""),
  note: text("note").notNull().default(""),
  revisionCount: integer("revision_count", { mode: "number" }).notNull().default(0),
  lastRevisionDay: text("last_revision_day"),
  stashed: integer("stashed", { mode: "boolean" }).notNull().default(false),
  driveFileId: text("drive_file_id"),
  isDeleted: integer("is_deleted", { mode: "boolean" }).notNull().default(false),
});

export const questionImages = sqliteTable("question_images", {
  questionId: text("question_id")
    .primaryKey()
    .references(() => questions.id, { onDelete: "cascade" }),
  image: blob("image").notNull(),
  imageHash: text("image_hash"),
});

export const syncQueue = sqliteTable("sync_queue", {
  id: text("id").primaryKey(),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id").notNull(),
  action: text("action").notNull(),
  createdAt: integer("created_at", { mode: "number" }).notNull(),
  attempts: integer("attempts", { mode: "number" }).notNull().default(0),
  lastAttemptAt: integer("last_attempt_at", { mode: "number" }),
  lastError: text("last_error"),
  status: text("status").notNull().default("pending"),
});

export const syncMetadata = sqliteTable("sync_metadata", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: integer("updated_at", { mode: "number" }).notNull(),
});

export type DbQuestion = typeof questions.$inferSelect;
export type DbQuestionImage = typeof questionImages.$inferSelect;
export type DbSource = typeof sources.$inferSelect;
export type DbSyncQueue = typeof syncQueue.$inferSelect;
export type DbSyncMetadata = typeof syncMetadata.$inferSelect;
