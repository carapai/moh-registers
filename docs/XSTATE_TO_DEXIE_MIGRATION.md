# XState to Dexie Migration Guide

## Overview

This guide explains how to migrate from XState-centered data management to Dexie-first architecture, where XState is used only for UI orchestration.

## Architecture Comparison

### Current Architecture (XState-Centered)
```
┌──────────────┐
│ Form Input   │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ XState       │ ← Stores ALL data (entities, events, UI state)
│ Context      │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ Manual Save  │ ← trackerActor.send({ type: "SAVE_EVENTS" })
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ Dexie        │
└──────────────┘
```

### New Architecture (Dexie-First)
```
┌──────────────┐
│ Form Input   │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ Dexie Hook   │ ← updateDataValue() - Automatic
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ Dexie        │ ← Single source of truth
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ DB Hooks     │ ← Auto-queue sync
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ Sync Queue   │
└──────────────┘

   ┌──────────────┐
   │ XState       │ ← ONLY UI state (modals, loading, navigation)
   │ (Optional)   │
   └──────────────┘
```

## Migration Strategy

### Phase 1: Gradual Adoption (Recommended)

Migrate one component at a time while keeping existing functionality working.

#### Step 1: Add Dexie Hooks Alongside Existing Code

**Before (XState only)**:
```typescript
// program-stage-capture.tsx
const currentEvent = TrackerContext.useSelector(
    (state) => state.context.currentEvent
);

const { triggerAutoSave } = useEventAutoSave({
    form: stageForm,
    event: currentEvent,
    trackerActor,
    ruleResult,
});
```

**After (Hybrid - both work)**:
```typescript
// program-stage-capture.tsx
const currentEvent = TrackerContext.useSelector(
    (state) => state.context.currentEvent
);

// NEW: Dexie hook (preferred)
const { event, updateDataValue, syncStatus } = useDexieEventForm({
    eventId: currentEvent.event,
    form: stageForm,
});

// OLD: Keep for now (will remove later)
const { triggerAutoSave } = useEventAutoSave({
    form: stageForm,
    event: currentEvent,
    trackerActor,
    ruleResult,
});

// Use NEW hook for new fields, OLD hook still works
const handleFieldChange = (dataElementId: string, value: any) => {
    // NEW way
    updateDataValue(dataElementId, value);

    // OLD way (keep until fully migrated)
    // triggerAutoSave(dataElementId, value);
};
```

#### Step 2: Update Components to Use Dexie Hooks

**Components to migrate** (in order of complexity):

1. ✅ Simple event forms (Labs, Pharmacy)
2. ✅ Program stage capture
3. ✅ Main event forms (ANC, PNC)
4. ✅ Tracked entity registration
5. ✅ Relationship forms

#### Step 3: Remove XState Data Storage

Once all components use Dexie hooks, simplify XState context:

**Before**:
```typescript
// tracker machine context
context: {
    trackedEntity: FlattenedTrackedEntity,  // ❌ Remove
    currentEvent: FlattenedEvent,           // ❌ Remove
    mainEvent: FlattenedEvent,              // ❌ Remove
    childEvent: FlattenedEvent,             // ❌ Remove
    isVisitModalOpen: boolean,              // ✅ Keep (UI state)
    isLoading: boolean,                     // ✅ Keep (UI state)
    currentView: string,                    // ✅ Keep (UI state)
}
```

**After**:
```typescript
// tracker machine context (UI only)
context: {
    // UI State only
    isVisitModalOpen: boolean,
    isLoading: boolean,
    currentView: string,
    currentEntityId: string,    // NEW: Just store IDs
    currentEventId: string,      // NEW: Just store IDs

    // Data comes from Dexie hooks
}
```

### Phase 2: Component-by-Component Migration

## Example: Migrating Program Stage Capture

### Current Implementation

```typescript
// program-stage-capture.tsx (BEFORE)
export const ProgramStageCapture = ({ programStage }: Props) => {
    const [stageForm] = Form.useForm();
    const trackerActor = TrackerContext.useActorRef();

    // Get event from XState
    const currentEvent = TrackerContext.useSelector(
        (state) => state.context.currentEvent
    );

    // Old auto-save hook
    const { triggerAutoSave, savingState } = useEventAutoSave({
        form: stageForm,
        event: currentEvent,
        trackerActor,
        ruleResult,
    });

    const handleFieldChange = (dataElementId: string, value: any) => {
        triggerAutoSave(dataElementId, value);
    };

    const onStageSubmit = (values: Record<string, any>) => {
        // Update XState
        trackerActor.send({
            type: "CREATE_OR_UPDATE_EVENT",
            event: { ...currentEvent, dataValues: values }
        });

        // Manual save to Dexie
        trackerActor.send({ type: "SAVE_EVENTS" });
    };

    return (
        <Form form={stageForm} initialValues={currentEvent.dataValues}>
            {/* form fields */}
        </Form>
    );
};
```

### New Implementation

```typescript
// program-stage-capture.tsx (AFTER)
export const ProgramStageCapture = ({ programStage, eventId }: Props) => {
    const [stageForm] = Form.useForm();

    // NEW: Get event from Dexie (reactive)
    const { event, updateDataValue, updateDataValues, syncStatus } =
        useDexieEventForm({
            eventId,
            form: stageForm, // Auto-syncs form with Dexie
        });

    const handleFieldChange = (dataElementId: string, value: any) => {
        // Automatic - writes to Dexie, triggers sync hook
        updateDataValue(dataElementId, value);
    };

    const onStageSubmit = async (values: Record<string, any>) => {
        // Immediate write to Dexie
        await updateDataValues(values);

        // Sync hook automatically queued
        // No XState needed!

        message.success("Saved successfully");
    };

    if (!event) return <Spin />;

    return (
        <Form form={stageForm} initialValues={event.dataValues}>
            <div>Sync Status: {syncStatus}</div>
            {/* form fields */}
        </Form>
    );
};
```

### Key Changes

1. **No XState Selector**: Data comes from `useDexieEventForm` instead of XState context
2. **No trackerActor**: No need to send events to XState machine
3. **Automatic Saving**: `updateDataValue()` writes to Dexie automatically
4. **Reactive Updates**: Component re-renders when Dexie data changes
5. **Sync Status**: Visible directly from hook

## XState Role After Migration

### What XState Should Handle

```typescript
// Minimal XState machine (UI orchestration only)
const uiMachine = createMachine({
    id: "ui",
    initial: "idle",
    context: {
        // UI state
        currentModal: null as "visit" | "child" | "relationship" | null,
        currentView: "dashboard" as "dashboard" | "calendar" | "reports",
        isLoading: false,

        // Entity IDs (not full objects)
        currentTrackedEntityId: null as string | null,
        currentEventId: null as string | null,
    },
    states: {
        idle: {
            on: {
                OPEN_MODAL: {
                    actions: assign({
                        currentModal: (_, event) => event.modal,
                    }),
                },
                CLOSE_MODAL: {
                    actions: assign({
                        currentModal: null,
                    }),
                },
                NAVIGATE: {
                    actions: assign({
                        currentView: (_, event) => event.view,
                    }),
                },
            },
        },
        loading: {
            /* ... */
        },
    },
});
```

### What XState Should NOT Handle

❌ **Don't Store**:
- Full tracked entity objects
- Full event objects
- Form data
- Enrollment data
- Relationship data

✅ **Only Store**:
- Modal open/closed state
- Current view/navigation
- Loading states
- Selected entity IDs (not full objects)
- UI preferences

## Migration Checklist

### Per Component

- [ ] Identify XState selectors that fetch data
- [ ] Replace with appropriate Dexie hook (`useDexieEventForm`, `useDexieTrackedEntityForm`)
- [ ] Remove `trackerActor.send()` calls for data updates
- [ ] Replace manual save calls with Dexie hook methods
- [ ] Update prop types (pass IDs instead of full objects)
- [ ] Test offline functionality
- [ ] Test sync status display
- [ ] Remove old auto-save hook imports

### Global

- [ ] Update XState machine to remove data from context
- [ ] Keep only UI state in XState
- [ ] Update machine actions to work with entity IDs
- [ ] Remove data-related machine states
- [ ] Update tests to use Dexie hooks
- [ ] Update documentation

## Benefits After Migration

### Developer Experience

1. **Simpler API**:
   - Before: `triggerAutoSave(field, value)` + manual `SAVE_EVENTS`
   - After: `updateDataValue(field, value)` - Done!

2. **Less Boilerplate**:
   - No `trackerActor` dependency
   - No `ruleResult` dependency
   - No manual queue management

3. **Better TypeScript**:
   - Full type inference from Dexie schema
   - Compile-time safety
   - Better autocomplete

### Performance

1. **Reduced Re-renders**:
   - Reactive queries only update affected components
   - No global XState updates triggering all subscribers

2. **Optimized Writes**:
   - Batched updates (500ms debounce)
   - Transaction-safe
   - Single write path

3. **Better Caching**:
   - Dexie handles data caching
   - No duplicate data in XState + Dexie

### Offline Support

1. **Native Offline**:
   - Dexie works offline by default
   - No special handling needed

2. **Sync Visibility**:
   - Clear sync status on every form
   - User knows what's synced vs pending

3. **Conflict Detection**:
   - Version numbers for optimistic locking
   - lastModified timestamps

## Troubleshooting Migration

### Issue: "Can't access XState data"

**Problem**: Component expects data from `TrackerContext.useSelector()`

**Solution**: Replace with Dexie hook
```typescript
// Before
const event = TrackerContext.useSelector(state => state.context.currentEvent);

// After
const { event } = useDexieEventForm({ eventId });
```

### Issue: "Form not updating"

**Problem**: Form doesn't reflect Dexie changes

**Solution**: Pass form to Dexie hook
```typescript
const { event } = useDexieEventForm({
    eventId,
    form: stageForm, // Required for auto-sync
});
```

### Issue: "Sync not happening"

**Problem**: Data saved to Dexie but not syncing to DHIS2

**Solution**: Ensure SyncManager is initialized and running
```typescript
// In app initialization
const syncManager = createSyncManager(engine);
syncManager.startAutoSync(); // Must call this!
```

### Issue: "Type errors with hook data"

**Problem**: TypeScript doesn't know if data exists

**Solution**: Use loading state and type guards
```typescript
const { event, loading } = useDexieEventForm({ eventId });

if (loading) return <Spin />;
if (!event) return <Alert message="Event not found" />;

// TypeScript knows event exists here
console.log(event.dataValues);
```

## Performance Considerations

### When to Use Which Hook

1. **useDexieEventForm**: For event data capture (most common)
2. **useDexieTrackedEntityForm**: For patient/client registration
3. **useDexieForm**: For generic or custom entity types

### Debounce Configuration

```typescript
// Fast fields (dropdowns, checkboxes)
const { updateDataValue } = useDexieEventForm({
    eventId,
    debounceMs: 0, // Immediate
});

// Text fields (default)
const { updateDataValue } = useDexieEventForm({
    eventId,
    debounceMs: 500, // Default
});

// Large text areas
const { updateDataValue } = useDexieEventForm({
    eventId,
    debounceMs: 1000, // Longer
});
```

### Batch Updates

For multiple fields, use plural methods:

```typescript
// ❌ Don't
fields.forEach(field => updateDataValue(field.id, field.value));

// ✅ Do
await updateDataValues(
    fields.reduce((acc, f) => ({ ...acc, [f.id]: f.value }), {})
);
```

## Next Steps

1. Start with simplest component (e.g., Lab results form)
2. Test thoroughly in both online and offline modes
3. Gradually migrate other components
4. Remove XState data storage once all components migrated
5. Update documentation and tests
6. Train team on new patterns

## Questions?

See [DEXIE_FORM_INTEGRATION.md](./DEXIE_FORM_INTEGRATION.md) for detailed hook usage.
