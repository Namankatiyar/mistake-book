"use client";

import { useEffect, useState } from "react";
import { getQuestionImageFromDb, getQuestionImagesFromDb } from "./idb";

export type CacheEntry = {
  id: string;
  blob: Blob;
  url: string;
  img?: HTMLImageElement;
  decoded: boolean;
  lastUsed: number;
};

const MAX_CACHE_SIZE = 30;
const cache = new Map<string, CacheEntry>();
const pendingLoads = new Map<string, Promise<string | null>>();

function pruneCache(protectedIds: Set<string> = new Set()) {
  if (cache.size <= MAX_CACHE_SIZE) return;

  // Find oldest entries not currently protected
  const entries = Array.from(cache.values()).sort(
    (a, b) => a.lastUsed - b.lastUsed,
  );

  for (const entry of entries) {
    if (cache.size <= MAX_CACHE_SIZE) break;
    if (protectedIds.has(entry.id)) continue;

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

  pruneCache(new Set([id]));
  cache.set(id, entry);
  return url;
}

/**
 * Preload a single question's image into memory from a known Blob or the local DB.
 */
export async function preloadSingleImage(
  id: string,
  knownBlob?: Blob,
): Promise<string | null> {
  const existing = getCachedImageUrl(id);
  if (existing) return existing;

  const pending = pendingLoads.get(id);
  if (pending) return pending;

  const promise = (async () => {
    try {
      let blob = knownBlob;
      if (!blob) {
        blob = (await getQuestionImageFromDb(id)) ?? undefined;
      }
      if (!blob) return null;

      return cacheImageBlob(id, blob);
    } catch (err) {
      console.error(`[preload] Failed to preload image for question ${id}:`, err);
      return null;
    } finally {
      pendingLoads.delete(id);
    }
  })();

  pendingLoads.set(id, promise);
  return promise;
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
 * If not preloaded, caches the initialBlob immediately and decodes in background.
 */
export function useQuestionImage(
  id: string,
  initialBlob?: Blob,
): string | null {
  const [url, setUrl] = useState<string | null>(() => {
    const cached = getCachedImageUrl(id);
    if (cached) return cached;
    if (initialBlob) {
      return cacheImageBlob(id, initialBlob);
    }
    return null;
  });

  useEffect(() => {
    let cancelled = false;

    // Check if URL became available or is already cached
    const cached = getCachedImageUrl(id);
    if (cached) {
      if (url !== cached) {
        setUrl(cached);
      }
      return;
    }

    void preloadSingleImage(id, initialBlob).then((loadedUrl) => {
      if (!cancelled && loadedUrl) {
        setUrl(loadedUrl);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [id, initialBlob, url]);

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
  pendingLoads.clear();
}
