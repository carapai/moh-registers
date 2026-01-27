import { FormInstance } from "antd";
import { useLiveQuery } from "dexie-react-hooks";
import { useCallback, useEffect, useRef } from "react";
import { db, FlattenedEvent } from "../db";
import type { FlattenedTrackedEntity } from "../db";

/**
 * useDexieForm Hook
 *
 * Reactive form integration with Dexie database.
 * Forms read from and write directly to Dexie with automatic sync queueing.
 *
 * Features:
 * - Reactive queries using useLiveQuery
 * - Batched writes with 500ms debounce
 * - Automatic sync metadata updates
 * - Transaction-based updates for consistency
 * - No manual save() calls needed
 */

interface UseDexieFormOptions {
    form: FormInstance;
    entityId: string;
    entityType: "trackedEntity" | "event" | "relationship";
    debounceMs?: number;
}

interface UseDexieFormReturn {
    data: FlattenedTrackedEntity | FlattenedEvent | null;
    loading: boolean;
    updateField: (field: string, value: any) => Promise<void>;
    updateFields: (fields: Record<string, any>) => Promise<void>;
    syncStatus: string | undefined;
}

export const useDexieForm = ({
    form,
    entityId,
    entityType,
    debounceMs = 500,
}: UseDexieFormOptions): UseDexieFormReturn => {
    const batchQueueRef = useRef<Record<string, any>>({});
    const batchTimerRef = useRef<NodeJS.Timeout | null>(null);

    // Reactive query - updates automatically when Dexie data changes
    const data = useLiveQuery(async () => {
        switch (entityType) {
            case "trackedEntity":
                return await db.trackedEntities.get(entityId);
            case "event":
                return await db.events.get(entityId);
            case "relationship":
                return await db.relationships.get(entityId);
            default:
                return null;
        }
    }, [entityId, entityType]);

    // Sync form when data changes from Dexie
    useEffect(() => {
        if (data) {
            if (entityType === "trackedEntity") {
                const entity = data as FlattenedTrackedEntity;
                form.setFieldsValue(entity.attributes);
            } else if (entityType === "event") {
                const event = data as FlattenedEvent;
                form.setFieldsValue(event.dataValues);
            }
        }
    }, [data, form, entityType]);

    /**
     * Perform batched write to Dexie
     * Uses transaction for atomic updates
     */
    const performBatchWrite = useCallback(async () => {
        const updates = { ...batchQueueRef.current };
        batchQueueRef.current = {};

        if (Object.keys(updates).length === 0) return;

        try {
            await db.transaction("rw", db[`${entityType}s` as keyof typeof db], async () => {
                if (entityType === "trackedEntity") {
                    await db.trackedEntities.update(entityId, {
                        attributes: {
                            ...(data as FlattenedTrackedEntity)?.attributes,
                            ...updates,
                        },
                    });
                } else if (entityType === "event") {
                    await db.events.update(entityId, {
                        dataValues: {
                            ...(data as FlattenedEvent)?.dataValues,
                            ...updates,
                        },
                    });
                }
            });

            console.log("✅ Batched write completed:", updates);
        } catch (error) {
            console.error("❌ Batched write failed:", error);
            throw error;
        }
    }, [entityId, entityType, data]);

    /**
     * Update a single field
     * Batches changes with debounce
     */
    const updateField = useCallback(
        async (field: string, value: any) => {
            // Add to batch queue
            batchQueueRef.current[field] = value;

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
     * Update multiple fields at once
     * Immediate write without debounce
     */
    const updateFields = useCallback(
        async (fields: Record<string, any>) => {
            // Clear any pending batch
            if (batchTimerRef.current) {
                clearTimeout(batchTimerRef.current);
                batchTimerRef.current = null;
            }

            // Merge with existing batch queue
            batchQueueRef.current = {
                ...batchQueueRef.current,
                ...fields,
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
        data: data || null,
        loading: data === undefined,
        updateField,
        updateFields,
        syncStatus: (data as any)?.syncStatus,
    };
};
