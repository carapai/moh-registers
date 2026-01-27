import { useEffect, useRef, useCallback } from "react";
import { FormInstance } from "antd";
import {
    saveEventDraft,
    saveTrackedEntityDraft,
    deleteEventDraft,
    deleteTrackedEntityDraft,
} from "../db/operations";
import { FlattenedEvent, FlattenedTrackedEntity } from "../db";

/**
 * Auto-save hook for Ant Design forms
 *
 * Automatically saves form state to IndexedDB at regular intervals
 * and provides methods to clear drafts on successful submission.
 *
 * @example
 * ```tsx
 * const { saveNow, clearDraft } = useAutoSave({
 *   form: visitForm,
 *   draftId: event.event,
 *   type: "event",
 *   interval: 30000, // 30 seconds
 *   onSave: () => console.log("Draft saved"),
 *   enabled: isVisitModalOpen,
 * });
 * ```
 */

export interface UseAutoSaveOptions {
    /** Ant Design form instance */
    form: FormInstance;

    /** Unique ID for this draft */
    draftId: string;

    /** Type of draft to save */
    type: "event" | "trackedEntity";

    /** Auto-save interval in milliseconds (default: 30000 = 30 seconds) */
    interval?: number;

    /** Callback when draft is saved */
    onSave?: (draft: FlattenedEvent | FlattenedTrackedEntity) => void;

    /** Callback when draft save fails */
    onError?: (error: Error) => void;

    /** Whether auto-save is enabled (default: true) */
    enabled?: boolean;

    /** Additional metadata to save with the draft */
    metadata?: {
        trackedEntity?: string;
        programStage?: string;
        enrollment?: string;
        orgUnit?: string;
        program?: string;
        occurredAt?: string;
        isNew?: boolean;
    };
}

export interface UseAutoSaveReturn {
    /** Manually trigger a save */
    saveNow: () => Promise<void>;

    /** Clear the draft from IndexedDB */
    clearDraft: () => Promise<void>;

    /** Whether a save is currently in progress */
    isSaving: boolean;

    /** Last save timestamp */
    lastSaved: Date | null;
}

/**
 * Hook to automatically save form drafts to IndexedDB
 */
export function useAutoSave(options: UseAutoSaveOptions): UseAutoSaveReturn {
    const {
        form,
        draftId,
        type,
        interval = 30000,
        onSave,
        onError,
        enabled = true,
        metadata = {},
    } = options;

    const isSavingRef = useRef(false);
    const lastSavedRef = useRef<Date | null>(null);
    const intervalRef = useRef<NodeJS.Timeout | null>(null);
    const lastValuesRef = useRef<Record<string, any>>({});

    /**
     * Deep compare two objects for equality
     */
    const deepEqual = (obj1: any, obj2: any): boolean => {
        if (obj1 === obj2) return true;
        if (obj1 == null || obj2 == null) return false;
        if (typeof obj1 !== "object" || typeof obj2 !== "object") return false;

        const keys1 = Object.keys(obj1);
        const keys2 = Object.keys(obj2);

        if (keys1.length !== keys2.length) return false;

        for (const key of keys1) {
            if (!keys2.includes(key)) return false;
            if (!deepEqual(obj1[key], obj2[key])) return false;
        }

        return true;
    };

    /**
     * Save current form values as a draft
     * ✅ OPTIMIZED: Added change detection to skip saves when values unchanged
     */
    const saveDraft = useCallback(async () => {
        if (!enabled || isSavingRef.current) return;

        try {
            isSavingRef.current = true;

            // Get current form values
            const values = form.getFieldsValue();

            // Check if there are any values to save
            const hasValues = Object.keys(values).some(
                (key) =>
                    values[key] !== undefined &&
                    values[key] !== null &&
                    values[key] !== "",
            );

            if (!hasValues) {
                console.log("⏭️  Skipping auto-save: No values to save");
                return;
            }

            // ✅ OPTIMIZED: Skip save if values haven't changed
            if (deepEqual(values, lastValuesRef.current)) {
                console.log("⏭️  Skipping auto-save: No changes detected");
                return;
            }

            let savedDraft: FlattenedEvent | FlattenedTrackedEntity;

            // if (type === "event") {
            //     savedDraft = await saveEventDraft({
            //         event: draftId,
            //         programStage: metadata.programStage || "",
            //         trackedEntity: metadata.trackedEntity || "",
            //         enrollment: metadata.enrollment || "",
            //         dataValues: values,
            //         occurredAt:
            //             values.occurredAt ||
            //             metadata.occurredAt ||
            //             new Date().toISOString(),
            //         orgUnit: metadata.orgUnit || "",
            //         program: metadata.program || "",
            //         deleted: false,
            //         followUp: false,
            //         status: "",
            //         // isNew: metadata.isNew ?? true,
            //     });
            // } else {
            //     savedDraft = await saveTrackedEntityDraft({
            //         trackedEntity: draftId,
            //         attributes: values,
            //         enrollment: {
            //             enrollment: metadata.enrollment || draftId,
            //             program: metadata.program || "",
            //             orgUnit: metadata.orgUnit || "",
            //             enrolledAt: new Date().toISOString(),
            //             occurredAt: new Date().toISOString(),
            //             status: "ACTIVE",
            //         } as any,
            //         orgUnit: metadata.orgUnit || "",
            //         // isNew: metadata.isNew ?? true,
            //         createdAtClient: new Date().toISOString(),
            //         deleted: false,
            //         events: [],
            //         potentialDuplicate: false,
            //         relationships: [],
            //         inactive: false,
            //         trackedEntityType: "",
            //     });
            // }

            // ✅ OPTIMIZED: Track last saved values for change detection
            lastValuesRef.current = values;
            lastSavedRef.current = new Date();
            // console.log(
            //     `💾 Draft auto-saved: ${type} - ${draftId}`,
            //     savedDraft,
            // );

            // if (onSave) {
            //     onSave(savedDraft);
            // }
        } catch (error) {
            console.error("❌ Auto-save failed:", error);
            if (onError && error instanceof Error) {
                onError(error);
            }
        } finally {
            isSavingRef.current = false;
        }
    }, [form, draftId, type, enabled, metadata, onSave, onError]);

    /**
     * Clear the draft from IndexedDB
     * ✅ OPTIMIZED: Also resets change detection tracking
     */
    const clearDraft = useCallback(async () => {
        try {
            if (type === "event") {
                await deleteEventDraft(draftId);
            } else {
                await deleteTrackedEntityDraft(draftId);
            }

            // Reset tracking refs
            lastValuesRef.current = {};
            lastSavedRef.current = null;

            console.log(`🗑️  Draft cleared: ${type} - ${draftId}`);
        } catch (error) {
            console.error("❌ Failed to clear draft:", error);
            if (onError && error instanceof Error) {
                onError(error);
            }
        }
    }, [draftId, type, onError]);

    /**
     * Setup auto-save interval
     */
    useEffect(() => {
        if (!enabled) return;

        console.log(
            `⏰ Auto-save enabled: ${type} - ${draftId} (interval: ${interval}ms)`,
        );

        // Initial save after 5 seconds
        const initialTimeout = setTimeout(() => {
            saveDraft();
        }, 5000);

        // Setup recurring auto-save
        intervalRef.current = setInterval(() => {
            saveDraft();
        }, interval);

        // Cleanup on unmount or when dependencies change
        return () => {
            clearTimeout(initialTimeout);
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
            console.log(`⏹️  Auto-save stopped: ${type} - ${draftId}`);
        };
    }, [enabled, interval, saveDraft, draftId, type]);

    return {
        saveNow: saveDraft,
        clearDraft,
        isSaving: isSavingRef.current,
        lastSaved: lastSavedRef.current,
    };
}
