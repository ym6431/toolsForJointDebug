# Phase 1 Data Model: Options Page PC Redesign

## Scope and compatibility

This redesign does not add persisted fields, change IndexedDB v2 stores, change storage repository APIs, or change the JSON export shape. New state introduced by the redesign is derived, in memory, and owned by the options page UI.

Persisted data keeps using the current contracts from `src/shared/types.ts`, `src/shared/storage.ts`, and `src/shared/utils.ts`:

* `ConfigItem` for migration keys.
* `LocalhostTarget` plus the serialized default target key for localhost targets.
* JSON export version 3 with `version`, `exportedAt`, `items`, `localhostTargets`, and `defaultLocalhostTarget`.
* IndexedDB v2 normalized stores and existing repository writes.

## Persisted entities

### ConfigItem, also called Migration Key

Represents one user approved state key that the extension may inspect during manual export.

Fields:

| Field | Type | Required | Validation and normalization |
| --- | --- | --- | --- |
| `storageType` | `'localStorage' \| 'sessionStorage' \| 'cookie'` | Yes | Must be one supported storage type. Unsupported values are rejected by UI validation and invalid imports. |
| `key` | `string` | Yes | Trimmed before save through `saveCustomConfig`. Empty keys are rejected. |
| `description` | `string` | Yes | Trimmed before save. Empty string is valid. |

Identity and dedupe:

* The persisted logical identity is `storageType + key`.
* The dedupe key is `toRecordKey(storageType, key)`, currently serialized as `${storageType}:${key}`.
* `dedupeConfig` trims `key`, drops empty keys, and keeps only the first item for each dedupe key.
* The redesign must reject duplicate `storageType + key` values in the pending list before save, so a user doesn't see one row silently discarded later by persistence normalization.

Relationships:

* Stored in the existing custom config store as normalized `ConfigRecord` rows with repository owned record ids and positions.
* Used by content and page bridge flows as the allowed scan list.
* Has no persisted row id in the public `ConfigItem` contract.

Invariants:

* A valid pending configuration contains no duplicate `storageType + trimmed key` pairs.
* The visible row order follows pending array order. Filtering doesn't reorder or mutate the array.
* Save persists the normalized result returned by `saveCustomConfig`.

### LocalhostTarget

Represents one loopback destination available to popup injection flows.

Fields:

| Field | Type | Required | Validation and normalization |
| --- | --- | --- | --- |
| `protocol` | `'http' \| 'https'` | Yes | Normalized by `normalizeLocalhostProtocol`. Other values are invalid. |
| `port` | `string` | Yes | Normalized by `normalizePort`. Must be digits only, integer, and within 1 through 65535. Saved as a trimmed numeric string without leading zero semantics from user input. |

Identity and dedupe:

* Target key is `serializeLocalhostTarget(target)`, currently `${protocol}:${port}`.
* Formatted display is `formatLocalhostTarget(target)`, currently `${protocol}://localhost:${port}`.
* `normalizeLocalhostTargetList` drops invalid targets and keeps the first target for each serialized target key.

Relationships:

* Stored in the existing localhost target store as normalized `LocalhostTargetRecord` rows with repository owned record ids and positions.
* The selected default is stored separately as a serialized target key in the existing default target store.
* Popup default target selection depends on the same serialized default key.

Invariants:

* A valid pending target list contains no duplicate serialized target keys.
* `defaultLocalhostTargetKey` is either one of the pending target keys or empty when no targets exist.
* If a default target is missing during normalization, `resolveDefaultLocalhostTargetKey` chooses the first remaining target, or empty when the list is empty.
* Removing the currently selected default first clears the removed key in pending UI state, then existing default normalization resolves the remaining valid default when saved.

### Saved configuration snapshot

Represents the last clean state loaded from storage or successfully saved.

Fields:

| Field | Type | Source |
| --- | --- | --- |
| `customConfig` | `ConfigItem[]` | `getCustomConfig()` after load, or the normalized return value from `saveCustomConfig()`. |
| `localhostTargets` | `LocalhostTarget[]` | `getLocalhostTargets()` after load, or `saveLocalhostTargetConfig(...).localhostTargets` after save. |
| `defaultLocalhostTargetKey` | `string` | `getDefaultLocalhostTargetKey()` after load, or `saveLocalhostTargetConfig(...).defaultLocalhostTargetKey` after save. |

Persistence:

* This snapshot is not a new store and is not exported as a distinct entity.
* It is private reactive UI state used to compare saved and pending state.

Invariants:

* On load, saved snapshot and pending editable configuration start equal after existing storage normalization.
* After successful save, saved snapshot is replaced with the normalized pending values returned by storage APIs.
* `hasPendingChanges` is derived by comparing normalized pending values with this snapshot, not by a manual dirty flag.

## Derived UI state

### Pending editable configuration

Represents the working copy visible in the redesigned options page.

Fields:

| Field | Type | Persistence |
| --- | --- | --- |
| `customConfigRows` | UI row wrappers containing `ConfigItem` values | Not persisted. Values map back to `ConfigItem[]` on save. |
| `localhostTargets` | `LocalhostTarget[]` | Not persisted until save. |
| `defaultLocalhostTargetKey` | `string` | Not persisted until save. |
| `inlineEditorDraft` | Draft state type, key, description, and validation message | Never persisted directly. |

Validation:

* Migration key edits must preserve supported `storageType`, non empty trimmed `key`, and unique `storageType + trimmed key` in the pending list.
* Localhost target edits or additions must pass protocol and port normalization and must not duplicate an existing target key.
* Import replace assigns pending values only after the whole imported payload validates.
* Import merge appends or merges only values that validate under the same rules and preserves existing pending values when import fails.

Invariants:

* Pending state is the only source used by the redesigned list, strip, toolbar pending indicator, and save action.
* Pending values don't mutate saved storage until explicit save.
* Invalid import leaves both saved snapshot and pending editable configuration unchanged.

### UI row identity

Represents stable identity for editable row rendering and event routing.

Fields:

| Field | Type | Persistence |
| --- | --- | --- |
| `uiId` | `string` | Ephemeral. Never stored, never exported. |
| `item` | `ConfigItem` | The editable migration key value associated with the row. |

Creation rules:

* Created when saved config is loaded into pending rows.
* Created when a valid inline editor draft is appended.
* Created when valid imported rows are accepted into pending state.
* Kept stable across filter changes, inline edits, and re renders.

Invariants:

* UI events update a row by `uiId`, not by visible index.
* Filtered views render the same row objects and don't create persisted ids.
* `uiId` must not appear in `saveCustomConfig` input or JSON export output.

### List filter

Represents the current migration key filter text.

Fields:

| Field | Type | Persistence |
| --- | --- | --- |
| `query` | `string` | Ephemeral page state. Never stored or exported. |

Rules:

* Matching is case insensitive substring matching over `key` and `description`.
* Empty query shows every pending migration key row.
* Filtering never changes row data, row identity, saved snapshot, pending order, or persistence output.
* When no row matches, the list shows an empty state inside the list area while the rest of the page remains usable.

### Operation result

Represents visible feedback for import, export, save, clear, and validation outcomes.

Fields, preserving the existing public shape:

| Field | Type | Required | Meaning |
| --- | --- | --- | --- |
| `ok` | `boolean` | Yes | Whether the operation completed successfully. |
| `message` | `string` | Yes | User visible summary. Must distinguish saved state from pending state when relevant. |
| `details` | `string[]` | No | Optional item level details, such as import validation failures. |

Invariants:

* A failed invalid import result reports the failure and leaves pending and saved state unchanged.
* A successful import result reports that values are pending, not saved.
* A successful save result reports that pending values became saved.
* Status must not rely on color alone.

### Confirmation request

Represents a pending explicit confirmation for destructive actions.

Fields:

| Field | Type | Persistence |
| --- | --- | --- |
| `kind` | `'remove-config-row' \| 'remove-localhost-target' \| 'clear-all'` | Ephemeral. |
| `targetUiId` | `string` when removing a migration key row | Ephemeral. |
| `targetKey` | `string` when removing a localhost target | Ephemeral. |
| `message` | `string` | Ephemeral user visible prompt. |

Rules:

* The confirmation surface appears near the triggering row, target, or toolbar clear action.
* No saved state mutates when a confirmation request is opened.
* Confirming a row removal mutates only pending migration key rows.
* Confirming a localhost target removal mutates only pending targets and pending default selection.
* Confirming clear all mutates saved state only through the existing explicit clear behavior, then sets pending and saved snapshots to empty clean state.
* Canceling discards only the confirmation request.

## JSON v3 import and export compatibility

The existing portable configuration shape remains unchanged:

| Field | Meaning |
| --- | --- |
| `version` | Export format version. Version 3 remains the compatible shape for this feature. |
| `exportedAt` | ISO timestamp set by export. |
| `items` | `ConfigItem[]` migration keys. |
| `localhostTargets` | `LocalhostTarget[]` target list. |
| `defaultLocalhostTarget` | Serialized localhost target key. |

Compatibility rules:

* Export builds JSON from the visible in-memory pending configuration, matching the current explicit `OptionsApp` behavior and `ui-contract.md`. Exporting does not persist those pending values and must not label them as saved.
* Import accepts only values that fit existing `ConfigItem`, `LocalhostTarget`, and default target key contracts.
* Version 3 compatibility must be preserved. The redesign must not add row ids, filter text, confirmation data, operation results, or pending snapshot metadata to exported JSON.
* Invalid import leaves current pending and saved state unchanged and emits a failed `OperationResult`.

## State transitions

### Load to clean

Trigger: options page loads saved configuration.

Transition:

1. Read existing storage through current APIs.
2. Normalize through existing storage and utility behavior.
3. Create saved snapshot from normalized values.
4. Create pending editable configuration from the same values, adding only ephemeral row ids.
5. Set list filter empty, confirmation request absent, and `hasPendingChanges` false.

Result: saved snapshot equals pending configuration. State is clean.

### Edit, import, add, remove, or default change to pending

Triggers: inline migration key edit, valid import, valid inline add, confirmed pending row removal, confirmed pending target removal, localhost target add, or default target change.

Transition:

1. Validate the action against pending state.
2. Apply the action to pending state only.
3. Recompute normalized pending values.
4. Compare normalized pending values with the saved snapshot.

Result: if values differ, `hasPendingChanges` is true and the toolbar save action plus page status show pending changes.

### Save to clean

Trigger: user activates save.

Transition:

1. Normalize and validate pending migration keys and localhost target config.
2. Persist through `saveCustomConfig` and `saveLocalhostTargetConfig`.
3. Replace saved snapshot with the normalized return values from storage APIs.
4. Rebuild pending UI rows from the saved values while keeping or recreating ephemeral row ids as needed.
5. Clear stale confirmation request and show a successful `OperationResult`.

Result: saved snapshot equals pending configuration. State is clean.

### Invalid import to unchanged

Trigger: user selects an invalid configuration file for merge or replace import.

Transition:

1. Parse and validate the whole imported payload against JSON v3 compatibility and current entity rules.
2. On any parsing or validation failure, don't apply any imported values.
3. Keep saved snapshot, pending configuration, row ids, filter, and default selection unchanged.
4. Show a failed `OperationResult` with the specific reason and optional details.

Result: pending and saved state are unchanged. Existing pending changes, if any, remain pending.

### Clear confirm to saved empty clean

Trigger: user confirms the toolbar clear all request.

Transition:

1. Open confirmation request from the toolbar clear action.
2. On confirm, call the existing clear behavior for custom config and localhost target configuration.
3. Set saved snapshot to empty values: empty migration keys, empty localhost targets, empty default target key.
4. Set pending editable configuration to the same empty values.
5. Clear row ids, inline editor draft validation, confirmation request, and pending indicator.
6. Show a successful `OperationResult` stating that saved configuration is empty.

Result: saved and pending state are both empty and clean.

## Cross entity invariants

* No schema changes are allowed. New UI state remains ephemeral.
* No new Chrome permissions or runtime message shapes are needed.
* Persisted migration key identity remains `storageType + key`.
* Localhost target normalization and default resolution stay delegated to existing utilities.
* Manual confirmation remains required before destructive saved state changes.
* No state changing operation silently writes to storage except the existing explicit save or explicit confirmed clear flow.
* Pending indicators derive from actual value comparison, not from a flag that can drift.
