import { FormInstance } from "antd";
import { useCallback, useEffect, useMemo, useState } from "react";
import type {
    ProgramRule,
    ProgramRuleResult,
    ProgramRuleVariable,
} from "../schemas";
import {
    createEmptyProgramRuleResult,
    executeProgramRules,
} from "../utils/utils";

/**
 * useProgramRules Hook
 *
 * Reactive program rules execution for forms with Dexie data integration.
 * Executes DHIS2 program rules based on form values and tracked entity attributes.
 *
 * Features:
 * - Automatic rule execution on form value changes
 * - Reactive rule results (hide/show fields, assign values, show messages)
 * - Integration with Dexie form hooks
 * - Debounced execution to prevent excessive computation
 * - Rule result caching
 *
 * Usage:
 * ```typescript
 * const { ruleResult, executeRules, isExecuting } = useProgramRules({
 *     form: eventForm,
 *     programRules,
 *     programRuleVariables,
 *     programStage: "K2nxbE9ubSs",
 *     trackedEntityAttributes: entity.attributes,
 *     enrollment: entity.enrollment,
 * });
 *
 * // Auto-execute on field change
 * <Input onChange={() => executeRules()} />
 *
 * // Use rule results
 * if (ruleResult.hiddenFields.has(dataElementId)) {
 *     return null;
 * }
 * ```
 */

export interface UseProgramRulesOptions {
    form: FormInstance;
    programRules: ProgramRule[];
    programRuleVariables: ProgramRuleVariable[];
    programStage?: string;
    program: string;
    trackedEntityAttributes?: Record<string, any>;
    enrollment?: { enrolledAt?: string; occurredAt?: string };
    debounceMs?: number;
    autoExecute?: boolean; // Auto-execute on form value changes
    isRegistration?: boolean;
}

export interface UseProgramRulesReturn {
    ruleResult: ProgramRuleResult;
    executeRules: (dataValues?: Record<string, any>) => ProgramRuleResult;
    isExecuting: boolean;
    hasErrors: boolean;
    hasWarnings: boolean;
    hasMessages: boolean;
}

export const useProgramRules = ({
    form,
    programRules,
    programRuleVariables,
    programStage,
    program,
    trackedEntityAttributes = {},
    enrollment,
    debounceMs = 300,
    autoExecute = false,
    isRegistration = false,
}: UseProgramRulesOptions): UseProgramRulesReturn => {
    const [ruleResult, setRuleResult] = useState<ProgramRuleResult>(
        createEmptyProgramRuleResult(),
    );
    const [isExecuting, setIsExecuting] = useState(false);
    
    const executeRules = useCallback(
        (providedDataValues?: Record<string, any>): ProgramRuleResult => {
            setIsExecuting(true);

            try {
                const dataValues = providedDataValues || form.getFieldsValue();
                const attributeValues = isRegistration
                    ? dataValues
                    : trackedEntityAttributes;

                const result = executeProgramRules({
                    programRules,
                    programRuleVariables,
                    dataValues,
                    attributeValues,
                    program,
                    programStage,
                    enrollment,
                });
                setRuleResult(result);
                setIsExecuting(false);

                return result;
            } catch (error) {
                console.error("❌ Program rules execution failed:", error);
                setIsExecuting(false);
                return createEmptyProgramRuleResult();
            }
        },
        [
            form,
            programRules,
            programRuleVariables,
            trackedEntityAttributes,
            program,
            programStage,
            enrollment,
        ],
    );

    /**
     * Auto-execute rules when form values change
     */
    useEffect(() => {
        if (!autoExecute) return;
        let timeoutId: NodeJS.Timeout;
        timeoutId = setTimeout(() => {
            executeRules();
        }, debounceMs);

        return () => {
            clearTimeout(timeoutId);
        };
    }, [form, autoExecute, debounceMs, executeRules]);

    // Derived state
    const hasErrors = ruleResult.errors.length > 0;
    const hasWarnings = ruleResult.warnings.length > 0;
    const hasMessages = ruleResult.messages.length > 0;

    return {
        ruleResult,
        executeRules,
        isExecuting,
        hasErrors,
        hasWarnings,
        hasMessages,
    };
};

/**
 * useProgramRulesWithDexie Hook
 *
 * Combines useProgramRules with Dexie form hooks for automatic
 * rule execution and value assignment.
 *
 * Features:
 * - Automatic rule execution on form changes
 * - Automatic assignment application to form
 * - Automatic assignment persistence to Dexie
 * - Error/warning/message display
 *
 * Usage:
 * ```typescript
 * const { event, updateDataValues } = useDexieEventForm({ eventId, form });
 *
 * const { ruleResult, executeAndApplyRules } = useProgramRulesWithDexie({
 *     form,
 *     programRules,
 *     programRuleVariables,
 *     programStage,
 *     trackedEntityAttributes: entity.attributes,
 *     enrollment: entity.enrollment,
 *     onAssignments: updateDataValues, // Auto-persist assignments to Dexie
 * });
 *
 * // Trigger on field change
 * <Input onChange={() => executeAndApplyRules()} />
 * ```
 */

export interface UseProgramRulesWithDexieOptions
    extends Omit<UseProgramRulesOptions, "autoExecute"> {
    onAssignments?: (assignments: Record<string, any>) => Promise<void>;
    applyAssignmentsToForm?: boolean; // Apply to form (default: true)
    persistAssignments?: boolean; // Persist to Dexie (default: false)
    clearHiddenFields?: boolean; // Clear fields that become hidden (default: false)
}

export interface UseProgramRulesWithDexieReturn extends UseProgramRulesReturn {
    executeAndApplyRules: (dataValues?: Record<string, any>) => Promise<void>;
}

export const useProgramRulesWithDexie = ({
    form,
    programRules,
    programRuleVariables,
    programStage,
    program,
    trackedEntityAttributes = {},
    enrollment,
    debounceMs = 300,
    onAssignments,
    applyAssignmentsToForm = true,
    persistAssignments = false,
    clearHiddenFields = false,
		isRegistration = false,
}: UseProgramRulesWithDexieOptions): UseProgramRulesWithDexieReturn => {
    const basicRules = useProgramRules({
        form,
        programRules,
        programRuleVariables,
        programStage,
        program,
        trackedEntityAttributes,
        enrollment,
        debounceMs,
        autoExecute: true,
				isRegistration
    });

    /**
     * Execute rules and apply assignments
     */
    const executeAndApplyRules = useCallback(
        async (providedDataValues?: Record<string, any>) => {
            // Execute rules
            const result = basicRules.executeRules(providedDataValues);

						console.log("useProgramRulesWithDexie - rule execution result:", result.assignments);

            if (clearHiddenFields && result.hiddenFields.size > 0) {
                const currentValues = form.getFieldsValue();
                const fieldsToClear: Record<string, any> = {};

                // Find fields that are hidden and have values
                result.hiddenFields.forEach((fieldId) => {
                    if (currentValues[fieldId] !== undefined && currentValues[fieldId] !== null && currentValues[fieldId] !== '') {
                        fieldsToClear[fieldId] = undefined;
                    }
                });

                // Clear from form
                if (Object.keys(fieldsToClear).length > 0) {
                    form.setFieldsValue(fieldsToClear);
                    console.log("🧹 Cleared hidden fields from form:", Object.keys(fieldsToClear));

                    // Persist clearing to Dexie
                    if (onAssignments) {
                        try {
                            await onAssignments(fieldsToClear);
                            console.log("✅ Hidden fields cleared from Dexie");
                        } catch (error) {
                            console.error("❌ Failed to clear hidden fields from Dexie:", error);
                        }
                    }
                }
            }

            // Apply assignments to form
            if (
                applyAssignmentsToForm &&
                Object.keys(result.assignments).length > 0
            ) {
                form.setFieldsValue(result.assignments);
            }

            // Persist assignments to Dexie
            if (
                persistAssignments &&
                onAssignments &&
                Object.keys(result.assignments).length > 0
            ) {
                try {
                    await onAssignments(result.assignments);
                    console.log(
                        "✅ Program rule assignments persisted to Dexie",
                    );
                } catch (error) {
                    console.error("❌ Failed to persist assignments:", error);
                }
            }
        },
        [
            basicRules,
            form,
            applyAssignmentsToForm,
            persistAssignments,
            onAssignments,
            clearHiddenFields,
        ],
    );

    return {
        ...basicRules,
        executeAndApplyRules,
    };
};

/**
 * useFieldVisibility Hook
 *
 * Determines if a field should be visible based on program rules.
 * Simple helper for conditional rendering.
 *
 * Usage:
 * ```typescript
 * const isVisible = useFieldVisibility(dataElementId, ruleResult);
 *
 * if (!isVisible) {
 *     return null;
 * }
 * ```
 */

export function useFieldVisibility(
    fieldId: string,
    ruleResult: ProgramRuleResult,
): boolean {
    return useMemo(() => {
        // Hidden by rule
        if (ruleResult.hiddenFields.has(fieldId)) {
            return false;
        }

        // Shown by rule (overrides default visibility)
        if (ruleResult.shownFields.has(fieldId)) {
            return true;
        }

        // Default visibility
        return true;
    }, [fieldId, ruleResult]);
}

/**
 * useSectionVisibility Hook
 *
 * Determines if a section should be visible based on program rules.
 *
 * Usage:
 * ```typescript
 * const isVisible = useSectionVisibility(sectionId, ruleResult);
 *
 * if (!isVisible) {
 *     return null;
 * }
 * ```
 */

export function useSectionVisibility(
    sectionId: string,
    ruleResult: ProgramRuleResult,
): boolean {
    return useMemo(() => {
        if (ruleResult.hiddenSections.has(sectionId)) {
            return false;
        }

        if (ruleResult.shownSections.has(sectionId)) {
            return true;
        }

        return true;
    }, [sectionId, ruleResult]);
}

export function useFilteredOptions<T extends { id: string }>(
    fieldId: string,
    allOptions: T[] = [],
    ruleResult: ProgramRuleResult,
): T[] {
    return useMemo(() => {
        const hiddenOptions = ruleResult.hiddenOptions[fieldId];
        const shownOptions = ruleResult.shownOptions[fieldId];

        // If no rules affect this field, return all options
        if (!hiddenOptions && !shownOptions) {
            return allOptions;
        }

        // Filter based on rules
        return allOptions.filter((option) => {
            // If explicitly hidden
            if (hiddenOptions?.has(option.id)) {
                return false;
            }

            // If shown options specified, only show those
            if (shownOptions && shownOptions.size > 0) {
                return shownOptions.has(option.id);
            }

            // Default: show
            return true;
        });
    }, [fieldId, allOptions, ruleResult]);
}
