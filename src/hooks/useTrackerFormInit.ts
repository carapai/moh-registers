import { FormInstance } from "antd";
import { useEffect, useRef, useState } from "react";
import type { ProgramRule, ProgramRuleVariable } from "../schemas";

/**
 * Unified Tracker Form Initialization Hook
 *
 * Consolidates all form initialization logic across TrackerRegistration,
 * EventModal, Relation, and ProgramStageCapture components.
 *
 * Handles:
 * - Loading entity from reactive query
 * - Merging initial values with entity data
 * - Setting form values once
 * - Initial program rules execution (autoExecute handles the rest)
 * - Initialization state tracking
 *
 * Eliminates:
 * - Duplicate initialization patterns across 4+ components
 * - Complex cascading rule execution logic
 * - Multiple useEffect hooks
 * - initialization guards (hasInitialized, initializedRef, etc.)
 */

interface UseTrackerFormInitOptions {
    form: FormInstance;
    entity: any | null | undefined; // From useLiveQuery or useDexiePersistence
    initialValues?: Record<string, any>;
    executeRules: (values?: Record<string, any>) => Promise<void> | void;
    enabled?: boolean; // Allow disabling initialization
}

interface UseTrackerFormInitReturn {
    isInitialized: boolean;
    isInitializing: boolean;
}

export function useTrackerFormInit(
    options: UseTrackerFormInitOptions
): UseTrackerFormInitReturn {
    const { form, entity, initialValues = {}, executeRules, enabled = true } = options;

    const [isInitialized, setIsInitialized] = useState(false);
    const [isInitializing, setIsInitializing] = useState(false);
    const hasRunRef = useRef(false);

    useEffect(() => {
        // Skip if disabled, already initialized, or entity hasn't loaded
        if (!enabled || hasRunRef.current || isInitializing || entity === undefined) {
            return;
        }

        // If entity is explicitly null (not found), we can still initialize with initialValues
        // If entity exists, wait for it to be defined
        if (entity === null && Object.keys(initialValues).length === 0) {
            return;
        }

        const initialize = async () => {
            setIsInitializing(true);
            hasRunRef.current = true;

            try {
                // Merge entity data with initial values
                const entityData = entity?.dataValues || entity?.attributes || {};
                const mergedValues = {
                    ...entityData,
                    ...initialValues,
                };

                console.log("🎬 useTrackerFormInit: Initializing form", {
                    entityType: entity?.trackedEntity ? "trackedEntity" : entity?.event ? "event" : "unknown",
                    entityDataKeys: Object.keys(entityData).length,
                    initialValuesKeys: Object.keys(initialValues).length,
                    mergedValuesKeys: Object.keys(mergedValues).length,
                });

                // Set form values
                form.setFieldsValue(mergedValues);

                // Execute program rules once
                // autoExecute will handle subsequent executions when fields change
                await executeRules(mergedValues);

                console.log("✅ useTrackerFormInit: Form initialized");
                setIsInitialized(true);
            } catch (error) {
                console.error("Form initialization failed:", error);
            } finally {
                setIsInitializing(false);
            }
        };

        initialize();
    }, [entity, enabled]);

    return {
        isInitialized,
        isInitializing,
    };
}
