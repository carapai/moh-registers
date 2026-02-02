import { useCallback, useEffect, useRef } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, FlattenedEvent, FlattenedTrackedEntity } from "../db";

/**
 * Unified Dexie Persistence Hook
 *
 * Replaces useDexieEventForm and useDexieTrackedEntityForm with a single,
 * generic persistence hook that handles batching and reactive queries.
 *
 * Features:
 * - Reactive entity loading via useLiveQuery
 * - Batched updates with configurable debounce (default 300ms)
 * - Immediate flush for bulk updates
 * - Automatic cleanup on unmount
 * - Type-safe for events, tracked entities, and relationships
 */

type EntityType = "event" | "trackedEntity";
type EventData = Partial<FlattenedEvent["dataValues"]>;
type TrackedEntityData = Partial<FlattenedTrackedEntity["attributes"]>;

interface UseDexiePersistenceOptions {
    entityType: EntityType;
    entityId: string | null;
    debounceMs?: number;
}

interface UseDexiePersistenceReturn<T> {
    entity: T | null;
    loading: boolean;
    updateField: (fieldId: string, value: any) => void;
    updateFields: (fields: Record<string, any>) => Promise<void>;
    createEntity: (entity: T) => Promise<void>;
}

export function useDexiePersistence<T extends FlattenedEvent | FlattenedTrackedEntity>(
    options: UseDexiePersistenceOptions
): UseDexiePersistenceReturn<T> {
    const { entityType, entityId, debounceMs = 300 } = options;

    // Reactive query for the entity
    const entity = useLiveQuery(async () => {
        if (!entityId) return null;

        if (entityType === "event") {
            return (await db.events.get(entityId)) as T | undefined;
        } else {
            return (await db.trackedEntities.get(entityId)) as T | undefined;
        }
    }, [entityId, entityType]);

    // Batch queue and timer for debounced updates
    const batchQueueRef = useRef<Record<string, any>>({});
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    /**
     * Flush pending updates to Dexie
     */
    const flush = useCallback(async () => {
        const updates = { ...batchQueueRef.current };
        batchQueueRef.current = {};

        if (Object.keys(updates).length === 0) {
            console.log("💾 Flush skipped: No updates in queue");
            return;
        }

        if (!entityId) {
            console.log("💾 Flush skipped: No entityId");
            return;
        }

        console.log(`💾 Flushing ${Object.keys(updates).length} updates for ${entityType}:`, entityId);

        try {
            if (entityType === "event") {
                // Fetch latest to avoid overwriting concurrent updates
                const current = await db.events.get(entityId);
                if (!current) {
                    console.error("❌ Event not found in Dexie:", entityId);
                    throw new Error(`Event ${entityId} not found in database`);
                }
                console.log("✅ Found event in Dexie, updating with:", Object.keys(updates));
                await db.events.put({
                    ...current,
                    dataValues: {
                        ...current.dataValues,
                        ...updates,
                    },
                });
                console.log("✅ Event updated successfully");
            } else {
                // Fetch latest to avoid overwriting concurrent updates
                const current = await db.trackedEntities.get(entityId);
                if (!current) {
                    console.error("❌ TrackedEntity not found in Dexie:", entityId);
                    throw new Error(`TrackedEntity ${entityId} not found in database`);
                }
                console.log("✅ Found trackedEntity in Dexie, updating with:", Object.keys(updates));
                await db.trackedEntities.put({
                    ...current,
                    attributes: {
                        ...current.attributes,
                        ...updates,
                    },
                });
                console.log("✅ TrackedEntity updated successfully");
            }
        } catch (error) {
            console.error(`❌ Failed to update ${entityType}:`, error);
            throw error;
        }
    }, [entityId, entityType]);

    /**
     * Update a single field (batched with debounce)
     */
    const updateField = useCallback(
        (fieldId: string, value: any) => {
            batchQueueRef.current[fieldId] = value;

            // Clear existing timer
            if (timerRef.current) {
                clearTimeout(timerRef.current);
            }

            // Start debounce timer
            timerRef.current = setTimeout(() => {
                flush();
            }, debounceMs);
        },
        [flush, debounceMs]
    );

    /**
     * Update multiple fields at once (immediate flush)
     */
    const updateFields = useCallback(
        async (fields: Record<string, any>) => {
            // Clear any pending batched updates
            if (timerRef.current) {
                clearTimeout(timerRef.current);
                timerRef.current = null;
            }

            // Merge with existing batch queue
            batchQueueRef.current = {
                ...batchQueueRef.current,
                ...fields,
            };

            // Immediate flush
            await flush();
        },
        [flush]
    );

    /**
     * Create a new entity in Dexie
     */
    const createEntity = useCallback(
        async (newEntity: T) => {
            try {
                if (entityType === "event") {
                    await db.events.put(newEntity as FlattenedEvent);
                } else {
                    await db.trackedEntities.put(newEntity as FlattenedTrackedEntity);
                }
            } catch (error) {
                console.error(`Failed to create ${entityType}:`, error);
                throw error;
            }
        },
        [entityType]
    );

    // Cleanup: flush pending updates on unmount
    useEffect(() => {
        return () => {
            if (timerRef.current) {
                clearTimeout(timerRef.current);
            }
            // Flush any pending updates before unmounting
            if (Object.keys(batchQueueRef.current).length > 0) {
                flush();
            }
        };
    }, [flush]);

    return {
        entity: (entity as T) || null,
        loading: entity === undefined,
        updateField,
        updateFields,
        createEntity,
    };
}
