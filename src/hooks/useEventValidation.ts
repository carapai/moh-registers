import { useMemo } from "react";
import { ProgramStage } from "../schemas";

/**
 * useEventValidation Hook
 *
 * Validates event data against program stage required fields.
 * Determines when an event should be created in IndexedDB vs. just held in memory.
 *
 * Features:
 * - Checks all compulsory fields are filled
 * - Validates occurredAt is present
 * - Returns list of missing fields for user feedback
 */

interface UseEventValidationOptions {
    programStage: ProgramStage;
    dataValues: Record<string, any>;
    occurredAt?: string;
}

interface UseEventValidationReturn {
    isValid: boolean;
    hasOccurredAt: boolean;
    hasRequiredFields: boolean;
    missingFields: string[];
    readyToCreate: boolean;
}

export const useEventValidation = ({
    programStage,
    dataValues,
    occurredAt,
}: UseEventValidationOptions): UseEventValidationReturn => {
    const validation = useMemo(() => {
        // Get all compulsory (required) data elements
        const requiredDataElements = programStage.programStageDataElements
            .filter((psde) => psde.compulsory)
            .map((psde) => psde.dataElement.id);

        // Check which required fields are missing
        const missingFields: string[] = [];

        for (const dataElementId of requiredDataElements) {
            const value = dataValues[dataElementId];
            // Field is missing if undefined, null, or empty string
            if (value === undefined || value === null || value === "") {
                missingFields.push(dataElementId);
            }
        }

        const hasRequiredFields = missingFields.length === 0;
        const hasOccurredAt = !!occurredAt;
        const isValid = hasRequiredFields && hasOccurredAt;

        return {
            isValid,
            hasOccurredAt,
            hasRequiredFields,
            missingFields,
            readyToCreate: isValid, // Event can be created when valid
        };
    }, [programStage, dataValues, occurredAt]);

    return validation;
};
