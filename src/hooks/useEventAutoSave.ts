import { useCallback, useEffect, useRef, useState } from "react";
import { FormInstance } from "antd";
import { message } from "antd";
import type { ActorRefFrom } from "xstate";
import type { trackerMachine } from "../machines/tracker";
import type { ProgramRuleResult } from "../schemas";
import type { FlattenedEvent } from "../db";

interface UseEventAutoSaveProps {
    form: FormInstance;
    event: FlattenedEvent;
    trackerActor: ActorRefFrom<typeof trackerMachine>;
    ruleResult: ProgramRuleResult;
    onEventCreated?: (newEventId: string) => void;
}

interface BatchedChange {
    dataElementId: string;
    value: any;
    timestamp: number;
}

export const useEventAutoSave = ({
    form,
    event,
    trackerActor,
    ruleResult,
    onEventCreated,
}: UseEventAutoSaveProps) => {
    const [isEventCreated, setIsEventCreated] = useState<boolean>(
        !event.event.startsWith("temp"),
    );
    const [savingState, setSavingState] = useState<
        "idle" | "saving" | "saved" | "error"
    >("idle");
    const [errorMessage, setErrorMessage] = useState<string>("");

    const batchQueueRef = useRef<BatchedChange[]>([]);
    const saveQueueRef = useRef<Record<string, any>[]>([]);
    const isSavingRef = useRef<boolean>(false);
    const batchTimerRef = useRef<NodeJS.Timeout | null>(null);
    const savedIndicatorTimerRef = useRef<NodeJS.Timeout | null>(null);
    const eventRef = useRef(event);
    const lastSavedValuesRef = useRef<Record<string, any>>({});

    // Update event ref when event changes
    useEffect(() => {
        eventRef.current = event;
    }, [event]);

    // Check if event ID changed from temp to real (created in DHIS2)
    useEffect(() => {
        if (!event.event.startsWith("temp") && !isEventCreated) {
            setIsEventCreated(true);
        }
    }, [event.event, isEventCreated]);

    const performSave = useCallback(
        async (changes: Record<string, any>) => {
            if (isSavingRef.current) {
                // Queue for later
                saveQueueRef.current.push(changes);
                return;
            }

            // Safety check: Don't save if event doesn't have required fields
            if (!eventRef.current.program || !eventRef.current.trackedEntity || !eventRef.current.enrollment) {
                console.warn("⚠️ Skipping auto-save: event missing required fields", {
                    program: eventRef.current.program,
                    trackedEntity: eventRef.current.trackedEntity,
                    enrollment: eventRef.current.enrollment,
                });
                return;
            }

            // Check validation
            if (ruleResult.errors.length > 0) {
                const errorMessages = ruleResult.errors
                    .map((e) => e.content)
                    .join(", ");
                setErrorMessage(`Cannot save: ${errorMessages}`);
                setSavingState("error");
                message.warning(`Cannot auto-save: ${errorMessages}`);
                return;
            }

            // Check if values actually changed
            const hasChanges = Object.entries(changes).some(
                ([key, value]) => lastSavedValuesRef.current[key] !== value
            );

            if (!hasChanges) {
                // No actual changes, skip save
                return;
            }

            isSavingRef.current = true;
            setSavingState("saving");
            setErrorMessage("");

            try {
                // Get current form values and merge with changes
                const currentValues = form.getFieldsValue();
                const updatedDataValues = {
                    ...currentValues,
                    ...changes,
                };

                // Remove occurredAt from dataValues (it's a separate field)
                const { occurredAt, ...dataValues } = updatedDataValues;

                const updatedEvent = {
                    ...eventRef.current,
                    dataValues,
                    occurredAt: occurredAt || eventRef.current.occurredAt,
                };

                console.log("🔍 Auto-save event details:", {
                    eventId: updatedEvent.event,
                    program: updatedEvent.program,
                    trackedEntity: updatedEvent.trackedEntity,
                    enrollment: updatedEvent.enrollment,
                    orgUnit: updatedEvent.orgUnit,
                    programStage: updatedEvent.programStage,
                });

                // Update last saved values
                lastSavedValuesRef.current = {
                    ...lastSavedValuesRef.current,
                    ...changes,
                };

                if (!isEventCreated) {
                    // CREATE new event
                    trackerActor.send({
                        type: "CREATE_OR_UPDATE_EVENT",
                        event: updatedEvent,
                    });

                    trackerActor.send({
                        type: "SAVE_EVENTS",
                    });

                    // Event will be created with temp ID, real ID comes from server
                    // For now, mark as created
                    setIsEventCreated(true);

                    // Note: In real implementation, you'd wait for server response
                    // and call onEventCreated with the real ID from DHIS2
                    // For now, we assume the state machine handles this

                    setSavingState("saved");

                    // Clear "Saved" indicator after 2 seconds
                    if (savedIndicatorTimerRef.current) {
                        clearTimeout(savedIndicatorTimerRef.current);
                    }
                    savedIndicatorTimerRef.current = setTimeout(() => {
                        setSavingState("idle");
                    }, 2000);
                } else {
                    // UPDATE existing event
                    trackerActor.send({
                        type: "CREATE_OR_UPDATE_EVENT",
                        event: updatedEvent,
                    });

                    trackerActor.send({
                        type: "SAVE_EVENTS",
                    });

                    setSavingState("saved");

                    // Clear "Saved" indicator after 2 seconds
                    if (savedIndicatorTimerRef.current) {
                        clearTimeout(savedIndicatorTimerRef.current);
                    }
                    savedIndicatorTimerRef.current = setTimeout(() => {
                        setSavingState("idle");
                    }, 2000);
                }
            } catch (error) {
                console.error("Auto-save failed:", error);
                setErrorMessage(
                    error instanceof Error
                        ? error.message
                        : "Failed to save changes",
                );
                setSavingState("error");
                message.error("Auto-save failed. Changes saved locally.");
            } finally {
                isSavingRef.current = false;

                // Process queued saves
                if (saveQueueRef.current.length > 0) {
                    const nextChanges = saveQueueRef.current.shift();
                    if (nextChanges) {
                        // Merge all queued changes
                        let mergedChanges = nextChanges;
                        while (saveQueueRef.current.length > 0) {
                            const queuedChange = saveQueueRef.current.shift();
                            if (queuedChange) {
                                mergedChanges = { ...mergedChanges, ...queuedChange };
                            }
                        }
                        performSave(mergedChanges);
                    }
                }
            }
        },
        [
            form,
            trackerActor,
            ruleResult,
            isEventCreated,
            onEventCreated,
        ],
    );

    const processBatch = useCallback(() => {
        if (batchQueueRef.current.length === 0) return;

        // Merge all batched changes
        const changes: Record<string, any> = {};
        batchQueueRef.current.forEach((change) => {
            changes[change.dataElementId] = change.value;
        });

        // Clear batch queue
        batchQueueRef.current = [];

        // Perform save
        performSave(changes);
    }, [performSave]);

    const triggerAutoSave = useCallback(
        (dataElementId: string, value: any) => {
            // Add to batch queue
            batchQueueRef.current.push({
                dataElementId,
                value,
                timestamp: Date.now(),
            });

            // Clear existing timer
            if (batchTimerRef.current) {
                clearTimeout(batchTimerRef.current);
            }

            // Start 500ms debounce timer
            batchTimerRef.current = setTimeout(() => {
                processBatch();
            }, 500);
        },
        [processBatch],
    );

    // Cleanup timers on unmount
    useEffect(() => {
        return () => {
            if (batchTimerRef.current) {
                clearTimeout(batchTimerRef.current);
            }
            if (savedIndicatorTimerRef.current) {
                clearTimeout(savedIndicatorTimerRef.current);
            }
        };
    }, []);

    return {
        triggerAutoSave,
        savingState,
        errorMessage,
        isEventCreated,
    };
};
