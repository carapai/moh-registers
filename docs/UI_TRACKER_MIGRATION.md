# UI Tracker Machine Migration Guide

## Overview

This guide shows how to migrate from the data-heavy `trackerMachine` to the UI-only `uiTrackerMachine` combined with Dexie hooks.

## Architecture Comparison

### Before: Data-Heavy XState Machine

```typescript
// tracker.ts - 1,178 lines
interface TrackerContext {
    // ❌ Full data objects
    trackedEntity: FlattenedTrackedEntity;
    childTrackedEntity: FlattenedTrackedEntity;
    trackedEntities: FlattenedTrackedEntity[];
    currentEvent: FlattenedEvent;
    mainEvent: FlattenedEvent;
    childEvent: FlattenedEvent;

    // ❌ Program rule results
    registrationRuleResults: ProgramRuleResult;
    childRegistrationRuleResults: ProgramRuleResult;
    mainEventRuleResults: ProgramRuleResult;
    currentEventRuleResults: ProgramRuleResult;
    childEventRuleResults: ProgramRuleResult;

    // ✅ UI state (should keep)
    modalState: "closed" | "creating" | "viewing" | "editing";
    search: OnChange;
    error?: string;

    // Dependencies
    engine: ReturnType<typeof useDataEngine>;
    navigate: UseNavigateResult<"/">;
    orgUnit: OrgUnit;
    syncManager?: SyncManager;
    message: MessageInstance;
}
```

**Problems**:
- Duplicates data already in Dexie
- Requires manual sync operations
- Complex event handling for data updates
- Tight coupling between UI and data logic
- 1,178 lines of complex state management

### After: UI-Only Machine + Dexie Hooks

```typescript
// ui-tracker.ts - 250 lines
interface UITrackerContext {
    // ✅ Only entity IDs (not full objects)
    selectedTrackedEntityId: string | null;
    selectedMainEventId: string | null;
    selectedCurrentEventId: string | null;
    selectedChildEntityId: string | null;

    // ✅ UI State
    isVisitModalOpen: boolean;
    isChildModalOpen: boolean;
    isLoading: boolean;
    currentView: "list" | "detail" | "calendar";
    searchFilters: Record<string, any>;
    error: string | null;

    // ✅ Dependencies
    navigate: UseNavigateResult<"/">;
    message: MessageInstance;
    orgUnitId: string;
}
```

**Benefits**:
- 78% reduction in code (250 vs 1,178 lines)
- Single source of truth (Dexie)
- Automatic syncing via hooks
- Clear separation of concerns
- Simpler mental model

## Migration Example: Tracked Entity Route

### Before: Using trackerMachine

```typescript
// tracked-entity.tsx (OLD)
function TrackedEntity() {
    const trackerActor = TrackerContext.useActorRef();

    // ❌ Get full object from XState
    const trackedEntity = TrackerContext.useSelector(
        (state) => state.context.trackedEntity,
    );

    // ❌ Get events from XState context
    const { enrollment, events, mainEvent, ruleResult } =
        useTrackerState("K2nxbE9ubSs");

    const showVisitModal = (visit: FlattenedEvent) => {
        visitForm.resetFields();
        // ❌ Update XState with full event object
        trackerActor.send({ type: "SET_MAIN_EVENT", mainEvent: visit });
        setModalKey(visit.event);
        setIsVisitModalOpen(true);
    };

    const onVisitSubmit = async (values: Record<string, any>) => {
        const event: FlattenedEvent = {
            ...mainEvent,
            occurredAt,
            dataValues: { ...mainEvent.dataValues, ...finalValues },
        };

        // ❌ Send event to XState
        trackerActor.send({
            type: "CREATE_OR_UPDATE_EVENT",
            event,
        });

        // ❌ Manual save trigger
        trackerActor.send({ type: "SAVE_EVENTS" });

        message.success("Visit record saved successfully!");
        visitForm.resetFields();
        // ❌ Reset XState event
        trackerActor.send({ type: "RESET_MAIN_EVENT" });
        setIsVisitModalOpen(false);
    };

    return (
        <Modal
            open={isVisitModalOpen}
            onCancel={handleModalClose}
        >
            <Form
                form={visitForm}
                onFinish={onVisitSubmit}
                initialValues={{
                    ...mainEvent.dataValues,
                    occurredAt: mainEvent.occurredAt,
                }}
            >
                {/* Form fields */}
            </Form>
        </Modal>
    );
}
```

### After: Using uiTrackerMachine + Dexie Hooks

```typescript
// tracked-entity.tsx (NEW)
import { UITrackerContext } from "../machines/ui-tracker";
import { useDexieTrackedEntityForm } from "../hooks/useDexieTrackedEntityForm";
import { useDexieEventForm } from "../hooks/useDexieEventForm";

function TrackedEntity() {
    const { trackedEntity: params } = TrackedEntityRoute.useParams();
    const uiActor = UITrackerContext.useActorRef();

    // ✅ Get UI state from machine
    const isVisitModalOpen = UITrackerContext.useSelector(
        (state) => state.context.isVisitModalOpen
    );
    const selectedMainEventId = UITrackerContext.useSelector(
        (state) => state.context.selectedMainEventId
    );

    // ✅ Get data from Dexie (reactive)
    const { trackedEntity, loading: entityLoading } = useDexieTrackedEntityForm({
        trackedEntityId: params,
    });

    // ✅ Get event data from Dexie (reactive)
    const {
        event: mainEvent,
        updateDataValue,
        updateDataValues,
        syncStatus
    } = useDexieEventForm({
        eventId: selectedMainEventId || "",
        form: visitForm,
    });

    const showVisitModal = (visitId: string) => {
        visitForm.resetFields();
        // ✅ Only update UI state with ID
        uiActor.send({
            type: "OPEN_VISIT_MODAL",
            eventId: visitId
        });
    };

    const onVisitSubmit = async (values: Record<string, any>) => {
        try {
            const { occurredAt, ...dataValues } = values;

            // ✅ Direct write to Dexie - automatic sync
            await updateDataValues({
                ...dataValues,
                occurredAt,
            });

            uiActor.send({ type: "CLOSE_VISIT_MODAL" });

            // ✅ Use UI machine for notifications
            message.success("Visit record saved successfully!");
            visitForm.resetFields();
        } catch (error) {
            uiActor.send({
                type: "SET_ERROR",
                error: error.message
            });
            message.error("Failed to save visit record");
        }
    };

    const handleModalClose = () => {
        // ✅ Only update UI state
        uiActor.send({ type: "CLOSE_VISIT_MODAL" });
        visitForm.resetFields();
    };

    if (entityLoading) {
        return <Spin />;
    }

    return (
        <Modal
            open={isVisitModalOpen}
            onCancel={handleModalClose}
        >
            <Form
                form={visitForm}
                onFinish={onVisitSubmit}
                initialValues={mainEvent?.dataValues || {}}
            >
                {/* Form fields */}

                {/* ✅ Show sync status from Dexie */}
                <div>Sync Status: {syncStatus}</div>
            </Form>
        </Modal>
    );
}
```

## Key Changes Summary

### Data Management

| Before (trackerMachine) | After (uiTrackerMachine + Dexie) |
|------------------------|----------------------------------|
| `context.trackedEntity` (full object) | `useDexieTrackedEntityForm({ entityId })` |
| `context.currentEvent` (full object) | `useDexieEventForm({ eventId })` |
| `trackerActor.send({ type: "SET_TRACKED_ENTITY" })` | Just update `selectedTrackedEntityId` |
| `trackerActor.send({ type: "CREATE_OR_UPDATE_EVENT" })` | `updateDataValues(values)` |
| `trackerActor.send({ type: "SAVE_EVENTS" })` | Automatic via Dexie hooks |
| Manual sync queueing | Automatic via Dexie hooks |

### UI State Management

| Before | After |
|--------|-------|
| `modalState: "closed" \| "creating" \| "viewing" \| "editing"` | `isVisitModalOpen: boolean` |
| Complex state transitions | Simple boolean toggles |
| `trackerActor.send({ type: "RESET_MAIN_EVENT" })` | `uiActor.send({ type: "CLOSE_VISIT_MODAL" })` |

## Migration Checklist

### Per Component

- [ ] Import `UITrackerContext` instead of `TrackerContext`
- [ ] Replace `TrackerContext.useSelector()` with appropriate Dexie hook
- [ ] Update event handlers to use Dexie hook methods
- [ ] Change XState events to UI-only events
- [ ] Remove manual save/sync calls
- [ ] Update prop types (pass IDs instead of objects)
- [ ] Test offline functionality
- [ ] Verify sync status displays correctly

### Example Conversions

#### Modal State

```typescript
// Before
const modalState = TrackerContext.useSelector(
    (state) => state.context.modalState
);
const isOpen = modalState === "viewing";

// After
const isVisitModalOpen = UITrackerContext.useSelector(
    (state) => state.context.isVisitModalOpen
);
```

#### Entity Selection

```typescript
// Before
trackerActor.send({
    type: "SET_TRACKED_ENTITY",
    trackedEntity: fullEntityObject,
});

// After
uiActor.send({
    type: "SET_SELECTED_ENTITY",
    entityId: entity.trackedEntity,
});
```

#### Form Submission

```typescript
// Before
trackerActor.send({
    type: "CREATE_OR_UPDATE_EVENT",
    event: fullEventObject,
});
trackerActor.send({ type: "SAVE_EVENTS" });

// After
await updateDataValues(values);
// That's it! Sync happens automatically
```

## Benefits After Migration

### Developer Experience

1. **Simpler API**:
   - No complex state machine events
   - Intuitive Dexie hook methods
   - Clear separation of concerns

2. **Less Boilerplate**:
   - 78% less state management code
   - No manual sync operations
   - No event object construction

3. **Better TypeScript**:
   - Full type inference from Dexie
   - Compile-time safety
   - Better autocomplete

### Performance

1. **Reduced Re-renders**:
   - Components only re-render when their specific data changes
   - No global state updates

2. **Optimized Writes**:
   - Batched updates (500ms debounce)
   - Single write path
   - Transaction-safe

3. **Better Caching**:
   - Dexie handles caching
   - No duplicate data

### Maintenance

1. **Single Source of Truth**:
   - All data in Dexie
   - UI state in machine
   - No synchronization issues

2. **Easier Testing**:
   - Mock Dexie directly
   - Test UI state separately
   - Clear boundaries

3. **Simpler Debugging**:
   - Check Dexie with browser tools
   - UI state is minimal
   - Clear data flow

## Troubleshooting

### Issue: "Cannot find entity data"

**Problem**: Component expects data from TrackerContext

**Solution**: Use Dexie hook instead
```typescript
// Before
const entity = TrackerContext.useSelector(state => state.context.trackedEntity);

// After
const { trackedEntity } = useDexieTrackedEntityForm({
    trackedEntityId: selectedId
});
```

### Issue: "Modal not opening"

**Problem**: Modal state not updated correctly

**Solution**: Use UI machine events
```typescript
// Before
trackerActor.send({ type: "SET_MAIN_EVENT", mainEvent: event });

// After
uiActor.send({ type: "OPEN_VISIT_MODAL", eventId: event.event });
```

### Issue: "Data not syncing"

**Problem**: Expecting manual sync call

**Solution**: Verify Dexie hooks are set up
```typescript
// Ensure SyncManager is initialized
const syncManager = createSyncManager(engine);
syncManager.startAutoSync();

// Use Dexie hook methods (sync happens automatically)
await updateDataValues(values);
```

## Next Steps

1. Start with one component (e.g., tracked-entity.tsx)
2. Test thoroughly in offline and online modes
3. Migrate remaining components
4. Remove old trackerMachine once all migrated
5. Update tests
6. Update documentation

## Additional Resources

- [XSTATE_TO_DEXIE_MIGRATION.md](./XSTATE_TO_DEXIE_MIGRATION.md) - Overall migration strategy
- [DEXIE_FORM_INTEGRATION.md](./DEXIE_FORM_INTEGRATION.md) - Dexie hook usage
- [ui-tracker.ts](../src/machines/ui-tracker.ts) - New UI-only machine
- [tracker.ts](../src/machines/tracker.ts) - Old machine (for reference)
