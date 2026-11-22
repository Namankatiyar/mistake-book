import { PGlite } from "@electric-sql/pglite";
import { drizzle, type PgliteDatabase } from "drizzle-orm/pglite";
import { eq, desc } from "drizzle-orm";
import * as schema from "@/db/schema";
import type { Question, Source } from "./model";

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
    subjectId: row.subjectId,
    chapterId: row.chapterId,
    mistakeId: row.mistakeId,
    sourceId: row.sourceId,
    answerKey: row.answerKey,
    note: row.note,
    revisionCount: row.revisionCount,
    lastRevisionDay: row.lastRevisionDay,
    stashed: Boolean(row.stashed),
  };
}

export async function loadAll(): Promise<{
  questions: Question[];
  sources: Source[];
}> {
  if (!isBrowser()) return { questions: [], sources: [] };
  const { db } = await getDb();
  const [qRows, sRows] = await Promise.all([
    db.select().from(schema.questions).orderBy(desc(schema.questions.createdAt)),
    db.select().from(schema.sources),
  ]);

  const questions = qRows.map(mapRowToQuestion);
  const sources = sRows
    .map((r) => ({
      id: r.id,
      name: r.name,
      createdAt: Number(r.createdAt),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return { questions, sources };
}

export async function putQuestion(q: Question): Promise<void> {
  const { db } = await getDb();
  const imageBytes = await blobToUint8Array(q.image);
  await db
    .insert(schema.questions)
    .values({
      id: q.id,
      image: imageBytes,
      createdAt: q.createdAt,
      subjectId: q.subjectId,
      chapterId: q.chapterId,
      mistakeId: q.mistakeId,
      sourceId: q.sourceId,
      answerKey: q.answerKey,
      note: q.note,
      revisionCount: q.revisionCount,
      lastRevisionDay: q.lastRevisionDay,
      stashed: q.stashed,
    })
    .onConflictDoUpdate({
      target: schema.questions.id,
      set: {
        image: imageBytes,
        createdAt: q.createdAt,
        subjectId: q.subjectId,
        chapterId: q.chapterId,
        mistakeId: q.mistakeId,
        sourceId: q.sourceId,
        answerKey: q.answerKey,
        note: q.note,
        revisionCount: q.revisionCount,
        lastRevisionDay: q.lastRevisionDay,
        stashed: q.stashed,
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
  await db.delete(schema.questions).where(eq(schema.questions.id, id));
}

export async function putSource(s: Source): Promise<void> {
  const { db } = await getDb();
  await db
    .insert(schema.sources)
    .values({
      id: s.id,
      name: s.name,
      createdAt: s.createdAt,
    })
    .onConflictDoUpdate({
      target: schema.sources.id,
      set: {
        name: s.name,
        createdAt: s.createdAt,
      },
    });
}

export async function removeSource(id: string): Promise<void> {
  const { db } = await getDb();
  await db.delete(schema.sources).where(eq(schema.sources.id, id));
}
