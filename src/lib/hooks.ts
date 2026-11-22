"use client";

import { useEffect, useState } from "react";

/** Object URL for a stored image blob; revoked on unmount / blob change. */
export function useObjectUrl(blob: Blob | undefined): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!blob) {
      setUrl(null);
      return;
    }
    const next = URL.createObjectURL(blob);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [blob]);
  return url;
}

/**
 * State persisted to sessionStorage, loaded after mount to keep
 * server and client markup identical. Used so the list keeps its
 * filters when you come back from the viewer.
 */
export function useSessionState<T>(
  key: string,
  initial: T,
): [T, (next: T | ((prev: T) => T)) => void] {
  const [value, setValue] = useState<T>(initial);

  useEffect(() => {
    try {
      const raw = window.sessionStorage.getItem(key);
      if (raw) setValue(JSON.parse(raw) as T);
    } catch {
      // Ignore.
    }
  }, [key]);

  useEffect(() => {
    try {
      window.sessionStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Ignore.
    }
  }, [key, value]);

  return [value, setValue];
}
