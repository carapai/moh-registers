import { useEffect, useState } from "react";
import type { SyncManager, SyncManagerState } from "../db/sync";

/**
 * useSyncStatus Hook
 *
 * Reactive hook for monitoring sync status across the application.
 * Automatically subscribes to SyncManager state changes.
 *
 * Features:
 * - Real-time sync status updates
 * - Pending operation count
 * - Online/offline detection
 * - Sync error tracking
 *
 * Usage:
 * ```typescript
 * const { status, pendingCount, isOnline, error } = useSyncStatus(syncManager);
 *
 * if (status === 'syncing') {
 *   return <Spin tip="Syncing..." />;
 * }
 * ```
 */

export interface UseSyncStatusReturn extends SyncManagerState {
    isOnline: boolean;
    isSyncing: boolean;
    hasError: boolean;
}

export const useSyncStatus = (
    syncManager: SyncManager | undefined,
): UseSyncStatusReturn => {
    const [state, setState] = useState<SyncManagerState>({
        status: "idle",
        pendingCount: 0,
    });

    useEffect(() => {
        if (!syncManager) {
            return;
        }

        // Subscribe to sync manager updates
        const unsubscribe = syncManager.subscribe((newState) => {
            setState(newState);
        });

        // Get initial state
        syncManager.getState().then((initialState) => {
            setState(initialState);
        });

        return () => {
            unsubscribe();
        };
    }, [syncManager]);

    return {
        ...state,
        isOnline: state.status === "online" || state.status === "syncing",
        isSyncing: state.status === "syncing",
        hasError: !!state.error,
    };
};
