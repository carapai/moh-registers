import { ProgramTrackedEntityAttribute } from "./../../.d2/shell/src/D2App/schemas";
import { useDataEngine } from "@dhis2/app-runtime";
import { createActorContext } from "@xstate/react";
import { assign, fromPromise, setup } from "xstate";
import { queryClient } from "../query-client";
import {
    createEmptyEvent,
    createEmptyTrackedEntity,
    flattenTrackedEntity,
    flattenTrackedEntityResponse,
} from "../utils/utils";
import { resourceQueryOptions } from "../query-options";
import {
    OnChange,
    OrgUnit,
    TrackedEntity,
    TrackedEntityResponse,
} from "../schemas";
import { UseNavigateResult } from "@tanstack/react-router";
import { isEmpty } from "lodash";

interface TrackerContext {
    trackedEntities: ReturnType<typeof flattenTrackedEntityResponse>;
    trackedEntity: ReturnType<typeof flattenTrackedEntity>;
    trackedEntityId?: string;
    error?: string;
    engine: ReturnType<typeof useDataEngine>;
    navigate: UseNavigateResult<"/">;
    organisationUnits: OrgUnit[];
    currentEvent: ReturnType<typeof flattenTrackedEntity>["events"][number];
    mainEvent: ReturnType<typeof flattenTrackedEntity>["events"][number];
    orgUnit: string;
    programTrackedEntityAttributes: ProgramTrackedEntityAttribute[];
    eventUpdates: string[];
    search: OnChange;
}

type TrackerEvents =
    | { type: "RETRY" }
    | { type: "GO_BACK" }
    | {
          type: "CREATE_TRACKED_ENTITY";
      }
    | {
          type: "SET_TRACKED_ENTITIES";
          trackedEntities: ReturnType<typeof flattenTrackedEntityResponse>;
      }
    | {
          type: "SET_TRACKED_ENTITY_ID";
          trackedEntityId: string;
      }
    | {
          type: "CREATE_OR_UPDATE_EVENT";
          event: ReturnType<typeof flattenTrackedEntity>["events"][number];
      }
    | { type: "FETCH_NEXT_PAGE"; search: OnChange }
    | {
          type: "SET_ORG_UNIT";
          orgUnit: string;
      }
    | {
          type: "SET_CURRENT_EVENT";
          currentEvent: ReturnType<
              typeof flattenTrackedEntity
          >["events"][number];
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
          type: "SAVE_EVENTS";
      }
    | {
          type: "SET_MAIN_EVENT";
          mainEvent: ReturnType<typeof flattenTrackedEntity>["events"][number];
      }
    | {
          type: "SET_TRACKED_ENTITY";
          trackedEntity: ReturnType<typeof flattenTrackedEntity>;
      };
export const trackerMachine = setup({
    types: {
        context: {} as TrackerContext,
        events: {} as TrackerEvents,
        input: {} as {
            engine: ReturnType<typeof useDataEngine>;
            navigate: UseNavigateResult<"/">;
            organisationUnits: OrgUnit[];
            programTrackedEntityAttributes: ProgramTrackedEntityAttribute[];
        },
    },
    actors: {
        fetchTrackedEntities: fromPromise<
            {
                instances: ReturnType<typeof flattenTrackedEntityResponse>;
                total: number;
            },
            {
                engine: ReturnType<typeof useDataEngine>;
                orgUnits: string;
                search: OnChange;
            }
        >(async ({ input: { engine, orgUnits, search } }) => {
            const params = new URLSearchParams({
                pageSize: `${search.pagination.pageSize || 10}`,
                page: `${search.pagination.current || 1}`,
                totalPages: "true",
                program: "ueBhWkWll5v",
                orgUnitMode: "SELECTED",
                orgUnits,
                order: "updatedAt:DESC",
                fields: "trackedEntity,orgUnit,createdAt,updatedAt,inactive,attributes,enrollments[enrolledAt,occurredAt,status],programOwners",
            });

            for (const [filterKey, filterValues] of Object.entries(
                search?.filters || {},
            )) {
                if (filterValues && filterValues.length > 0) {
                    params.append(
                        `filter`,
                        `${filterKey}:eq:${filterValues[0]}`,
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
            return {
                instances: flattenTrackedEntityResponse(data),
                total: data.pager.total,
            };
        }),
        fetchTrackedEntity: fromPromise<
            ReturnType<typeof flattenTrackedEntity>,
            {
                engine: ReturnType<typeof useDataEngine>;
                trackedEntity: string;
            }
        >(async ({ input: { engine, trackedEntity } }) => {
            const data = await queryClient.fetchQuery(
                resourceQueryOptions<TrackedEntity>({
                    engine,
                    resource: "tracker/trackedEntities",
                    id: trackedEntity,
                    params: {
                        program: "ueBhWkWll5v",
                        fields: "*",
                    },
                }),
            );
            return flattenTrackedEntity(data);
        }),
        createOrUpdateEvents: fromPromise<
            void,
            {
                engine: ReturnType<typeof useDataEngine>;
                events: ReturnType<typeof flattenTrackedEntity>["events"];
            }
        >(async ({ input: { engine, events } }) => {
            const allEvents = events.map(({ dataValues, ...event }) => {
                return {
                    ...event,
                    dataValues: Object.entries(dataValues).flatMap(
                        ([dataElement, value]) => {
                            if (!isEmpty(value)) {
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
            const response = await engine.mutate({
                resource: "tracker",
                type: "create",
                data: { events: allEvents },
                params: { async: false },
            });
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
    },
}).createMachine({
    id: "tracker",
    initial: "loading",
    context: ({
        input: {
            engine,
            navigate,
            organisationUnits,
            programTrackedEntityAttributes,
        },
    }) => {
        return {
            trackedEntities: [],
            engine,
            navigate,
            organisationUnits,
            trackedEntity: createEmptyTrackedEntity({ orgUnit: "" }),
            currentEvent: createEmptyEvent({
                orgUnit: "",
                program: "",
                trackedEntity: "",
                enrollment: "",
                programStage: "K2nxbE9ubSs",
            }),
            mainEvent: createEmptyEvent({
                orgUnit: "",
                program: "",
                trackedEntity: "",
                enrollment: "",
                programStage: "K2nxbE9ubSs",
            }),
            trackedEntityId: "",
            programTrackedEntityAttributes,
            orgUnit: organisationUnits[0]?.id || "",
            eventUpdates: [],
            search: {
                pagination: { current: 1, pageSize: 10, total: 0 },
                filters: {},
            },
        };
    },
    states: {
        loading: {
            entry: ["gotoEntities", "resetTrackedEntities"],
            invoke: {
                src: "fetchTrackedEntities",
                input: ({ context: { engine, orgUnit, search } }) => {
                    return {
                        engine,
                        orgUnits: orgUnit,
                        search,
                    };
                },
                onDone: {
                    target: "success",
                    actions: assign({
                        trackedEntities: ({ event }) => event.output.instances,
                        search: ({ event, context }) => ({
                            ...context.search,
                            pagination: {
                                ...context.search.pagination,
                                total: event.output.total,
                            },
                        }),
                    }),
                },
                onError: {
                    target: "failure",
                    actions: assign({
                        error: ({ event }) =>
                            event.error instanceof Error
                                ? event.error.message
                                : String(event.error),
                    }),
                },
            },
        },

        success: {
            on: {
                SET_TRACKED_ENTITY_ID: {
                    target: "loadingEntity",
                    actions: assign({
                        trackedEntityId: ({ event }) => event.trackedEntityId,
                    }),
                },
                SET_ORG_UNIT: {
                    target: "loading",
                    actions: assign({
                        orgUnit: ({ event }) => event.orgUnit,
                    }),
                },

                FETCH_NEXT_PAGE: {
                    target: "loading",
                    actions: assign({
                        search: ({ event }) => event.search,
                    }),
                },
                CREATE_TRACKED_ENTITY: {},
                TOGGLE_ATTRIBUTE_COLUMN: {
                    actions: assign({
                        programTrackedEntityAttributes: ({
                            context,
                            event,
                        }) => {
                            return context.programTrackedEntityAttributes.map(
                                (attr) => {
                                    if (attr.id === event.attributeId) {
                                        return {
                                            ...attr,
                                            displayInList: !attr.displayInList,
                                        };
                                    }
                                    return attr;
                                },
                            );
                        },
                    }),
                },
            },
        },
        loadingEntity: {
            entry: "gotoEntity",
            invoke: {
                src: "fetchTrackedEntity",
                input: ({ context: { engine, trackedEntityId } }) => {
                    return { engine, trackedEntity: trackedEntityId! };
                },
                onDone: {
                    target: "entitySuccess",
                    actions: assign({
                        trackedEntity: ({ event }) => event.output,
                    }),
                },
                onError: {
                    target: "failure",
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
            on: {
                GO_BACK: {
                    target: "loading",
                },
                SET_CURRENT_EVENT: {
                    actions: assign({
                        currentEvent: ({ event }) => {
                            return event.currentEvent;
                        },
                    }),
                },
                SET_MAIN_EVENT: {
                    actions: assign({
                        mainEvent: ({ event }) => {
                            return event.mainEvent;
                        },
                    }),
                },

                ADD_EVENT_UPDATE: {
                    actions: assign({
                        eventUpdates: ({ context, event }) => {
                            return [...context.eventUpdates, event.id];
                        },
                    }),
                },

                CREATE_OR_UPDATE_EVENT: {
                    actions: assign({
                        trackedEntity: ({ context, event }) => {
                            const search = context.trackedEntity.events.find(
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
                            return [...context.eventUpdates, event.event.event];
                        },
                    }),
                },
                SAVE_EVENTS: "optimisticUpdate",
            },
        },
        optimisticUpdate: {
            invoke: {
                src: "createOrUpdateEvents",
                input: ({
                    context: { engine, trackedEntity, eventUpdates },
                }) => {
                    return {
                        engine,
                        events: trackedEntity.events.filter((event) =>
                            eventUpdates.includes(event.event),
                        ),
                    };
                },
                onDone: {
                    target: "entitySuccess",
                },
                onError: {
                    target: "failure",
                    actions: assign({
                        error: ({ event }) =>
                            event.error instanceof Error
                                ? event.error.message
                                : String(event.error),
                    }),
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
