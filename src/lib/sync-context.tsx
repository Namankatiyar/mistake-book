"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { getDb } from "@/lib/pglite-db";
import { LibraryContext } from "@/lib/library";
import {
  SyncRunner,
  type SyncProgress,
  type SyncStatus,
} from "@/lib/sync-engine";
import { clearFolderCache } from "@/lib/drive-api";
import * as schema from "@/db/schema";

export type AuthUser = {
  email: string;
  name?: string;
  picture?: string;
};

export type AuthStatus = {
  connected: boolean;
  user?: AuthUser;
};

export type SyncContextValue = {
  syncProgress: SyncProgress;
  syncNow: () => Promise<void>;
  mergeWithCloud: () => Promise<void>;
  restoreFromDrive: () => Promise<void>;
  authStatus: AuthStatus;
  authChecked: boolean;
  connectDrive: () => void;
  disconnectDrive: () => Promise<void>;
  signInModalOpen: boolean;
  openSignInModal: () => void;
  closeSignInModal: () => void;
};

const SyncContext = createContext<SyncContextValue | null>(null);

const DEFAULT_SYNC_PROGRESS: SyncProgress = {
  status: "idle",
  pending: 0,
  processed: 0,
  total: 0,
};

export function SyncProvider({ children }: { children: ReactNode }) {
  const libraryCtx = useContext(LibraryContext);
  const isLibraryReady = libraryCtx ? libraryCtx.ready : true;

  const [authStatus, setAuthStatus] = useState<AuthStatus>({ connected: false });
  const [authChecked, setAuthChecked] = useState(false);
  const [syncProgress, setSyncProgress] = useState<SyncProgress>(DEFAULT_SYNC_PROGRESS);
  const [signInModalOpen, setSignInModalOpen] = useState(false);

  const openSignInModal = useCallback(() => setSignInModalOpen(true), []);
  const closeSignInModal = useCallback(() => setSignInModalOpen(false), []);

  const runnerRef = useRef<SyncRunner | null>(null);
  const hasMergedOnConnectRef = useRef(false);

  // Check if offline on initial client mount
  useEffect(() => {
    if (typeof window !== "undefined" && !navigator.onLine) {
      setSyncProgress((prev) => ({ ...prev, status: "offline" }));
    }
  }, []);

  const fetchAuthStatus = useCallback(async (): Promise<AuthStatus> => {
    try {
      const res = await fetch("/api/auth/google/status");
      if (!res.ok) {
        const unauth: AuthStatus = { connected: false };
        setAuthStatus(unauth);
        setAuthChecked(true);
        return unauth;
      }
      const data = (await res.json()) as AuthStatus;
      setAuthStatus(data);
      if (data.connected && typeof window !== "undefined") {
        try {
          localStorage.setItem("mb.has_signed_in", "true");
        } catch {
          // ignore
        }
      }
      setAuthChecked(true);
      return data;
    } catch {
      const unauth: AuthStatus = { connected: false };
      setAuthStatus(unauth);
      setAuthChecked(true);
      return unauth;
    }
  }, []);

  // Initialize SyncRunner when LibraryProvider is ready
  useEffect(() => {
    if (!isLibraryReady) return;

    const runner = new SyncRunner(getDb);
    runnerRef.current = runner;

    const unsubscribe = runner.subscribe((progress) => {
      setSyncProgress(progress);
    });

    fetchAuthStatus().then((auth) => {
      if (auth.connected) {
        if (!hasMergedOnConnectRef.current) {
          hasMergedOnConnectRef.current = true;
          runner.mergeWithCloud().catch(() => {});
        } else {
          runner.schedule(1000);
        }
      }
    });

    return () => {
      unsubscribe();
      runner.destroy();
      runnerRef.current = null;
    };
  }, [isLibraryReady, fetchAuthStatus]);

  // Check auth status on mount and when ?sync=connected is detected in URL
  useEffect(() => {
    if (typeof window === "undefined") return;

    const url = new URL(window.location.href);
    const isSyncRedirect = url.searchParams.get("sync") === "connected";
    if (isSyncRedirect) {
      url.searchParams.delete("sync");
      window.history.replaceState(
        {},
        "",
        url.pathname + (url.search ? url.search : "")
      );
    }

    fetchAuthStatus().then((auth) => {
      if (auth.connected && runnerRef.current) {
        if (isSyncRedirect || !hasMergedOnConnectRef.current) {
          hasMergedOnConnectRef.current = true;
          runnerRef.current.mergeWithCloud().catch(() => {});
        } else {
          runnerRef.current.schedule(500);
        }
      }
    });
  }, [fetchAuthStatus]);

  // Listen to online and offline window events
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleOnline = () => {
      fetchAuthStatus().then((auth) => {
        if (auth.connected && runnerRef.current) {
          runnerRef.current.schedule(1000);
        }
      });
    };

    const handleOffline = () => {
      setSyncProgress((prev) => ({ ...prev, status: "offline" as SyncStatus }));
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [fetchAuthStatus]);

  const syncNow = useCallback(async () => {
    if (runnerRef.current) {
      await runnerRef.current.syncNow();
    }
  }, []);

  const mergeWithCloud = useCallback(async () => {
    if (runnerRef.current) {
      await runnerRef.current.mergeWithCloud();
    }
  }, []);

  const restoreFromDrive = useCallback(async () => {
    if (runnerRef.current) {
      await runnerRef.current.restoreFromDrive();
    }
  }, []);

  const connectDrive = useCallback(() => {
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("mb.has_signed_in", "true");
      } catch {
        // ignore
      }
      // Full browser navigation is required to trigger OAuth redirection to Google
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.href = "/api/auth/google";
    }
  }, []);

  const disconnectDrive = useCallback(async () => {
    try {
      await fetch("/api/auth/google/logout", { method: "POST" });
    } catch {
      // ignore
    }
    try {
      const { db } = await getDb();
      await db.delete(schema.syncMetadata);
      clearFolderCache();
    } catch {
      // ignore
    }
    hasMergedOnConnectRef.current = false;
    setAuthStatus({ connected: false });
    setSyncProgress((prev) => ({ ...prev, status: "unauthenticated" as SyncStatus }));
  }, []);

  const value = useMemo<SyncContextValue>(
    () => ({
      syncProgress,
      syncNow,
      mergeWithCloud,
      restoreFromDrive,
      authStatus,
      authChecked,
      connectDrive,
      disconnectDrive,
      signInModalOpen,
      openSignInModal,
      closeSignInModal,
    }),
    [
      syncProgress,
      syncNow,
      mergeWithCloud,
      restoreFromDrive,
      authStatus,
      authChecked,
      connectDrive,
      disconnectDrive,
      signInModalOpen,
      openSignInModal,
      closeSignInModal,
    ]
  );

  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
}

export function useDriveSync(): SyncContextValue {
  const ctx = useContext(SyncContext);
  if (!ctx) {
    throw new Error("useDriveSync must be used within a SyncProvider");
  }
  return ctx;
}
