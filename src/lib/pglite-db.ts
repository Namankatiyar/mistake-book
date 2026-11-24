import { PGlite } from "@electric-sql/pglite";
import { drizzle, type PgliteDatabase } from "drizzle-orm/pglite";
import { eq, desc, inArray, count } from "drizzle-orm";
import * as schema from "@/db/schema";
import { newId, type Question, type Source } from "./model";

type PGliteInstance = {
  client: PGlite;
  db: PgliteDatabase<typeof schema>;
};

let instancePromise: Promise<PGliteInstance> | null = null;

export function isBrowser(): boolean {
  return typeof window !== "undefined";
}

export async function getDb(): Promise<PGliteInstance> {
  if (!isBrowser()) {
    throw new Error("PGlite client-side database cannot run during SSR");
  }

  if (!instancePromise) {
    instancePromise = (async () => {
      // Persistent storage in browser IndexedDB
      const client = new PGlite("idb://mistake-book-db");

      // Auto-bootstrap schema with DDL for zero migration bundle overhead
      await client.exec(`
        CREATE TABLE IF NOT EXISTS sources (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          created_at BIGINT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS questions (
          id TEXT PRIMARY KEY,
          image BYTEA NOT NULL,
          created_at BIGINT NOT NULL,
          subject_id TEXT NOT NULL,
          chapter_id TEXT NOT NULL,
          mistake_id TEXT,
          source_id TEXT REFERENCES sources(id) ON DELETE SET NULL,
          answer_key TEXT NOT NULL DEFAULT '',
          note TEXT NOT NULL DEFAULT '',
          revision_count INTEGER NOT NULL DEFAULT 0,
          last_revision_day TEXT,
          stashed BOOLEAN NOT NULL DEFAULT FALSE
        );

        CREATE INDEX IF NOT EXISTS idx_questions_created_at ON questions(created_at);
        CREATE INDEX IF NOT EXISTS idx_questions_subject ON questions(subject_id);

        -- Backward-compatible column additions
        ALTER TABLE questions ADD COLUMN IF NOT EXISTS updated_at BIGINT;
        ALTER TABLE questions ADD COLUMN IF NOT EXISTS synced_at BIGINT;
        ALTER TABLE questions ADD COLUMN IF NOT EXISTS drive_file_id TEXT;
        ALTER TABLE questions ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT FALSE;
        UPDATE questions SET updated_at = created_at WHERE updated_at IS NULL;

        ALTER TABLE sources ADD COLUMN IF NOT EXISTS updated_at BIGINT;
        ALTER TABLE sources ADD COLUMN IF NOT EXISTS synced_at BIGINT;
        ALTER TABLE sources ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT FALSE;
        UPDATE sources SET updated_at = created_at WHERE updated_at IS NULL;

        -- Outbox Queue
        CREATE TABLE IF NOT EXISTS sync_queue (
          id TEXT PRIMARY KEY,
          entity_type TEXT NOT NULL,
          entity_id TEXT NOT NULL,
          action TEXT NOT NULL,
          created_at BIGINT NOT NULL,
          attempts INTEGER NOT NULL DEFAULT 0,
          last_attempt_at BIGINT,
          last_error TEXT,
          status TEXT NOT NULL DEFAULT 'pending'
        );
        CREATE INDEX IF NOT EXISTS idx_sync_queue_status ON sync_queue(status, created_at);

        -- Key-value store for Drive Folder IDs & Sync Checkpoints
        CREATE TABLE IF NOT EXISTS sync_metadata (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL,
          updated_at BIGINT NOT NULL
        );
      `);

      const db = drizzle(client, { schema });
      return { client, db };
    })();
  }

  return instancePromise;
}

// Convert Blob -> Uint8Array for PostgreSQL BYTEA
async function blobToUint8Array(blob: Blob): Promise<Uint8Array> {
  const buffer = await blob.arrayBuffer();
  return new Uint8Array(buffer);
}

// Convert BYTEA (Uint8Array) -> Blob
function uint8ArrayToBlob(bytes: Uint8Array, type = "image/png"): Blob {
  return new Blob([bytes as unknown as BlobPart], { type });
}

function mapRowToQuestion(row: schema.DbQuestion): Question {
  return {
    id: row.id,
    image: uint8ArrayToBlob(row.image),
    createdAt: Number(row.createdAt),
    updatedAt: Number(row.updatedAt ?? row.createdAt),
    syncedAt: row.syncedAt != null ? Number(row.syncedAt) : null,
    subjectId: row.subjectId,
    chapterId: row.chapterId,
    mistakeId: row.mistakeId,
    sourceId: row.sourceId,
    answerKey: row.answerKey,
    note: row.note,
    revisionCount: row.revisionCount,
    lastRevisionDay: row.lastRevisionDay,
    stashed: Boolean(row.stashed),
    driveFileId: row.driveFileId ?? null,
    isDeleted: Boolean(row.isDeleted),
  };
}

export async function loadAll(): Promise<{
  questions: Question[];
  sources: Source[];
}> {
  if (!isBrowser()) return { questions: [], sources: [] };
  const { db } = await getDb();
  const [qRows, sRows] = await Promise.all([
    db
      .select()
      .from(schema.questions)
      .where(eq(schema.questions.isDeleted, false))
      .orderBy(desc(schema.questions.createdAt)),
    db
      .select()
      .from(schema.sources)
      .where(eq(schema.sources.isDeleted, false)),
  ]);

  const questions = qRows.map(mapRowToQuestion);
  const sources = sRows
    .map((r) => ({
      id: r.id,
      name: r.name,
      createdAt: Number(r.createdAt),
      updatedAt: Number(r.updatedAt ?? r.createdAt),
      syncedAt: r.syncedAt != null ? Number(r.syncedAt) : null,
      isDeleted: Boolean(r.isDeleted),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return { questions, sources };
}

export async function loadQuestionsPaginated({
  page = 1,
  pageSize = 30,
}: {
  page?: number;
  pageSize?: number;
} = {}): Promise<{
  questions: Question[];
  total: number;
  sources: Source[];
}> {
  if (!isBrowser()) return { questions: [], total: 0, sources: [] };
  const { db } = await getDb();
  const offset = Math.max(0, (page - 1) * pageSize);

  const [qRows, countRows, sRows] = await Promise.all([
    db
      .select()
      .from(schema.questions)
      .where(eq(schema.questions.isDeleted, false))
      .orderBy(desc(schema.questions.createdAt))
      .limit(pageSize)
      .offset(offset),
    db
      .select({ count: count() })
      .from(schema.questions)
      .where(eq(schema.questions.isDeleted, false)),
    db
      .select()
      .from(schema.sources)
      .where(eq(schema.sources.isDeleted, false)),
  ]);

  const questions = qRows.map(mapRowToQuestion);
  const total = Number(countRows[0]?.count ?? 0);
  const sources = sRows
    .map((r) => ({
      id: r.id,
      name: r.name,
      createdAt: Number(r.createdAt),
      updatedAt: Number(r.updatedAt ?? r.createdAt),
      syncedAt: r.syncedAt != null ? Number(r.syncedAt) : null,
      isDeleted: Boolean(r.isDeleted),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return { questions, total, sources };
}

export async function putQuestion(q: Question): Promise<void> {
  const { db } = await getDb();
  const imageBytes = await blobToUint8Array(q.image);
  const updatedAt = q.updatedAt || Date.now();
  await db
    .insert(schema.questions)
    .values({
      id: q.id,
      image: imageBytes,
      createdAt: q.createdAt,
      updatedAt,
      syncedAt: q.syncedAt ?? null,
      subjectId: q.subjectId,
      chapterId: q.chapterId,
      mistakeId: q.mistakeId,
      sourceId: q.sourceId,
      answerKey: q.answerKey,
      note: q.note,
      revisionCount: q.revisionCount,
      lastRevisionDay: q.lastRevisionDay,
      stashed: q.stashed,
      driveFileId: q.driveFileId ?? null,
      isDeleted: q.isDeleted ?? false,
    })
    .onConflictDoUpdate({
      target: schema.questions.id,
      set: {
        image: imageBytes,
        createdAt: q.createdAt,
        updatedAt,
        syncedAt: q.syncedAt ?? null,
        subjectId: q.subjectId,
        chapterId: q.chapterId,
        mistakeId: q.mistakeId,
        sourceId: q.sourceId,
        answerKey: q.answerKey,
        note: q.note,
        revisionCount: q.revisionCount,
        lastRevisionDay: q.lastRevisionDay,
        stashed: q.stashed,
        driveFileId: q.driveFileId ?? null,
        isDeleted: q.isDeleted ?? false,
      },
    });
}

export async function putQuestions(qs: Question[]): Promise<void> {
  if (qs.length === 0) return;
  for (const q of qs) {
    await putQuestion(q);
  }
}

export async function removeQuestion(id: string): Promise<void> {
  const { db } = await getDb();
  await db
    .update(schema.questions)
    .set({
      isDeleted: true,
      updatedAt: Date.now(),
    })
    .where(eq(schema.questions.id, id));
}

export async function putSource(s: Source): Promise<void> {
  const { db } = await getDb();
  const updatedAt = s.updatedAt || Date.now();
  await db
    .insert(schema.sources)
    .values({
      id: s.id,
      name: s.name,
      createdAt: s.createdAt,
      updatedAt,
      syncedAt: s.syncedAt ?? null,
      isDeleted: s.isDeleted ?? false,
    })
    .onConflictDoUpdate({
      target: schema.sources.id,
      set: {
        name: s.name,
        createdAt: s.createdAt,
        updatedAt,
        syncedAt: s.syncedAt ?? null,
        isDeleted: s.isDeleted ?? false,
      },
    });
}

export async function removeSource(id: string): Promise<void> {
  const { db } = await getDb();
  await db
    .update(schema.sources)
    .set({
      isDeleted: true,
      updatedAt: Date.now(),
    })
    .where(eq(schema.sources.id, id));
}

export async function enqueueSyncItem(
  entityType: string,
  entityId: string,
  action: string
): Promise<void> {
  if (!isBrowser()) return;
  const { db } = await getDb();
  await db.insert(schema.syncQueue).values({
    id: newId(),
    entityType,
    entityId,
    action,
    createdAt: Date.now(),
    attempts: 0,
    status: "pending",
  });
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("mb:sync-enqueue"));
  }
}

export async function getQuestionImageFromDb(id: string): Promise<Blob | null> {
  if (!isBrowser()) return null;
  const { db } = await getDb();
  const rows = await db
    .select({ image: schema.questions.image })
    .from(schema.questions)
    .where(eq(schema.questions.id, id))
    .limit(1);

  if (rows.length === 0 || !rows[0].image) return null;
  return uint8ArrayToBlob(rows[0].image);
}

export async function getQuestionImagesFromDb(ids: string[]): Promise<Map<string, Blob>> {
  if (!isBrowser() || ids.length === 0) return new Map();
  const { db } = await getDb();
  const rows = await db
    .select({ id: schema.questions.id, image: schema.questions.image })
    .from(schema.questions)
    .where(inArray(schema.questions.id, ids));

  const result = new Map<string, Blob>();
  for (const row of rows) {
    if (row.image) {
      result.set(row.id, uint8ArrayToBlob(row.image));
    }
  }
  return result;
}
