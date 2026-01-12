import { useDataEngine } from "@dhis2/app-runtime";
import { db, type SyncOperation } from "./index";
import {
    completeSyncOperation,
    deleteOldDrafts,
    failSyncOperation,
    getNextSyncOperation,
    getSyncOperationsByStatus,
    getSyncQueueStats,
    queueSyncOperation,
    updateSyncOperation,
} from "./operations";

/**
 * Sync Manager for MOH Registers Application
 *
 * Handles synchronization between local IndexedDB and remote DHIS2 API.
 * Provides offline-first capabilities with automatic background sync.
 */

export type SyncStatus = "idle" | "syncing" | "online" | "offline";

export interface SyncManagerState {
    status: SyncStatus;
    pendingCount: number;
    lastSyncAt?: string;
    error?: string;
}

const SYNC_CONFIG = {
    batchSize: 10,
    retryLimit: 3,
    syncInterval: 5000, // 5 seconds
    pullInterval: 10000, // 10 seconds - interval for pulling data from server
    enablePull: true, // Enable pulling data from server
};

/**
 * SyncManager Class
 *
 * Manages the synchronization lifecycle between local database and DHIS2 API.
 */
export class SyncManager {
    private engine: ReturnType<typeof useDataEngine>;
    private isOnline: boolean = navigator.onLine;
    private isSyncing: boolean = false;
    private isPulling: boolean = false;
    private syncInterval?: NodeJS.Timeout;
    private cleanupInterval?: NodeJS.Timeout;
    private listeners: Set<(state: SyncManagerState) => void> = new Set();

    constructor(engine: ReturnType<typeof useDataEngine>) {
        this.engine = engine;
        this.setupOnlineListener();
        this.setupDatabaseHooks();
    }

    private setupDatabaseHooks() {
        // Hook for creating records
        db.trackedEntities.hook("creating", (primKey, obj, transaction) => {});

        // Hook for updating records
        db.trackedEntities.hook(
            "updating",
            (modifications, primKey, obj, transaction) => {},
        );

        // Hook for deleting records
        db.trackedEntities.hook("deleting", (primKey, obj, transaction) => {});

        // Hook for creating records
        db.events.hook("creating", (primKey, obj, transaction) => {});

        // Hook for updating records
        db.events.hook(
            "updating",
            (modifications, primKey, obj, transaction) => {},
        );
        // Hook for deleting records
        db.events.hook("deleting", (primKey, obj, transaction) => {});
    }

    /**
     * Setup online/offline event listeners
     */
    private setupOnlineListener(): void {
        window.addEventListener("online", () => {
            console.log("📡 Network connection restored");
            this.isOnline = true;
            this.notifyListeners();
            this.startSync(); // Immediately sync when coming back online
        });

        window.addEventListener("offline", () => {
            console.log("📡 Network connection lost");
            this.isOnline = false;
            this.notifyListeners();
        });
    }

    /**
     * Subscribe to sync state changes
     */
    public subscribe(listener: (state: SyncManagerState) => void): () => void {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    /**
     * Notify all listeners of state changes
     */
    private async notifyListeners(): Promise<void> {
        const state = await this.getState();
        this.listeners.forEach((listener) => listener(state));
    }

    /**
     * Get current sync manager state
     */
    public async getState(): Promise<SyncManagerState> {
        const stats = await getSyncQueueStats();
        return {
            status: this.isSyncing
                ? "syncing"
                : this.isOnline
                  ? "online"
                  : "offline",
            pendingCount: stats.pending + stats.failed,
        };
    }

    /**
     * Start automatic background sync
     * ✅ OPTIMIZED: Default interval increased to 5 minutes (was 30 seconds)
     * Syncs every 5 minutes when online to reduce unnecessary sync checks
     * ✅ OPTIMIZED: Auto-cleanup of old drafts runs daily
     */
    public startAutoSync(intervalMs: number = 300000): void {
        if (this.syncInterval) {
            console.warn("⚠️  Auto-sync already running");
            return;
        }

        console.log("🔄 Starting auto-sync (interval: " + intervalMs + "ms)");

        this.syncInterval = setInterval(() => {
            if (this.isOnline && !this.isSyncing) {
                this.startSync().catch((error) => {
                    console.error("❌ Auto-sync error:", error);
                });
            }
        }, intervalMs);

        // Immediate first sync if online
        if (this.isOnline) {
            this.startSync().catch((error) => {
                console.error("❌ Initial sync error:", error);
            });
        }

        // ✅ OPTIMIZED: Run draft cleanup daily (24 hours)
        this.scheduleDraftCleanup();
    }

    /**
     * Stop automatic background sync
     */
    public stopAutoSync(): void {
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
            this.syncInterval = undefined;
            console.log("🛑 Auto-sync stopped");
        }
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = undefined;
            console.log("🛑 Draft cleanup stopped");
        }
    }

    /**
     * Schedule automatic draft cleanup (runs daily)
     * ✅ OPTIMIZED: Removes drafts older than 30 days to prevent database growth
     */
    private scheduleDraftCleanup(): void {
        // Run cleanup immediately on start
        deleteOldDrafts(30).catch((error) => {
            console.error("❌ Draft cleanup error:", error);
        });

        // Schedule daily cleanup (24 hours)
        this.cleanupInterval = setInterval(
            () => {
                deleteOldDrafts(30).catch((error) => {
                    console.error("❌ Draft cleanup error:", error);
                });
            },
            24 * 60 * 60 * 1000,
        ); // 24 hours

        console.log("🗑️  Scheduled daily draft cleanup (30+ days old)");
    }

    /**
     * Manually trigger a sync operation
     * ✅ OPTIMIZED: Batch operations for better network performance
     */
    public async startSync(): Promise<void> {
        if (!this.isOnline) {
            console.log("📵 Offline - sync skipped");
            return;
        }

        if (this.isSyncing) {
            console.log("🔄 Sync already in progress");
            return;
        }

        this.isSyncing = true;
        this.notifyListeners();

        try {
            console.log("🔄 Starting sync...");
            let syncedCount = 0;

            // ✅ OPTIMIZED: Process queue in batches of up to 10 operations
            while (this.isOnline) {
                // Get batch of operations
                const batch = await this.getNextBatch(10);
                if (batch.length === 0) break;

                // Group by type for efficient batching
                const eventOps = batch.filter(
                    (op) =>
                        op.type === "CREATE_EVENT" ||
                        op.type === "UPDATE_EVENT",
                );
                const entityOps = batch.filter(
                    (op) =>
                        op.type === "CREATE_TRACKED_ENTITY" ||
                        op.type === "UPDATE_TRACKED_ENTITY",
                );

                try {
                    // Batch events together (most common operation)
                    if (eventOps.length > 0) {
                        await this.processBatchedEvents(eventOps);
                        for (const op of eventOps) {
                            await completeSyncOperation(op.id);
                            syncedCount++;
                        }
                    }

                    // Process entities one by one (less common, more critical)
                    for (const op of entityOps) {
                        try {
                            await this.processSyncOperation(op);
                            await completeSyncOperation(op.id);
                            syncedCount++;
                        } catch (error: any) {
                            console.error("❌ Sync operation failed:", error);
                            await failSyncOperation(
                                op.id,
                                error.message || "Unknown error",
                            );

                            if (op.attempts >= 3) {
                                console.error(
                                    "🚫 Max retry attempts reached for operation:",
                                    op.id,
                                );
                            }
                        }
                    }
                } catch (error: any) {
                    console.error("❌ Batch sync failed:", error);
                    // Mark all failed operations
                    for (const op of eventOps) {
                        await failSyncOperation(
                            op.id,
                            error.message || "Batch sync failed",
                        );
                    }
                }
            }

            if (syncedCount > 0) {
                console.log(`✅ Sync completed: ${syncedCount} operations`);
            }
        } catch (error) {
            console.error("❌ Sync error:", error);
        } finally {
            this.isSyncing = false;
            this.notifyListeners();
        }
    }

    /**
     * Get next batch of sync operations
     * ✅ OPTIMIZED: Fetch multiple operations at once
     */
    private async getNextBatch(size: number): Promise<SyncOperation[]> {
        const operations: SyncOperation[] = [];

        for (let i = 0; i < size; i++) {
            const op = await getNextSyncOperation();
            if (!op) break;

            // Mark as syncing
            await updateSyncOperation(op.id, {
                status: "syncing",
                attempts: op.attempts + 1,
            });

            operations.push(op);
        }

        return operations;
    }

    /**
     * Process batched events in single API call
     * ✅ OPTIMIZED: Send up to 10 events in one request
     */
    private async processBatchedEvents(
        operations: SyncOperation[],
    ): Promise<void> {
        console.log(
            `🔄 Processing batched events: ${operations.length} operations`,
        );

        const events = operations.map((op) => op.data);

        const allEvents = events.map(({ dataValues, ...event }) => {
            return {
                ...event,
                dataValues: Object.entries(dataValues).flatMap(
                    ([dataElement, value]: [string, any]) => {
                        if (
                            value !== undefined &&
                            value !== null &&
                            value !== ""
                        ) {
                            if (Array.isArray(value)) {
                                return {
                                    dataElement,
                                    value: value.join(","),
                                };
                            }
                            return {
                                dataElement,
                                value,
                            };
                        }
                        return [];
                    },
                ),
            };
        });

        await this.engine.mutate({
            resource: "tracker",
            type: "create",
            data: { events: allEvents },
            params: { async: false },
        });

        console.log(
            `✅ Batched ${operations.length} events synced successfully`,
        );
    }

    /**
     * Process a single sync operation
     */
    private async processSyncOperation(
        operation: SyncOperation,
    ): Promise<void> {
        console.log(`🔄 Processing: ${operation.type} - ${operation.entityId}`);

        // Mark as syncing
        await updateSyncOperation(operation.id, {
            status: "syncing",
            attempts: operation.attempts + 1,
        });

        try {
            switch (operation.type) {
                case "CREATE_TRACKED_ENTITY":
                    await this.syncCreateTrackedEntity(operation.data);
                    break;

                case "UPDATE_TRACKED_ENTITY":
                    await this.syncUpdateTrackedEntity(operation.data);
                    break;

                case "CREATE_EVENT":
                    await this.syncCreateEvent(operation.data);
                    break;

                case "UPDATE_EVENT":
                    await this.syncUpdateEvent(operation.data);
                    break;

                default:
                    throw new Error(
                        `Unknown operation type: ${operation.type}`,
                    );
            }

            console.log(
                `✅ Completed: ${operation.type} - ${operation.entityId}`,
            );
        } catch (error) {
            console.error(
                `❌ Failed: ${operation.type} - ${operation.entityId}`,
                error,
            );
            throw error;
        }
    }

    /**
     * Sync create tracked entity to DHIS2 API
     */
    private async syncCreateTrackedEntity(data: any): Promise<void> {
        const { attributes, enrollment, events, ...rest } = data;

        const allAttributes = Object.entries(attributes).flatMap(
            ([attribute, value]: [string, any]) => {
                if (value !== undefined && value !== null && value !== "") {
                    return { attribute, value };
                }
                return [];
            },
        );

        const trackedEntities = [
            {
                ...rest,
                attributes: allAttributes, // ✅ FIX: Attributes belong on trackedEntity
            },
        ];

        const enrollments = [
            {
                ...enrollment,
                attributes: [], // Enrollment doesn't need attributes, they're on trackedEntity
            },
        ];

        await this.engine.mutate({
            resource: "tracker",
            type: "create",
            data: { trackedEntities, enrollments },
            params: { async: false },
        });
    }

    /**
     * Sync update tracked entity to DHIS2 API
     */
    private async syncUpdateTrackedEntity(data: any): Promise<void> {
        const { attributes, enrollment, events, ...rest } = data;

        const allAttributes = Object.entries(attributes).flatMap(
            ([attribute, value]: [string, any]) => {
                if (value !== undefined && value !== null && value !== "") {
                    return { attribute, value };
                }
                return [];
            },
        );

        const trackedEntities = [
            {
                ...rest,
                attributes: allAttributes, // ✅ FIX: Attributes belong on trackedEntity, not enrollment
            },
        ];

        const enrollments = [
            {
                ...enrollment,
                attributes: [], // Enrollment doesn't need attributes, they're on trackedEntity
            },
        ];

        await this.engine.mutate({
            resource: "tracker",
            type: "create",
            data: { trackedEntities, enrollments },
            params: { async: false },
        });
    }

    /**
     * Sync create/update events to DHIS2 API
     */
    private async syncCreateEvent(data: any): Promise<void> {
        const allEvents = [data].map(({ dataValues, ...event }) => ({
            ...event,
            dataValues: Object.entries(dataValues || {}).flatMap(
                ([dataElement, value]: [string, any]) => {
                    if (value !== undefined && value !== null && value !== "") {
                        if (Array.isArray(value)) {
                            return {
                                dataElement,
                                value: value.join(","),
                            };
                        }
                        return {
                            dataElement,
                            value,
                        };
                    }
                    return [];
                },
            ),
        }));

        await this.engine.mutate({
            resource: "tracker",
            type: "create",
            data: { events: allEvents },
            params: { async: false },
        });
    }

    /**
     * Sync update event to DHIS2 API
     */
    private async syncUpdateEvent(data: any): Promise<void> {
        // Same as create for now, DHIS2 tracker endpoint handles both
        await this.syncCreateEvent(data);
    }

    /**
     * Check if operation already exists in queue
     * ✅ OPTIMIZED: Prevent duplicate queue entries
     */
    private async operationExists(
        entityId: string,
        type: string,
    ): Promise<boolean> {
        const stats = await getSyncQueueStats();
        if (stats.pending === 0 && stats.syncing === 0) return false;

        // Check pending operations for this entity
        const pending = await getSyncOperationsByStatus("pending");
        const syncing = await getSyncOperationsByStatus("syncing");

        const allOps = [...pending, ...syncing];
        return allOps.some(
            (op) => op.entityId === entityId && op.type === type,
        );
    }

    /**
     * Queue a create tracked entity operation
     * ✅ OPTIMIZED: Check for duplicates before queueing
     */
    public async queueCreateTrackedEntity(
        data: any,
        priority: number = 5,
    ): Promise<void> {
        // Check if already queued
        const exists = await this.operationExists(
            data.trackedEntity,
            "CREATE_TRACKED_ENTITY",
        );

        if (exists) {
            console.log(
                `⏭️  Skipping duplicate: CREATE_TRACKED_ENTITY - ${data.trackedEntity}`,
            );
            return;
        }

        await queueSyncOperation({
            type: "CREATE_TRACKED_ENTITY",
            entityId: data.trackedEntity,
            data,
            priority,
        });

        this.notifyListeners();

        // Trigger immediate sync if online
        if (this.isOnline && !this.isSyncing) {
            this.startSync();
        }
    }

    /**
     * Queue a create/update event operation
     * ✅ OPTIMIZED: Check for duplicates before queueing
     */
    public async queueCreateEvent(
        data: any,
        priority: number = 5,
    ): Promise<void> {
        // Check if already queued
        const exists = await this.operationExists(data.event, "CREATE_EVENT");

        if (exists) {
            console.log(`⏭️  Skipping duplicate: CREATE_EVENT - ${data.event}`);
            return;
        }

        await queueSyncOperation({
            type: "CREATE_EVENT",
            entityId: data.event,
            data,
            priority,
        });

        this.notifyListeners();

        // Trigger immediate sync if online
        if (this.isOnline && !this.isSyncing) {
            this.startSync();
        }
    }

    /**
     * Check if online
     */
    public getOnlineStatus(): boolean {
        return this.isOnline;
    }

    // Pull data from server
    private async pullFromServer() {
        if (this.isPulling || !this.isOnline) {
            return;
        }
        this.isPulling = true;

        this.isPulling = false;
    }

    // Start periodic pull from server
    private startPeriodicPull() {
        // Initial pull
        if (this.isOnline) {
            this.pullFromServer();
        }

        // // Set up periodic pull
        // this.pullTimer = setInterval(() => {
        //     if (this.isOnline && !this.isPulling) {
        //         this.pullFromServer();
        //     }
        // }, SYNC_CONFIG.pullInterval);
    }

    // Manually trigger pull
    public async pullNow() {
        if (this.isOnline) {
            await this.pullFromServer();
        } else {
            throw new Error("Cannot pull while offline");
        }
    }
}

/**
 * Create a sync manager instance
 */
export function createSyncManager(
    engine: ReturnType<typeof useDataEngine>,
): SyncManager {
    return new SyncManager(engine);
}
