import { useEffect, useState } from "react";
import {
    MetadataSync,
    MetadataSyncProgress,
    MetadataSyncState,
} from "../db/metadata-sync";

/**
 * useMetadataSync Hook
 *
 * React hook for managing metadata synchronization state.
 * Provides access to sync status, progress, and control functions.
 *
 * Usage:
 * ```typescript
 * const { state, sync, checkForUpdates, isStale } = useMetadataSync(metadataSync);
 *
 * // Check for updates
 * const updates = await checkForUpdates();
 *
 * // Perform full sync
 * await sync();
 * ```
 */
export interface UseMetadataSyncReturn {
    state: MetadataSyncState;
    sync: (onProgress?: (progress: MetadataSyncProgress) => void) => Promise<void>;
    checkForUpdates: () => Promise<void>;
    isStale: () => Promise<boolean>;
    isChecking: boolean;
    isSyncing: boolean;
    hasError: boolean;
    lastSync?: string;
}

export function useMetadataSync(metadataSync: MetadataSync): UseMetadataSyncReturn {
    const [state, setState] = useState<MetadataSyncState>(metadataSync.getState());

    // Subscribe to metadata sync state changes
    useEffect(() => {
        const unsubscribe = metadataSync.subscribe(setState);
        return unsubscribe;
    }, [metadataSync]);

    // Perform full metadata sync
    const sync = async (
        onProgress?: (progress: MetadataSyncProgress) => void,
    ): Promise<void> => {
        try {
            await metadataSync.fullSync(onProgress);
        } catch (error) {
            console.error("Metadata sync failed:", error);
            throw error;
        }
    };

    // Check for metadata updates
    const checkForUpdates = async (): Promise<void> => {
        try {
            await metadataSync.checkForUpdates();
        } catch (error) {
            console.error("Failed to check for metadata updates:", error);
            throw error;
        }
    };

    // Check if metadata is stale
    const isStale = async (): Promise<boolean> => {
        return metadataSync.isMetadataStale();
    };

    return {
        state,
        sync,
        checkForUpdates,
        isStale,
        isChecking: state.status === "checking",
        isSyncing: state.status === "syncing",
        hasError: state.status === "error",
        lastSync: state.lastSync,
    };
}
