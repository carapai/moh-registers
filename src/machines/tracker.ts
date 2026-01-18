import { useDataEngine } from "@dhis2/app-runtime";
import { UseNavigateResult } from "@tanstack/react-router";
import { createActorContext } from "@xstate/react";
import { MessageInstance } from "antd/es/message/interface";
import { assertEvent, assign, fromPromise, setup } from "xstate";
import {
    FlattenedEvent,
    FlattenedRelationship,
    FlattenedTrackedEntity,
} from "../db";
import {
    bulkSaveTrackedEntities,
    saveEvent,
    saveRelationship,
    saveTrackedEntity,
} from "../db/operations";
import type { SyncManager } from "../db/sync";
import { queryClient } from "../query-client";
import { resourceQueryOptions } from "../query-options";
import {
    OnChange,
    OrgUnit,
    ProgramRule,
    ProgramRuleResult,
    ProgramRuleVariable,
    TrackedEntityResponse,
} from "../schemas";
import { generateUid } from "../utils/id";
import {
    createEmptyEvent,
    createEmptyProgramRuleResult,
    createEmptyTrackedEntity,
    executeProgramRules,
    flattenTrackedEntityResponse,
} from "../utils/utils";

interface TrackerContext {
    trackedEntities: FlattenedTrackedEntity[];
    trackedEntity: FlattenedTrackedEntity;
    childTrackedEntity: FlattenedTrackedEntity;
    trackedEntityId?: string;
    error?: string;
    engine: ReturnType<typeof useDataEngine>;
    navigate: UseNavigateResult<"/">;
    orgUnit: OrgUnit;
    currentEvent: FlattenedTrackedEntity["events"][number];
    mainEvent: FlattenedTrackedEntity["events"][number];
    childEvent: FlattenedTrackedEntity["events"][number];
    eventUpdates: string[];
    search: OnChange;
    registrationRuleResults: ProgramRuleResult;
    childRegistrationRuleResults: ProgramRuleResult;
    mainEventRuleResults: ProgramRuleResult;
    currentEventRuleResults: ProgramRuleResult;
    childEventRuleResults: ProgramRuleResult;
    modalState: "closed" | "creating" | "viewing" | "editing";
    syncManager?: SyncManager;
    message: MessageInstance;
}

type TrackerEvents =
    | { type: "RETRY" }
    | { type: "GO_BACK" }
    | {
          type: "CREATE_TRACKED_ENTITY";
          trackedEntity: FlattenedTrackedEntity;
      }
    | {
          type: "CREATE_TRACKED_CHILD_ENTITY";
          trackedEntity: FlattenedTrackedEntity;
      }
    | {
          type: "CREATE_RELATIONSHIP";
          relationship: FlattenedRelationship;
      }
    | {
          type: "SET_TRACKED_ENTITY";
          trackedEntity: FlattenedTrackedEntity;
      }
    | {
          type: "SET_TRACKED_ENTITIES";
          trackedEntities: FlattenedTrackedEntity[];
      }
    | {
          type: "SET_TRACKED_ENTITY_ID";
          trackedEntityId: string;
      }
    | {
          type: "CREATE_OR_UPDATE_EVENT";
          event: FlattenedEvent;
      }
    | { type: "SEARCH"; search: OnChange }
    | {
          type: "SET_ORG_UNIT";
          orgUnit: string;
      }
    | {
          type: "SET_CURRENT_EVENT";
          currentEvent: FlattenedEvent;
      }
    | {
          type: "SET_CHILD_EVENT";
          childEvent: FlattenedEvent;
      }
    | {
          type: "TOGGLE_ATTRIBUTE_COLUMN";
          attributeId: string;
      }
    | {
          type: "ADD_EVENT_UPDATE";
          id: string;
      }
    | {
          type: "RESET_MAIN_EVENT";
      }
    | {
          type: "RESET_CURRENT_EVENT";
      }
    | {
          type: "RESET_PROGRAM_RULES";
      }
    | {
          type: "SAVE_EVENTS";
      }
    | {
          type: "SET_MAIN_EVENT";
          mainEvent: FlattenedTrackedEntity["events"][number];
      }
    | {
          type: "RESET_TRACKED_ENTITY";
      }
    | {
          type: "RESET_CHILD_ENTITY";
      }
    | {
          type: "EXECUTE_PROGRAM_RULES";
          attributeValues?: Record<string, any>;
          dataValues?: Record<string, any>;
          programStage?: string;
          programRules: ProgramRule[];
          programRuleVariables: ProgramRuleVariable[];
          enrollment?: { enrolledAt: string; occurredAt: string };
          ruleResultKey:
              | "registrationRuleResults"
              | "childRegistrationRuleResults"
              | "mainEventRuleResults"
              | "currentEventRuleResults"
              | "childEventRuleResults";
          ruleResultUpdateKey:
              | "childTrackedEntity"
              | "currentEvent"
              | "trackedEntity"
              | "childEvent"
              | "mainEvent";
          updateKey: "dataValues" | "attributes";
      }
    | {
          type: "RESET_REGISTRATION_FORM";
      }
    | {
          type: "RESET_EVENT_FORM";
          eventId: string;
      };
export const trackerMachine = setup({
    types: {
        context: {} as TrackerContext,
        events: {} as TrackerEvents,
        input: {} as {
            engine: ReturnType<typeof useDataEngine>;
            navigate: UseNavigateResult<"/">;
            orgUnit: OrgUnit;
            message: MessageInstance;
            syncManager?: SyncManager;
        },
    },
    actors: {
        fetchTrackedEntities: fromPromise<
            FlattenedTrackedEntity[],
            {
                engine: ReturnType<typeof useDataEngine>;
                orgUnits: string;
                search: OnChange;
            }
        >(async ({ input: { engine, orgUnits, search } }) => {
            const params = new URLSearchParams({
                pageSize: "5",
                page: "1",
                program: "ueBhWkWll5v",
                orgUnitMode: "ACCESSIBLE",
                order: "updatedAt:DESC",
                fields: "trackedEntity,orgUnit,createdAt,updatedAt,inactive,attributes,relationships[relationship,to],enrollments[*,events[*]]",
            });

            if (Object.keys(search.filters || {}).length > 0) {
                for (const [filterKey, filterValues] of Object.entries(
                    search?.filters || {},
                )) {
                    if (
                        filterValues &&
                        filterValues.length > 0 &&
                        filterValues[0]
                    ) {
                        params.append(
                            `filter`,
                            `${filterKey}:ilike:${filterValues[0]}`,
                        );
                    }
                }
                const data = await queryClient.fetchQuery(
                    resourceQueryOptions<TrackedEntityResponse>({
                        engine,
                        resource: `tracker/trackedEntities?${params.toString()}`,
                        queryKey: [
                            "trackedEntities",
                            orgUnits,
                            Array.from(params.values()).sort().join(","),
                        ],
                    }),
                );
                return flattenTrackedEntityResponse(data);
            }
            return [];
        }),

        createOrUpdateEvents: fromPromise<
            void,
            {
                syncManager?: SyncManager;
                events: FlattenedTrackedEntity["events"];
            }
        >(async ({ input: { syncManager, events } }) => {
            for (const event of events) {
                await saveEvent(event);
                if (syncManager) {
                    await syncManager.queueCreateEvent(event, 7);
                }
            }
        }),
        createOrUpdateTrackedEntity: fromPromise<
            FlattenedTrackedEntity,
            {
                syncManager?: SyncManager;
                trackedEntity: FlattenedTrackedEntity;
            }
        >(async ({ input: { syncManager, trackedEntity } }) => {
            await saveTrackedEntity(trackedEntity);
            if (syncManager) {
                await syncManager.queueCreateTrackedEntity(trackedEntity, 8);
            }
            return trackedEntity;
        }),

        createRelationship: fromPromise<
            FlattenedRelationship,
            {
                syncManager?: SyncManager;
                relationship: FlattenedRelationship;
            }
        >(async ({ input: { syncManager, relationship } }) => {
            await saveRelationship(relationship);
            if (syncManager) {
                await syncManager.queueCreateRelationship(relationship, 8);
            }
            return relationship;
        }),
    },
    actions: {
        gotoEntities: ({ context }) => {
            context.navigate({ to: "/tracked-entities" });
        },
        gotoEntity: ({ context }) => {
            context.navigate({
                to: "/tracked-entity/$trackedEntity",
                params: {
                    trackedEntity: context.trackedEntityId || "",
                },
            });
        },
        resetTrackedEntities: assign({
            trackedEntities: () => [],
        }),
        resetTrackedEntity: assign({
            trackedEntity: ({ context }) => {
                return createEmptyTrackedEntity({
                    orgUnit: context.orgUnit.id,
                });
            },
        }),
        resetChildTrackedEntity: assign({
            childTrackedEntity: ({ context }) => {
                return createEmptyTrackedEntity({
                    orgUnit: context.orgUnit.id,
                });
            },
        }),
        resetMainEvent: assign({
            mainEvent: ({ context }) => {
                const enrollment = context.trackedEntity?.enrollment;
                return createEmptyEvent({
                    orgUnit: enrollment?.orgUnit || context.orgUnit.id,
                    enrollment: enrollment?.enrollment || generateUid(),
                    program: enrollment?.program || "ueBhWkWll5v",
                    trackedEntity:
                        context.trackedEntity?.trackedEntity || generateUid(),
                    programStage: "K2nxbE9ubSs",
                });
            },
        }),

        resetCurrentEvent: assign({
            currentEvent: ({ context }) => {
                const enrollment = context.trackedEntity?.enrollment;
                return createEmptyEvent({
                    orgUnit: enrollment?.orgUnit || context.orgUnit.id,
                    enrollment: enrollment?.enrollment || generateUid(),
                    program: enrollment?.program || "ueBhWkWll5v",
                    trackedEntity:
                        context.trackedEntity?.trackedEntity || generateUid(),
                    programStage: "K2nxbE9ubSs",
                });
            },
        }),
        resetChildEvent: assign({
            childEvent: ({ context }) => {
                const enrollment = context.childTrackedEntity?.enrollment;
                return createEmptyEvent({
                    orgUnit: enrollment?.orgUnit || context.orgUnit.id,
                    enrollment: enrollment?.enrollment || generateUid(),
                    program: enrollment?.program || "ueBhWkWll5v",
                    trackedEntity:
                        context.trackedEntity?.trackedEntity || generateUid(),
                    programStage: "K2nxbE9ubSs",
                });
            },
        }),

        resetAllProgramRules: assign({
            registrationRuleResults: () => createEmptyProgramRuleResult(),
            mainEventRuleResults: () => createEmptyProgramRuleResult(),
            childRegistrationRuleResults: () => createEmptyProgramRuleResult(),
            currentEventRuleResults: () => createEmptyProgramRuleResult(),
            childEventRuleResults: () => createEmptyProgramRuleResult(),
        }),

        resetRegistrationRules: assign({
            registrationRuleResults: () => createEmptyProgramRuleResult(),
        }),
        resetChildRegistrationRules: assign({
            childRegistrationRuleResults: () => createEmptyProgramRuleResult(),
        }),

        resetMainEventRules: assign({
            mainEventRuleResults: () => createEmptyProgramRuleResult(),
        }),

        resetCurrentEventRules: assign({
            currentEventRuleResults: () => createEmptyProgramRuleResult(),
        }),
        resetChildEventRules: assign({
            childEventRuleResults: () => createEmptyProgramRuleResult(),
        }),

        setModalCreating: assign({
            modalState: () => "creating" as const,
        }),

        setModalViewing: assign({
            modalState: () => "viewing" as const,
        }),

        setModalEditing: assign({
            modalState: () => "editing" as const,
        }),

        setModalClosed: assign({
            modalState: () => "closed" as const,
        }),

        persistTrackedEntity: async ({ context }) => {
            if (context.trackedEntity?.trackedEntity) {
                await saveTrackedEntity(context.trackedEntity);
            }
        },

        persistEvent: async ({ event }) => {
            if (event.type === "CREATE_OR_UPDATE_EVENT" && event.event?.event) {
                await saveEvent(event.event);
            }
        },

        persistTrackedEntities: async ({ context }) => {
            if (context.trackedEntities.length > 0) {
                await bulkSaveTrackedEntities(context.trackedEntities);
            }
        },

        queueTrackedEntitySync: async ({ context }) => {
            if (context.syncManager && context.trackedEntity?.trackedEntity) {
                await context.syncManager.queueCreateTrackedEntity(
                    context.trackedEntity,
                    8,
                );
            }
        },

        queueEventSync: async ({ context, event }) => {
            if (
                context.syncManager &&
                event.type === "CREATE_OR_UPDATE_EVENT" &&
                event.event?.event
            ) {
                const enrollment = context.trackedEntity?.enrollment;
                const eventToSync = {
                    ...event.event,
                    orgUnit:
                        event.event.orgUnit ||
                        enrollment?.orgUnit ||
                        context.orgUnit,
                    enrollment:
                        event.event.enrollment || enrollment?.enrollment,
                    program: "ueBhWkWll5v",
                    trackedEntity:
                        event.event.trackedEntity ||
                        context.trackedEntity?.trackedEntity,
                };

                await context.syncManager.queueCreateEvent(eventToSync, 7);
            }
        },
        queueAllEventsSync: async ({ context }) => {
            if (!context.syncManager || context.eventUpdates.length === 0) {
                return;
            }
            const enrollment = context.trackedEntity?.enrollment;
            for (const eventId of context.eventUpdates) {
                const eventToSync = context.trackedEntity.events.find(
                    (e) => e.event === eventId,
                );

                if (eventToSync) {
                    const completeEvent = {
                        ...eventToSync,
                        orgUnit:
                            eventToSync.orgUnit ||
                            enrollment?.orgUnit ||
                            context.orgUnit,
                        enrollment:
                            eventToSync.enrollment || enrollment?.enrollment,
                        program: eventToSync.program || "ueBhWkWll5v",
                        trackedEntity:
                            eventToSync.trackedEntity ||
                            context.trackedEntity?.trackedEntity,
                    };

                    await context.syncManager.queueCreateEvent(
                        completeEvent,
                        7,
                    );
                    console.log(`  ✅ Queued event ${eventId} for sync`);
                }
            }

            console.log("📤 All events queued successfully");
        },

        persistAndQueueTrackedEntity: async ({ context }) => {
            if (!context.trackedEntity?.trackedEntity) {
                return;
            }
            await saveTrackedEntity(context.trackedEntity);
            console.log(
                "💾 Persisted tracked entity to IndexedDB:",
                context.trackedEntity.trackedEntity,
            );

            if (context.syncManager) {
                await context.syncManager.queueCreateTrackedEntity(
                    context.trackedEntity,
                    8,
                );
            }
        },

        executeProgramRules: assign(({ event, context }) => {
            if (event.type !== "EXECUTE_PROGRAM_RULES") {
                return {};
            }
            const results = executeProgramRules({
                programRules: event.programRules,
                programRuleVariables: event.programRuleVariables,
                dataValues: event.dataValues,
                attributeValues: event.attributeValues,
                programStage: event.programStage,
                program: "ueBhWkWll5v",
                enrollment: event.enrollment,
            });
            return {
                [event.ruleResultKey]: results,
                [event.ruleResultUpdateKey]: {
                    ...context[event.ruleResultUpdateKey],
                    [event.updateKey]: {
                        ...context[event.ruleResultUpdateKey][event.updateKey],
                        ...results.assignments,
                    },
                },
            };
        }),

        // Notification actions
        showSuccessNotification: ({ event, context: { message } }) => {
            if (event.type === "CREATE_TRACKED_ENTITY") {
                message.success({
                    content: "Patient registered successfully!",
                    duration: 3,
                });
            } else if (event.type === "CREATE_OR_UPDATE_EVENT") {
                message.success({
                    content: "Visit record saved successfully!",
                    duration: 3,
                });
            } else if (event.type === "SAVE_EVENTS") {
                message.success({
                    content: "Events saved successfully!",
                    duration: 3,
                });
            }
        },

        showErrorNotification: ({ context: { error, message } }) => {
            message.error({
                content: error || "An error occurred. Please try again.",
                duration: 5,
            });
        },

        showSavingNotification: ({ context: { message } }) => {
            message.loading({
                content: "Saving...",
                duration: 2,
            });
        },
    },
}).createMachine({
    id: "tracker",
    initial: "initial",
    context: ({
        input: { engine, navigate, orgUnit, syncManager, message },
    }) => {
        const defaultOrgUnit = orgUnit.id;
        return {
            trackedEntities: [],
            engine,
            navigate,
            orgUnit,
            trackedEntity: createEmptyTrackedEntity({
                orgUnit: defaultOrgUnit,
            }),
            childTrackedEntity: createEmptyTrackedEntity({
                orgUnit: defaultOrgUnit,
            }),
            currentEvent: createEmptyEvent({
                orgUnit: defaultOrgUnit,
                program: "ueBhWkWll5v",
                trackedEntity: "",
                enrollment: "",
                programStage: "K2nxbE9ubSs",
            }),
            mainEvent: createEmptyEvent({
                orgUnit: defaultOrgUnit,
                program: "ueBhWkWll5v",
                trackedEntity: "",
                enrollment: "",
                programStage: "K2nxbE9ubSs",
            }),
            childEvent: createEmptyEvent({
                orgUnit: defaultOrgUnit,
                program: "ueBhWkWll5v",
                trackedEntity: "",
                enrollment: "",
                programStage: "K2nxbE9ubSs",
            }),
            trackedEntityId: "",
            // Initialize separate rule results for each context
            registrationRuleResults: createEmptyProgramRuleResult(),
            childRegistrationRuleResults: createEmptyProgramRuleResult(),
            mainEventRuleResults: createEmptyProgramRuleResult(),
            currentEventRuleResults: createEmptyProgramRuleResult(),
            childEventRuleResults: createEmptyProgramRuleResult(),
            eventUpdates: [],
            search: {
                pagination: { current: 1, pageSize: 10, total: 0 },
                filters: {},
            },
            modalState: "closed",
            syncManager,
            message,
        };
    },
    states: {
        initial: {
            entry: "gotoEntities",
            on: {
                SEARCH: {
                    target: "loading",
                    actions: assign({
                        search: ({ event }) => event.search,
                    }),
                },
                SET_TRACKED_ENTITY: {
                    target: "entitySuccess",
                    actions: [
                        assign({
                            trackedEntity: ({ event }) => event.trackedEntity,
                            trackedEntityId: ({ event }) =>
                                event.trackedEntity.trackedEntity,
                        }),
                    ],
                },

                CREATE_TRACKED_ENTITY: {
                    target: "saveTrackedEntity",
                    actions: [
                        assign({
                            trackedEntity: ({ event }) => event.trackedEntity,
                            trackedEntityId: ({ event }) =>
                                event.trackedEntity.trackedEntity,
                            trackedEntities: ({ context, event }) => [
                                event.trackedEntity,
                                ...context.trackedEntities,
                            ],
                        }),
                        // "persistTrackedEntity",
                        // "queueTrackedEntitySync",
                    ],
                },
                EXECUTE_PROGRAM_RULES: {
                    actions: "executeProgramRules",
                },
                RESET_MAIN_EVENT: {
                    actions: ["resetMainEvent", "resetMainEventRules"],
                },
                RESET_CURRENT_EVENT: {
                    actions: ["resetCurrentEvent", "resetCurrentEventRules"],
                },

                RESET_PROGRAM_RULES: {
                    actions: "resetAllProgramRules",
                },
                TOGGLE_ATTRIBUTE_COLUMN: {
                    // actions: assign({
                    //     attributes: ({ context, event }) => {
                    //         return context.attributes.map((attr) => {
                    //             if (attr.id === event.attributeId) {
                    //                 return {
                    //                     ...attr,
                    //                     displayInList: !attr.displayInList,
                    //                 };
                    //             }
                    //             return attr;
                    //         });
                    //     },
                    // }),
                },
                RESET_TRACKED_ENTITY: {
                    actions: [
                        assign({
                            trackedEntity: ({ context }) =>
                                createEmptyTrackedEntity({
                                    orgUnit: context.orgUnit.id,
                                }),
                        }),
                        "resetRegistrationRules", // Reset rules when creating new patient
                    ],
                },
            },
        },
        loading: {
            entry: "resetTrackedEntities",
            invoke: {
                src: "fetchTrackedEntities",
                input: ({ context: { engine, orgUnit, search } }) => {
                    return {
                        engine,
                        orgUnits: orgUnit.id,
                        search,
                    };
                },
                onDone: {
                    target: "initial",
                    actions: [
                        assign({
                            search: ({ context }) => ({
                                ...context.search,
                                pagination: {
                                    ...context.search.pagination,
                                },
                            }),
                            trackedEntities: ({ event }) => event.output,
                        }),
                        "persistTrackedEntities",
                    ],
                },
                onError: {
                    actions: assign({
                        error: ({ event }) =>
                            event.error instanceof Error
                                ? event.error.message
                                : String(event.error),
                    }),
                },
            },
        },
        entitySuccess: {
            entry: "gotoEntity",
            on: {
                GO_BACK: {
                    target: "initial",
                },
                EVALUATE_REGISTRATION_RULES: {
                    actions: ["evaluateRegistrationRules"],
                },
                EVALUATE_EVENT_RULES: {
                    actions: ["evaluateEventRules"],
                },
                EXECUTE_PROGRAM_RULES: {
                    actions: "executeProgramRules",
                },
                RESET_MAIN_EVENT: {
                    actions: ["resetMainEvent", "resetMainEventRules"],
                },
                RESET_CURRENT_EVENT: {
                    actions: ["resetCurrentEvent", "resetCurrentEventRules"],
                },
                RESET_PROGRAM_RULES: {
                    actions: "resetAllProgramRules",
                },
                CREATE_TRACKED_CHILD_ENTITY: {
                    target: "saveChildTrackedEntity",
                },
                CREATE_RELATIONSHIP: {
                    target: "saveRelationship",
                },
                RESET_TRACKED_ENTITY: {
                    actions: [
                        assign({
                            trackedEntity: ({ context }) =>
                                createEmptyTrackedEntity({
                                    orgUnit: context.orgUnit.id,
                                }),
                        }),
                        "resetRegistrationRules",
                    ],
                },
                RESET_CHILD_ENTITY: {
                    actions: [
                        assign({
                            childTrackedEntity: ({ context }) =>
                                createEmptyTrackedEntity({
                                    orgUnit: context.orgUnit.id,
                                }),
                        }),
                        "resetChildRegistrationRules",
                    ],
                },
                SET_CURRENT_EVENT: {
                    actions: [
                        assign({
                            currentEvent: ({ event }) => {
                                return event.currentEvent;
                            },
                        }),
                        "resetCurrentEventRules",
                    ],
                },
                SET_CHILD_EVENT: {
                    actions: [
                        assign({
                            childEvent: ({ event }) => {
                                return event.childEvent;
                            },
                        }),
                        "resetChildEventRules",
                    ],
                },
                SET_MAIN_EVENT: {
                    actions: [
                        assign({
                            mainEvent: ({ event }) => {
                                return event.mainEvent;
                            },
                        }),
                        "resetMainEventRules",
                    ],
                },

                ADD_EVENT_UPDATE: {
                    actions: assign({
                        eventUpdates: ({ context, event }) => {
                            return [...context.eventUpdates, event.id];
                        },
                    }),
                },

                CREATE_OR_UPDATE_EVENT: {
                    actions: [
                        assign({
                            trackedEntity: ({ context, event }) => {
                                const search =
                                    context.trackedEntity.events.find(
                                        (e) => e.event === event.event.event,
                                    );
                                if (search === undefined) {
                                    return {
                                        ...context.trackedEntity,
                                        events: [
                                            ...context.trackedEntity.events,
                                            event.event,
                                        ],
                                    };
                                } else {
                                    return {
                                        ...context.trackedEntity,
                                        events: context.trackedEntity.events.map(
                                            (e) =>
                                                e.event === event.event.event
                                                    ? event.event
                                                    : e,
                                        ),
                                    };
                                }
                            },
                            eventUpdates: ({ context, event }) => {
                                return [
                                    ...context.eventUpdates,
                                    event.event.event,
                                ];
                            },
                        }),
                    ],
                },
                SAVE_EVENTS: "optimisticUpdate",
            },
        },
        saveTrackedEntity: {
            entry: "showSavingNotification",
            invoke: {
                src: "createOrUpdateTrackedEntity",
                input: ({ context: { syncManager, trackedEntity } }) => {
                    return { syncManager, trackedEntity };
                },
                onDone: {
                    target: "entitySuccess",
                    actions: [
                        assign({
                            trackedEntity: ({ event }) => event.output,
                            eventUpdates: () => [],
                        }),
                        "showSuccessNotification",
                        "gotoEntity",
                    ],
                },
                onError: {
                    actions: [
                        assign({
                            error: ({ event }) =>
                                event.error instanceof Error
                                    ? event.error.message
                                    : String(event.error),
                        }),
                        "showErrorNotification",
                    ],
                },
            },
        },

        saveChildTrackedEntity: {
            entry: "showSavingNotification",
            invoke: {
                src: "createOrUpdateTrackedEntity",
                input: ({ context: { syncManager }, event }) => {
                    assertEvent(event, "CREATE_TRACKED_CHILD_ENTITY");
                    return {
                        syncManager,
                        trackedEntity: event.trackedEntity,
                    };
                },
                onDone: {
                    actions: "showSuccessNotification",
                },
                onError: {
                    actions: [
                        assign({
                            error: ({ event }) =>
                                event.error instanceof Error
                                    ? event.error.message
                                    : String(event.error),
                        }),
                        "showErrorNotification",
                    ],
                },
            },
        },
        saveRelationship: {
            entry: "showSavingNotification",
            invoke: {
                src: "createRelationship",
                input: ({ context: { syncManager }, event }) => {
                    assertEvent(event, "CREATE_RELATIONSHIP");
                    return {
                        syncManager,
                        relationship: event.relationship,
                    };
                },
                onDone: {
                    actions: "showSuccessNotification",
                },
                onError: {
                    actions: [
                        assign({
                            error: ({ event }) =>
                                event.error instanceof Error
                                    ? event.error.message
                                    : String(event.error),
                        }),
                        "showErrorNotification",
                    ],
                },
            },
        },

        optimisticUpdate: {
            entry: "showSavingNotification",
            invoke: {
                src: "createOrUpdateEvents",
                input: ({
                    context: { syncManager, trackedEntity, eventUpdates },
                }) => {
                    return {
                        syncManager,
                        events: trackedEntity.events.filter((event) =>
                            eventUpdates.includes(event.event),
                        ),
                    };
                },
                onDone: {
                    target: "entitySuccess",
                    actions: [
                        assign({
                            eventUpdates: () => [],
                        }),
                        "showSuccessNotification",
                    ],
                },
                onError: {
                    actions: [
                        assign({
                            error: ({ event }) =>
                                event.error instanceof Error
                                    ? event.error.message
                                    : String(event.error),
                        }),
                        "showErrorNotification",
                    ],
                },
            },

            on: {
                SET_CURRENT_EVENT: {
                    actions: assign({
                        currentEvent: ({ event }) => {
                            return event.currentEvent;
                        },
                    }),
                },
            },
        },
        failure: {
            on: {
                RETRY: "loading",
            },
        },
    },
});

export const TrackerContext = createActorContext(trackerMachine);
