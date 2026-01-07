import { generateUid } from "../utils/id";
import {
    db,
    type EventDraft,
    type FlattenedEvent,
    type FlattenedTrackedEntity,
    type SyncOperation,
    type TrackedEntityDraft,
} from "./index";

/**
 * Database Operations for MOH Registers Application
 *
 * This module provides a clean API for interacting with the IndexedDB database.
 * All operations are async and return promises.
 */

// ============================================================================
// TrackedEntity Operations
// ============================================================================

/**
 * Save or update a tracked entity in the local database
 */
export async function saveTrackedEntity(
    entity: FlattenedTrackedEntity,
): Promise<void> {
    await db.trackedEntities.put(entity);
}

/**
 * Get a tracked entity by ID
 */
export async function getTrackedEntity(
    id: string,
): Promise<FlattenedTrackedEntity | undefined> {
    return await db.trackedEntities.get(id);
}

/**
 * Get all tracked entities for an organization unit (paginated)
 * ✅ OPTIMIZED: Added pagination to prevent loading large datasets
 */
export async function getTrackedEntitiesByOrgUnit(
    orgUnit: string,
    page: number = 1,
    pageSize: number = 50,
): Promise<{ entities: FlattenedTrackedEntity[]; total: number }> {
    const total = await db.trackedEntities
        .where("orgUnit")
        .equals(orgUnit)
        .count();

    const entities = await db.trackedEntities
        .where("orgUnit")
        .equals(orgUnit)
        .reverse()
        .sortBy("updatedAt")
        .then((sorted) => {
            const start = (page - 1) * pageSize;
            return sorted.slice(start, start + pageSize);
        });

    return { entities, total };
}

/**
 * Get all tracked entities (paginated)
 */
export async function getTrackedEntities(
    page: number = 1,
    pageSize: number = 10,
): Promise<{ entities: FlattenedTrackedEntity[]; total: number }> {
    const total = await db.trackedEntities.count();
    const entities = await db.trackedEntities
        .orderBy("updatedAt")
        .reverse()
        .offset((page - 1) * pageSize)
        .limit(pageSize)
        .toArray();

    return { entities, total };
}

/**
 * Delete a tracked entity
 */
export async function deleteTrackedEntity(id: string): Promise<void> {
    await db.trackedEntities.delete(id);
}

/**
 * Bulk save tracked entities (useful for initial sync)
 */
export async function bulkSaveTrackedEntities(
    entities: FlattenedTrackedEntity[],
): Promise<void> {
    await db.trackedEntities.bulkPut(entities);
}

// ============================================================================
// Event Operations
// ============================================================================

/**
 * Save or update an event in the local database
 */
export async function saveEvent(event: FlattenedEvent): Promise<void> {
    await db.events.put(event);
}

/**
 * Get an event by ID
 */
export async function getEvent(
    id: string,
): Promise<FlattenedEvent | undefined> {
    return await db.events.get(id);
}

/**
 * Get all events for a tracked entity (paginated)
 * ✅ OPTIMIZED: Added pagination to prevent loading large event datasets
 */
export async function getEventsByTrackedEntity(
    trackedEntityId: string,
    page: number = 1,
    pageSize: number = 100,
): Promise<{ events: FlattenedEvent[]; total: number }> {
    const total = await db.events
        .where("trackedEntity")
        .equals(trackedEntityId)
        .count();

    const events = await db.events
        .where("trackedEntity")
        .equals(trackedEntityId)
        .reverse()
        .sortBy("occurredAt")
        .then((sorted) => {
            const start = (page - 1) * pageSize;
            return sorted.slice(start, start + pageSize);
        });

    return { events, total };
}

/**
 * Get all events for a program stage (paginated)
 * ✅ OPTIMIZED: Added pagination to prevent loading large event datasets
 */
export async function getEventsByProgramStage(
    trackedEntityId: string,
    programStageId: string,
    page: number = 1,
    pageSize: number = 100,
): Promise<{ events: FlattenedEvent[]; total: number }> {
    const total = await db.events
        .where("[trackedEntity+programStage]")
        .equals([trackedEntityId, programStageId])
        .count();

    const events = await db.events
        .where("[trackedEntity+programStage]")
        .equals([trackedEntityId, programStageId])
        .reverse()
        .sortBy("occurredAt")
        .then((sorted) => {
            const start = (page - 1) * pageSize;
            return sorted.slice(start, start + pageSize);
        });

    return { events, total };
}

/**
 * Delete an event
 */
export async function deleteEvent(id: string): Promise<void> {
    await db.events.delete(id);
}

/**
 * Bulk save events (useful for initial sync)
 */
export async function bulkSaveEvents(events: FlattenedEvent[]): Promise<void> {
    await db.events.bulkPut(events);
}

// ============================================================================
// Draft Operations
// ============================================================================

/**
 * Save a tracked entity draft (for auto-save)
 */
export async function saveTrackedEntityDraft(
    draft: Omit<TrackedEntityDraft, "createdAt" | "updatedAt">,
): Promise<TrackedEntityDraft> {
    const now = new Date().toISOString();
    const existing = await db.trackedEntityDrafts.get(draft.id);

    const completeDraft: TrackedEntityDraft = {
        ...draft,
        createdAt: existing?.createdAt || now,
        updatedAt: now,
    };

    await db.trackedEntityDrafts.put(completeDraft);
    return completeDraft;
}

/**
 * Get a tracked entity draft by ID
 */
export async function getTrackedEntityDraft(
    id: string,
): Promise<TrackedEntityDraft | undefined> {
    return await db.trackedEntityDrafts.get(id);
}

/**
 * Delete a tracked entity draft
 */
export async function deleteTrackedEntityDraft(id: string): Promise<void> {
    await db.trackedEntityDrafts.delete(id);
}

/**
 * Get all tracked entity drafts (paginated)
 * ✅ OPTIMIZED: Added pagination to prevent loading large draft datasets
 */
export async function getAllTrackedEntityDrafts(
    page: number = 1,
    pageSize: number = 50,
): Promise<{ drafts: TrackedEntityDraft[]; total: number }> {
    const total = await db.trackedEntityDrafts.count();
    const drafts = await db.trackedEntityDrafts
        .orderBy("updatedAt")
        .reverse()
        .offset((page - 1) * pageSize)
        .limit(pageSize)
        .toArray();

    return { drafts, total };
}

/**
 * Save an event draft (for auto-save)
 */
export async function saveEventDraft(
    draft: Omit<EventDraft, "createdAt" | "updatedAt">,
): Promise<EventDraft> {
    const now = new Date().toISOString();
    const existing = await db.eventDrafts.get(draft.id);

    const completeDraft: EventDraft = {
        ...draft,
        createdAt: existing?.createdAt || now,
        updatedAt: now,
    };

    await db.eventDrafts.put(completeDraft);
    return completeDraft;
}

/**
 * Get an event draft by ID
 */
export async function getEventDraft(
    id: string,
): Promise<EventDraft | undefined> {
    return await db.eventDrafts.get(id);
}

/**
 * Delete an event draft
 */
export async function deleteEventDraft(id: string): Promise<void> {
    await db.eventDrafts.delete(id);
}

/**
 * Get all event drafts for a tracked entity (paginated)
 * ✅ OPTIMIZED: Added pagination to prevent loading large draft datasets
 */
export async function getEventDraftsByTrackedEntity(
    trackedEntityId: string,
    page: number = 1,
    pageSize: number = 50,
): Promise<{ drafts: EventDraft[]; total: number }> {
    const total = await db.eventDrafts
        .where("trackedEntity")
        .equals(trackedEntityId)
        .count();

    const drafts = await db.eventDrafts
        .where("trackedEntity")
        .equals(trackedEntityId)
        .reverse()
        .sortBy("updatedAt")
        .then((sorted) => {
            const start = (page - 1) * pageSize;
            return sorted.slice(start, start + pageSize);
        });

    return { drafts, total };
}

/**
 * Get all event drafts (paginated)
 * ✅ OPTIMIZED: Added pagination to prevent loading large draft datasets
 */
export async function getAllEventDrafts(
    page: number = 1,
    pageSize: number = 50,
): Promise<{ drafts: EventDraft[]; total: number }> {
    const total = await db.eventDrafts.count();
    const drafts = await db.eventDrafts
        .orderBy("updatedAt")
        .reverse()
        .offset((page - 1) * pageSize)
        .limit(pageSize)
        .toArray();

    return { drafts, total };
}

/**
 * Delete old drafts (older than specified days)
 * ✅ OPTIMIZED: Auto-cleanup to prevent draft table growth
 */
export async function deleteOldDrafts(daysOld: number = 30): Promise<{
    trackedEntityDrafts: number;
    eventDrafts: number;
}> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);
    const cutoffIso = cutoffDate.toISOString();

    // Delete old tracked entity drafts
    const oldTrackedEntityDrafts = await db.trackedEntityDrafts
        .where("updatedAt")
        .below(cutoffIso)
        .toArray();

    await db.trackedEntityDrafts.where("updatedAt").below(cutoffIso).delete();

    // Delete old event drafts
    const oldEventDrafts = await db.eventDrafts
        .where("updatedAt")
        .below(cutoffIso)
        .toArray();

    await db.eventDrafts.where("updatedAt").below(cutoffIso).delete();

    console.log(
        `🗑️  Cleaned up ${oldTrackedEntityDrafts.length} tracked entity drafts and ${oldEventDrafts.length} event drafts older than ${daysOld} days`,
    );

    return {
        trackedEntityDrafts: oldTrackedEntityDrafts.length,
        eventDrafts: oldEventDrafts.length,
    };
}

// ============================================================================
// Sync Queue Operations
// ============================================================================

/**
 * Add an operation to the sync queue
 */
export async function queueSyncOperation(
    operation: Omit<
        SyncOperation,
        "id" | "status" | "attempts" | "createdAt" | "updatedAt"
    >,
): Promise<SyncOperation> {
    const now = new Date().toISOString();
    const completeOperation: SyncOperation = {
        ...operation,
        id: generateUid(),
        status: "pending",
        attempts: 0,
        createdAt: now,
        updatedAt: now,
    };

    await db.syncQueue.put(completeOperation);
    return completeOperation;
}

/**
 * Get next pending sync operation (highest priority, oldest first)
 */
export async function getNextSyncOperation(): Promise<
    SyncOperation | undefined
> {
    const operations = await db.syncQueue
        .where("status")
        .equals("pending")
        .sortBy("priority");

    return operations.reverse()[0]; // Highest priority first
}

/**
 * Update sync operation status
 */
export async function updateSyncOperation(
    id: string,
    update: Partial<Pick<SyncOperation, "status" | "attempts" | "error">>,
): Promise<void> {
    const operation = await db.syncQueue.get(id);
    if (!operation) return;

    await db.syncQueue.put({
        ...operation,
        ...update,
        updatedAt: new Date().toISOString(),
    });
}

/**
 * Mark sync operation as completed
 */
export async function completeSyncOperation(id: string): Promise<void> {
    await updateSyncOperation(id, { status: "completed" });
}

/**
 * Mark sync operation as failed
 */
export async function failSyncOperation(
    id: string,
    error: string,
): Promise<void> {
    const operation = await db.syncQueue.get(id);
    if (!operation) return;

    await updateSyncOperation(id, {
        status: "failed",
        attempts: operation.attempts + 1,
        error,
    });
}

/**
 * Retry a failed sync operation
 */
export async function retrySyncOperation(id: string): Promise<void> {
    await updateSyncOperation(id, { status: "pending", error: undefined });
}

/**
 * Delete a sync operation
 */
export async function deleteSyncOperation(id: string): Promise<void> {
    await db.syncQueue.delete(id);
}

/**
 * Get all sync operations with a specific status
 */
export async function getSyncOperationsByStatus(
    status: SyncOperation["status"],
): Promise<SyncOperation[]> {
    return await db.syncQueue
        .where("status")
        .equals(status)
        .sortBy("createdAt");
}

/**
 * Get sync queue statistics
 */
export async function getSyncQueueStats(): Promise<{
    pending: number;
    syncing: number;
    failed: number;
    completed: number;
    total: number;
}> {
    const [pending, syncing, failed, completed] = await Promise.all([
        db.syncQueue.where("status").equals("pending").count(),
        db.syncQueue.where("status").equals("syncing").count(),
        db.syncQueue.where("status").equals("failed").count(),
        db.syncQueue.where("status").equals("completed").count(),
    ]);

    return {
        pending,
        syncing,
        failed,
        completed,
        total: pending + syncing + failed + completed,
    };
}

// ============================================================================
// Machine State Operations
// ============================================================================

/**
 * Save XState machine state for persistence across page refreshes
 */
export async function saveMachineState(
    context: any,
    state: string,
): Promise<void> {
    await db.machineState.put({
        id: "tracker-machine",
        context,
        state,
        updatedAt: new Date().toISOString(),
    });
}

/**
 * Load XState machine state
 */
export async function loadMachineState(): Promise<
    { context: any; state: string } | undefined
> {
    return await db.machineState.get("tracker-machine");
}

/**
 * Clear machine state
 */
export async function clearMachineState(): Promise<void> {
    await db.machineState.delete("tracker-machine");
}
