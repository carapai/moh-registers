# Dexie Form Integration Guide

## Overview

The Dexie form hooks provide reactive, offline-first form management with automatic syncing to DHIS2. Forms read from and write directly to Dexie with automatic sync queue management via database hooks.

## Architecture

```
User Input → Form → Dexie Hook → Dexie Update → Hook Triggers → Sync Queue → DHIS2
                                       ↓
                                  useLiveQuery (reactive UI update)
```

## Available Hooks

### 1. `useDexieEventForm` - For Event Data Capture

**Use Case**: Program stage forms, service delivery records, visit data

**Example Usage**:

```typescript
import { useDexieEventForm } from "../hooks/useDexieEventForm";

function EventForm({ eventId }: { eventId: string }) {
    const [form] = Form.useForm();

    const {
        event,
        loading,
        updateDataValue,
        updateDataValues,
        syncStatus,
    } = useDexieEventForm({
        eventId,
        form, // Optional - auto-syncs form with Dexie
        debounceMs: 500, // Optional - default 500ms
    });

    // Handle field change
    const handleFieldChange = (dataElementId: string, value: any) => {
        // Automatically batched and written to Dexie
        // Sync hook will queue for DHIS2
        updateDataValue(dataElementId, value);
    };

    // Handle form submit
    const handleSubmit = async (values: Record<string, any>) => {
        // Write all values immediately (no debounce)
        await updateDataValues(values);
    };

    return (
        <Form form={form} initialValues={event?.dataValues}>
            <Form.Item name="dataElementId">
                <Input onChange={(e) => handleFieldChange("dataElementId", e.target.value)} />
            </Form.Item>
            <div>Sync Status: {syncStatus}</div>
        </Form>
    );
}
```

### 2. `useDexieTrackedEntityForm` - For Patient/Client Registration

**Use Case**: Patient demographics, client registration, enrollment data

**Example Usage**:

```typescript
import { useDexieTrackedEntityForm } from "../hooks/useDexieTrackedEntityForm";

function PatientRegistration({ trackedEntityId }: { trackedEntityId: string }) {
    const [form] = Form.useForm();

    const {
        trackedEntity,
        loading,
        updateAttribute,
        updateAttributes,
        syncStatus,
    } = useDexieTrackedEntityForm({
        trackedEntityId,
        form,
    });

    const handleFieldChange = (attributeId: string, value: any) => {
        updateAttribute(attributeId, value);
    };

    const handleSubmit = async (values: Record<string, any>) => {
        await updateAttributes(values);
    };

    return (
        <Form form={form} initialValues={trackedEntity?.attributes}>
            <Form.Item name="firstName">
                <Input onChange={(e) => handleFieldChange("firstName", e.target.value)} />
            </Form.Item>
            <div>Sync Status: {syncStatus}</div>
        </Form>
    );
}
```

### 3. `useDexieForm` - Generic Hook for Any Entity Type

**Use Case**: Generic form handling, custom entity types

**Example Usage**:

```typescript
import { useDexieForm } from "../hooks/useDexieForm";

function GenericForm({ entityId, entityType }: { entityId: string; entityType: "trackedEntity" | "event" }) {
    const [form] = Form.useForm();

    const {
        data,
        loading,
        updateField,
        updateFields,
        syncStatus,
    } = useDexieForm({
        form,
        entityId,
        entityType,
    });

    // Similar usage to specific hooks
}
```

## Key Features

### 1. Reactive Updates

The hooks use `useLiveQuery` from `dexie-react-hooks`, which automatically re-renders components when Dexie data changes:

```typescript
const event = useLiveQuery(
    async () => await db.events.get(eventId),
    [eventId]
);
// Component re-renders whenever event data changes in Dexie
```

### 2. Batched Writes

Field changes are batched with a 500ms debounce to prevent excessive database writes:

```typescript
updateDataValue("field1", "value1"); // Queued
updateDataValue("field2", "value2"); // Queued
// After 500ms → Single transaction writes both
```

### 3. Immediate Writes

For form submissions, use the plural methods for immediate writes:

```typescript
await updateDataValues({
    field1: "value1",
    field2: "value2",
}); // Writes immediately, no debounce
```

### 4. Automatic Sync Queueing

Dexie hooks automatically queue sync operations when data changes:

```typescript
db.events.update(eventId, { dataValues: { ... } });
// Hook triggers automatically:
// 1. Sets syncStatus = "pending"
// 2. Increments version
// 3. Updates lastModified
// 4. Queues sync operation
```

### 5. Sync Status Visibility

Track sync state in your UI:

```typescript
const { syncStatus, version, lastModified } = useDexieEventForm({ eventId });

// Display sync status
<Badge
    status={syncStatus === "synced" ? "success" : "processing"}
    text={syncStatus}
/>
```

## Migration from Existing Hooks

### From `useEventAutoSave`:

**Before**:
```typescript
const { triggerAutoSave } = useEventAutoSave({
    form,
    event,
    trackerActor,
    ruleResult,
});

// Manual trigger
triggerAutoSave(dataElementId, value);
```

**After**:
```typescript
const { updateDataValue } = useDexieEventForm({
    eventId: event.event,
    form,
});

// Automatic handling
updateDataValue(dataElementId, value);
```

### From `useAutoSave`:

**Before**:
```typescript
const { saveTrackedEntityDraft } = useAutoSave({
    trackedEntity,
    trackerActor,
});

// Manual draft save
await saveTrackedEntityDraft();
```

**After**:
```typescript
const { updateAttribute } = useDexieTrackedEntityForm({
    trackedEntityId: trackedEntity.trackedEntity,
    form,
});

// Automatic save to Dexie + sync queue
updateAttribute(attributeId, value);
```

## Benefits

### 1. Simpler API
- No manual `save()` calls
- No XState actor dependencies
- No draft management needed

### 2. Better Performance
- Batched writes reduce database operations
- Reactive queries prevent unnecessary re-renders
- Transaction-safe updates

### 3. Offline-First
- All writes go to Dexie first
- Sync happens in background
- Works completely offline

### 4. Automatic Sync
- No manual queue management
- Hooks handle everything
- Priority-based syncing

### 5. Type-Safe
- Full TypeScript support
- Type inference from Dexie schema
- Compile-time safety

## Advanced Usage

### Custom Debounce Timing

```typescript
const { updateDataValue } = useDexieEventForm({
    eventId,
    debounceMs: 1000, // 1 second debounce
});
```

### Programmatic Updates

```typescript
// Update single field
updateDataValue("weight", 65);

// Update multiple fields
await updateDataValues({
    weight: 65,
    height: 170,
    bmi: 22.5,
});
```

### Sync Status Monitoring

```typescript
const { syncStatus, version, lastModified } = useDexieEventForm({ eventId });

useEffect(() => {
    if (syncStatus === "failed") {
        message.error("Sync failed - data saved locally");
    } else if (syncStatus === "synced") {
        message.success("Data synced to server");
    }
}, [syncStatus]);
```

### Form Validation Integration

```typescript
const handleSubmit = async () => {
    try {
        const values = await form.validateFields();
        await updateDataValues(values);
        message.success("Saved successfully");
    } catch (error) {
        message.error("Please fix validation errors");
    }
};
```

## Troubleshooting

### Data Not Updating

**Issue**: Form doesn't update when Dexie data changes

**Solution**: Ensure form is passed to hook:
```typescript
const { event } = useDexieEventForm({
    eventId,
    form, // Must pass form for auto-sync
});
```

### Excessive Database Writes

**Issue**: Too many database operations

**Solution**: Use batched methods for multiple fields:
```typescript
// ❌ Don't do this
updateDataValue("field1", value1);
updateDataValue("field2", value2);
updateDataValue("field3", value3);

// ✅ Do this
await updateDataValues({
    field1: value1,
    field2: value2,
    field3: value3,
});
```

### Sync Not Happening

**Issue**: Changes saved but not syncing to DHIS2

**Solution**: Ensure SyncManager is running:
```typescript
// In your app initialization
syncManager.startAutoSync();
```

### Type Errors

**Issue**: TypeScript errors with hook data

**Solution**: Use type guards:
```typescript
const { event } = useDexieEventForm({ eventId });

if (event) {
    // TypeScript knows event is not null here
    console.log(event.dataValues);
}
```

## Performance Tips

1. **Use Specific Hooks**: Use `useDexieEventForm` instead of generic `useDexieForm` when possible
2. **Batch Updates**: Use plural methods (`updateDataValues`) for multiple fields
3. **Memoize Callbacks**: Wrap handlers in `useCallback` to prevent re-renders
4. **Lazy Loading**: Only load data when needed, use `loading` state
5. **Debounce Configuration**: Adjust `debounceMs` based on field type (text: 500ms, select: 0ms)

## Next Steps

1. Migrate existing forms to use Dexie hooks
2. Remove old auto-save hooks
3. Simplify XState machine (remove data storage)
4. Update components to use reactive queries
5. Add sync status indicators to UI
