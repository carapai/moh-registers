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
import { OrgUnit, TrackedEntity, TrackedEntityResponse } from "../schemas";
import { UseNavigateResult } from "@tanstack/react-router";

interface TrackerContext {
    trackedEntities: ReturnType<typeof flattenTrackedEntityResponse>;
    trackedEntity: ReturnType<typeof flattenTrackedEntity>;
    trackedEntityId?: string;
    error?: string;
    engine: ReturnType<typeof useDataEngine>;
    action: "CREATE" | "UPDATE";
    navigate: UseNavigateResult<"/">;
    organisationUnits: OrgUnit[];
    currentEvent: ReturnType<typeof flattenTrackedEntity>["events"][number];
    mainEvent: ReturnType<typeof flattenTrackedEntity>["events"][number];
}

type TrackerEvents =
    | { type: "RETRY" }
    | { type: "GO_BACK" }
    | {
          type: "CREATE_TRACKED_ENTITY";
      }
    | {
          type: "SET_ACTION";
          action: "CREATE" | "UPDATE";
      }
    | {
          type: "NEXT_ACTION";
          action: string;
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
    | {
          type: "SET_CURRENT_EVENT";
          currentEvent: ReturnType<
              typeof flattenTrackedEntity
          >["events"][number];
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
        },
    },
    actors: {
        fetchTrackedEntities: fromPromise<
            ReturnType<typeof flattenTrackedEntityResponse>,
            {
                engine: ReturnType<typeof useDataEngine>;
            }
        >(async ({ input: { engine } }) => {
            const data = await queryClient.fetchQuery(
                resourceQueryOptions<TrackedEntityResponse>({
                    engine,
                    resource: "tracker/trackedEntities",
                    params: {
                        program: "ueBhWkWll5v",
                        orgUnitMode: "SELECTED",
                        orgUnits: "FvewOonC8lS",
                    },
                }),
            );
            return flattenTrackedEntityResponse(data);
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
    },
}).createMachine({
    id: "tracker",
    initial: "loading",
    context: ({ input: { engine, navigate, organisationUnits } }) => {
        return {
            trackedEntities: [],
            engine,
            navigate,
            action: "CREATE",
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
        };
    },
    states: {
        loading: {
            entry: "gotoEntities",
            invoke: {
                src: "fetchTrackedEntities",
                input: ({ context: { engine } }) => {
                    return { engine };
                },
                onDone: {
                    target: "success",
                    actions: assign({
                        trackedEntities: ({ event }) => event.output,
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
                SET_ACTION: {
                    actions: assign({
                        action: ({ event }) => event.action,
                    }),
                },
                SET_TRACKED_ENTITY_ID: {
                    target: "loadingEntity",
                    actions: assign({
                        trackedEntityId: ({ event }) => event.trackedEntityId,
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
                CREATE_OR_UPDATE_EVENT: {
                    // target: "optimisticUpdate",
                    actions: assign({
                        trackedEntity: ({ context, event }) => {
                            if (context.action === "CREATE") {
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
                    }),
                },
            },
        },
        optimisticUpdate: {
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
