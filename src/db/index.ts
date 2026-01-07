import Dexie, { Table } from "dexie";
import {
    flattenTrackedEntity,
    flattenTrackedEntityResponse,
} from "../utils/utils";
import {
    DataElement,
    FAttribute,
    FDataElement,
    ProgramRule,
    ProgramRuleVariable,
    ProgramStage,
    ProgramTrackedEntityAttribute,
    Node,
    TrackedEntityAttribute,
    Program,
} from "../schemas";

/**
 * Database Schema for MOH Registers Application
 *
 * This IndexedDB database provides offline-first data persistence
 * and enables draft management, sync queueing, and local caching.
 */

// Flattened TrackedEntity type from utils
export type FlattenedTrackedEntity = ReturnType<typeof flattenTrackedEntity>;
export type FlattenedTrackedEntities = ReturnType<
    typeof flattenTrackedEntityResponse
>;

// Flattened Event type
export type FlattenedEvent = FlattenedTrackedEntity["events"][number];

// Draft types for auto-save functionality
export interface TrackedEntityDraft {
    id: string; // Same as trackedEntity ID or generated UID for new entities
    attributes: Record<string, any>;
    enrollment: FlattenedTrackedEntity["enrollment"];
    orgUnit: string;
    program: string;
    createdAt: string;
    updatedAt: string;
    isNew: boolean; // true if this is a new entity, false if editing existing
}

export interface EventDraft {
    id: string; // Same as event ID or generated UID for new events
    event: string;
    programStage: string;
    trackedEntity: string;
    enrollment: string;
    dataValues: Record<string, any>;
    occurredAt: string;
    orgUnit: string;
    program: string;
    createdAt: string;
    updatedAt: string;
    isNew: boolean; // true if this is a new event, false if editing existing
}

// Sync queue for offline operations
export interface SyncOperation {
    id: string; // Unique operation ID
    type:
        | "CREATE_TRACKED_ENTITY"
        | "UPDATE_TRACKED_ENTITY"
        | "CREATE_EVENT"
        | "UPDATE_EVENT";
    entityId: string; // TrackedEntity or Event ID
    data: any; // The data payload to sync
    status: "pending" | "syncing" | "failed" | "completed";
    attempts: number;
    createdAt: string;
    updatedAt: string;
    error?: string;
    priority: number; // Higher priority syncs first (0-10)
}

// Machine state persistence
export interface MachineState {
    id: string; // Always "tracker-machine" for single state
    context: any; // XState machine context
    state: string; // Current machine state
    updatedAt: string;
}

// Village reference data
export interface Village {
    village_id: string;
    village_name: string;
    parish_name: string;
    subcounty_name: string;
    District: string;
}

/**
 * RegisterDatabase - Main Dexie database instance
 */
export class RegisterDatabase extends Dexie {
    // Tables
    trackedEntities!: Table<FlattenedTrackedEntity, string>;
    events!: Table<FlattenedEvent, string>;
    trackedEntityDrafts!: Table<TrackedEntityDraft, string>;
    eventDrafts!: Table<EventDraft, string>;
    syncQueue!: Table<SyncOperation, string>;
    machineState!: Table<MachineState, string>;
    programRules!: Table<ProgramRule, string>;
    programRuleVariables!: Table<ProgramRuleVariable, string>;
    optionGroups!: Table<
        { id: string; name: string; code: string; optionGroup: string },
        string
    >;
    optionSets!: Table<
        { id: string; name: string; code: string; optionSet: string },
        string
    >;
    dataElements!: Table<DataElement, string>;
    trackedEntityAttributes!: Table<TrackedEntityAttribute, string>;
    organisationUnits!: Table<Node, string>;
    programs!: Table<Program, string>;
    villages!: Table<Village, string>;

    constructor() {
        super("MOHRegisterDB");

        this.version(1).stores({
            // TrackedEntities table
            // Primary key: trackedEntity
            // Indexed fields: orgUnit, updatedAt (for querying and sorting)
            trackedEntities:
                "trackedEntity,orgUnit,enrollment.enrolledAt,updatedAt",

            // Events table
            // Primary key: event
            // Indexed fields: trackedEntity,programStage,occurredAt
            events: "event,trackedEntity,programStage,enrollment,occurredAt,updatedAt",

            // TrackedEntity drafts table
            // Primary key: id
            // Indexed fields: updatedAt (for cleanup and listing)
            trackedEntityDrafts: "id,orgUnit,updatedAt,isNew",

            // Event drafts table
            // Primary key: id
            // Indexed fields: trackedEntity,programStage,updatedAt
            eventDrafts: "id,trackedEntity,programStage,updatedAt,isNew",

            // Sync queue table
            // Primary key: id
            // Indexed fields: status,priority,createdAt (for queue processing)
            syncQueue: "id,status,priority,type,entityId,createdAt",

            // Machine state table
            // Primary key: id (always "tracker-machine")
            machineState: "id,updatedAt",
            // Program Rules table
            programRules: "id,program",

            programRuleVariables: "id,program",
            // Options table
            dataElements: "id,name",
            // Attributes table
            trackedEntityAttributes: "id,name",
            organisationUnits: "[id+user],id,title,user",
            optionSets: "[id+optionSet],id,optionSet,name,code",
            optionGroups: "[id+optionGroup],id,optionGroup,name,code",
            programs: "id,name,programType",
            // Villages table with compound indexes for hierarchical queries
            // Allows fast filtering: District -> Subcounty -> Parish -> Village
            villages: "village_id,village_name,District,[District+subcounty_name],[District+subcounty_name+parish_name]",
        });
    }

    /**
     * Clear all draft data (useful after successful submissions)
     */
    async clearAllDrafts(): Promise<void> {
        await this.trackedEntityDrafts.clear();
        await this.eventDrafts.clear();
    }

    /**
     * Clear all data (useful for logout/reset)
     */
    async clearAllData(): Promise<void> {
        await this.trackedEntities.clear();
        await this.events.clear();
        await this.trackedEntityDrafts.clear();
        await this.eventDrafts.clear();
        await this.syncQueue.clear();
        await this.machineState.clear();
    }

    /**
     * Get pending sync operations ordered by priority and creation time
     */
    async getPendingSyncOperations(): Promise<SyncOperation[]> {
        return await this.syncQueue
            .where("status")
            .equals("pending")
            .or("status")
            .equals("failed")
            .sortBy("priority")
            .then((ops) => ops.reverse()); // Higher priority first
    }

    /**
     * Get total count of pending sync operations
     */
    async getPendingSyncCount(): Promise<number> {
        return await this.syncQueue
            .where("status")
            .equals("pending")
            .or("status")
            .equals("failed")
            .count();
    }

    /**
     * Clean up old completed sync operations (older than 7 days)
     */
    async cleanupCompletedSyncOperations(): Promise<void> {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        await this.syncQueue
            .where("status")
            .equals("completed")
            .and((op) => new Date(op.updatedAt) < sevenDaysAgo)
            .delete();
    }

    /**
     * Get all drafts for listing in UI
     */
    async getAllDrafts(): Promise<{
        trackedEntityDrafts: TrackedEntityDraft[];
        eventDrafts: EventDraft[];
    }> {
        const trackedEntityDrafts = await this.trackedEntityDrafts
            .orderBy("updatedAt")
            .reverse()
            .toArray();

        const eventDrafts = await this.eventDrafts
            .orderBy("updatedAt")
            .reverse()
            .toArray();

        return { trackedEntityDrafts, eventDrafts };
    }
}

// Export singleton database instance
export const db = new RegisterDatabase();
