import { db } from "../db";
import type { FlattenedTrackedEntity, FlattenedEvent, TrackedEntityDraft, EventDraft } from "../db";
import { generateUid } from "./id";

/**
 * Testing Utilities and Helpers
 *
 * Provides utilities for testing the offline-first functionality:
 * - Database initialization and cleanup
 * - Mock data generation
 * - Sync simulation
 * - Draft testing helpers
 */

// ============================================================================
// Database Testing Utilities
// ============================================================================

/**
 * Clear all data from the database
 * Useful for resetting state between tests
 */
export async function clearDatabase(): Promise<void> {
    await Promise.all([
        db.trackedEntities.clear(),
        db.events.clear(),
        db.trackedEntityDrafts.clear(),
        db.eventDrafts.clear(),
        db.syncQueue.clear(),
        db.machineState.clear(),
    ]);
    console.log("🧹 Database cleared");
}

/**
 * Get database statistics
 * Useful for verifying data state during testing
 */
export async function getDatabaseStats(): Promise<{
    trackedEntities: number;
    events: number;
    trackedEntityDrafts: number;
    eventDrafts: number;
    syncQueue: number;
}> {
    const [trackedEntities, events, trackedEntityDrafts, eventDrafts, syncQueue] =
        await Promise.all([
            db.trackedEntities.count(),
            db.events.count(),
            db.trackedEntityDrafts.count(),
            db.eventDrafts.count(),
            db.syncQueue.count(),
        ]);

    return {
        trackedEntities,
        events,
        trackedEntityDrafts,
        eventDrafts,
        syncQueue,
    };
}

/**
 * Print database statistics to console
 */
export async function printDatabaseStats(): Promise<void> {
    const stats = await getDatabaseStats();
    console.log("📊 Database Statistics:", stats);
}

// ============================================================================
// Mock Data Generators
// ============================================================================

/**
 * Generate a mock tracked entity
 */
export function generateMockTrackedEntity(
    overrides?: Partial<FlattenedTrackedEntity>
): FlattenedTrackedEntity {
    const id = generateUid();
    return {
        trackedEntity: id,
        trackedEntityType: "nEenWmSyUEp",
        orgUnit: "DiszpKrYNg8",
        attributes: {
            w75KJ2mc4zz: `FirstName${Math.random().toString(36).substring(7)}`,
            zDhUuAYrxNC: `LastName${Math.random().toString(36).substring(7)}`,
            AuPLng5hLbE: new Date().toISOString().split("T")[0],
        },
        enrollment: {
            enrollment: generateUid(),
            program: "ueBhWkWll5v",
            orgUnit: "DiszpKrYNg8",
            enrolledAt: new Date().toISOString(),
            occurredAt: new Date().toISOString(),
            status: "ACTIVE",
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ...overrides,
    };
}

/**
 * Generate a mock event
 */
export function generateMockEvent(
    trackedEntity: string,
    overrides?: Partial<FlattenedEvent>
): FlattenedEvent {
    const id = generateUid();
    return {
        event: id,
        programStage: "A03MvHHogjR",
        trackedEntity,
        enrollment: generateUid(),
        orgUnit: "DiszpKrYNg8",
        program: "ueBhWkWll5v",
        status: "ACTIVE",
        occurredAt: new Date().toISOString(),
        dataValues: {
            a3kGcGDCuk6: "Test Value",
            oZg33kd9taw: "General",
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ...overrides,
    };
}

/**
 * Generate a mock tracked entity draft
 */
export function generateMockTrackedEntityDraft(
    overrides?: Partial<TrackedEntityDraft>
): TrackedEntityDraft {
    return {
        id: generateUid(),
        attributes: {
            w75KJ2mc4zz: `DraftFirst${Math.random().toString(36).substring(7)}`,
            zDhUuAYrxNC: `DraftLast${Math.random().toString(36).substring(7)}`,
        },
        enrollment: {
            enrollment: generateUid(),
            program: "ueBhWkWll5v",
            orgUnit: "DiszpKrYNg8",
            enrolledAt: new Date().toISOString(),
            occurredAt: new Date().toISOString(),
            status: "ACTIVE",
        },
        orgUnit: "DiszpKrYNg8",
        program: "ueBhWkWll5v",
        isNew: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ...overrides,
    };
}

/**
 * Generate a mock event draft
 */
export function generateMockEventDraft(
    trackedEntity: string,
    overrides?: Partial<EventDraft>
): EventDraft {
    return {
        id: generateUid(),
        event: generateUid(),
        programStage: "A03MvHHogjR",
        trackedEntity,
        enrollment: generateUid(),
        dataValues: {
            a3kGcGDCuk6: "Draft Test Value",
            oZg33kd9taw: "General",
        },
        occurredAt: new Date().toISOString(),
        orgUnit: "DiszpKrYNg8",
        program: "ueBhWkWll5v",
        isNew: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ...overrides,
    };
}

// ============================================================================
// Bulk Data Generation
// ============================================================================

/**
 * Generate multiple mock tracked entities
 */
export function generateMockTrackedEntities(count: number): FlattenedTrackedEntity[] {
    return Array.from({ length: count }, () => generateMockTrackedEntity());
}

/**
 * Generate multiple mock events for a tracked entity
 */
export function generateMockEvents(
    trackedEntity: string,
    count: number
): FlattenedEvent[] {
    return Array.from({ length: count }, () =>
        generateMockEvent(trackedEntity)
    );
}

// ============================================================================
// Sync Testing Helpers
// ============================================================================

/**
 * Simulate offline mode
 */
export function simulateOffline(): void {
    Object.defineProperty(navigator, "onLine", {
        writable: true,
        value: false,
    });
    window.dispatchEvent(new Event("offline"));
    console.log("📵 Simulating offline mode");
}

/**
 * Simulate online mode
 */
export function simulateOnline(): void {
    Object.defineProperty(navigator, "onLine", {
        writable: true,
        value: true,
    });
    window.dispatchEvent(new Event("online"));
    console.log("📡 Simulating online mode");
}

/**
 * Wait for a specified amount of time
 * Useful for testing auto-save and sync intervals
 */
export function wait(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

// ============================================================================
// Draft Testing Helpers
// ============================================================================

/**
 * Populate database with test data
 */
export async function seedTestData(options?: {
    trackedEntities?: number;
    eventsPerEntity?: number;
    drafts?: number;
}): Promise<{
    trackedEntities: FlattenedTrackedEntity[];
    events: FlattenedEvent[];
    drafts: TrackedEntityDraft[];
}> {
    const { trackedEntities = 5, eventsPerEntity = 3, drafts = 2 } = options || {};

    // Generate tracked entities
    const entities = generateMockTrackedEntities(trackedEntities);
    await db.trackedEntities.bulkPut(entities);

    // Generate events for each tracked entity
    const allEvents: FlattenedEvent[] = [];
    for (const entity of entities) {
        const events = generateMockEvents(entity.trackedEntity, eventsPerEntity);
        allEvents.push(...events);
    }
    await db.events.bulkPut(allEvents);

    // Generate drafts
    const draftData: TrackedEntityDraft[] = [];
    for (let i = 0; i < drafts; i++) {
        const draft = generateMockTrackedEntityDraft();
        draftData.push(draft);
    }
    await db.trackedEntityDrafts.bulkPut(draftData);

    console.log("🌱 Seeded test data:", {
        trackedEntities: entities.length,
        events: allEvents.length,
        drafts: draftData.length,
    });

    return {
        trackedEntities: entities,
        events: allEvents,
        drafts: draftData,
    };
}

// ============================================================================
// Validation Helpers
// ============================================================================

/**
 * Validate that data was saved correctly
 */
export async function validateDataPersistence(
    entityId: string
): Promise<boolean> {
    const entity = await db.trackedEntities.get(entityId);
    return entity !== undefined;
}

/**
 * Validate draft auto-save functionality
 */
export async function validateAutoSave(draftId: string): Promise<boolean> {
    const [eventDraft, trackedEntityDraft] = await Promise.all([
        db.eventDrafts.get(draftId),
        db.trackedEntityDrafts.get(draftId),
    ]);

    return eventDraft !== undefined || trackedEntityDraft !== undefined;
}

/**
 * Validate sync queue
 */
export async function validateSyncQueue(expectedCount: number): Promise<boolean> {
    const count = await db.syncQueue.count();
    return count === expectedCount;
}

// ============================================================================
// Export all utilities
// ============================================================================

export const testHelpers = {
    // Database
    clearDatabase,
    getDatabaseStats,
    printDatabaseStats,

    // Mock data
    generateMockTrackedEntity,
    generateMockEvent,
    generateMockTrackedEntityDraft,
    generateMockEventDraft,
    generateMockTrackedEntities,
    generateMockEvents,

    // Sync
    simulateOffline,
    simulateOnline,
    wait,

    // Seeding
    seedTestData,

    // Validation
    validateDataPersistence,
    validateAutoSave,
    validateSyncQueue,
};

// Make helpers available globally in development
if (process.env.NODE_ENV === "development") {
    (window as any).testHelpers = testHelpers;
    console.log("🧪 Test helpers available globally as window.testHelpers");
}
