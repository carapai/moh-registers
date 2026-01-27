import { useLiveQuery } from "dexie-react-hooks";
import { useCallback, useEffect, useRef } from "react";
import { db, FlattenedEvent } from "../db";

interface UseDexieEventFormOptions {
    currentEvent: FlattenedEvent;
    debounceMs?: number;
}

interface UseDexieEventFormReturn {
    event: FlattenedEvent | null;
    loading: boolean;
    eventExistsInDb: boolean;
    updateDataValue: (dataElementId: string, value: any) => void;
    updateDataValues: (values: Record<string, any>) => Promise<void>;
    createEvent: (initialData: Partial<FlattenedEvent>) => Promise<void>;
    markEventReady: () => Promise<void>;
    syncStatus: string | undefined;
    version: number | undefined;
}

export const useDexieEventForm = ({
    currentEvent,
    debounceMs = 500,
}: UseDexieEventFormOptions): UseDexieEventFormReturn => {
    const batchQueueRef = useRef<Record<string, any>>({});
    const batchTimerRef = useRef<NodeJS.Timeout | null>(null);
    const isWritingRef = useRef(false);
    const eventIdRef = useRef(currentEvent.event);
    useEffect(() => {
        eventIdRef.current = currentEvent.event;
    }, [currentEvent.event]);

    const event = useLiveQuery(async () => {
        return await db.events.get(currentEvent.event);
    }, [currentEvent.event]);

    const eventExistsInDb = event !== undefined && event !== null;
    const createEvent = useCallback(
        async (initialData: Record<string, string>) => {
            try {
                const newEvent = {
                    ...currentEvent,
                    dataValues: { ...currentEvent.dataValues, ...initialData },
                };
                await db.events.put(newEvent);
            } catch (error) {
                console.error("❌ Event creation failed:", error);
                throw error;
            }
        },
        [],
    );
    const performBatchWrite = useCallback(async () => {
        if (isWritingRef.current) {
            return;
        }
        const updates = { ...batchQueueRef.current };
        batchQueueRef.current = {};

        if (Object.keys(updates).length === 0) {
            return;
        }

        isWritingRef.current = true;

        try {
            const eventSearch = await db.events.get(currentEvent.event);

            if (!eventSearch) {
                const now = new Date().toISOString();
                const newEvent = {
                    ...currentEvent,
                    event: eventIdRef.current,
                    dataValues: updates,
                    syncStatus: "draft",
                    version: 1,
                    updatedAt: now,
                    createdAt: now,
                };
                await db.events.add(newEvent);
            } else {
                const mergedDataValues = {
                    ...currentEvent.dataValues,
                    ...updates,
                };
                const now = new Date().toISOString();
                await db.events.update(eventIdRef.current, {
                    ...createEvent,
                    dataValues: mergedDataValues,
                    syncStatus:
                        currentEvent.syncStatus === "synced"
                            ? "pending"
                            : currentEvent.syncStatus === "draft"
                              ? "draft"
                              : currentEvent.syncStatus,
                    version: (currentEvent.version || 0) + 1,
                    updatedAt: now,
                });
            }
        } catch (error) {
            console.error("❌ Event save failed:", error);
            throw error;
        } finally {
            isWritingRef.current = false;
        }
    }, []);

    /**
     * Update a single data element value
     * Batches changes with debounce
     */
    const updateDataValue = useCallback(
        (dataElementId: string, value: any) => {
            batchQueueRef.current[dataElementId] = value;
            if (batchTimerRef.current) {
                clearTimeout(batchTimerRef.current);
            }

            batchTimerRef.current = setTimeout(() => {
                performBatchWrite();
            }, debounceMs);
        },
        [debounceMs, performBatchWrite],
    );
    const updateDataValues = useCallback(
        async (values: Record<string, any>) => {
            if (batchTimerRef.current) {
                clearTimeout(batchTimerRef.current);
                batchTimerRef.current = null;
            }
            batchQueueRef.current = {
                ...batchQueueRef.current,
                ...values,
            };
            await performBatchWrite();
        },
        [performBatchWrite],
    );

    /**
     * Mark event as ready for sync
     * Changes status from "draft" to "pending" when validation passes
     */
    const markEventReady = useCallback(async () => {
        const currentEvent = await db.events.get(eventIdRef.current);
        if (currentEvent && currentEvent.syncStatus === "draft") {
            await db.events.update(eventIdRef.current, {
                syncStatus: "pending",
            });
        }
    }, []);

    useEffect(() => {
        return () => {
            if (batchTimerRef.current) {
                clearTimeout(batchTimerRef.current);
            }
        };
    }, []);

    return {
        event: event || null,
        loading: event === undefined,
        eventExistsInDb,
        updateDataValue,
        updateDataValues,
        createEvent,
        markEventReady,
        syncStatus: event?.syncStatus,
        version: event?.version,
    };
};
