import { useLiveQuery } from "dexie-react-hooks";
import { useCallback, useEffect, useRef } from "react";
import { db, FlattenedTrackedEntity } from "../db";

/**
 * useDexieTrackedEntityForm Hook
 *
 * Reactive form hook for tracked entities (patients/clients).
 * Manages attributes and enrollment data with automatic syncing.
 *
 * Features:
 * - Reactive tracked entity data from Dexie
 * - Batched attribute updates (500ms debounce)
 * - Automatic sync queueing via Dexie hooks
 * - Transaction-safe writes
 */

interface UseDexieTrackedEntityFormOptions {
    trackedEntityId: string;
    debounceMs?: number;
}

interface UseDexieTrackedEntityFormReturn {
    trackedEntity: FlattenedTrackedEntity | null;
    loading: boolean;
    updateAttribute: (attributeId: string, value: any) => void;
    updateAttributes: (attributes: Record<string, any>) => Promise<void>;
    syncStatus: string | undefined;
    version: number | undefined;
    lastModified: string | undefined;
}

export const useDexieTrackedEntityForm = ({
    trackedEntityId,
    debounceMs = 500,
}: UseDexieTrackedEntityFormOptions): UseDexieTrackedEntityFormReturn => {
    const batchQueueRef = useRef<Record<string, any>>({});
    const batchTimerRef = useRef<NodeJS.Timeout | null>(null);

    // Reactive query - UI updates automatically when tracked entity changes
    const trackedEntity = useLiveQuery(
        async () => {
            return await db.trackedEntities.get(trackedEntityId);
        },
        [trackedEntityId],
    );

    // NOTE: No automatic Dexie → Form sync to prevent flicker during user input
    // Form initialization should be handled by the component on mount/open
    // Only Form → Dexie flow is active via updateAttribute/updateAttributes

    /**
     * Perform batched write to Dexie
     * Hooks will automatically queue sync operation
     */
    const performBatchWrite = useCallback(async () => {
        const updates = { ...batchQueueRef.current };
        batchQueueRef.current = {};

        if (Object.keys(updates).length === 0) return;

        try {
            await db.trackedEntities.update(trackedEntityId, {
                attributes: {
                    ...trackedEntity?.attributes,
                    ...updates,
                },
            });

            console.log("✅ Tracked entity updated:", { trackedEntityId, updates });
        } catch (error) {
            console.error("❌ Tracked entity update failed:", error);
            throw error;
        }
    }, [trackedEntityId, trackedEntity]);

    /**
     * Update a single attribute value
     * Batches changes with debounce
     */
    const updateAttribute = useCallback(
        (attributeId: string, value: any) => {
            // Add to batch queue
            batchQueueRef.current[attributeId] = value;

            // Clear existing timer
            if (batchTimerRef.current) {
                clearTimeout(batchTimerRef.current);
            }

            // Start debounce timer
            batchTimerRef.current = setTimeout(() => {
                performBatchWrite();
            }, debounceMs);
        },
        [debounceMs, performBatchWrite],
    );

    /**
     * Update multiple attributes at once
     * Immediate write without debounce
     */
    const updateAttributes = useCallback(
        async (attributes: Record<string, any>) => {
            // Clear any pending batch
            if (batchTimerRef.current) {
                clearTimeout(batchTimerRef.current);
                batchTimerRef.current = null;
            }

            // Merge with existing batch queue
            batchQueueRef.current = {
                ...batchQueueRef.current,
                ...attributes,
            };

            // Immediate write
            await performBatchWrite();
        },
        [performBatchWrite],
    );

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (batchTimerRef.current) {
                clearTimeout(batchTimerRef.current);
            }
        };
    }, []);

    return {
        trackedEntity: trackedEntity || null,
        loading: trackedEntity === undefined,
        updateAttribute,
        updateAttributes,
        syncStatus: (trackedEntity as any)?.syncStatus,
        version: (trackedEntity as any)?.version,
        lastModified: (trackedEntity as any)?.lastModified,
    };
};
