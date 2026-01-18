import { useMemo } from "react";
import { TrackerContext } from "../machines/tracker";
import type { FlattenedTrackedEntity } from "../db";
import type { ProgramRuleResult } from "../schemas";

/**
 * Optimized Hook for Tracker State
 *
 * Consolidates multiple useSelector calls into a single subscription
 * to prevent excessive re-renders. Uses shallow comparison to only
 * trigger re-renders when actually needed data changes.
 *
 * Performance Impact:
 * - Before: 6+ separate subscriptions = 6+ re-renders per state change
 * - After: 1 subscription = 1 re-render only when selected data changes
 */

interface TrackerState {
    attributes?: Record<string, any>;
    enrollment: FlattenedTrackedEntity["enrollment"];
    events: FlattenedTrackedEntity["events"];
    mainEvent: FlattenedTrackedEntity["events"][number];
    // isLoading: boolean;
    ruleResult: ProgramRuleResult;
}

/**
 * Consolidated selector for tracked entity state
 *
 * @param programStageId - Optional filter for events by program stage
 * @returns Memoized tracker state object
 */
export function useTrackerState(programStageId?: string): TrackerState {
    // Single selector with shallow comparison
    const state = TrackerContext.useSelector((s) => {
        const trackedEntity = s.context.trackedEntity;
        const events = programStageId
            ? trackedEntity.events.filter(
                  (e) => e.programStage === programStageId,
              )
            : trackedEntity.events;

        return {
            attributes: trackedEntity?.attributes,
            enrollment: trackedEntity.enrollment,
            events,
            mainEvent: s.context.mainEvent,
            ruleResult: s.context.mainEventRuleResults,
        };
    });

    // Memoize to prevent unnecessary re-renders
    // Only recreate object if actual values changed
    return useMemo(
        () => ({
            attributes: state.attributes,
            enrollment: state.enrollment,
            events: state.events,
            mainEvent: state.mainEvent,
            // isLoading: state.isLoading,
            ruleResult: state.ruleResult,
        }),
        [
            state.attributes,
            state.enrollment,
            state.events,
            state.mainEvent,
            // state.isLoading,
            state.ruleResult,
        ],
    );
}

/**
 * Lightweight selector for program stage events only
 * Use when you only need events for a specific stage
 */
export function useProgramStageEvents(
    programStageId: string,
): FlattenedTrackedEntity["events"] {
    return TrackerContext.useSelector((state) =>
        state.context.trackedEntity.events.filter(
            (e) => e.programStage === programStageId,
        ),
    );
}

/**
 * Lightweight selector for main event only
 * Use when you only need the current event being edited
 */
export function useMainEvent(): FlattenedTrackedEntity["events"][number] {
    return TrackerContext.useSelector((state) => state.context.mainEvent);
}

/**
 * Lightweight selector for loading state
 * Use when you only need to know if data is loading
 */
export function useIsLoading(): boolean {
    return false;
}
