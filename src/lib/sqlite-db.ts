import SQLiteAsyncESMFactory from "wa-sqlite/dist/wa-sqlite-async.mjs";
import * as SQLite from "wa-sqlite";
import { IDBBatchAtomicVFS } from "wa-sqlite/src/examples/IDBBatchAtomicVFS.js";
import { drizzle, type SqliteRemoteDatabase } from "drizzle-orm/sqlite-proxy";
import { eq, desc, inArray, count, and, isNull } from "drizzle-orm";
import * as schema from "@/db/schema";
import { computeBytesHash } from "./image-hash";
import { newId, type Question, type Source } from "./model";

export type SqliteDatabase = SqliteRemoteDatabase<typeof schema>;

export type SqliteInstance = {
  sqlite3: any;
  rawDb: number;
  db: SqliteDatabase;
};

// Strict FIFO async mutex to ensure non-reentrant SQLite WASM statements never interleave
class AsyncMutex {
  private queue: Promise<unknown> = Promise.resolve();

  run<T>(fn: () => Promise<T>): Promise<T> {
    const res = this.queue.then(fn, fn);
    this.queue = res.then(
      () => {},
      () => {}
    );
    return res;
  }
}

const dbMutex = new AsyncMutex();

let instancePromise: Promise<SqliteInstance> | null = null;

const MIGRATION_KEY = "sqlite_migrated_v1";

export function isBrowser(): boolean {
  return typeof window !== "undefined";
}

// Convert Blob -> Uint8Array for SQLite BLOB storage
async function blobToUint8Array(blob: Blob): Promise<Uint8Array> {
  const buffer = await blob.arrayBuffer();
  return new Uint8Array(buffer);
}

// Convert BLOB (Uint8Array) -> Blob
function uint8ArrayToBlob(bytes: Uint8Array, type = "image/png"): Blob {
  const safeBytes = bytes instanceof Uint8Array ? bytes : new Uint8Array(0);
  return new Blob([safeBytes as unknown as BlobPart], { type });
}

// Coerce binary values (including empty views) to Uint8Array
function toUint8Array(value: unknown): Uint8Array {
  if (value instanceof Uint8Array) return value;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (ArrayBuffer.isView(value)) {
    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  }
  if (Array.isArray(value)) return new Uint8Array(value);
  return new Uint8Array(0);
}

// Normalize Drizzle sqlite-proxy parameters for wa-sqlite
function normalizeSqliteParams(params?: unknown[]): unknown[] | undefined {
  if (!params || params.length === 0) return params;
  return params.map((p) => {
    if (typeof p === "boolean") {
      return p ? 1 : 0;
    }
    if (p instanceof Uint8Array) {
      return p;
    }
    if (p instanceof ArrayBuffer) {
      return new Uint8Array(p);
    }
    if (ArrayBuffer.isView(p)) {
      return new Uint8Array(p.buffer, p.byteOffset, p.byteLength);
    }
    return p;
  });
}

// Patch wa-sqlite's bind_blob so 0-byte BLOBs bind as X'' instead of SQL NULL
// (wa-sqlite calls sqlite3_malloc(0) -> 0/NULL, which sqlite3_bind_blob treats as NULL).
function patchEmptyBlobBinding(sqlite3: any, wasmModule: any, rawDb: number): void {
  const originalBindBlob = sqlite3.bind_blob.bind(sqlite3);
  const SQLITE_TRANSIENT = -1;
  const rawBindBlob = wasmModule.cwrap("sqlite3_bind_blob", "number", [
    "number",
    "number",
    "number",
    "number",
    "number",
  ]);
  const SQLiteErrorCtor = (
    SQLite as unknown as {
      SQLiteError?: new (message: string, code: number) => Error;
    }
  ).SQLiteError;

  sqlite3.bind_blob = (stmt: number, index: number, value: Uint8Array | number[]) => {
    const byteLength = value instanceof Uint8Array ? value.byteLength : value.length;
    if (byteLength === 0) {
      // Validate statement handle just like wa-sqlite's bind_blob
      sqlite3.bind_parameter_count(stmt);
      const ptr = wasmModule._sqlite3_malloc(1);
      if (!ptr) {
        const SQLITE_NOMEM = 7;
        throw SQLiteErrorCtor
          ? new SQLiteErrorCtor("out of memory", SQLITE_NOMEM)
          : new Error("SQLite out of memory");
      }
      let rc: number;
      try {
        rc = rawBindBlob(stmt, index, ptr, 0, SQLITE_TRANSIENT);
      } finally {
        wasmModule._sqlite3_free(ptr);
      }
      if (rc !== SQLite.SQLITE_OK) {
        const message = wasmModule.ccall("sqlite3_errmsg", "string", ["number"], [rawDb]);
        throw SQLiteErrorCtor
          ? new SQLiteErrorCtor(message, rc)
          : new Error(`SQLite error (${rc}): ${message}`);
      }
      return rc;
    }
    return originalBindBlob(stmt, index, value);
  };
}

function mapRowToQuestion(row: schema.DbQuestion): Question {
  return {
    id: row.id,
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

async function checkIndexedDbExists(dbName: string): Promise<boolean> {
  return new Promise((resolve) => {
    let existed = true;
    let req: IDBOpenDBRequest;
    try {
      req = indexedDB.open(dbName);
    } catch {
      resolve(false);
      return;
    }

    req.onupgradeneeded = (event) => {
      // oldVersion 0 indicates the database did not exist prior to this call
      if (event.oldVersion === 0) {
        existed = false;
        try {
          req.transaction?.abort();
        } catch {
          // ignore abort error
        }
      }
    };

    req.onsuccess = () => {
      try {
        req.result.close();
      } catch {}
      resolve(existed);
    };

    req.onerror = () => {
      resolve(false);
    };
  });
}

async function checkLegacyPgliteExists(): Promise<boolean> {
  if (typeof window === "undefined" || typeof indexedDB === "undefined") return false;
  try {
    if (typeof indexedDB.databases === "function") {
      const dbs = await indexedDB.databases();
      return dbs.some(
        (db) =>
          db.name &&
          (db.name.includes("mistake-book-db") || db.name.includes("/pglite/mistake-book-db"))
      );
    }

    // Graceful fallback for browsers where indexedDB.databases is not available (e.g. Firefox)
    const [exists1, exists2] = await Promise.all([
      checkIndexedDbExists("/pglite/mistake-book-db"),
      checkIndexedDbExists("mistake-book-db"),
    ]);
    return exists1 || exists2;
  } catch (e) {
    console.warn("[Migration] Could not inspect indexedDB databases:", e);
    return false;
  }
}

async function migrateLegacyPgliteData(
  sqliteDb: SqliteDatabase,
  sqlite3: any,
  rawDb: number
): Promise<void> {
  if (typeof window === "undefined") return;
  if (localStorage.getItem(MIGRATION_KEY) === "true") return;

  const hasLegacy = await checkLegacyPgliteExists();
  if (!hasLegacy) {
    // No legacy database detected; flag as migrated so we never run this check again
    localStorage.setItem(MIGRATION_KEY, "true");
    return;
  }

  console.log("[Migration] Legacy PGlite database detected. Starting migration to SQLite WASM...");

  try {
    const { PGlite } = await import("@electric-sql/pglite");
    const pg = new PGlite("idb://mistake-book-db");

    // Check if questions table exists in PGlite
    const tableCheck = await pg.query<{ exists: boolean }>(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables WHERE table_name = 'questions'
      ) as exists;
    `);

    if (!tableCheck.rows[0]?.exists) {
      console.log("[Migration] No existing questions table found in PGlite. Skipping.");
      await pg.close();
      localStorage.setItem(MIGRATION_KEY, "true");
      return;
    }

    // Read all records from PGlite
    const sourcesRes = await pg.query<{
      id: string;
      name: string;
      created_at: string | number;
      updated_at: string | number;
      synced_at: string | number | null;
      is_deleted: boolean;
    }>("SELECT * FROM sources;");

    const questionsRes = await pg.query<{
      id: string;
      image: Uint8Array | null;
      created_at: string | number;
      updated_at: string | number;
      synced_at: string | number | null;
      subject_id: string;
      chapter_id: string;
      mistake_id: string | null;
      source_id: string | null;
      answer_key: string;
      note: string;
      revision_count: number;
      last_revision_day: string | null;
      stashed: boolean;
      drive_file_id: string | null;
      is_deleted: boolean;
    }>("SELECT * FROM questions;");

    let syncQueueRes: any = { rows: [] };
    try {
      syncQueueRes = await pg.query("SELECT * FROM sync_queue;");
    } catch {
      // Table might not exist in early versions
    }

    let syncMetadataRes: any = { rows: [] };
    try {
      syncMetadataRes = await pg.query("SELECT * FROM sync_metadata;");
    } catch {
      // Table might not exist in early versions
    }

    console.log(
      `[Migration] Found ${questionsRes.rows.length} questions, ${sourcesRes.rows.length} sources to migrate.`
    );

    // Copy to SQLite in a transaction
    await dbMutex.run(() => sqlite3.exec(rawDb, "BEGIN TRANSACTION;"));
    try {
      // Insert sources
      for (const s of sourcesRes.rows) {
        await sqliteDb
          .insert(schema.sources)
          .values({
            id: s.id,
            name: s.name ?? "",
            createdAt: Number(s.created_at),
            updatedAt: Number(s.updated_at ?? s.created_at),
            syncedAt: s.synced_at != null ? Number(s.synced_at) : null,
            isDeleted: Boolean(s.is_deleted),
          })
          .onConflictDoNothing();
      }

      // Insert questions
      for (const q of questionsRes.rows) {
        await sqliteDb
          .insert(schema.questions)
          .values({
            id: q.id,
            createdAt: Number(q.created_at),
            updatedAt: Number(q.updated_at ?? q.created_at),
            syncedAt: q.synced_at != null ? Number(q.synced_at) : null,
            subjectId: q.subject_id ?? "",
            chapterId: q.chapter_id ?? "",
            mistakeId: q.mistake_id ?? null,
            sourceId: q.source_id ?? null,
            answerKey: q.answer_key ?? "",
            note: q.note ?? "",
            revisionCount: Number(q.revision_count ?? 0),
            lastRevisionDay: q.last_revision_day ?? null,
            stashed: Boolean(q.stashed),
            driveFileId: q.drive_file_id ?? null,
            isDeleted: Boolean(q.is_deleted),
          })
          .onConflictDoNothing();

        const imageBytes = toUint8Array(q.image);
        await sqliteDb
          .insert(schema.questionImages)
          .values({
            questionId: q.id,
            image: imageBytes,
          })
          .onConflictDoNothing();
      }

      // Insert sync queue
      for (const sq of syncQueueRes.rows) {
        await sqliteDb
          .insert(schema.syncQueue)
          .values({
            id: sq.id,
            entityType: sq.entity_type,
            entityId: sq.entity_id,
            action: sq.action,
            createdAt: Number(sq.created_at),
            attempts: Number(sq.attempts ?? 0),
            lastAttemptAt: sq.last_attempt_at != null ? Number(sq.last_attempt_at) : null,
            lastError: sq.last_error ?? null,
            status: sq.status ?? "pending",
          })
          .onConflictDoNothing();
      }

      // Insert sync metadata
      for (const sm of syncMetadataRes.rows) {
        await sqliteDb
          .insert(schema.syncMetadata)
          .values({
            key: sm.key,
            value: sm.value,
            updatedAt: Number(sm.updated_at),
          })
          .onConflictDoNothing();
      }

      await dbMutex.run(() => sqlite3.exec(rawDb, "COMMIT;"));
    } catch (txErr) {
      await dbMutex.run(() => sqlite3.exec(rawDb, "ROLLBACK;"));
      throw txErr;
    }

    // Verify row counts
    const [qCount] = await sqliteDb.select({ count: count() }).from(schema.questions);
    const [sCount] = await sqliteDb.select({ count: count() }).from(schema.sources);

    console.log(`[Migration] SQLite verified: ${qCount?.count} questions, ${sCount?.count} sources.`);

    if (
      Number(qCount?.count ?? 0) >= questionsRes.rows.length &&
      Number(sCount?.count ?? 0) >= sourcesRes.rows.length
    ) {
      localStorage.setItem(MIGRATION_KEY, "true");
      console.log("[Migration] Migration from PGlite to SQLite completed successfully.");
    } else {
      console.error(
        "[Migration] Row count verification mismatch after migration. Not flagging complete."
      );
    }

    await pg.close();
  } catch (err) {
    console.error("[Migration] Failed to migrate PGlite data to SQLite:", err);
  }
}

export async function getDb(): Promise<SqliteInstance> {
  if (!isBrowser()) {
    throw new Error("SQLite client-side database cannot run during SSR");
  }

  if (!instancePromise) {
    instancePromise = (async () => {
      // Initialize wa-sqlite WASM module
      const wasmModule = await SQLiteAsyncESMFactory({
        locateFile: (file: string) => `/${file}`,
      });
      const sqlite3 = SQLite.Factory(wasmModule);

      // Register IDBBatchAtomicVFS for durable, cross-tab IndexedDB storage without COOP/COEP
      const vfs = new IDBBatchAtomicVFS("mistake-book-sqlite-vfs");
      sqlite3.vfs_register(vfs, true);

      // Open persistent database
      const rawDb = await sqlite3.open_v2(
        "mistake-book.db",
        SQLite.SQLITE_OPEN_READWRITE | SQLite.SQLITE_OPEN_CREATE | SQLite.SQLITE_OPEN_URI,
        "mistake-book-sqlite-vfs"
      );

      // Ensure 0-byte Uint8Array / binary BLOBs bind as X'' instead of SQL NULL
      patchEmptyBlobBinding(sqlite3, wasmModule, rawDb);

      await sqlite3.exec(rawDb, "PRAGMA foreign_keys = ON;");

      // Setup schema tables and indices
      await sqlite3.exec(
        rawDb,
        `
        CREATE TABLE IF NOT EXISTS sources (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL,
          synced_at INTEGER,
          is_deleted INTEGER NOT NULL DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS questions (
          id TEXT PRIMARY KEY,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL,
          synced_at INTEGER,
          subject_id TEXT NOT NULL,
          chapter_id TEXT NOT NULL,
          mistake_id TEXT,
          source_id TEXT REFERENCES sources(id) ON DELETE SET NULL,
          answer_key TEXT NOT NULL DEFAULT '',
          note TEXT NOT NULL DEFAULT '',
          revision_count INTEGER NOT NULL DEFAULT 0,
          last_revision_day TEXT,
          stashed INTEGER NOT NULL DEFAULT 0,
          drive_file_id TEXT,
          is_deleted INTEGER NOT NULL DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS question_images (
          question_id TEXT PRIMARY KEY REFERENCES questions(id) ON DELETE CASCADE,
          image BLOB NOT NULL,
          image_hash TEXT
        );

        CREATE INDEX IF NOT EXISTS idx_questions_created_at ON questions(created_at);
        CREATE INDEX IF NOT EXISTS idx_questions_subject ON questions(subject_id);
        CREATE INDEX IF NOT EXISTS idx_question_images_hash ON question_images(image_hash);

        CREATE TABLE IF NOT EXISTS sync_queue (
          id TEXT PRIMARY KEY,
          entity_type TEXT NOT NULL,
          entity_id TEXT NOT NULL,
          action TEXT NOT NULL,
          created_at INTEGER NOT NULL,
          attempts INTEGER NOT NULL DEFAULT 0,
          last_attempt_at INTEGER,
          last_error TEXT,
          status TEXT NOT NULL DEFAULT 'pending'
        );
        CREATE INDEX IF NOT EXISTS idx_sync_queue_status ON sync_queue(status, created_at);

        CREATE TABLE IF NOT EXISTS sync_metadata (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL,
          updated_at INTEGER NOT NULL
        );
      `
      );

      // Check for legacy schema migration (questions table containing 'image' column)
      let hasImageColumn = false;
      for await (const stmt of sqlite3.statements(rawDb, "PRAGMA table_info(questions);")) {
        while ((await sqlite3.step(stmt)) === SQLite.SQLITE_ROW) {
          const row = sqlite3.row(stmt);
          if (row && (row[1] === "image" || (row as any).name === "image")) {
            hasImageColumn = true;
            break;
          }
        }
      }

      if (hasImageColumn) {
        await sqlite3.exec(rawDb, "PRAGMA foreign_keys = OFF;");
        await sqlite3.exec(rawDb, "BEGIN TRANSACTION;");
        try {
          await sqlite3.exec(
            rawDb,
            `
            INSERT OR IGNORE INTO question_images (question_id, image)
            SELECT id, image FROM questions WHERE image IS NOT NULL;

            CREATE TABLE questions_v2 (
              id TEXT PRIMARY KEY,
              created_at INTEGER NOT NULL,
              updated_at INTEGER NOT NULL,
              synced_at INTEGER,
              subject_id TEXT NOT NULL,
              chapter_id TEXT NOT NULL,
              mistake_id TEXT,
              source_id TEXT REFERENCES sources(id) ON DELETE SET NULL,
              answer_key TEXT NOT NULL DEFAULT '',
              note TEXT NOT NULL DEFAULT '',
              revision_count INTEGER NOT NULL DEFAULT 0,
              last_revision_day TEXT,
              stashed INTEGER NOT NULL DEFAULT 0,
              drive_file_id TEXT,
              is_deleted INTEGER NOT NULL DEFAULT 0
            );

            INSERT INTO questions_v2 (
              id, created_at, updated_at, synced_at, subject_id, chapter_id,
              mistake_id, source_id, answer_key, note, revision_count,
              last_revision_day, stashed, drive_file_id, is_deleted
            )
            SELECT
              id, created_at, updated_at, synced_at, subject_id, chapter_id,
              mistake_id, source_id, answer_key, note, revision_count,
              last_revision_day, stashed, drive_file_id, is_deleted
            FROM questions;

            DROP TABLE questions;
            ALTER TABLE questions_v2 RENAME TO questions;

            CREATE INDEX IF NOT EXISTS idx_questions_created_at ON questions(created_at);
            CREATE INDEX IF NOT EXISTS idx_questions_subject ON questions(subject_id);
          `
          );
          await sqlite3.exec(rawDb, "COMMIT;");
        } catch (migErr) {
          await sqlite3.exec(rawDb, "ROLLBACK;");
          throw migErr;
        } finally {
          await sqlite3.exec(rawDb, "PRAGMA foreign_keys = ON;");
        }
      }

      // Drizzle adapter using sqlite-proxy with strict FIFO AsyncMutex
      const db = drizzle(
        (sql: string, params: any[], method: "run" | "all" | "values" | "get") => {
          return dbMutex.run(async () => {
            const normalizedParams = normalizeSqliteParams(params);
            const bindParams = (stmt: number) => {
              if (normalizedParams && normalizedParams.length > 0) {
                sqlite3.bind_collection(stmt, normalizedParams);
              }
            };

            if (method === "run") {
              for await (const stmt of sqlite3.statements(rawDb, sql)) {
                bindParams(stmt);
                await sqlite3.step(stmt);
              }
              return { rows: [] };
            }

            if (method === "get") {
              let row: any = undefined;
              for await (const stmt of sqlite3.statements(rawDb, sql)) {
                bindParams(stmt);
                const rc = await sqlite3.step(stmt);
                if (rc === SQLite.SQLITE_ROW) {
                  row = sqlite3.row(stmt);
                }
              }
              return { rows: row };
            }

            // method === "all" or "values"
            const rows: any[] = [];
            for await (const stmt of sqlite3.statements(rawDb, sql)) {
              bindParams(stmt);
              while ((await sqlite3.step(stmt)) === SQLite.SQLITE_ROW) {
                rows.push(sqlite3.row(stmt));
              }
            }
            return { rows };
          });
        },
        { schema }
      );

      // Run seamless migration from legacy PGlite if needed
      await migrateLegacyPgliteData(db, sqlite3, rawDb);

      return { sqlite3, rawDb, db };
    })().catch((err) => {
      // Prevent permanently poisoning singleton on transient failure
      instancePromise = null;
      throw err;
    });
  }

  return instancePromise;
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
  const updatedAt = q.updatedAt || Date.now();
  await db
    .insert(schema.questions)
    .values({
      id: q.id,
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
  const { sqlite3, rawDb } = await getDb();
  await dbMutex.run(() => sqlite3.exec(rawDb, "BEGIN TRANSACTION;"));
  try {
    for (const q of qs) {
      await putQuestion(q);
    }
    await dbMutex.run(() => sqlite3.exec(rawDb, "COMMIT;"));
  } catch (err) {
    await dbMutex.run(() => sqlite3.exec(rawDb, "ROLLBACK;"));
    throw err;
  }
}

export async function putQuestionWithImage(
  q: Question,
  image: Blob,
  imageHash?: string | null
): Promise<void> {
  const imageBytes = await blobToUint8Array(image);
  const { db, sqlite3, rawDb } = await getDb();
  const updatedAt = q.updatedAt || Date.now();

  await dbMutex.run(() => sqlite3.exec(rawDb, "BEGIN TRANSACTION;"));
  try {
    await db
      .insert(schema.questions)
      .values({
        id: q.id,
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

    await db
      .insert(schema.questionImages)
      .values({
        questionId: q.id,
        image: imageBytes,
        imageHash: imageHash ?? null,
      })
      .onConflictDoUpdate({
        target: schema.questionImages.questionId,
        set: {
          image: imageBytes,
          ...(imageHash !== undefined ? { imageHash } : {}),
        },
      });

    await dbMutex.run(() => sqlite3.exec(rawDb, "COMMIT;"));
  } catch (err) {
    await dbMutex.run(() => sqlite3.exec(rawDb, "ROLLBACK;"));
    throw err;
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
    .select({ image: schema.questionImages.image })
    .from(schema.questionImages)
    .where(eq(schema.questionImages.questionId, id))
    .limit(1);

  if (rows.length === 0 || !rows[0].image) return null;
  return uint8ArrayToBlob(rows[0].image);
}

export async function getQuestionImagesFromDb(ids: string[]): Promise<Map<string, Blob>> {
  if (!isBrowser() || ids.length === 0) return new Map();
  const { db } = await getDb();
  const rows = await db
    .select({
      id: schema.questionImages.questionId,
      image: schema.questionImages.image,
    })
    .from(schema.questionImages)
    .where(inArray(schema.questionImages.questionId, ids));

  const result = new Map<string, Blob>();
  for (const row of rows) {
    if (row.image) {
      result.set(row.id, uint8ArrayToBlob(row.image));
    }
  }
  return result;
}

export async function getQuestionImageBytesFromDb(id: string): Promise<Uint8Array | null> {
  if (!isBrowser()) return null;
  const { db } = await getDb();
  const rows = await db
    .select({ image: schema.questionImages.image })
    .from(schema.questionImages)
    .where(eq(schema.questionImages.questionId, id))
    .limit(1);

  if (rows.length === 0 || !rows[0].image) return null;
  return toUint8Array(rows[0].image);
}

export async function upsertQuestionImageBytes(
  questionId: string,
  image: Uint8Array,
  imageHash?: string | null
): Promise<void> {
  if (!isBrowser()) return;
  const { db } = await getDb();
  const safeBytes = toUint8Array(image);

  await db
    .insert(schema.questionImages)
    .values({
      questionId,
      image: safeBytes,
      imageHash: imageHash ?? null,
    })
    .onConflictDoUpdate({
      target: schema.questionImages.questionId,
      set: {
        image: safeBytes,
        ...(imageHash !== undefined ? { imageHash } : {}),
      },
    });
}

export async function updateQuestionImageHash(
  questionId: string,
  imageHash: string
): Promise<void> {
  if (!isBrowser()) return;
  const { db } = await getDb();
  await db
    .update(schema.questionImages)
    .set({
      imageHash,
    })
    .where(eq(schema.questionImages.questionId, questionId));
}

export async function hasActiveQuestionImageHash(hash: string): Promise<boolean> {
  if (!isBrowser() || !hash) return false;
  const { db } = await getDb();

  const match = await db
    .select({ questionId: schema.questionImages.questionId })
    .from(schema.questionImages)
    .innerJoin(schema.questions, eq(schema.questionImages.questionId, schema.questions.id))
    .where(and(eq(schema.questions.isDeleted, false), eq(schema.questionImages.imageHash, hash)))
    .limit(1);

  if (match.length > 0) {
    return true;
  }

  // Lazily compute and persist hashes for legacy active rows where image_hash is NULL
  const legacyRows = await db
    .select({ questionId: schema.questionImages.questionId })
    .from(schema.questionImages)
    .innerJoin(schema.questions, eq(schema.questionImages.questionId, schema.questions.id))
    .where(and(eq(schema.questions.isDeleted, false), isNull(schema.questionImages.imageHash)));

  const BATCH_SIZE = 10;
  for (let i = 0; i < legacyRows.length; i += BATCH_SIZE) {
    const batchIds = legacyRows.slice(i, i + BATCH_SIZE).map((r) => r.questionId);
    const imageRows = await db
      .select({
        questionId: schema.questionImages.questionId,
        image: schema.questionImages.image,
      })
      .from(schema.questionImages)
      .where(inArray(schema.questionImages.questionId, batchIds));

    for (const row of imageRows) {
      const bytes = toUint8Array(row.image);
      const computedHash = await computeBytesHash(bytes);
      await updateQuestionImageHash(row.questionId, computedHash);
      if (computedHash === hash) {
        return true;
      }
    }
  }

  return false;
}
