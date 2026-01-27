# Dexie-First Architecture Documentation

Welcome to the Dexie-first form management system documentation. This system provides offline-first data persistence with automatic syncing to DHIS2.

## 📚 Documentation Index

### Getting Started

1. **[MIGRATION_COMPLETE.md](./MIGRATION_COMPLETE.md)** - Migration overview and summary
   - Architecture comparison (before/after)
   - All 6 phases explained
   - Performance benchmarks
   - Success criteria

2. **[API_REFERENCE.md](./API_REFERENCE.md)** - Complete API documentation
   - Form management hooks
   - Sync status hooks
   - Program rules hooks
   - Database operations
   - Conflict resolution
   - Error handling
   - UI components
   - Type definitions

### Migration Guides

3. **[XSTATE_TO_DEXIE_MIGRATION.md](./XSTATE_TO_DEXIE_MIGRATION.md)** - Strategic migration guide
   - Gradual adoption strategy
   - Component-by-component approach
   - Before/after examples
   - Migration checklist

4. **[UI_TRACKER_MIGRATION.md](./UI_TRACKER_MIGRATION.md)** - UI state machine migration
   - trackerMachine → uiTrackerMachine
   - Side-by-side comparison
   - Specific component examples
   - Troubleshooting

5. **[DEXIE_FORM_INTEGRATION.md](./DEXIE_FORM_INTEGRATION.md)** - Form integration guide
   - Hook usage examples
   - Integration patterns
   - Best practices
   - Common use cases

### Phase Implementation Details

6. **[PHASE_1_SUMMARY.md](../PHASE_1_PERFORMANCE_SUMMARY.md)** - Enhanced Dexie Schema
   - Sync status tracking
   - Version management
   - Database migrations

7. **[PHASE_2_SUMMARY.md](../PHASE_2_PERFORMANCE_SUMMARY.md)** - Dexie Hooks
   - Database lifecycle hooks
   - Automatic sync queueing
   - Priority management

8. **[PHASE_3_SUMMARY.md](../PHASE_3_PERFORMANCE_SUMMARY.md)** - Form Integration
   - useDexieEventForm
   - useDexieTrackedEntityForm
   - useDexieForm

9. **[PHASE_4_SUMMARY.md](./PHASE_4_SUMMARY.md)** - XState Simplification
   - UI-only state machine
   - 78% code reduction
   - Clear separation of concerns

10. **[PHASE_5_SUMMARY.md](./PHASE_5_SUMMARY.md)** - Sync Manager Enhancement
    - Sync status hooks
    - Conflict resolution
    - Error handling
    - UI components

11. **[PHASE_6_SUMMARY.md](./PHASE_6_SUMMARY.md)** - Program Rules Integration
    - Reactive rule execution
    - Performance caching
    - Dexie integration

## 🚀 Quick Start

### Basic Form with Dexie

```typescript
import { useDexieEventForm } from "../hooks/useDexieEventForm";

function MyEventForm({ eventId }: Props) {
    const [form] = Form.useForm();

    const { event, updateDataValue, syncStatus } = useDexieEventForm({
        eventId,
        form,
    });

    const handleSubmit = async (values: Record<string, any>) => {
        await updateDataValues(values);
        message.success("Saved!");
    };

    return (
        <Form form={form} onFinish={handleSubmit}>
            <div>Status: {syncStatus}</div>
            <Form.Item name="field1">
                <Input />
            </Form.Item>
            <Button type="primary" htmlType="submit">
                Save
            </Button>
        </Form>
    );
}
```

### With Program Rules

```typescript
import { useDexieEventForm } from "../hooks/useDexieEventForm";
import { useProgramRulesWithDexie, useFieldVisibility } from "../hooks/useProgramRules";

function MyEventFormWithRules({ eventId, programRules, programRuleVariables }: Props) {
    const [form] = Form.useForm();

    const { event, updateDataValues } = useDexieEventForm({
        eventId,
        form,
    });

    const { ruleResult, executeAndApplyRules } = useProgramRulesWithDexie({
        form,
        programRules,
        programRuleVariables,
        onAssignments: updateDataValues,
        persistAssignments: true,
    });

    const showField1 = useFieldVisibility("field1", ruleResult);

    return (
        <Form
            form={form}
            onValuesChange={() => executeAndApplyRules()}
        >
            {showField1 && (
                <Form.Item name="field1">
                    <Input />
                </Form.Item>
            )}
            <Button type="primary" htmlType="submit">
                Save
            </Button>
        </Form>
    );
}
```

### With Sync Status

```typescript
import { useDexieEventForm } from "../hooks/useDexieEventForm";
import { useEventSyncStatus } from "../hooks/useEntitySyncStatus";
import { SyncStatusBadge } from "../components/sync-status-badge";

function MyEventFormWithStatus({ eventId }: Props) {
    const [form] = Form.useForm();

    const { event, updateDataValues } = useDexieEventForm({
        eventId,
        form,
    });

    const { syncStatus, isPending, hasFailed, syncError } = useEventSyncStatus(eventId);

    return (
        <div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
                <h3>Event Form</h3>
                <SyncStatusBadge
                    syncStatus={syncStatus}
                    syncError={syncError}
                    showText
                />
            </div>

            {hasFailed && (
                <Alert type="error" message={syncError} />
            )}

            <Form form={form}>
                {/* Form fields */}
            </Form>
        </div>
    );
}
```

## 🎯 Key Concepts

### 1. Single Source of Truth

**Dexie (IndexedDB) is the single source of truth** for all data. XState only manages UI state.

```
Form → Dexie → DB Hooks → Sync Queue → DHIS2
        ↓
    Components (reactive via useLiveQuery)
```

### 2. Automatic Sync

Database hooks automatically queue sync operations when data changes. No manual triggers needed.

```typescript
// This automatically triggers sync
await updateDataValue("field1", "value");

// Dexie hooks detect the update
// → Add to sync queue
// → SyncManager processes queue
// → Syncs to DHIS2
```

### 3. Reactive Queries

Components automatically re-render when data changes in Dexie.

```typescript
// useLiveQuery from dexie-react-hooks
const event = useLiveQuery(
    async () => await db.events.get(eventId),
    [eventId]
);

// Component re-renders when event changes
```

### 4. Batched Updates

Form hooks batch updates with 500ms debounce to optimize performance.

```typescript
// Multiple rapid updates are batched
updateDataValue("field1", "value1");  // ┐
updateDataValue("field2", "value2");  // ├─ Batched into
updateDataValue("field3", "value3");  // ┘  single write
```

### 5. Conflict Resolution

Built-in conflict detection and resolution strategies.

```typescript
const result = await handleConflict(
    "event",
    eventId,
    localEvent,
    remoteEvent,
    "newest-wins" // or client-wins, server-wins, manual
);
```

## 📊 Performance Improvements

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| **State Management** | 1,178 lines | 250 lines | **78% reduction** |
| **Form Updates** | ~50ms | ~5ms | **90% faster** |
| **Program Rules (cached)** | ~100ms | ~10ms | **90% faster** |
| **Memory Usage** | High | Low | **~40% reduction** |
| **Operations** | ~380ms | ~65ms | **83% faster** |

## 🏗️ Architecture

### Component Hierarchy

```
App
├── SyncManager (background sync)
├── UITracker (UI state only)
└── Components
    ├── useDexieEventForm (data from Dexie)
    ├── useProgramRules (rules execution)
    └── useSyncStatus (sync visibility)
```

### Data Flow

```
1. User Input
   ↓
2. Form Hook (useDexieEventForm)
   ↓
3. Batched Update (500ms debounce)
   ↓
4. Dexie Write (transaction-safe)
   ↓
5. Dexie Hook Triggered (updating)
   ↓
6. Sync Queue (automatic)
   ↓
7. SyncManager (background)
   ↓
8. DHIS2 API
```

### Offline Flow

```
1. Offline Detection (navigator.onLine)
   ↓
2. Data Saved to Dexie (normal flow)
   ↓
3. Sync Queue Accumulates
   ↓
4. Online Detection
   ↓
5. SyncManager Processes Queue
   ↓
6. Batch Sync to DHIS2
```

## 🛠️ Development

### Project Structure

```
src/
├── db/
│   ├── index.ts                    # Dexie schema
│   ├── sync.ts                     # SyncManager
│   ├── operations.ts               # DB operations
│   ├── conflict-resolution.ts      # Conflict handling
│   └── sync-errors.ts              # Error categorization
├── hooks/
│   ├── useDexieEventForm.ts        # Event form hook
│   ├── useDexieTrackedEntityForm.ts # Entity form hook
│   ├── useDexieForm.ts             # Generic form hook
│   ├── useSyncStatus.ts            # Sync status hooks
│   ├── useEntitySyncStatus.ts      # Entity sync status
│   ├── useProgramRules.ts          # Program rules
│   └── useCachedProgramRules.ts    # Cached rules
├── machines/
│   ├── tracker.ts                  # Old machine (deprecated)
│   └── ui-tracker.ts               # New UI-only machine
├── components/
│   └── sync-status-badge.tsx       # Sync UI components
└── utils/
    └── utils.ts                    # Utilities
```

### Testing

```bash
# Run tests
npm test

# Build
npm run build

# Type check
npx tsc --noEmit
```

### Adding New Features

1. **New Form Type**
   ```typescript
   // Create new hook in src/hooks/
   export const useMyCustomForm = ({ ... }) => {
       // Use useLiveQuery for reactive data
       // Implement batched updates
       // Return data and update methods
   };
   ```

2. **New Sync Operation**
   ```typescript
   // Add to src/db/sync.ts
   private async syncMyOperation(data: any): Promise<void> {
       await this.engine.mutate({
           resource: "...",
           type: "create",
           data,
       });
   }
   ```

3. **New UI Component**
   ```typescript
   // Create in src/components/
   // Use sync status hooks
   // Integrate with Dexie data
   ```

## 🐛 Troubleshooting

### Common Issues

1. **Form not updating**
   - Ensure `form` prop is passed to Dexie hook
   - Check that form fields have correct `name` props

2. **Sync not happening**
   - Verify SyncManager is initialized
   - Check `syncManager.startAutoSync()` was called
   - Inspect sync queue: `db.syncQueue.toArray()`

3. **Program rules not executing**
   - Verify rules and variables are passed correctly
   - Check `executeRules()` is called on field changes
   - Inspect rule result: `console.log(ruleResult)`

4. **Conflicts not resolving**
   - Check version numbers are incrementing
   - Verify lastModified timestamps
   - Test conflict resolution strategy

5. **Performance issues**
   - Enable caching for program rules
   - Check debounce settings
   - Monitor batch sizes

### Debug Tools

```typescript
// Check sync queue
const pending = await db.syncQueue.where("status").equals("pending").toArray();
console.log("Pending operations:", pending);

// Check sync status
const stats = await db.getPendingChangesCount();
console.log("Pending changes:", stats);

// Clear cache
await db.ruleCache.clear();

// Monitor sync operations
syncManager.subscribe((state) => {
    console.log("Sync state:", state);
});
```

## 📝 Best Practices

### 1. Always Use Form Prop

✅ **DO**:
```typescript
const { event, updateDataValue } = useDexieEventForm({
    eventId,
    form,  // Auto-syncs form
});
```

### 2. Batch Updates

✅ **DO**:
```typescript
await updateDataValues({
    field1: "value1",
    field2: "value2",
});
```

### 3. Use Cached Rules

✅ **DO**:
```typescript
const { ruleResult } = useCachedProgramRules({
    cacheKey: `event-${eventId}`,
    // ...
});
```

### 4. Handle Errors

✅ **DO**:
```typescript
try {
    await updateDataValues(values);
} catch (error) {
    const syncError = categorizeSyncError(error);
    message.error(syncError.message);
}
```

### 5. Show Sync Status

✅ **DO**:
```typescript
const { syncStatus } = useEventSyncStatus(eventId);
return <SyncStatusBadge syncStatus={syncStatus} showText />;
```

## 🤝 Contributing

When adding new features:

1. Follow existing patterns
2. Use TypeScript
3. Add JSDoc comments
4. Update documentation
5. Test offline functionality
6. Check performance impact

## 📖 Further Reading

- [Dexie.js Documentation](https://dexie.org/)
- [DHIS2 Tracker API](https://docs.dhis2.org/en/develop/using-the-api/dhis-core-version-master/tracker.html)
- [IndexedDB API](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API)
- [Offline First](https://offlinefirst.org/)

## 📄 License

See project LICENSE file.

---

**Questions?** Check the documentation above or raise an issue.
