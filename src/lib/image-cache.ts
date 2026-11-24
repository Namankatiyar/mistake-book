"use client";

import { useEffect, useState } from "react";
import { getQuestionImagesFromDb } from "./idb";

export type CacheEntry = {
  id: string;
  blob: Blob;
  url: string;
  img?: HTMLImageElement;
  decoded: boolean;
  lastUsed: number;
  refCount: number;
};

export type UseQuestionImageOptions = {
  enabled?: boolean;
  initialBlob?: Blob;
};

const MAX_CACHE_SIZE = 90;
const cache = new Map<string, CacheEntry>();

type BatchRequest = {
  id: string;
  resolve: (url: string | null) => void;
  reject: (err: unknown) => void;
};

let batchQueue: BatchRequest[] = [];
let batchScheduled = false;
const pendingRequests = new Map<string, Promise<string | null>>();

function pruneCache(protectedIds: Set<string> = new Set()) {
  if (cache.size <= MAX_CACHE_SIZE) return;

  // Find oldest entries not currently protected or held by mounted components
  const entries = Array.from(cache.values()).sort(
    (a, b) => a.lastUsed - b.lastUsed,
  );

  for (const entry of entries) {
    if (cache.size <= MAX_CACHE_SIZE) break;
    if (entry.refCount > 0 || protectedIds.has(entry.id)) continue;

    // Revoke object URL to free memory
    try {
      URL.revokeObjectURL(entry.url);
    } catch {
      // Ignore
    }
    cache.delete(entry.id);
  }
}

/**
 * Returns the cached object URL synchronously if already preloaded into memory.
 */
export function getCachedImageUrl(id: string): string | null {
  if (!id) return null;
  const entry = cache.get(id);
  if (entry) {
    entry.lastUsed = Date.now();
    return entry.url;
  }
  return null;
}

/**
 * Synchronously registers a Blob into the in-memory cache, creates an object URL,
 * and decodes the image in the background.
 */
export function cacheImageBlob(id: string, blob: Blob): string {
  const existing = cache.get(id);
  if (existing) {
    existing.lastUsed = Date.now();
    return existing.url;
  }

  const url = URL.createObjectURL(blob);
  const entry: CacheEntry = {
    id,
    blob,
    url,
    decoded: false,
    lastUsed: Date.now(),
    refCount: 0,
  };

  if (typeof window !== "undefined") {
    const img = new Image();
    img.src = url;
    entry.img = img;
    void img
      .decode()
      .then(() => {
        entry.decoded = true;
      })
      .catch(() => {
        entry.decoded = true;
      });
  }

  cache.set(id, entry);
  pruneCache(new Set([id]));
  return url;
}

async function flushBatch() {
  batchScheduled = false;
  const currentBatch = batchQueue;
  batchQueue = [];

  if (currentBatch.length === 0) return;

  const idsToFetch = Array.from(new Set(currentBatch.map((req) => req.id)));

  try {
    const dbBlobs = await getQuestionImagesFromDb(idsToFetch);

    for (const req of currentBatch) {
      const blob = dbBlobs.get(req.id);
      if (blob) {
        const url = cacheImageBlob(req.id, blob);
        req.resolve(url);
      } else {
        req.resolve(null);
      }
    }
  } catch (err) {
    console.error("[requestImage] Batch DB fetch error:", err);
    for (const req of currentBatch) {
      req.resolve(null);
    }
  } finally {
    for (const id of idsToFetch) {
      pendingRequests.delete(id);
    }
  }
}

/**
 * Micro-batched DB fetching that coalesces concurrent missing IDs
 * within the same tick into a single getQuestionImagesFromDb call.
 */
export async function requestImage(id: string): Promise<string | null> {
  if (typeof window === "undefined" || !id) return null;

  const cached = getCachedImageUrl(id);
  if (cached) return cached;

  const inFlight = pendingRequests.get(id);
  if (inFlight) return inFlight;

  const promise = new Promise<string | null>((resolve, reject) => {
    batchQueue.push({ id, resolve, reject });
  });

  pendingRequests.set(id, promise);

  if (!batchScheduled) {
    batchScheduled = true;
    queueMicrotask(flushBatch);
  }

  return promise;
}

/**
 * Preload a single question's image into memory from a known Blob or the local DB.
 */
export async function preloadSingleImage(
  id: string,
  knownBlob?: Blob,
): Promise<string | null> {
  if (!id) return null;

  const existing = getCachedImageUrl(id);
  if (existing) return existing;

  if (knownBlob) {
    return cacheImageBlob(id, knownBlob);
  }

  return requestImage(id);
}

/**
 * Preloads the given question images (e.g. next 3 questions) into memory from the DB,
 * decodes the raster images asynchronously, and caches their object URLs for instant serving.
 */
export async function preloadQuestionImages(
  ids: string[],
  knownBlobs?: Map<string, Blob>,
): Promise<void> {
  if (typeof window === "undefined" || ids.length === 0) return;

  const targetIds = ids.filter((id) => Boolean(id));
  const missingFromCache = targetIds.filter((id) => !cache.has(id));
  if (missingFromCache.length === 0) {
    // Touch timestamp for existing items
    const now = Date.now();
    for (const id of targetIds) {
      const entry = cache.get(id);
      if (entry) entry.lastUsed = now;
    }
    return;
  }

  // Identify which ones need DB retrieval
  const needDbFetch: string[] = [];
  const blobsToCache = new Map<string, Blob>();

  for (const id of missingFromCache) {
    const blob = knownBlobs?.get(id);
    if (blob) {
      blobsToCache.set(id, blob);
    } else {
      needDbFetch.push(id);
    }
  }

  // Fetch missing blobs from the DB
  if (needDbFetch.length > 0) {
    try {
      const dbBlobs = await getQuestionImagesFromDb(needDbFetch);
      for (const [id, blob] of dbBlobs.entries()) {
        blobsToCache.set(id, blob);
      }
    } catch (err) {
      console.error("[preload] Error fetching images from db:", err);
    }
  }

  // Cache and decode images into memory
  const decodePromises: Promise<void>[] = [];
  for (const [id, blob] of blobsToCache.entries()) {
    cacheImageBlob(id, blob);
    const entry = cache.get(id);
    if (entry?.img && !entry.decoded) {
      decodePromises.push(
        entry.img
          .decode()
          .then(() => {
            entry.decoded = true;
          })
          .catch(() => {
            entry.decoded = true;
          }),
      );
    }
  }

  await Promise.allSettled(decodePromises);
}

/**
 * Hook to retrieve a question's image URL instantly from memory.
 * If preloaded, returns the object URL synchronously on line 1 of render.
 * While url is held by the mounted hook, entry.refCount is incremented.
 * Only triggers requestImage / preloadSingleImage when enabled !== false and not yet cached.
 */
export function useQuestionImage(
  id: string,
  options?: Blob | UseQuestionImageOptions,
): string | null {
  let enabled = true;
  let initialBlob: Blob | undefined;

  if (options instanceof Blob) {
    initialBlob = options;
  } else if (options && typeof options === "object") {
    if (options.enabled !== undefined) {
      enabled = options.enabled;
    }
    initialBlob = options.initialBlob;
  }

  const [prevId, setPrevId] = useState(id);
  const [url, setUrl] = useState<string | null>(() => {
    const cached = getCachedImageUrl(id);
    if (cached) return cached;
    if (initialBlob) {
      return cacheImageBlob(id, initialBlob);
    }
    return null;
  });

  if (prevId !== id) {
    setPrevId(id);
    const cached = getCachedImageUrl(id);
    setUrl(cached ?? (initialBlob ? cacheImageBlob(id, initialBlob) : null));
  }

  // Ref count management: while url is held by mounted hook, increment refCount
  useEffect(() => {
    if (!url) return;
    const entry = cache.get(id);
    if (entry) {
      entry.refCount += 1;
    }
    return () => {
      const e = cache.get(id);
      if (e) {
        e.refCount = Math.max(0, e.refCount - 1);
      }
    };
  }, [id, url]);

  // Fetching logic: only trigger requestImage when enabled !== false and not yet cached
  useEffect(() => {
    if (enabled === false) return;

    const cached = getCachedImageUrl(id);
    if (cached) {
      if (url !== cached) {
        setUrl(cached);
      }
      return;
    }

    let cancelled = false;

    const loadPromise = initialBlob
      ? preloadSingleImage(id, initialBlob)
      : requestImage(id);

    void loadPromise.then((loadedUrl) => {
      if (!cancelled && loadedUrl) {
        setUrl(loadedUrl);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [id, enabled, initialBlob, url]);

  return url;
}

/**
 * Evict a question's image from the cache and revoke its object URL.
 */
export function evictImage(id: string): void {
  const entry = cache.get(id);
  if (entry) {
    try {
      URL.revokeObjectURL(entry.url);
    } catch {
      // Ignore
    }
    cache.delete(id);
  }
}

/**
 * Clear the entire image cache and revoke all object URLs.
 */
export function clearImageCache(): void {
  for (const entry of cache.values()) {
    try {
      URL.revokeObjectURL(entry.url);
    } catch {
      // Ignore
    }
  }
  cache.clear();
  pendingRequests.clear();
  batchQueue = [];
  batchScheduled = false;
}
