import { UseNavigateResult } from "@tanstack/react-router";
import { createActorContext } from "@xstate/react";
import { MessageInstance } from "antd/es/message/interface";
import { assign, setup } from "xstate";

/**
 * Simplified UI-Only Tracker Machine
 *
 * This machine handles ONLY UI orchestration:
 * - Modal states (open/closed)
 * - Loading states
 * - Navigation
 * - Selected entity/event IDs (not full objects)
 *
 * All data (tracked entities, events, relationships) should be managed by Dexie
 * and accessed via useDexieEventForm, useDexieTrackedEntityForm hooks.
 */

interface UITrackerContext {
    // Navigation & External Dependencies
    navigate: UseNavigateResult<"/">;
    message: MessageInstance;
    orgUnitId: string;

    // Selected Entity IDs (not full objects)
    selectedTrackedEntityId: string | null;
    selectedMainEventId: string | null;
    selectedCurrentEventId: string | null;
    selectedChildEntityId: string | null;

    // UI State
    isVisitModalOpen: boolean;
    isChildModalOpen: boolean;
    isLoading: boolean;
    currentView: "list" | "detail" | "calendar";

    // Search/Filter State (UI concern)
    searchFilters: Record<string, any>;

    // Error handling (UI concern)
    error: string | null;
}

type UITrackerEvents =
    | { type: "NAVIGATE_TO_LIST" }
    | { type: "NAVIGATE_TO_DETAIL"; entityId: string }
    | { type: "NAVIGATE_TO_CALENDAR" }
    | { type: "OPEN_VISIT_MODAL"; eventId?: string }
    | { type: "CLOSE_VISIT_MODAL" }
    | { type: "OPEN_CHILD_MODAL" }
    | { type: "CLOSE_CHILD_MODAL" }
    | { type: "SET_SELECTED_ENTITY"; entityId: string }
    | { type: "SET_SELECTED_EVENT"; eventId: string }
    | { type: "CLEAR_SELECTION" }
    | { type: "SET_SEARCH_FILTERS"; filters: Record<string, any> }
    | { type: "CLEAR_SEARCH_FILTERS" }
    | { type: "SET_LOADING"; isLoading: boolean }
    | { type: "SET_ERROR"; error: string }
    | { type: "CLEAR_ERROR" };

export const uiTrackerMachine = setup({
    types: {
        context: {} as UITrackerContext,
        events: {} as UITrackerEvents,
        input: {} as {
            navigate: UseNavigateResult<"/">;
            message: MessageInstance;
            orgUnitId: string;
        },
    },
    actions: {
        // Navigation actions
        navigateToList: ({ context }) => {
            context.navigate({ to: "/tracked-entities" });
        },
        navigateToDetail: ({ context }) => {
            if (context.selectedTrackedEntityId) {
                context.navigate({
                    to: "/tracked-entity/$trackedEntity",
                    params: {
                        trackedEntity: context.selectedTrackedEntityId,
                    },
                });
            }
        },

        // Notification actions
        showSuccessMessage: ({ context }, params: { message: string }) => {
            context.message.success({
                content: params.message,
                duration: 3,
            });
        },
        showErrorMessage: ({ context }, params: { message: string }) => {
            context.message.error({
                content: params.message,
                duration: 5,
            });
        },
        showLoadingMessage: ({ context }, params: { message: string }) => {
            context.message.loading({
                content: params.message,
                duration: 2,
            });
        },
    },
}).createMachine({
    id: "uiTracker",
    initial: "list",
    context: ({ input: { navigate, message, orgUnitId } }) => ({
        navigate,
        message,
        orgUnitId,
        selectedTrackedEntityId: null,
        selectedMainEventId: null,
        selectedCurrentEventId: null,
        selectedChildEntityId: null,
        isVisitModalOpen: false,
        isChildModalOpen: false,
        isLoading: false,
        currentView: "list" as const,
        searchFilters: {},
        error: null,
    }),
    states: {
        list: {
            entry: "navigateToList",
            on: {
                NAVIGATE_TO_DETAIL: {
                    target: "detail",
                    actions: assign({
                        selectedTrackedEntityId: ({ event }) => event.entityId,
                        currentView: () => "detail" as const,
                    }),
                },
                NAVIGATE_TO_CALENDAR: {
                    target: "calendar",
                    actions: assign({
                        currentView: () => "calendar" as const,
                    }),
                },
                SET_SEARCH_FILTERS: {
                    actions: assign({
                        searchFilters: ({ event }) => event.filters,
                    }),
                },
                CLEAR_SEARCH_FILTERS: {
                    actions: assign({
                        searchFilters: () => ({}),
                    }),
                },
                SET_LOADING: {
                    actions: assign({
                        isLoading: ({ event }) => event.isLoading,
                    }),
                },
            },
        },
        detail: {
            entry: "navigateToDetail",
            on: {
                NAVIGATE_TO_LIST: {
                    target: "list",
                    actions: assign({
                        currentView: () => "list" as const,
                        selectedTrackedEntityId: () => null,
                    }),
                },
                OPEN_VISIT_MODAL: {
                    actions: assign({
                        isVisitModalOpen: () => true,
                        selectedMainEventId: ({ event }) => event.eventId || null,
                    }),
                },
                CLOSE_VISIT_MODAL: {
                    actions: assign({
                        isVisitModalOpen: () => false,
                        selectedMainEventId: () => null,
                    }),
                },
                OPEN_CHILD_MODAL: {
                    actions: assign({
                        isChildModalOpen: () => true,
                    }),
                },
                CLOSE_CHILD_MODAL: {
                    actions: assign({
                        isChildModalOpen: () => false,
                        selectedChildEntityId: () => null,
                    }),
                },
                SET_SELECTED_EVENT: {
                    actions: assign({
                        selectedCurrentEventId: ({ event }) => event.eventId,
                    }),
                },
                SET_ERROR: {
                    actions: assign({
                        error: ({ event }) => event.error,
                    }),
                },
                CLEAR_ERROR: {
                    actions: assign({
                        error: () => null,
                    }),
                },
            },
        },
        calendar: {
            on: {
                NAVIGATE_TO_LIST: {
                    target: "list",
                    actions: assign({
                        currentView: () => "list" as const,
                    }),
                },
                NAVIGATE_TO_DETAIL: {
                    target: "detail",
                    actions: assign({
                        selectedTrackedEntityId: ({ event }) => event.entityId,
                        currentView: () => "detail" as const,
                    }),
                },
            },
        },
    },
    on: {
        // Global event handlers
        CLEAR_SELECTION: {
            actions: assign({
                selectedTrackedEntityId: () => null,
                selectedMainEventId: () => null,
                selectedCurrentEventId: () => null,
                selectedChildEntityId: () => null,
            }),
        },
    },
});

export const UITrackerContext = createActorContext(uiTrackerMachine);
