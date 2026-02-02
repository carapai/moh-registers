import { useDataEngine } from "@dhis2/app-runtime";
import { db, type SyncOperation } from "./index";
import { createMetadataSync, type MetadataSync } from "./metadata-sync";
import {
    deleteOldDrafts,
    deleteSyncOperation,
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
    private metadataCheckInterval?: NodeJS.Timeout;
    private listeners: Set<(state: SyncManagerState) => void> = new Set();
    private metadataSync: MetadataSync;

    constructor(engine: ReturnType<typeof useDataEngine>) {
        this.engine = engine;
        this.metadataSync = createMetadataSync(engine);
        this.setupOnlineListener();
        this.setupDatabaseHooks();
    }

    private setupDatabaseHooks() {
        // ============================================================
        // TRACKED ENTITIES HOOKS
        // ============================================================

        // Hook for creating tracked entities
        db.trackedEntities.hook("creating", (primKey, obj, transaction) => {
            console.log("🎣 Hook: Creating tracked entity", primKey);

            // Initialize sync metadata if not present
            const entity = obj as any;
            if (!entity.syncStatus) {
                entity.syncStatus = "pending";
                entity.version = 1;
                entity.lastModified = new Date().toISOString();
            }

            // Queue sync operation asynchronously ONLY if not draft
            // Draft entities should NOT be queued until explicitly marked as pending
            transaction.on("complete", () => {
                // Get the created entity to check its final status
                db.trackedEntities.get(primKey).then((created) => {
                    if (created && created.syncStatus === "pending") {
                        this.queueCreateTrackedEntity(created, 8).catch(
                            (error) => {
                                console.error(
                                    "❌ Failed to queue tracked entity sync:",
                                    error,
                                );
                            },
                        );
                    } else if (created && created.syncStatus === "draft") {
                        console.log(
                            "⏸️  Tracked entity is draft, skipping sync queue:",
                            primKey,
                        );
                    }
                });
            });
        });

        // Hook for updating tracked entities
        db.trackedEntities.hook(
            "updating",
            (modifications, primKey, obj, transaction) => {
                console.log("🎣 Hook: Updating tracked entity", primKey);
                const entity = obj as any;
                const mods = modifications as any;
                if (!("syncStatus" in mods)) {
                    if (
                        entity.syncStatus !== "draft" &&
                        entity.syncStatus !== "synced"
                    ) {
                        mods.syncStatus = "pending";
                    }
                }

                if (!("version" in mods) && !("lastSynced" in mods)) {
                    mods.version = (entity.version || 0) + 1;
                    mods.lastModified = new Date().toISOString();
                }

                transaction.on("complete", () => {
                    db.trackedEntities.get(primKey).then((updated) => {
                        if (updated && updated.syncStatus === "pending") {
                            this.queueCreateTrackedEntity(updated, 8).catch(
                                (error) => {
                                    console.error(
                                        "❌ Failed to queue tracked entity update:",
                                        error,
                                    );
                                },
                            );
                        } else if (updated && updated.syncStatus === "draft") {
                            console.log(
                                "⏸️  Tracked entity is draft, skipping sync queue:",
                                primKey,
                            );
                        }
                    });
                });
            },
        );

        // Hook for deleting tracked entities
        db.trackedEntities.hook("deleting", (primKey, obj, transaction) => {});

        // ============================================================
        // EVENTS HOOKS
        // ============================================================

        // Hook for creating events
        db.events.hook("creating", (primKey, obj, transaction) => {
            const event = obj as any;
            if (!event.syncStatus) {
                event.syncStatus = "pending";
                event.version = 1;
                event.lastModified = new Date().toISOString();
            }

            // Queue sync operation asynchronously ONLY if not draft
            // transaction.on("complete", () => {
            //     db.events.get(primKey).then((created) => {
            // 			console.log("🎣 Hook: Creating event", created);
            //         // if (created && created.syncStatus === "pending") {
            //         //     this.queueCreateEvent(created, 7).catch((error) => {
            //         //         console.error(
            //         //             "❌ Failed to queue event sync:",
            //         //             error,
            //         //         );
            //         //     });
            //         // } else if (created && created.syncStatus === "draft") {
            //         //     console.log(
            //         //         "⏸️  Event is draft, skipping sync queue:",
            //         //         primKey,
            //         //     );
            //         // }
            //     });
            // });
        });

        // Hook for updating events
        db.events.hook(
            "updating",
            (modifications, primKey, obj, transaction) => {
                // Update sync metadata
                const event = obj as any;
                const mods = modifications as any;

                // Don't override if syncStatus is explicitly being set (e.g., to "synced")
                // Only auto-set to pending for user data changes
                if (!("syncStatus" in mods)) {
                    // Only set to pending if not draft and not already synced
                    if (
                        event.syncStatus !== "draft" &&
                        event.syncStatus !== "synced"
                    ) {
                        mods.syncStatus = "pending";
                    }
                }

                // Don't increment version if only sync status/metadata is changing
                // Only increment for actual data changes
                if (!("version" in mods) && !("lastSynced" in mods)) {
                    mods.version = (event.version || 0) + 1;
                    mods.lastModified = new Date().toISOString();
                }

                // Queue sync operation after transaction completes
                // But ONLY if the final status is "pending", not "draft" or "synced"
                transaction.on("complete", () => {
                    db.events.get(primKey).then((updated) => {
                        if (updated && updated.syncStatus === "pending") {
                            this.queueCreateEvent(updated, 7).catch((error) => {
                                console.error(
                                    "❌ Failed to queue event update:",
                                    error,
                                );
                            });
                        }
                    });
                });
            },
        );

        // Hook for deleting events
        db.events.hook("deleting", (primKey, obj, transaction) => {
            console.log("🎣 Hook: Deleting event", primKey);
            // Note: DHIS2 doesn't support delete via tracker endpoint
        });

        // ============================================================
        // RELATIONSHIPS HOOKS
        // ============================================================

        // Hook for creating relationships
        db.relationships.hook("creating", (primKey, obj, transaction) => {
            console.log("🎣 Hook: Creating relationship", primKey);

            // Initialize sync metadata if not present
            const relationship = obj as any;
            if (!relationship.syncStatus) {
                relationship.syncStatus = "pending";
                relationship.version = 1;
                relationship.lastModified = new Date().toISOString();
            }

            // Queue sync operation asynchronously ONLY if not draft
            transaction.on("complete", () => {
                db.relationships.get(primKey).then((created) => {
                    if (created && created.syncStatus === "pending") {
                        this.queueCreateRelationship(created, 6).catch(
                            (error) => {
                                console.error(
                                    "❌ Failed to queue relationship sync:",
                                    error,
                                );
                            },
                        );
                    } else if (created && created.syncStatus === "draft") {
                        console.log(
                            "⏸️  Relationship is draft, skipping sync queue:",
                            primKey,
                        );
                    }
                });
            });
        });

        // Hook for updating relationships
        db.relationships.hook(
            "updating",
            (modifications, primKey, obj, transaction) => {
                console.log("🎣 Hook: Updating relationship", primKey);

                // Update sync metadata
                const relationship = obj as any;
                const mods = modifications as any;

                // Don't override if syncStatus is explicitly being set (e.g., to "synced")
                if (!("syncStatus" in mods)) {
                    // Only set to pending if not draft and not already synced
                    if (
                        relationship.syncStatus !== "draft" &&
                        relationship.syncStatus !== "synced"
                    ) {
                        mods.syncStatus = "pending";
                    }
                }

                // Don't increment version if only sync status/metadata is changing
                if (!("version" in mods) && !("lastSynced" in mods)) {
                    mods.version = (relationship.version || 0) + 1;
                    mods.lastModified = new Date().toISOString();
                }

                // Queue sync operation after transaction completes
                // But ONLY if the final status is "pending", not "draft" or "synced"
                transaction.on("complete", () => {
                    db.relationships.get(primKey).then((updated) => {
                        if (updated && updated.syncStatus === "pending") {
                            this.queueCreateRelationship(updated, 6).catch(
                                (error) => {
                                    console.error(
                                        "❌ Failed to queue relationship update:",
                                        error,
                                    );
                                },
                            );
                        } else if (updated && updated.syncStatus === "draft") {
                            console.log(
                                "⏸️  Relationship is draft, skipping sync queue:",
                                primKey,
                            );
                        }
                    });
                });
            },
        );

        console.log("✅ Database hooks setup complete");
    }

    /**
     * Setup online/offline event listeners
     */
    private setupOnlineListener(): void {
        window.addEventListener("online", () => {
            console.log("📡 Network connection restored");
            this.isOnline = true;
            this.notifyListeners();
            this.startSync();
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
     * ✅ NEW: Metadata staleness checks every 30 minutes
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

        // ✅ NEW: Start metadata freshness checks every 30 minutes
        this.startMetadataChecks();
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
        if (this.metadataCheckInterval) {
            clearInterval(this.metadataCheckInterval);
            this.metadataCheckInterval = undefined;
            console.log("🛑 Metadata checks stopped");
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
     * Start metadata staleness checks (runs every 30 minutes)
     * ✅ NEW: Checks if metadata is stale and logs notification
     * Users can manually sync via the UI button if needed
     */
    private startMetadataChecks(): void {
        // Check immediately on start
        this.checkMetadataFreshness().catch((error) => {
            console.error("❌ Metadata check error:", error);
        });

        // Schedule checks every 30 minutes
        this.metadataCheckInterval = setInterval(
            () => {
                this.checkMetadataFreshness().catch((error) => {
                    console.error("❌ Metadata check error:", error);
                });
            },
            30 * 60 * 1000,
        ); // 30 minutes

        console.log(
            "📋 Scheduled metadata freshness checks (every 30 minutes)",
        );
    }

    /**
     * Check if metadata is stale and notify user
     * Does not automatically sync - user must trigger manual sync via UI
     */
    private async checkMetadataFreshness(): Promise<void> {
        try {
            const isStale = await this.metadataSync.isMetadataStale();
            if (isStale) {
                console.log(
                    "📋 Metadata is stale (>1 hour old). User can sync via UI button.",
                );
                // Optional: Could emit an event or notification here
                // For now, just log - user has manual sync button in UI
            } else {
                console.log("📋 Metadata is fresh");
            }
        } catch (error) {
            console.error("❌ Failed to check metadata freshness:", error);
        }
    }

    /**
     * Get the metadata sync manager instance
     * Allows components to access metadata sync functionality
     */
    public getMetadataSync(): MetadataSync {
        return this.metadataSync;
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
                const relationshipOps = batch.filter(
                    (op) => op.type === "CREATE_RELATIONSHIP",
                );

                try {
                    // Batch events together (most common operation)
                    if (eventOps.length > 0) {
                        await this.processBatchedEvents(eventOps);
                        for (const op of eventOps) {
                            // Update event syncStatus to "synced"
                            await db.events.update(op.entityId, {
                                syncStatus: "synced",
                                lastSynced: new Date().toISOString(),
                            });
                            await deleteSyncOperation(op.id);
                            syncedCount++;
                        }
                    }

                    if (relationshipOps.length > 0) {
                        await this.processBatchedRelationships(relationshipOps);
                        for (const op of relationshipOps) {
                            // Update relationship syncStatus to "synced"
                            await db.relationships.update(op.entityId, {
                                syncStatus: "synced",
                                lastSynced: new Date().toISOString(),
                            });
                            await deleteSyncOperation(op.id);
                            syncedCount++;
                        }
                    }
                    // Process entities one by one (less common, more critical)
                    for (const op of entityOps) {
                        try {
                            await this.processSyncOperation(op);
                            // Update tracked entity syncStatus to "synced"
                            await db.trackedEntities.update(op.entityId, {
                                syncStatus: "synced",
                                lastSynced: new Date().toISOString(),
                            });
                            await deleteSyncOperation(op.id);
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

            // Log retry attempts
            if (op.status === "failed") {
                console.log(
                    `🔄 Retrying failed operation (attempt ${op.attempts + 1}/3): ${op.type} - ${op.entityId}`,
                );
            }
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
            params: { async: false, importStrategy: "CREATE_AND_UPDATE" },
        });

        console.log(
            `✅ Batched ${operations.length} events synced successfully`,
        );
    }

    private async processBatchedRelationships(
        operations: SyncOperation[],
    ): Promise<void> {
        const relationships = operations.map((op) => op.data);
        await this.engine.mutate({
            resource: "tracker",
            type: "create",
            data: { relationships },
            params: { async: false, importStrategy: "CREATE_AND_UPDATE" },
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
                case "CREATE_RELATIONSHIP":
                    await this.syncCreateRelationship(operation.data);
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
        const { attributes, enrollment, events, relationships, ...rest } = data;

        const allAttributes = Object.entries(attributes).flatMap(
            ([attribute, value]: [string, any]) => {
                // Filter out internal fields that are not real DHIS2 attributes
                if (attribute === "TRACKER_ID" || attribute === "ENROLLED_AT") {
                    return [];
                }
                if (value !== undefined && value !== null && value !== "") {
                    return { attribute, value };
                }
                return [];
            },
        );

        console.log("Syncing tracked entity:", allAttributes, data);

        const trackedEntities = [
            {
                ...rest,
                attributes: allAttributes,
            },
        ];

        const enrollments = [
            {
                ...enrollment,
                attributes: allAttributes,
            },
        ];

        // Build the payload with relationships if they exist
        const payload: any = { trackedEntities, enrollments };

        if (relationships && relationships.length > 0) {
            payload.relationships = relationships;
            console.log("Including relationships in payload:", relationships);
        }

        await this.engine.mutate({
            resource: "tracker",
            type: "create",
            data: payload,
            params: { async: false, importStrategy: "CREATE_AND_UPDATE" },
        });
    }
    private async syncCreateRelationship(relationships: any): Promise<void> {
        await this.engine.mutate({
            resource: "tracker",
            type: "create",
            data: { relationships },
            params: { async: false, importStrategy: "CREATE_AND_UPDATE" },
        });
    }

    /**
     * Sync update tracked entity to DHIS2 API
     */
    private async syncUpdateTrackedEntity(data: any): Promise<void> {
        const { attributes, enrollment, events, ...rest } = data;

        const allAttributes = Object.entries(attributes).flatMap(
            ([attribute, value]: [string, any]) => {
                // Filter out internal fields that are not real DHIS2 attributes
                if (attribute === "TRACKER_ID" || attribute === "ENROLLED_AT") {
                    return [];
                }
                if (value !== undefined && value !== null && value !== "") {
                    return { attribute, value };
                }
                return [];
            },
        );

        const trackedEntities = [
            {
                ...rest,
                attributes: allAttributes,
            },
        ];

        const enrollments = [
            {
                ...enrollment,
                attributes: allAttributes,
            },
        ];

        await this.engine.mutate({
            resource: "tracker",
            type: "create",
            data: { trackedEntities, enrollments },
            params: { async: false, importStrategy: "CREATE_AND_UPDATE" },
        });
    }

    /**
     * Sync create/update events to DHIS2 API
     */
    private async syncCreateEvent(data: any): Promise<void> {
        const { dataValues, relationships, ...event } = data;

        const allEvents = [
            {
                ...event,
                dataValues: Object.entries(dataValues || {}).flatMap(
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
            },
        ];

        // Build the payload with relationships if they exist
        const payload: any = { events: allEvents };

        if (relationships && relationships.length > 0) {
            payload.relationships = relationships;
            console.log("Including relationships with event:", relationships);
        }

        await this.engine.mutate({
            resource: "tracker",
            type: "create",
            data: payload,
            params: { async: false, importStrategy: "CREATE_AND_UPDATE" },
        });
    }

    /**
     * Sync update event to DHIS2 API
     */
    private async syncUpdateEvent(data: any): Promise<void> {
        // Same as create for now, DHIS2 tracker endpoint handles both with CREATE_AND_UPDATE
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

    public async queueCreateRelationship(
        data: any,
        priority: number = 5,
    ): Promise<void> {
        // Check if already queued
        const exists = await this.operationExists(
            data.relationship,
            "CREATE_RELATIONSHIP",
        );

        if (exists) {
            console.log(
                `⏭️  Skipping duplicate: CREATE_RELATIONSHIP - ${data.relationship}`,
            );
            return;
        }

        await queueSyncOperation({
            type: "CREATE_RELATIONSHIP",
            entityId: data.relationship,
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
