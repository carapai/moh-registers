import { FormInstance } from "antd";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
    ProgramRule,
    ProgramRuleResult,
    ProgramRuleVariable,
} from "../schemas";
import {
    createEmptyProgramRuleResult,
    executeProgramRules,
} from "../utils/utils";

export interface UseProgramRulesOptions {
    form: FormInstance;
    programRules: ProgramRule[];
    programRuleVariables: ProgramRuleVariable[];
    programStage?: string;
    program: string;
    trackedEntityAttributes?: Record<string, any>;
    enrollment?: { enrolledAt?: string; occurredAt?: string };
    debounceMs?: number;
    autoExecute?: boolean;
    isRegistration?: boolean;
}

export interface UseProgramRulesReturn {
    ruleResult: ProgramRuleResult;
    executeRules: (dataValues?: Record<string, any>) => ProgramRuleResult;
    triggerAutoExecute: () => void;
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

                console.log("⚡ Executing program rules", {
                    isRegistration,
                    dataValuesCount: Object.keys(dataValues).length,
                    attributeValuesCount: Object.keys(attributeValues).length,
                    programRulesCount: programRules.length,
                });

                const result = executeProgramRules({
                    programRules,
                    programRuleVariables,
                    dataValues,
                    attributeValues,
                    program,
                    programStage,
                    enrollment,
                });

                console.log("✅ Program rules result", {
                    assignments: Object.keys(result.assignments).length,
                    hiddenFields: result.hiddenFields.size,
                    errors: result.errors.length,
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
            isRegistration,
        ],
    );

    // Track last executed values to prevent infinite loops from auto-execute
    const lastExecutedValuesRef = useRef<string>("");
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    /**
     * Trigger function that can be called manually or automatically
     * This is exposed so DataElementField can call it on field changes
     */
    const triggerAutoExecute = useCallback(() => {
        if (!autoExecute) return;

        const dataValues = form.getFieldsValue();
        // For registration, attributes come from form values
        // For events, attributes come from trackedEntityAttributes
        const attributeValues = isRegistration ? dataValues : trackedEntityAttributes;

        const valuesString = JSON.stringify({
            data: dataValues,
            attributes: attributeValues,
            enrollment,
        });

        // Skip if values haven't changed
        if (lastExecutedValuesRef.current === valuesString) {
            return;
        }

        console.log("🔄 Auto-executing program rules", {
            isRegistration,
            dataValuesCount: Object.keys(dataValues).length,
            attributeValuesCount: Object.keys(attributeValues).length,
            hasChanges: lastExecutedValuesRef.current !== valuesString
        });

        lastExecutedValuesRef.current = valuesString;

        // Clear existing timer
        if (timerRef.current) {
            clearTimeout(timerRef.current);
        }

        // Start debounce timer
        timerRef.current = setTimeout(() => {
            executeRules();
        }, debounceMs);
    }, [autoExecute, form, isRegistration, trackedEntityAttributes, enrollment, executeRules, debounceMs]);

    /**
     * Auto-execute rules when dependencies change
     * This catches changes to trackedEntityAttributes and enrollment
     */
    useEffect(() => {
        if (!autoExecute) return;
        triggerAutoExecute();
    }, [autoExecute, trackedEntityAttributes, enrollment, triggerAutoExecute]);

    // Derived state
    const hasErrors = ruleResult.errors.length > 0;
    const hasWarnings = ruleResult.warnings.length > 0;
    const hasMessages = ruleResult.messages.length > 0;

    return {
        ruleResult,
        executeRules,
        triggerAutoExecute,
        isExecuting,
        hasErrors,
        hasWarnings,
        hasMessages,
    };
};

export interface UseProgramRulesWithDexieOptions
    extends UseProgramRulesOptions {
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
    autoExecute = false,
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
        autoExecute,
        isRegistration,
    });

    const executeAndApplyRules = useCallback(
        async (providedDataValues?: Record<string, any>, maxIterations: number = 5) => {
            let iteration = 0;
            let hasNewAssignments = true;
            let allAssignments: Record<string, any> = {};

            console.log("🔄 Starting cascading rule execution");

            // Execute rules repeatedly until no new assignments or max iterations reached
            while (hasNewAssignments && iteration < maxIterations) {
                iteration++;

                // Get current form values for this iteration
                const currentValues = providedDataValues || form.getFieldsValue();

                const result = basicRules.executeRules(currentValues);

                console.log(`   Iteration ${iteration}:`, {
                    assignments: Object.keys(result.assignments).length,
                    hiddenFields: result.hiddenFields.size,
                    errors: result.errors.length,
                });

                // Clear hidden fields if needed
                if (clearHiddenFields && result.hiddenFields.size > 0) {
                    const fieldsToClear: Record<string, any> = {};
                    result.hiddenFields.forEach((fieldId) => {
                        if (
                            currentValues[fieldId] !== undefined &&
                            currentValues[fieldId] !== null &&
                            currentValues[fieldId] !== ""
                        ) {
                            fieldsToClear[fieldId] = undefined;
                        }
                    });

                    if (Object.keys(fieldsToClear).length > 0) {
                        form.setFieldsValue(fieldsToClear);
                        if (onAssignments) {
                            try {
                                await onAssignments(fieldsToClear);
                            } catch (error) {
                                console.error(
                                    "Failed to clear hidden fields from Dexie:",
                                    error,
                                );
                            }
                        }
                    }
                }

                // Check if there are new assignments
                if (Object.keys(result.assignments).length === 0) {
                    hasNewAssignments = false;
                    console.log("✅ No more assignments, stopping cascade");
                    break;
                }

                // Merge assignments
                allAssignments = { ...allAssignments, ...result.assignments };

                // Apply assignments to form
                if (applyAssignmentsToForm) {
                    form.setFieldsValue(result.assignments);
                }

                // Persist assignments
                if (persistAssignments && onAssignments) {
                    try {
                        await onAssignments(result.assignments);
                    } catch (error) {
                        console.error("Failed to persist assignments:", error);
                    }
                }

                // Check if we should continue - only if we have new assignments that might trigger more rules
                const assignmentKeys = Object.keys(result.assignments);
                if (assignmentKeys.length === 0) {
                    hasNewAssignments = false;
                }
            }

            if (iteration >= maxIterations) {
                console.warn(`⚠️ Reached max iterations (${maxIterations}) for cascading rules`);
            } else {
                console.log(`✅ Cascading complete after ${iteration} iteration(s)`);
            }

            return allAssignments;
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

    // Override triggerAutoExecute to use executeAndApplyRules instead of executeRules
    const lastExecutedValuesRef = useRef<string>("");
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    const triggerAutoExecuteWithDexie = useCallback(() => {
        if (!autoExecute) return;

        const dataValues = form.getFieldsValue();
        // For registration, attributes come from form values
        // For events, attributes come from trackedEntityAttributes
        const attributeValues = isRegistration ? dataValues : trackedEntityAttributes;

        const valuesString = JSON.stringify({
            data: dataValues,
            attributes: attributeValues,
            enrollment,
        });

        // Skip if values haven't changed
        if (lastExecutedValuesRef.current === valuesString) {
            return;
        }

        console.log("🔄 Auto-executing program rules (with Dexie)", {
            isRegistration,
            dataValuesCount: Object.keys(dataValues).length,
            attributeValuesCount: Object.keys(attributeValues).length,
            hasChanges: lastExecutedValuesRef.current !== valuesString
        });

        lastExecutedValuesRef.current = valuesString;

        // Clear existing timer
        if (timerRef.current) {
            clearTimeout(timerRef.current);
        }

        // Start debounce timer
        timerRef.current = setTimeout(() => {
            executeAndApplyRules();
        }, debounceMs);
    }, [autoExecute, form, isRegistration, trackedEntityAttributes, enrollment, executeAndApplyRules, debounceMs]);

    return {
        ...basicRules,
        executeAndApplyRules,
        triggerAutoExecute: triggerAutoExecuteWithDexie, // Override with Dexie-aware version
    };
};

export function useFieldVisibility(
    fieldId: string,
    ruleResult: ProgramRuleResult,
): boolean {
    return useMemo(() => {
        if (ruleResult.hiddenFields.has(fieldId)) {
            return false;
        }
        if (ruleResult.shownFields.has(fieldId)) {
            return true;
        }
        return true;
    }, [fieldId, ruleResult]);
}

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
        if (!hiddenOptions && !shownOptions) {
            return allOptions;
        }

        return allOptions.filter((option) => {
            if (hiddenOptions?.has(option.id)) {
                return false;
            }

            if (shownOptions && shownOptions.size > 0) {
                return shownOptions.has(option.id);
            }

            return true;
        });
    }, [fieldId, allOptions, ruleResult]);
}
