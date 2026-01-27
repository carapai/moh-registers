import { useLiveQuery } from "dexie-react-hooks";
import { db, type SyncStatus } from "../db";

/**
 * useEntitySyncStatus Hook
 *
 * Monitor sync status for a specific tracked entity.
 * Returns reactive sync metadata from Dexie.
 *
 * Features:
 * - Real-time sync status
 * - Version tracking (for conflict detection)
 * - Last modified timestamp
 * - Last synced timestamp
 * - Sync error details
 *
 * Usage:
 * ```typescript
 * const { syncStatus, version, lastModified, lastSynced, syncError } =
 *   useEntitySyncStatus(trackedEntityId);
 *
 * if (syncStatus === 'pending') {
 *   return <Badge status="warning" text="Pending sync" />;
 * }
 * ```
 */

export interface EntitySyncStatusReturn {
    syncStatus: SyncStatus | undefined;
    version: number | undefined;
    lastModified: string | undefined;
    lastSynced: string | undefined;
    syncError: string | undefined;
    loading: boolean;
    isPending: boolean;
    isSyncing: boolean;
    isSynced: boolean;
    hasFailed: boolean;
}

export const useEntitySyncStatus = (
    trackedEntityId: string | null,
): EntitySyncStatusReturn => {
    const entity = useLiveQuery(
        async () => {
            if (!trackedEntityId) return null;
            return await db.trackedEntities.get(trackedEntityId);
        },
        [trackedEntityId],
    );

    const loading = entity === undefined;
    const syncStatus = (entity as any)?.syncStatus as SyncStatus | undefined;

    return {
        syncStatus,
        version: (entity as any)?.version,
        lastModified: (entity as any)?.lastModified,
        lastSynced: (entity as any)?.lastSynced,
        syncError: (entity as any)?.syncError,
        loading,
        isPending: syncStatus === "pending",
        isSyncing: syncStatus === "syncing",
        isSynced: syncStatus === "synced",
        hasFailed: syncStatus === "failed",
    };
};

/**
 * useEventSyncStatus Hook
 *
 * Monitor sync status for a specific event.
 * Returns reactive sync metadata from Dexie.
 *
 * Usage:
 * ```typescript
 * const { syncStatus, isPending, hasFailed } = useEventSyncStatus(eventId);
 * ```
 */

export const useEventSyncStatus = (
    eventId: string | null,
): EntitySyncStatusReturn => {
    const event = useLiveQuery(
        async () => {
            if (!eventId) return null;
            return await db.events.get(eventId);
        },
        [eventId],
    );

    const loading = event === undefined;
    const syncStatus = (event as any)?.syncStatus as SyncStatus | undefined;

    return {
        syncStatus,
        version: (event as any)?.version,
        lastModified: (event as any)?.lastModified,
        lastSynced: (event as any)?.lastSynced,
        syncError: (event as any)?.syncError,
        loading,
        isPending: syncStatus === "pending",
        isSyncing: syncStatus === "syncing",
        isSynced: syncStatus === "synced",
        hasFailed: syncStatus === "failed",
    };
};

/**
 * useRelationshipSyncStatus Hook
 *
 * Monitor sync status for a specific relationship.
 * Returns reactive sync metadata from Dexie.
 *
 * Usage:
 * ```typescript
 * const { syncStatus, lastSynced } = useRelationshipSyncStatus(relationshipId);
 * ```
 */

export const useRelationshipSyncStatus = (
    relationshipId: string | null,
): EntitySyncStatusReturn => {
    const relationship = useLiveQuery(
        async () => {
            if (!relationshipId) return null;
            return await db.relationships.get(relationshipId);
        },
        [relationshipId],
    );

    const loading = relationship === undefined;
    const syncStatus = (relationship as any)?.syncStatus as
        | SyncStatus
        | undefined;

    return {
        syncStatus,
        version: (relationship as any)?.version,
        lastModified: (relationship as any)?.lastModified,
        lastSynced: (relationship as any)?.lastSynced,
        syncError: (relationship as any)?.syncError,
        loading,
        isPending: syncStatus === "pending",
        isSyncing: syncStatus === "syncing",
        isSynced: syncStatus === "synced",
        hasFailed: syncStatus === "failed",
    };
};
