import type { PgliteDatabase } from "drizzle-orm/pglite";
import * as schema from "@/db/schema";
import { eq, asc, isNotNull, and, or, isNull } from "drizzle-orm";
import { subjectById, chapterById } from "@/lib/syllabus";
import { newId } from "./model";
import {
  findOrCreateFolder,
  resolveChapterFolder,
  uploadImage,
  downloadImage,
  trashFile,
  getManifest,
  uploadManifest,
  computeBytesHash,
  formatQuestionFileName,
  type ManifestData,
  type ManifestQuestion,
  type ManifestSource,
} from "./drive-api";

export type SyncStatus = "idle" | "syncing" | "error" | "offline" | "unauthenticated";

export type SyncProgress = {
  status: SyncStatus;
  pending: number;
  processed: number;
  total: number;
  lastError?: string;
  lastSyncedAt?: number;
};

export type SyncStatusListener = (progress: SyncProgress) => void;

async function processWithRateLimit<T>(
  items: T[],
  concurrency: number,
  pauseMs: number,
  fn: (item: T) => Promise<void>
): Promise<void> {
  let index = 0;
  const workerCount = Math.min(concurrency, items.length);
  if (workerCount === 0) return;

  const workers = Array.from({ length: workerCount }, async () => {
    while (index < items.length) {
      const currentIndex = index++;
      const item = items[currentIndex];
      await fn(item);
      if (pauseMs > 0 && index < items.length) {
        await new Promise((resolve) => setTimeout(resolve, pauseMs));
      }
    }
  });

  await Promise.all(workers);
}

/**
 * Scans local questions and sources for any active items where syncedAt IS NULL
 * or driveFileId IS NULL, and enqueues them to sync_queue if not already pending/queued.
 */
export async function ensureUnsyncedEnqueued(
  db: PgliteDatabase<typeof schema>
): Promise<void> {
  const existingQueue = await db
    .select({
      entityType: schema.syncQueue.entityType,
      entityId: schema.syncQueue.entityId,
    })
    .from(schema.syncQueue);

  const queuedQuestionIds = new Set(
    existingQueue
      .filter((item) => item.entityType === "question")
      .map((item) => item.entityId)
  );

  const queuedSourceIds = new Set(
    existingQueue
      .filter((item) => item.entityType === "source")
      .map((item) => item.entityId)
  );

  // 1. Scan active questions where syncedAt IS NULL or driveFileId IS NULL
  const unsyncedQuestions = await db
    .select({ id: schema.questions.id })
    .from(schema.questions)
    .where(
      and(
        eq(schema.questions.isDeleted, false),
        or(isNull(schema.questions.syncedAt), isNull(schema.questions.driveFileId))
      )
    );

  const now = Date.now();
  for (const q of unsyncedQuestions) {
    if (!queuedQuestionIds.has(q.id)) {
      await db.insert(schema.syncQueue).values({
        id: newId(),
        entityType: "question",
        entityId: q.id,
        action: "upsert",
        createdAt: now,
        attempts: 0,
        status: "pending",
      });
      queuedQuestionIds.add(q.id);
    }
  }

  // 2. Scan active sources where syncedAt IS NULL
  const unsyncedSources = await db
    .select({ id: schema.sources.id })
    .from(schema.sources)
    .where(
      and(
        eq(schema.sources.isDeleted, false),
        isNull(schema.sources.syncedAt)
      )
    );

  for (const s of unsyncedSources) {
    if (!queuedSourceIds.has(s.id)) {
      await db.insert(schema.syncQueue).values({
        id: newId(),
        entityType: "source",
        entityId: s.id,
        action: "upsert",
        createdAt: now,
        attempts: 0,
        status: "pending",
      });
      queuedSourceIds.add(s.id);
    }
  }
}

export class SyncRunner {
  private getDb: () => Promise<{ db: PgliteDatabase<typeof schema> }>;
  private listeners: Set<SyncStatusListener> = new Set();
  private progress: SyncProgress = {
    status: "idle",
    pending: 0,
    processed: 0,
    total: 0,
  };
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private syncPromise: Promise<void> | null = null;
  private isDestroyed = false;
  private onlineHandler: (() => void) | null = null;
  private offlineHandler: (() => void) | null = null;
  private enqueueHandler: (() => void) | null = null;

  constructor(getDb: () => Promise<{ db: PgliteDatabase<typeof schema> }>) {
    this.getDb = getDb;

    if (typeof window !== "undefined") {
      if (!navigator.onLine) {
        this.progress.status = "offline";
      }

      this.onlineHandler = () => {
        if (this.progress.status === "offline") {
          this.updateProgress({ status: "idle" });
        }
        this.schedule(1000);
      };

      this.offlineHandler = () => {
        if (this.debounceTimer) {
          clearTimeout(this.debounceTimer);
          this.debounceTimer = null;
        }
        this.updateProgress({ status: "offline" });
      };

      this.enqueueHandler = () => {
        this.schedule(2000);
      };

      window.addEventListener("online", this.onlineHandler);
      window.addEventListener("offline", this.offlineHandler);
      window.addEventListener("mb:sync-enqueue", this.enqueueHandler);

      this.getDb()
        .then(async ({ db }) => {
          try {
            await ensureUnsyncedEnqueued(db);
            const rows = await db
              .select()
              .from(schema.syncMetadata)
              .where(eq(schema.syncMetadata.key, "last_synced_at"));
            if (rows.length > 0 && rows[0].value) {
              const ts = Number(rows[0].value);
              if (!isNaN(ts)) {
                this.updateProgress({ lastSyncedAt: ts });
              }
            }
          } catch {
            // ignore
          }
        })
        .catch(() => {});
    }
  }

  public getProgress(): SyncProgress {
    return { ...this.progress };
  }

  public subscribe(listener: SyncStatusListener): () => void {
    this.listeners.add(listener);
    try {
      listener(this.getProgress());
    } catch {
      // ignore
    }
    return () => {
      this.listeners.delete(listener);
    };
  }

  public schedule(delayMs: number = 2000): void {
    if (this.isDestroyed) return;
    if (typeof window !== "undefined" && !navigator.onLine) {
      this.updateProgress({ status: "offline" });
      return;
    }

    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = null;
      this.syncNow().catch(() => {});
    }, delayMs);
  }

  public async syncNow(): Promise<void> {
    return this.mergeWithCloud();
  }

  public async mergeWithCloud(): Promise<void> {
    if (this.isDestroyed) return;
    if (this.syncPromise) {
      return this.syncPromise;
    }

    this.syncPromise = this.runMergeWithCloud().finally(() => {
      this.syncPromise = null;
    });

    return this.syncPromise;
  }

  public async runSync(): Promise<void> {
    if (this.isDestroyed) return;
    if (this.syncPromise) {
      return this.syncPromise;
    }

    this.syncPromise = (async () => {
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        this.updateProgress({ status: "offline" });
        return;
      }

      const { db } = await this.getDb();
      let accessToken: string | null = null;
      try {
        accessToken = await this.fetchAccessToken();
      } catch (err) {
        this.updateProgress({
          status: "error",
          lastError: err instanceof Error ? err.message : String(err),
        });
        return;
      }

      if (!accessToken) {
        this.updateProgress({ status: "unauthenticated" });
        return;
      }

      const rootFolderId = await this.getRootFolderId(db, accessToken);
      await this.runSyncInternal(db, accessToken, rootFolderId);
    })().finally(() => {
      this.syncPromise = null;
    });

    return this.syncPromise;
  }

  public async restoreFromDrive(): Promise<void> {
    if (this.isDestroyed) return;
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      this.updateProgress({ status: "offline" });
      return;
    }

    this.updateProgress({ status: "syncing", processed: 0, total: 100, pending: 100 });

    try {
      const { db } = await this.getDb();
      const accessToken = await this.fetchAccessToken();
      if (!accessToken) {
        this.updateProgress({ status: "unauthenticated" });
        return;
      }

      const rootFolderId = await this.getRootFolderId(db, accessToken);
      const manifest = await getManifest(accessToken, rootFolderId);
      if (!manifest) {
        this.updateProgress({ status: "idle", pending: 0, processed: 0, total: 0 });
        return;
      }

      // Restore sources
      for (const s of manifest.sources) {
        const [existing] = await db
          .select()
          .from(schema.sources)
          .where(eq(schema.sources.id, s.id));

        if (!existing || s.updatedAt > Number(existing.updatedAt ?? existing.createdAt)) {
          await db
            .insert(schema.sources)
            .values({
              id: s.id,
              name: s.name,
              createdAt: s.createdAt,
              updatedAt: s.updatedAt,
              syncedAt: s.updatedAt,
              isDeleted: s.isDeleted,
            })
            .onConflictDoUpdate({
              target: schema.sources.id,
              set: {
                name: s.name,
                createdAt: s.createdAt,
                updatedAt: s.updatedAt,
                syncedAt: s.updatedAt,
                isDeleted: s.isDeleted,
              },
            });
        }
      }

      // Restore questions
      const totalQuestions = manifest.questions.length;
      let processedQuestions = 0;
      this.updateProgress({
        status: "syncing",
        total: totalQuestions,
        processed: 0,
        pending: totalQuestions,
      });

      await processWithRateLimit(manifest.questions, 3, 50, async (q) => {
        const [existing] = await db
          .select()
          .from(schema.questions)
          .where(eq(schema.questions.id, q.id));

        const isNewer = !existing || q.updatedAt > Number(existing.updatedAt ?? existing.createdAt);

        if (isNewer) {
          if (q.isDeleted) {
            if (existing) {
              await db
                .update(schema.questions)
                .set({
                  isDeleted: true,
                  updatedAt: q.updatedAt,
                  syncedAt: q.updatedAt,
                })
                .where(eq(schema.questions.id, q.id));
            }
          } else {
            const imageBlob = await downloadImage(accessToken, q.driveFileId);
            const imageBuffer = await imageBlob.arrayBuffer();
            const imageBytes = new Uint8Array(imageBuffer);

            await db
              .insert(schema.questions)
              .values({
                id: q.id,
                image: imageBytes,
                createdAt: q.createdAt,
                updatedAt: q.updatedAt,
                syncedAt: q.updatedAt,
                subjectId: q.subjectId,
                chapterId: q.chapterId,
                mistakeId: q.mistakeId,
                sourceId: q.sourceId,
                answerKey: q.answerKey,
                note: q.note,
                revisionCount: q.revisionCount,
                lastRevisionDay: q.lastRevisionDay,
                stashed: q.stashed,
                driveFileId: q.driveFileId,
                isDeleted: false,
              })
              .onConflictDoUpdate({
                target: schema.questions.id,
                set: {
                  image: imageBytes,
                  createdAt: q.createdAt,
                  updatedAt: q.updatedAt,
                  syncedAt: q.updatedAt,
                  subjectId: q.subjectId,
                  chapterId: q.chapterId,
                  mistakeId: q.mistakeId,
                  sourceId: q.sourceId,
                  answerKey: q.answerKey,
                  note: q.note,
                  revisionCount: q.revisionCount,
                  lastRevisionDay: q.lastRevisionDay,
                  stashed: q.stashed,
                  driveFileId: q.driveFileId,
                  isDeleted: false,
                },
              });
          }
        }

        processedQuestions++;
        this.updateProgress({
          status: "syncing",
          total: totalQuestions,
          processed: processedQuestions,
          pending: totalQuestions - processedQuestions,
        });
      });

      // Clear sync queue since local state is now synchronized with Drive
      await db.delete(schema.syncQueue);

      await db
        .insert(schema.syncMetadata)
        .values({
          key: "last_synced_at",
          value: String(manifest.lastSyncedAt),
          updatedAt: Date.now(),
        })
        .onConflictDoUpdate({
          target: schema.syncMetadata.key,
          set: { value: String(manifest.lastSyncedAt), updatedAt: Date.now() },
        });

      this.updateProgress({
        status: "idle",
        total: totalQuestions,
        processed: totalQuestions,
        pending: 0,
        lastSyncedAt: manifest.lastSyncedAt,
        lastError: undefined,
      });

      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("mb:library-reload"));
      }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      if (errorMsg.includes("401")) {
        this.updateProgress({ status: "unauthenticated" });
      } else {
        this.updateProgress({ status: "error", lastError: errorMsg });
      }
      throw err;
    }
  }

  public destroy(): void {
    this.isDestroyed = true;
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    if (typeof window !== "undefined") {
      if (this.onlineHandler) {
        window.removeEventListener("online", this.onlineHandler);
        this.onlineHandler = null;
      }
      if (this.offlineHandler) {
        window.removeEventListener("offline", this.offlineHandler);
        this.offlineHandler = null;
      }
      if (this.enqueueHandler) {
        window.removeEventListener("mb:sync-enqueue", this.enqueueHandler);
        this.enqueueHandler = null;
      }
    }
    this.listeners.clear();
  }

  private updateProgress(patch: Partial<SyncProgress>): void {
    this.progress = { ...this.progress, ...patch };
    for (const listener of this.listeners) {
      try {
        listener(this.getProgress());
      } catch {
        // ignore
      }
    }
  }

  private async fetchAccessToken(): Promise<string | null> {
    try {
      const res = await fetch("/api/drive/token");
      if (res.status === 401 || res.status === 403) {
        return null;
      }
      if (!res.ok) {
        throw new Error(`Token fetch failed with status ${res.status}`);
      }
      const data = (await res.json()) as { accessToken?: string };
      return data.accessToken || null;
    } catch (err) {
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        this.updateProgress({ status: "offline" });
        return null;
      }
      throw err;
    }
  }

  private async getRootFolderId(
    db: PgliteDatabase<typeof schema>,
    accessToken: string
  ): Promise<string> {
    const rows = await db
      .select()
      .from(schema.syncMetadata)
      .where(eq(schema.syncMetadata.key, "root_folder_id"));

    if (rows.length > 0 && rows[0].value) {
      return rows[0].value;
    }

    const rootId = await findOrCreateFolder(accessToken, "MistakeBook");
    await db
      .insert(schema.syncMetadata)
      .values({
        key: "root_folder_id",
        value: rootId,
        updatedAt: Date.now(),
      })
      .onConflictDoUpdate({
        target: schema.syncMetadata.key,
        set: {
          value: rootId,
          updatedAt: Date.now(),
        },
      });

    return rootId;
  }

  private async uploadUnifiedManifest(
    db: PgliteDatabase<typeof schema>,
    accessToken: string,
    rootFolderId: string
  ): Promise<number> {
    const allSources = await db.select().from(schema.sources);
    const syncedQuestions = await db
      .select()
      .from(schema.questions)
      .where(isNotNull(schema.questions.driveFileId));

    const manifestQuestions: ManifestQuestion[] = await Promise.all(
      syncedQuestions.map(async (q) => {
        const subjectName = subjectById(q.subjectId)?.name ?? q.subjectId;
        const chapterName = chapterById(q.chapterId)?.name ?? q.chapterId;
        const fileName = formatQuestionFileName(q);
        const imageHash =
          q.image && q.image.byteLength > 0
            ? await computeBytesHash(q.image)
            : "";
        return {
          id: q.id,
          driveFileId: q.driveFileId!,
          driveFilePath: `${subjectName}/${chapterName}/${fileName}`,
          imageHash,
          subjectId: q.subjectId,
          chapterId: q.chapterId,
          mistakeId: q.mistakeId,
          sourceId: q.sourceId,
          answerKey: q.answerKey,
          note: q.note,
          revisionCount: q.revisionCount,
          lastRevisionDay: q.lastRevisionDay,
          stashed: Boolean(q.stashed),
          createdAt: Number(q.createdAt),
          updatedAt: Number(q.updatedAt ?? q.createdAt),
          isDeleted: Boolean(q.isDeleted),
        };
      })
    );

    const manifestSources: ManifestSource[] = allSources.map((s) => ({
      id: s.id,
      name: s.name,
      createdAt: Number(s.createdAt),
      updatedAt: Number(s.updatedAt ?? s.createdAt),
      isDeleted: Boolean(s.isDeleted),
    }));

    const nowTimestamp = Date.now();
    const manifest: ManifestData = {
      version: 1,
      lastSyncedAt: nowTimestamp,
      sources: manifestSources,
      questions: manifestQuestions,
    };

    const cachedManifest = await db
      .select()
      .from(schema.syncMetadata)
      .where(eq(schema.syncMetadata.key, "manifest_file_id"));
    const existingManifestId = cachedManifest[0]?.value;

    const manifestFileId = await uploadManifest(
      accessToken,
      manifest,
      rootFolderId,
      existingManifestId
    );

    await db
      .insert(schema.syncMetadata)
      .values({
        key: "manifest_file_id",
        value: manifestFileId,
        updatedAt: nowTimestamp,
      })
      .onConflictDoUpdate({
        target: schema.syncMetadata.key,
        set: { value: manifestFileId, updatedAt: nowTimestamp },
      });

    await db
      .insert(schema.syncMetadata)
      .values({
        key: "last_synced_at",
        value: String(nowTimestamp),
        updatedAt: nowTimestamp,
      })
      .onConflictDoUpdate({
        target: schema.syncMetadata.key,
        set: { value: String(nowTimestamp), updatedAt: nowTimestamp },
      });

    await db
      .update(schema.sources)
      .set({ syncedAt: nowTimestamp })
      .where(isNull(schema.sources.syncedAt));

    return nowTimestamp;
  }

  private async runMergeWithCloud(): Promise<void> {
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      this.updateProgress({ status: "offline" });
      return;
    }

    const { db } = await this.getDb();

    let accessToken: string | null = null;
    try {
      accessToken = await this.fetchAccessToken();
    } catch (err) {
      this.updateProgress({
        status: "error",
        lastError: err instanceof Error ? err.message : String(err),
      });
      return;
    }

    if (!accessToken) {
      this.updateProgress({ status: "unauthenticated" });
      return;
    }

    this.updateProgress({ status: "syncing" });

    try {
      const rootFolderId = await this.getRootFolderId(db, accessToken);
      const remoteManifest = await getManifest(accessToken, rootFolderId);

      // 1. If remote manifest does not exist:
      if (!remoteManifest) {
        await ensureUnsyncedEnqueued(db);
        await this.runSyncInternal(db, accessToken, rootFolderId);
        const checkManifest = await getManifest(accessToken, rootFolderId);
        if (!checkManifest) {
          await this.uploadUnifiedManifest(db, accessToken, rootFolderId);
        }
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("mb:library-reload"));
        }
        return;
      }

      // 2. If remote manifest DOES exist:
      // --- Sources Merge ---
      const localSources = await db.select().from(schema.sources);
      const localSourceMap = new Map(localSources.map((s) => [s.id, s]));

      for (const remoteS of remoteManifest.sources) {
        const localS = localSourceMap.get(remoteS.id);
        if (!localS) {
          // Remote sources missing locally -> insert into local DB
          await db.insert(schema.sources).values({
            id: remoteS.id,
            name: remoteS.name,
            createdAt: remoteS.createdAt,
            updatedAt: remoteS.updatedAt,
            syncedAt: remoteS.updatedAt,
            isDeleted: remoteS.isDeleted,
          });
        } else {
          // Sources existing in both -> Last-Write-Wins (LWW) based on updatedAt
          const localUpdated = Number(localS.updatedAt ?? localS.createdAt);
          const remoteUpdated = Number(remoteS.updatedAt);
          if (remoteUpdated > localUpdated) {
            await db
              .update(schema.sources)
              .set({
                name: remoteS.name,
                createdAt: remoteS.createdAt,
                updatedAt: remoteS.updatedAt,
                syncedAt: remoteS.updatedAt,
                isDeleted: remoteS.isDeleted,
              })
              .where(eq(schema.sources.id, remoteS.id));
          } else if (localUpdated === remoteUpdated) {
            if (localS.syncedAt == null) {
              await db
                .update(schema.sources)
                .set({ syncedAt: remoteS.updatedAt })
                .where(eq(schema.sources.id, remoteS.id));
            }
          }
          // If localUpdated > remoteUpdated: keep local in DB
        }
      }

      // Valid source IDs to guard foreign keys
      const currentSources = await db.select({ id: schema.sources.id }).from(schema.sources);
      const validSourceIds = new Set(currentSources.map((s) => s.id));

      // --- Questions Merge ---
      const localQuestions = await db.select().from(schema.questions);
      const localQuestionMap = new Map(localQuestions.map((q) => [q.id, q]));
      const remoteQuestionMap = new Map(remoteManifest.questions.map((q) => [q.id, q]));

      // Existing queue items to avoid duplicating
      const existingQueue = await db
        .select({ entityType: schema.syncQueue.entityType, entityId: schema.syncQueue.entityId })
        .from(schema.syncQueue);
      const queuedQuestionIds = new Set(
        existingQueue.filter((i) => i.entityType === "question").map((i) => i.entityId)
      );

      const downloadTasks: Array<{
        remoteQ: ManifestQuestion;
        mode: "insert" | "update";
      }> = [];

      for (const remoteQ of remoteManifest.questions) {
        const localQ = localQuestionMap.get(remoteQ.id);
        const sId = remoteQ.sourceId && validSourceIds.has(remoteQ.sourceId) ? remoteQ.sourceId : null;

        if (!localQ) {
          // Remote question missing locally
          if (remoteQ.isDeleted) {
            await db.insert(schema.questions).values({
              id: remoteQ.id,
              image: new Uint8Array(0),
              createdAt: remoteQ.createdAt,
              updatedAt: remoteQ.updatedAt,
              syncedAt: remoteQ.updatedAt,
              subjectId: remoteQ.subjectId,
              chapterId: remoteQ.chapterId,
              mistakeId: remoteQ.mistakeId,
              sourceId: sId,
              answerKey: remoteQ.answerKey,
              note: remoteQ.note,
              revisionCount: remoteQ.revisionCount,
              lastRevisionDay: remoteQ.lastRevisionDay,
              stashed: remoteQ.stashed,
              driveFileId: remoteQ.driveFileId,
              isDeleted: true,
            });
          } else {
            downloadTasks.push({ remoteQ, mode: "insert" });
          }
        } else {
          // Questions existing in both
          const localUpdated = Number(localQ.updatedAt ?? localQ.createdAt);
          const remoteUpdated = Number(remoteQ.updatedAt);

          if (localUpdated > remoteUpdated) {
            // Local is newer -> keep local in DB, mark/enqueue for upload and manifest update
            if (!localQ.driveFileId) {
              await db
                .update(schema.questions)
                .set({ driveFileId: remoteQ.driveFileId })
                .where(eq(schema.questions.id, localQ.id));
            }
            if (!queuedQuestionIds.has(localQ.id)) {
              await db.insert(schema.syncQueue).values({
                id: newId(),
                entityType: "question",
                entityId: localQ.id,
                action: localQ.isDeleted ? "delete" : "upsert",
                createdAt: Date.now(),
                attempts: 0,
                status: "pending",
              });
              queuedQuestionIds.add(localQ.id);
            }
          } else if (remoteUpdated > localUpdated) {
            // Remote is newer -> update local DB with remote metadata
            // and if image hash differs or local image is missing, download remote image
            if (remoteQ.isDeleted) {
              await db
                .update(schema.questions)
                .set({
                  isDeleted: true,
                  updatedAt: remoteQ.updatedAt,
                  syncedAt: remoteQ.updatedAt,
                  driveFileId: remoteQ.driveFileId,
                })
                .where(eq(schema.questions.id, localQ.id));

              await db
                .delete(schema.syncQueue)
                .where(
                  and(
                    eq(schema.syncQueue.entityType, "question"),
                    eq(schema.syncQueue.entityId, localQ.id)
                  )
                );
            } else {
              let localHash = "";
              if (localQ.image && localQ.image.byteLength > 0) {
                localHash = await computeBytesHash(localQ.image);
              }
              const needDownload = !localHash || localHash !== remoteQ.imageHash;

              if (needDownload) {
                downloadTasks.push({ remoteQ, mode: "update" });
              } else {
                await db
                  .update(schema.questions)
                  .set({
                    subjectId: remoteQ.subjectId,
                    chapterId: remoteQ.chapterId,
                    mistakeId: remoteQ.mistakeId,
                    sourceId: sId,
                    answerKey: remoteQ.answerKey,
                    note: remoteQ.note,
                    revisionCount: remoteQ.revisionCount,
                    lastRevisionDay: remoteQ.lastRevisionDay,
                    stashed: remoteQ.stashed,
                    driveFileId: remoteQ.driveFileId,
                    updatedAt: remoteQ.updatedAt,
                    syncedAt: remoteQ.updatedAt,
                    isDeleted: false,
                  })
                  .where(eq(schema.questions.id, localQ.id));
              }

              await db
                .delete(schema.syncQueue)
                .where(
                  and(
                    eq(schema.syncQueue.entityType, "question"),
                    eq(schema.syncQueue.entityId, localQ.id)
                  )
                );
            }
          } else {
            // Timestamps equal: already in sync, ensure driveFileId is preserved
            if (!localQ.driveFileId || localQ.driveFileId !== remoteQ.driveFileId || localQ.syncedAt == null) {
              await db
                .update(schema.questions)
                .set({
                  driveFileId: remoteQ.driveFileId,
                  syncedAt: remoteQ.updatedAt,
                })
                .where(eq(schema.questions.id, localQ.id));
            }
            await db
              .delete(schema.syncQueue)
              .where(
                and(
                  eq(schema.syncQueue.entityType, "question"),
                  eq(schema.syncQueue.entityId, localQ.id)
                )
              );
          }
        }
      }

      // Local questions missing in remote manifest -> keep locally and enqueue into sync_queue
      for (const [id, localQ] of localQuestionMap.entries()) {
        if (!remoteQuestionMap.has(id)) {
          if (!localQ.isDeleted && !queuedQuestionIds.has(id)) {
            await db.insert(schema.syncQueue).values({
              id: newId(),
              entityType: "question",
              entityId: id,
              action: "upsert",
              createdAt: Date.now(),
              attempts: 0,
              status: "pending",
            });
            queuedQuestionIds.add(id);
          }
        }
      }

      // Download remote images with processWithRateLimit(..., 3, 50)
      if (downloadTasks.length > 0) {
        let downloadedCount = 0;
        const totalDownloads = downloadTasks.length;
        this.updateProgress({
          status: "syncing",
          total: totalDownloads,
          processed: 0,
          pending: totalDownloads,
        });

        await processWithRateLimit(downloadTasks, 3, 50, async (task) => {
          const q = task.remoteQ;
          const imageBlob = await downloadImage(accessToken, q.driveFileId);
          const imageBuffer = await imageBlob.arrayBuffer();
          const imageBytes = new Uint8Array(imageBuffer);
          const sId = q.sourceId && validSourceIds.has(q.sourceId) ? q.sourceId : null;

          if (task.mode === "insert") {
            await db.insert(schema.questions).values({
              id: q.id,
              image: imageBytes,
              createdAt: q.createdAt,
              updatedAt: q.updatedAt,
              syncedAt: q.updatedAt,
              subjectId: q.subjectId,
              chapterId: q.chapterId,
              mistakeId: q.mistakeId,
              sourceId: sId,
              answerKey: q.answerKey,
              note: q.note,
              revisionCount: q.revisionCount,
              lastRevisionDay: q.lastRevisionDay,
              stashed: q.stashed,
              driveFileId: q.driveFileId,
              isDeleted: false,
            });
          } else {
            await db
              .update(schema.questions)
              .set({
                image: imageBytes,
                createdAt: q.createdAt,
                updatedAt: q.updatedAt,
                syncedAt: q.updatedAt,
                subjectId: q.subjectId,
                chapterId: q.chapterId,
                mistakeId: q.mistakeId,
                sourceId: sId,
                answerKey: q.answerKey,
                note: q.note,
                revisionCount: q.revisionCount,
                lastRevisionDay: q.lastRevisionDay,
                stashed: q.stashed,
                driveFileId: q.driveFileId,
                isDeleted: false,
              })
              .where(eq(schema.questions.id, q.id));
          }

          downloadedCount++;
          this.updateProgress({
            status: "syncing",
            total: totalDownloads,
            processed: downloadedCount,
            pending: totalDownloads - downloadedCount,
          });
        });
      }

      // --- Update Remote Manifest ---
      // Generate unified manifest.json containing ALL merged sources and questions
      await this.uploadUnifiedManifest(db, accessToken, rootFolderId);

      // --- Notify UI ---
      // Dispatch window.dispatchEvent(new CustomEvent("mb:library-reload"))
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("mb:library-reload"));
      }

      // --- Drain Uploads ---
      // Any local-only questions will now be in sync_queue and will be uploaded to Drive
      await this.runSyncInternal(db, accessToken, rootFolderId);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      if (errorMsg.includes("401")) {
        this.updateProgress({ status: "unauthenticated" });
      } else {
        this.updateProgress({ status: "error", lastError: errorMsg });
      }
      throw err;
    }
  }

  private async runSyncInternal(
    db: PgliteDatabase<typeof schema>,
    accessToken: string,
    rootFolderId: string
  ): Promise<void> {
    await ensureUnsyncedEnqueued(db);

    const allQueueItems = await db
      .select()
      .from(schema.syncQueue)
      .orderBy(asc(schema.syncQueue.createdAt));

    const now = Date.now();
    const eligibleItems = allQueueItems.filter((item) => {
      if (item.status === "pending") return true;
      if (item.status === "failed") {
        const attempts = item.attempts ?? 0;
        const backoffMs = Math.min(1000 * Math.pow(2, attempts), 30000);
        const lastAttempt = Number(item.lastAttemptAt ?? 0);
        return now - lastAttempt >= backoffMs;
      }
      return false;
    });

    if (eligibleItems.length === 0) {
      const meta = await db
        .select()
        .from(schema.syncMetadata)
        .where(eq(schema.syncMetadata.key, "last_synced_at"));
      const lastSyncedAt = meta[0]?.value ? Number(meta[0].value) : undefined;
      this.updateProgress({
        status: "idle",
        pending: 0,
        processed: 0,
        total: 0,
        lastSyncedAt,
      });
      return;
    }

    this.updateProgress({
      status: "syncing",
      total: eligibleItems.length,
      processed: 0,
      pending: eligibleItems.length,
      lastError: undefined,
    });

    let processedCount = 0;
    let has401Error = false;

    await processWithRateLimit(eligibleItems, 3, 50, async (item) => {
      try {
        if (item.entityType === "question") {
          const [q] = await db
            .select()
            .from(schema.questions)
            .where(eq(schema.questions.id, item.entityId));

          if (!q) {
            await db.delete(schema.syncQueue).where(eq(schema.syncQueue.id, item.id));
          } else if (item.action === "delete" || q.isDeleted) {
            if (q.driveFileId) {
              await trashFile(accessToken, q.driveFileId);
            }
            await db
              .update(schema.questions)
              .set({ syncedAt: Date.now() })
              .where(eq(schema.questions.id, q.id));
            await db.delete(schema.syncQueue).where(eq(schema.syncQueue.id, item.id));
          } else {
            const subject = subjectById(q.subjectId);
            const subjectName = subject?.name ?? q.subjectId;
            const chapter = chapterById(q.chapterId);
            const chapterName = chapter?.name ?? q.chapterId;
            const chapterFolderId = await resolveChapterFolder(
              accessToken,
              subjectName,
              chapterName,
              rootFolderId
            );

            const fileName = formatQuestionFileName(q);
            const blob = new Blob([q.image as unknown as BlobPart], { type: "image/png" });
            const driveFileId = await uploadImage(
              accessToken,
              blob,
              fileName,
              chapterFolderId,
              q.driveFileId ?? undefined
            );

            await db
              .update(schema.questions)
              .set({
                driveFileId,
                syncedAt: Date.now(),
              })
              .where(eq(schema.questions.id, q.id));

            await db.delete(schema.syncQueue).where(eq(schema.syncQueue.id, item.id));
          }
        } else if (item.entityType === "source") {
          await db
            .update(schema.sources)
            .set({ syncedAt: Date.now() })
            .where(eq(schema.sources.id, item.entityId));
          await db.delete(schema.syncQueue).where(eq(schema.syncQueue.id, item.id));
        } else {
          await db.delete(schema.syncQueue).where(eq(schema.syncQueue.id, item.id));
        }
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        await db
          .update(schema.syncQueue)
          .set({
            attempts: (item.attempts ?? 0) + 1,
            lastAttemptAt: Date.now(),
            lastError: errorMsg,
            status: "failed",
          })
          .where(eq(schema.syncQueue.id, item.id));

        if (errorMsg.includes("401")) {
          has401Error = true;
        }
      } finally {
        processedCount++;
        this.updateProgress({
          status: "syncing",
          total: eligibleItems.length,
          processed: processedCount,
          pending: eligibleItems.length - processedCount,
        });
      }
    });

    if (has401Error) {
      this.updateProgress({ status: "unauthenticated" });
      return;
    }

    // Upload updated manifest.json
    try {
      const nowTimestamp = await this.uploadUnifiedManifest(db, accessToken, rootFolderId);

      const remainingPending = await db
        .select()
        .from(schema.syncQueue)
        .where(eq(schema.syncQueue.status, "pending"));

      const failedQueue = await db
        .select()
        .from(schema.syncQueue)
        .where(eq(schema.syncQueue.status, "failed"));

      if (failedQueue.length > 0) {
        this.updateProgress({
          status: "error",
          pending: remainingPending.length + failedQueue.length,
          lastError: failedQueue[0].lastError ?? "Some items failed to sync",
          lastSyncedAt: nowTimestamp,
        });
      } else {
        this.updateProgress({
          status: "idle",
          pending: remainingPending.length,
          lastSyncedAt: nowTimestamp,
          lastError: undefined,
        });
      }

      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("mb:library-reload"));
      }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      this.updateProgress({
        status: "error",
        lastError: errorMsg,
      });
    }
  }
}
