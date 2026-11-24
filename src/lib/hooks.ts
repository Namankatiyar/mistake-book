"use client";

import { type RefObject, useEffect, useState } from "react";

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

/**
 * Hook to detect when an element enters the viewport.
 * Latches to `true` once intersected and disconnects the observer to prevent
 * flickering back to skeleton on scroll.
 * Falls back to `true` if IntersectionObserver is undefined.
 */
export function useInView(
  ref: RefObject<Element | null>,
  options?: IntersectionObserverInit,
): boolean {
  const [inView, setInView] = useState(() => {
    if (typeof window !== "undefined" && !("IntersectionObserver" in window)) {
      return true;
    }
    return false;
  });

  const root = options?.root;
  const rootMargin = options?.rootMargin ?? "200px 0px";
  const threshold = options?.threshold;

  useEffect(() => {
    if (inView) return;

    if (typeof window === "undefined" || !("IntersectionObserver" in window)) {
      setInView(true);
      return;
    }

    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry?.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      { root, rootMargin, threshold },
    );

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, [ref, inView, root, rootMargin, threshold]);

  return inView;
}
