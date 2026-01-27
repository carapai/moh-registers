# Dexie-First Architecture - API Reference

Complete API reference for the Dexie-first form management system.

## Table of Contents

1. [Form Management Hooks](#form-management-hooks)
2. [Sync Status Hooks](#sync-status-hooks)
3. [Program Rules Hooks](#program-rules-hooks)
4. [Database Operations](#database-operations)
5. [Conflict Resolution](#conflict-resolution)
6. [Error Handling](#error-handling)
7. [UI Components](#ui-components)
8. [Type Definitions](#type-definitions)

---

## Form Management Hooks

### `useDexieEventForm`

Reactive form hook for event data capture with automatic Dexie persistence.

**Location**: `src/hooks/useDexieEventForm.ts`

```typescript
function useDexieEventForm(options: UseDexieEventFormOptions): UseDexieEventFormReturn
```

**Options**:
```typescript
interface UseDexieEventFormOptions {
    eventId: string;              // Event ID
    form?: FormInstance;          // Ant Design form instance (optional)
    debounceMs?: number;          // Debounce delay (default: 500ms)
}
```

**Returns**:
```typescript
interface UseDexieEventFormReturn {
    event: FlattenedEvent | null;           // Event data
    loading: boolean;                       // Loading state
    updateDataValue: (dataElementId: string, value: any) => void;     // Update single field
    updateDataValues: (values: Record<string, any>) => Promise<void>; // Update multiple fields
    syncStatus: string | undefined;         // Sync status
    version: number | undefined;            // Version number
    lastModified: string | undefined;       // Last modified timestamp
}
```

**Example**:
```typescript
const { event, updateDataValue, syncStatus } = useDexieEventForm({
    eventId: "abc123",
    form: myForm,
    debounceMs: 500,
});

// Update single field
updateDataValue("dataElement1", "value");

// Update multiple fields
await updateDataValues({
    dataElement1: "value1",
    dataElement2: "value2",
});
```

---

### `useDexieTrackedEntityForm`

Reactive form hook for tracked entity/patient registration.

**Location**: `src/hooks/useDexieTrackedEntityForm.ts`

```typescript
function useDexieTrackedEntityForm(options: UseDexieTrackedEntityFormOptions): UseDexieTrackedEntityFormReturn
```

**Options**:
```typescript
interface UseDexieTrackedEntityFormOptions {
    trackedEntityId: string;      // Tracked entity ID
    form?: FormInstance;          // Ant Design form instance (optional)
    debounceMs?: number;          // Debounce delay (default: 500ms)
}
```

**Returns**:
```typescript
interface UseDexieTrackedEntityFormReturn {
    trackedEntity: FlattenedTrackedEntity | null;  // Entity data
    loading: boolean;                              // Loading state
    updateAttribute: (attributeId: string, value: any) => void;        // Update single attribute
    updateAttributes: (attributes: Record<string, any>) => Promise<void>; // Update multiple attributes
    syncStatus: string | undefined;                // Sync status
    version: number | undefined;                   // Version number
    lastModified: string | undefined;              // Last modified timestamp
}
```

**Example**:
```typescript
const { trackedEntity, updateAttribute } = useDexieTrackedEntityForm({
    trackedEntityId: "xyz789",
    form: registrationForm,
});

updateAttribute("firstName", "John");
```

---

### `useDexieForm`

Generic reactive form hook for any entity type.

**Location**: `src/hooks/useDexieForm.ts`

```typescript
function useDexieForm(options: UseDexieFormOptions): UseDexieFormReturn
```

**Options**:
```typescript
interface UseDexieFormOptions {
    form: FormInstance;
    entityId: string;
    entityType: "trackedEntity" | "event" | "relationship";
    debounceMs?: number;
}
```

**Returns**:
```typescript
interface UseDexieFormReturn {
    data: FlattenedTrackedEntity | FlattenedEvent | null;
    loading: boolean;
    updateField: (field: string, value: any) => Promise<void>;
    updateFields: (fields: Record<string, any>) => Promise<void>;
    syncStatus: string | undefined;
}
```

---

## Sync Status Hooks

### `useSyncStatus`

Monitor global application sync status.

**Location**: `src/hooks/useSyncStatus.ts`

```typescript
function useSyncStatus(syncManager: SyncManager | undefined): UseSyncStatusReturn
```

**Returns**:
```typescript
interface UseSyncStatusReturn {
    status: "idle" | "syncing" | "online" | "offline";
    pendingCount: number;
    lastSyncAt?: string;
    error?: string;
    isOnline: boolean;
    isSyncing: boolean;
    hasError: boolean;
}
```

**Example**:
```typescript
const { status, pendingCount, isOnline } = useSyncStatus(syncManager);

if (status === "syncing") {
    return <Spin tip="Syncing..." />;
}
```

---

### `useEntitySyncStatus`

Monitor sync status for a specific tracked entity.

**Location**: `src/hooks/useEntitySyncStatus.ts`

```typescript
function useEntitySyncStatus(trackedEntityId: string | null): EntitySyncStatusReturn
```

**Returns**:
```typescript
interface EntitySyncStatusReturn {
    syncStatus: SyncStatus | undefined;
    version: number | undefined;
    lastModified: string | undefined;
    lastSynced: string | undefined;
    syncError: string | undefined;
    loading: boolean;
    isPending: boolean;
    isSyncing: boolean;
    isSynced: boolean;
    hasFailed: boolean;
}
```

**Example**:
```typescript
const { isPending, hasFailed, syncError } = useEntitySyncStatus(entityId);

if (hasFailed) {
    return <Alert type="error" message={syncError} />;
}
```

---

### `useEventSyncStatus`

Monitor sync status for a specific event.

**Location**: `src/hooks/useEntitySyncStatus.ts`

```typescript
function useEventSyncStatus(eventId: string | null): EntitySyncStatusReturn
```

Same return type as `useEntitySyncStatus`.

---

### `useRelationshipSyncStatus`

Monitor sync status for a specific relationship.

**Location**: `src/hooks/useEntitySyncStatus.ts`

```typescript
function useRelationshipSyncStatus(relationshipId: string | null): EntitySyncStatusReturn
```

Same return type as `useEntitySyncStatus`.

---

## Program Rules Hooks

### `useProgramRules`

Execute program rules reactively based on form values.

**Location**: `src/hooks/useProgramRules.ts`

```typescript
function useProgramRules(options: UseProgramRulesOptions): UseProgramRulesReturn
```

**Options**:
```typescript
interface UseProgramRulesOptions {
    form: FormInstance;
    programRules: ProgramRule[];
    programRuleVariables: ProgramRuleVariable[];
    programStage?: string;
    program?: string;
    trackedEntityAttributes?: Record<string, any>;
    enrollment?: { enrolledAt?: string; occurredAt?: string };
    debounceMs?: number;           // Default: 300ms
    autoExecute?: boolean;         // Default: false
}
```

**Returns**:
```typescript
interface UseProgramRulesReturn {
    ruleResult: ProgramRuleResult;
    executeRules: (dataValues?: Record<string, any>) => ProgramRuleResult;
    isExecuting: boolean;
    hasErrors: boolean;
    hasWarnings: boolean;
    hasMessages: boolean;
}
```

**Example**:
```typescript
const { ruleResult, executeRules } = useProgramRules({
    form,
    programRules,
    programRuleVariables,
    programStage,
    trackedEntityAttributes,
});

// Execute on field change
<Input onChange={() => executeRules()} />

// Check field visibility
if (ruleResult.hiddenFields.has(dataElementId)) {
    return null;
}
```

---

### `useProgramRulesWithDexie`

Program rules with automatic Dexie persistence.

**Location**: `src/hooks/useProgramRules.ts`

```typescript
function useProgramRulesWithDexie(options: UseProgramRulesWithDexieOptions): UseProgramRulesWithDexieReturn
```

**Options**:
```typescript
interface UseProgramRulesWithDexieOptions extends Omit<UseProgramRulesOptions, "autoExecute"> {
    onAssignments?: (assignments: Record<string, any>) => Promise<void>;
    applyAssignmentsToForm?: boolean;    // Default: true
    persistAssignments?: boolean;         // Default: false
}
```

**Returns**:
```typescript
interface UseProgramRulesWithDexieReturn extends UseProgramRulesReturn {
    executeAndApplyRules: (dataValues?: Record<string, any>) => Promise<void>;
}
```

**Example**:
```typescript
const { event, updateDataValues } = useDexieEventForm({ eventId, form });

const { executeAndApplyRules } = useProgramRulesWithDexie({
    form,
    programRules,
    programRuleVariables,
    onAssignments: updateDataValues,  // Auto-persist
    persistAssignments: true,
});

await executeAndApplyRules();
```

---

### `useCachedProgramRules`

Performance-optimized program rules with IndexedDB caching.

**Location**: `src/hooks/useCachedProgramRules.ts`

```typescript
function useCachedProgramRules(options: UseCachedProgramRulesOptions): UseCachedProgramRulesReturn
```

**Options**:
```typescript
interface UseCachedProgramRulesOptions {
    form: FormInstance;
    cacheKey: string;              // Unique cache key
    programRules: ProgramRule[];
    programRuleVariables: ProgramRuleVariable[];
    programStage?: string;
    program?: string;
    trackedEntityAttributes?: Record<string, any>;
    enrollment?: { enrolledAt?: string; occurredAt?: string };
    cacheTTL?: number;             // Default: 5 minutes
    enableCache?: boolean;         // Default: true
}
```

**Returns**:
```typescript
interface UseCachedProgramRulesReturn {
    ruleResult: ProgramRuleResult;
    executeRules: (dataValues?: Record<string, any>) => ProgramRuleResult;
    clearCache: () => Promise<void>;
    isCached: boolean;
    cacheAge: number | null;
    isExecuting: boolean;
}
```

**Example**:
```typescript
const { ruleResult, isCached, cacheAge } = useCachedProgramRules({
    form,
    cacheKey: `event-${eventId}-rules`,
    programRules,
    programRuleVariables,
    cacheTTL: 5 * 60 * 1000, // 5 minutes
});

console.log(`Cached: ${isCached}, Age: ${cacheAge}ms`);
```

---

### Helper Hooks

#### `useFieldVisibility`

Determine field visibility based on program rules.

```typescript
function useFieldVisibility(fieldId: string, ruleResult: ProgramRuleResult): boolean
```

**Example**:
```typescript
const isVisible = useFieldVisibility("dataElement1", ruleResult);

if (!isVisible) return null;
```

---

#### `useSectionVisibility`

Determine section visibility based on program rules.

```typescript
function useSectionVisibility(sectionId: string, ruleResult: ProgramRuleResult): boolean
```

---

#### `useFilteredOptions`

Filter option set options based on program rules.

```typescript
function useFilteredOptions<T extends { id: string }>(
    fieldId: string,
    allOptions: T[],
    ruleResult: ProgramRuleResult
): T[]
```

**Example**:
```typescript
const filteredOptions = useFilteredOptions(
    dataElementId,
    allOptions,
    ruleResult
);

<Select options={filteredOptions} />
```

---

## Database Operations

### Dexie Instance

```typescript
import { db } from "./db";
```

**Tables**:
- `db.trackedEntities` - Tracked entities
- `db.events` - Events
- `db.relationships` - Relationships
- `db.syncQueue` - Sync operations
- `db.ruleCache` - Program rule cache
- `db.programRules` - Program rules
- `db.programRuleVariables` - Program rule variables

**Helper Methods**:

```typescript
// Get entities by sync status
await db.getEntitiesByStatus("pending");

// Get pending changes count
await db.getPendingChangesCount();
// Returns: { entities: number, events: number, relationships: number, total: number }

// Clear all drafts
await db.clearAllDrafts();

// Clear all data
await db.clearAllData();
```

---

## Conflict Resolution

### `detectConflict`

Detect if a conflict exists between local and remote data.

**Location**: `src/db/conflict-resolution.ts`

```typescript
function detectConflict(localData: any, remoteData: any): ConflictDetectionResult
```

**Returns**:
```typescript
interface ConflictDetectionResult {
    hasConflict: boolean;
    localVersion: number;
    remoteVersion?: number;
    localLastModified: string;
    remoteLastModified?: string;
    reason?: string;
}
```

---

### `resolveConflict`

Resolve conflict using specified strategy.

```typescript
function resolveConflict(
    entityType: "trackedEntity" | "event" | "relationship",
    entityId: string,
    localData: any,
    remoteData: any,
    strategy: ConflictStrategy = "newest-wins"
): Promise<ConflictResolutionResult>
```

**Strategies**:
- `"client-wins"` - Local changes take precedence
- `"server-wins"` - Remote changes take precedence
- `"newest-wins"` - Most recent modification wins
- `"manual"` - Require user intervention

**Returns**:
```typescript
interface ConflictResolutionResult {
    resolved: boolean;
    strategy: ConflictStrategy;
    winner: "local" | "remote" | "merged" | "pending";
    data: any;
    message?: string;
}
```

---

### `smartMerge`

Automatically merge compatible changes.

```typescript
function smartMerge(
    entityType: "trackedEntity" | "event",
    entityId: string,
    localData: any,
    remoteData: any
): Promise<ConflictResolutionResult>
```

---

### `handleConflict`

High-level conflict handling with automatic resolution.

```typescript
function handleConflict(
    entityType: "trackedEntity" | "event" | "relationship",
    entityId: string,
    localData: any,
    remoteData: any,
    preferredStrategy: ConflictStrategy = "newest-wins"
): Promise<ConflictResolutionResult>
```

---

## Error Handling

### `categorizeSyncError`

Categorize error and provide metadata.

**Location**: `src/db/sync-errors.ts`

```typescript
function categorizeSyncError(error: any): SyncError
```

**Returns**:
```typescript
interface SyncError {
    type: SyncErrorType;
    message: string;
    details?: any;
    retryable: boolean;
    requiresUserAction: boolean;
    suggestedAction?: string;
}
```

**Error Types**:
```typescript
enum SyncErrorType {
    NETWORK_ERROR,
    TIMEOUT,
    CONNECTION_LOST,
    UNAUTHORIZED,
    FORBIDDEN,
    TOKEN_EXPIRED,
    VALIDATION_ERROR,
    INVALID_DATA,
    MISSING_REQUIRED_FIELD,
    CONFLICT,
    VERSION_MISMATCH,
    SERVER_ERROR,
    SERVICE_UNAVAILABLE,
    ENTITY_NOT_FOUND,
    DUPLICATE_ENTITY,
    REFERENCE_ERROR,
    UNKNOWN,
}
```

---

### `shouldRetry`

Determine if operation should be retried.

```typescript
function shouldRetry(
    error: SyncError,
    attemptNumber: number,
    config?: RetryConfig
): boolean
```

---

### `calculateRetryDelay`

Calculate retry delay with exponential backoff.

```typescript
function calculateRetryDelay(
    attemptNumber: number,
    config?: RetryConfig
): number
```

**Default Config**:
```typescript
{
    maxAttempts: 3,
    baseDelay: 1000,      // 1 second
    maxDelay: 30000,      // 30 seconds
    backoffMultiplier: 2,
}
```

---

## UI Components

### `SyncStatusBadge`

Visual indicator for entity/event sync status.

**Location**: `src/components/sync-status-badge.tsx`

```typescript
<SyncStatusBadge
    syncStatus="pending"
    lastModified="2024-01-20T10:00:00Z"
    lastSynced="2024-01-20T09:55:00Z"
    syncError="Network error"
    showText={true}
    size="default"
/>
```

**Props**:
```typescript
interface SyncStatusBadgeProps {
    syncStatus?: SyncStatus;
    lastModified?: string;
    lastSynced?: string;
    syncError?: string;
    showText?: boolean;     // Default: false
    size?: "small" | "default";  // Default: "default"
}
```

---

### `GlobalSyncStatus`

Application-wide sync status indicator.

```typescript
<GlobalSyncStatus
    status="syncing"
    pendingCount={5}
    isOnline={true}
    onSyncNow={() => syncManager.startSync()}
/>
```

**Props**:
```typescript
interface GlobalSyncStatusProps {
    status: "idle" | "syncing" | "online" | "offline";
    pendingCount: number;
    isOnline: boolean;
    onSyncNow?: () => void;
}
```

---

## Type Definitions

### Core Types

```typescript
// Sync status
type SyncStatus = "draft" | "pending" | "syncing" | "synced" | "failed";

// Flattened entities
type FlattenedTrackedEntity = ReturnType<typeof flattenTrackedEntity>;
type FlattenedEvent = FlattenedTrackedEntity["events"][number];
type FlattenedRelationship = FlattenedTrackedEntity["relationships"][number];

// Sync metadata
interface SyncMetadata {
    syncStatus: SyncStatus;
    version: number;
    lastModified: string;
    lastSynced?: string;
    syncError?: string;
}
```

---

### Program Rule Types

```typescript
interface ProgramRuleResult {
    assignments: Record<string, any>;
    hiddenFields: Set<string>;
    shownFields: Set<string>;
    hiddenSections: Set<string>;
    shownSections: Set<string>;
    messages: Array<Message>;
    warnings: Array<Message>;
    errors: Array<Message>;
    hiddenOptions: Record<string, Set<string>>;
    shownOptions: Record<string, Set<string>>;
    hiddenOptionGroups: Record<string, Set<string>>;
    shownOptionGroups: Record<string, Set<string>>;
}

interface Message {
    id: string;
    message: string;
}
```

---

## Best Practices

### 1. Form Hooks

✅ **DO**:
```typescript
// Use form prop for auto-sync
const { event, updateDataValue } = useDexieEventForm({
    eventId,
    form: myForm,  // Auto-syncs form with Dexie
});
```

❌ **DON'T**:
```typescript
// Without form prop, must manually sync
const { event, updateDataValue } = useDexieEventForm({
    eventId,
});
// Need to manually call form.setFieldsValue()
```

### 2. Batching Updates

✅ **DO**:
```typescript
// Batch multiple updates
await updateDataValues({
    field1: "value1",
    field2: "value2",
    field3: "value3",
});
```

❌ **DON'T**:
```typescript
// Multiple individual updates trigger multiple writes
updateDataValue("field1", "value1");
updateDataValue("field2", "value2");
updateDataValue("field3", "value3");
```

### 3. Program Rules

✅ **DO**:
```typescript
// Use cached rules for repeated executions
const { ruleResult } = useCachedProgramRules({
    cacheKey: `event-${eventId}`,
    // ...
});
```

❌ **DON'T**:
```typescript
// Re-execute rules on every render
const { ruleResult, executeRules } = useProgramRules({
    autoExecute: true,  // Can cause performance issues
    // ...
});
```

### 4. Error Handling

✅ **DO**:
```typescript
try {
    await updateDataValues(values);
} catch (error) {
    const syncError = categorizeSyncError(error);
    if (syncError.requiresUserAction) {
        showErrorModal(syncError.message);
    }
}
```

❌ **DON'T**:
```typescript
// Silently swallow errors
await updateDataValues(values).catch(() => {});
```

---

## Migration Examples

### Before (XState)

```typescript
const currentEvent = TrackerContext.useSelector(
    (state) => state.context.currentEvent
);

trackerActor.send({
    type: "CREATE_OR_UPDATE_EVENT",
    event: { ...currentEvent, dataValues: values }
});

trackerActor.send({ type: "SAVE_EVENTS" });
```

### After (Dexie)

```typescript
const { event, updateDataValues } = useDexieEventForm({
    eventId,
    form,
});

await updateDataValues(values);
// Done! Automatic sync
```

---

## Support

For additional help:
- See [MIGRATION_COMPLETE.md](./MIGRATION_COMPLETE.md) for migration guide
- See [DEXIE_FORM_INTEGRATION.md](./DEXIE_FORM_INTEGRATION.md) for detailed examples
- See Phase summaries for implementation details
