# Phase 1 Application Interface Contract: PC First Options Page

## Scope

This contract defines the user visible interface and component event boundary for the redesigned options page. It covers layout regions, stable control names, user commands, page states, responsive behavior, accessibility semantics, and persistence boundaries.

The redesign changes presentation and interaction density only. It must not change IndexedDB v2 stores, storage repository APIs, Chrome permissions, manifest entries, runtime message contracts, or the JSON config export shape.

## Source of truth

- Feature specification: `specs/002-options-pc-redesign/spec.md`
- Phase 0 research decisions: `specs/002-options-pc-redesign/research.md`
- Design governance: `DESIGN.md`
- Current orchestration owner: `src/options/options-app.ts`

## Interface regions

### 1. Compact header

Purpose: identify the page without consuming the visual space used by the current hero block.

Required content:

- Page title: `迁移 Key 配置`
- Supporting text that says the page maintains the keys scanned by the popup
- Optional summary metadata, such as migration key count and localhost target count

Behavior:

- The header is not the primary action area.
- It must not push the migration key work surface below the initial PC viewport when twelve rows exist.
- It may scroll away. The sticky toolbar carries persistent workflow access.

Accessibility:

- The title is the page level `h1`.
- Supporting metadata must be text, not color only.

### 2. Sticky toolbar

Purpose: keep primary configuration actions reachable while users scan or edit a dense list.

Required controls with stable accessible names:

- `导出配置`
- `追加合并导入`
- `覆盖导入`
- `保存全部配置`
- `清空全部配置`

Required indicators:

- Pending configuration indicator, visible when pending state differs from the saved snapshot
- Operation status area for save, export, import, validation, and clear feedback

Behavior:

- The toolbar remains reachable from above the migration key list area and should stay sticky near the top of the scrolling options page on PC widths.
- `保存全部配置` is the only toolbar action that persists pending migration keys, localhost targets, and the default localhost target.
- `导出配置` exports the visible pending configuration, matching current behavior where export reads the in memory options state, not a separate saved snapshot.
- `追加合并导入` opens the hidden JSON file input in merge mode.
- `覆盖导入` opens the hidden JSON file input in replace mode.
- `清空全部配置` must enter an inline confirmation state before it mutates saved state.

Inline confirmation contract:

- Clear all confirmation appears near the toolbar, keeps the list visible, names the action, and offers confirm and cancel controls.
- Confirming clear all performs the existing clear behavior, clearing saved configuration and resetting pending state.
- Canceling clear all returns focus to `清空全部配置` and leaves pending and saved state unchanged.

Status contract:

- Success and error messages are visible text.
- Pending status must distinguish pending changes from saved changes.
- Import success messages must state that imported values are pending until save.
- Invalid import messages must identify the failure and must not clear the current pending state.

### 3. Migration key work surface

Purpose: present saved or pending migration keys as a dense, table like editing surface optimized for 1280px and wider PC viewports.

Required subregions:

- List filter
- Dense row header
- Editable migration key rows
- Inline composer row
- Empty or filtered empty state

#### List filter

Stable accessible name:

- `筛选配置`

Behavior:

- Filters only the migration key list.
- Matches key and description using case insensitive substring logic.
- Does not mutate migration key data, order, saved state, pending state, export payload, or persisted storage.
- Clearing the filter restores all rows.
- If no rows match, show an empty state inside the list area while keeping toolbar, composer, and localhost target controls usable.

Event to `OptionsApp`:

```ts
type MigrationKeyFilterChangeEvent = CustomEvent<{
  value: string
}>
```

Payload expectations:

- `value` is the raw filter text from the input.
- `OptionsApp` owns matching and visible row derivation.

#### Editable migration key rows

Visible columns at wide width:

- Storage type
- Key
- Description
- Row status or validation, when present
- Row actions

Required row controls:

- Storage type select with values `localStorage`, `sessionStorage`, and `cookie`
- Key input
- Description input
- Delete action with stable accessible name pattern: `删除配置 ${key}` when a key exists, otherwise `删除配置行`

Behavior:

- Edits update the pending row immediately and remain pending until `保存全部配置` is activated.
- Rows must use stable UI identity for rendering and updates. Visible filtered index must not be used as the persisted row index.
- Long keys and descriptions must wrap or truncate with accessible full text available through the input value. They must not break row actions out of view.
- Duplicate state type plus key combinations are invalid in pending state and must be reported near the affected row or composer.

Events to `OptionsApp`:

```ts
type MigrationKeyUpdateEvent = CustomEvent<{
  rowId: string
  field: 'storageType' | 'key' | 'description'
  value: string
}>

type MigrationKeyDeleteRequestEvent = CustomEvent<{
  rowId: string
  storageType: 'localStorage' | 'sessionStorage' | 'cookie'
  key: string
}>

type MigrationKeyDeleteConfirmEvent = CustomEvent<{
  rowId: string
}>

type MigrationKeyDeleteCancelEvent = CustomEvent<{
  rowId: string
}>
```

Payload expectations:

- `rowId` is stable for the lifetime of the loaded pending list and any appended row.
- `field` names the exact `ConfigItem` field to update.
- `value` is raw child control output. `OptionsApp` trims and validates only at command boundaries where the current behavior already validates.
- Delete request only opens inline confirmation. Confirm removes from pending state. It does not write to persistence until save.

#### Inline composer row

Purpose: add a new migration key without moving away from the dense list.

Required controls with stable accessible names:

- `新增 Storage 类型`
- `新增 Key`
- `新增说明`
- `加入列表`

Behavior:

- Valid append inserts a new pending row at the end of the full migration key list, not merely the filtered visible subset.
- The inserted row uses the same visual row shape as existing rows.
- The composer clears after a valid append.
- Empty key, unsupported storage type, and duplicate state type plus key are rejected.
- Validation appears next to the composer row and does not rely on color alone.

Event to `OptionsApp`:

```ts
type MigrationKeyAppendEvent = CustomEvent<{
  storageType: 'localStorage' | 'sessionStorage' | 'cookie'
  key: string
  description: string
}>
```

Payload expectations:

- `key` and `description` are raw composer values.
- `OptionsApp` owns trimming, duplicate detection, append ordering, status messages, and pending state derivation.

### 4. Localhost target strip

Purpose: make localhost targets and default target selection visible as one compact PC friendly group.

Required content:

- Protocol selector for new target: `协议`
- Port input for new target: `端口`
- Add target action: `加入端口列表`
- Existing targets displayed as compact chips or rows
- Default marker text: `默认`
- Set default action: `设为默认`
- Remove action with stable accessible name pattern: `删除目标 ${protocol}://localhost:${port}`

Behavior:

- At wide width, targets render in a horizontal friendly strip or wrapped chip row, with target label, default marker, set default action, and remove action visible together.
- Selecting a default changes pending state immediately and is persisted only by `保存全部配置`.
- Removing a non default target removes it from pending state only.
- Removing the current default clears that removed key from pending state, then existing default normalization may select a remaining valid target as required by current storage behavior. This preserves popup compatibility without changing storage semantics.
- Adding an invalid, empty, out of range, or duplicate target is rejected with a message near the strip composer.

Events to `OptionsApp`:

```ts
type LocalhostDraftChangeEvent = CustomEvent<{
  field: 'protocol' | 'port'
  value: string
}>

type LocalhostTargetAppendEvent = CustomEvent<{
  protocol: 'http' | 'https'
  port: string
}>

type LocalhostTargetDefaultEvent = CustomEvent<{
  targetKey: string
}>

type LocalhostTargetDeleteRequestEvent = CustomEvent<{
  targetKey: string
  label: string
  isDefault: boolean
}>

type LocalhostTargetDeleteConfirmEvent = CustomEvent<{
  targetKey: string
}>

type LocalhostTargetDeleteCancelEvent = CustomEvent<{
  targetKey: string
}>
```

Payload expectations:

- `targetKey` uses the same serialized target key that current target utilities produce.
- `label` is the formatted visible target label.
- `OptionsApp` owns normalization, duplicate checks, default reconciliation, pending state, and persistence.

### 5. Hidden import input

Purpose: preserve current file picker behavior while toolbar buttons provide stable visible commands.

Required attributes:

- `type="file"`
- `accept="application/json,.json"`
- Stable id may remain `config-import-input`

Behavior:

- The input is visually hidden but remains programmatically activated by toolbar import actions.
- It does not need to be part of the visible tab order when equivalent visible buttons exist.
- After file handling, its value is cleared so selecting the same file again retriggers change.

Import semantics:

- Merge import appends imported values into the pending configuration, deduped by existing utility behavior.
- Replace import replaces the visible pending configuration.
- Import does not persist until `保存全部配置`.
- Invalid JSON or invalid item shape preserves saved state and current pending state.
- Invalid import status remains visible while the user continues editing.

## Page commands and persistence boundaries

| Command | User control | Pending state effect | Persistence effect | Notes |
|---|---|---|---|---|
| Filter migration keys | `筛选配置` | Updates ephemeral filter only | None | Export still uses full visible pending configuration state, not filtered rows only. |
| Edit migration key | Row storage type, key, description controls | Updates pending row | None | Save required. |
| Append migration key | `加入列表` in composer | Adds pending row | None | Reject invalid or duplicate rows. |
| Request row delete | `删除配置 ...` | Opens inline confirmation | None | List remains visible. |
| Confirm row delete | Row confirmation confirm button | Removes pending row | None | Save required. |
| Add localhost target | `加入端口列表` | Adds pending target | None | Reject invalid or duplicate targets. |
| Set default target | `设为默认` | Updates pending default | None | Save required. |
| Request target delete | `删除目标 ...` | Opens inline confirmation | None | Strip remains visible. |
| Confirm target delete | Target confirmation confirm button | Removes pending target and reconciles pending default | None | Save required. |
| Export config | `导出配置` | None | Downloads JSON file only | Export payload is built from current pending options state, matching current behavior. |
| Merge import | `追加合并导入` | Merges valid import into pending state | None | Save required. |
| Replace import | `覆盖导入` | Replaces pending state with valid import | None | Save required. |
| Invalid import | File input change | None | None | Current pending state is preserved. |
| Save all | `保存全部配置` | Normalized pending state becomes clean saved snapshot | Writes through existing storage APIs | Only save persists pending edits and imports. |
| Clear all request | `清空全部配置` | Opens toolbar confirmation | None | Explicit confirmation required. |
| Clear all confirm | Toolbar confirmation confirm button | Clears pending state after existing clear behavior completes | Uses existing reset and localhost save calls | No schema or API changes. |

## Required page states

### Loading

- The page may show neutral loading text or disabled controls while existing config and localhost target state load.
- No toolbar command should write stale empty state before load completes.

### Clean saved state

- No pending indicator is shown.
- Status may show the last successful operation.
- `保存全部配置` may remain enabled for consistency or be disabled with clear text if no pending changes exist.

### Pending changes

- Toolbar and page status show pending changes in text.
- `保存全部配置` is visually emphasized.
- Navigation away warning may be registered only while this state exists.
- Pending state includes migration keys, localhost targets, and default target differences from the saved snapshot.

### Filtered list

- Only matching migration key rows are visible.
- Composer remains visible.
- Row edits use stable row identity, not visible index.

### Filtered empty

- Shows a message inside the list area, for example `没有匹配的配置项。`
- Provides an obvious way to clear or edit the filter.
- Does not hide toolbar, localhost strip, or composer.

### Inline confirmation open

- Only the targeted destructive action waits for confirmation.
- The affected row, target, or toolbar action remains identifiable by text.
- Confirm and cancel controls are keyboard reachable.
- Escape may cancel if implemented, but button controls are required.

### Import success pending

- Status says imported data is visible and pending until save.
- For merge, status names append or merge behavior.
- For replace, status names replace behavior.

### Import failure

- Status reports the parse or validation error.
- Saved state remains unchanged.
- Current pending state remains unchanged.
- File input resets so the user can retry.

### Save success

- Pending indicator clears.
- Saved snapshot updates to the normalized data returned by existing storage APIs.
- Status confirms the configuration was saved.

## Responsive behavior

### Wide layout, 1280px and above

- PC first dense mode is required.
- The options content may widen beyond the current card feel if needed, while staying governed by `DESIGN.md` spacing, typography, surface, and token rules.
- Toolbar actions appear together in one compact row or controlled wrap that remains above the work surface.
- Migration key rows show storage type, key, description, validation, and row actions together as one logical row.
- Twelve or more migration key rows plus the inline composer should be reachable without scrolling past the list area on a 1440px viewport.
- Localhost targets render together in a compact strip or wrapped chip row.

### Narrow fallback, below 1280px

- Functionality remains complete: add, edit, remove, save, import, export, clear, filter, target add, target delete, and default selection.
- The table may collapse into row groups or a more compact stacked layout.
- DOM order and reading order remain logical: header, toolbar, status, localhost strip, filter, migration key list, composer.
- Sticky toolbar may wrap to multiple rows, but controls keep stable accessible names.
- No control may become hidden without an equivalent reachable control.

### Very narrow or zoomed layouts

- Inputs may stack, but row actions remain reachable.
- Long values wrap safely.
- Horizontal scrolling is allowed only inside the migration key work surface if it preserves visible row headers and accessible controls. It must not be required for page level toolbar actions.

## Accessibility and interaction semantics

### Control size and focus

- All interactive controls must have at least a 40px pointer target height, following `DESIGN.md`.
- Primary fields may remain 48px outside dense rows.
- Every button, input, select, file command surrogate, and confirmation control must be keyboard reachable.
- Visible `:focus-visible` or `:focus-within` styling is required.
- Focus order follows the visible workflow and must not jump into hidden import input controls.

### Labels and E2E stability

Stable accessible names must remain available for these controls because tests may depend on them:

- `导出配置`
- `追加合并导入`
- `覆盖导入`
- `保存全部配置`
- `清空全部配置`
- `加入列表`
- `加入端口列表`
- `设为默认`
- `筛选配置`

Destructive row and target labels may add the affected key or target after the stable verb phrase, but must keep `删除配置` and `删除目标` as the leading action text.

### Semantics

- Use `main` for the page content.
- Use `h1` for the compact header title.
- Use named `section` regions for toolbar/status, localhost targets, and migration keys.
- A native table may be used only if inline editing and responsive fallback remain accessible. If a CSS grid is used, preserve clear text headers and row grouping semantics.
- Status messages should use an appropriate live region when they report async import, save, export, or validation results.
- Error and pending states must include text labels, not color only.

### Keyboard behavior

- Tab reaches toolbar actions, filter, localhost controls, row controls, composer controls, and confirmation controls in visible order.
- Enter or Space activates buttons and confirmation actions through native button semantics.
- Native select and input keyboard behavior must remain intact through `app-select` and `app-input`.
- After canceling inline confirmation, focus returns to the initiating destructive action.
- After confirming deletion, focus moves to the next sensible row action, the composer, or the toolbar if the list is empty.

### Reduced motion

- Respect `prefers-reduced-motion: reduce`.
- Do not animate layout dimensions.
- Allowed motion is limited to interaction meaning, using color, opacity, transform, filter, or shadow tokens.
- Confirmation entry, toolbar stickiness, and row updates must remain understandable with transitions removed.

## Child component boundary

`OptionsApp` remains the orchestration owner. Child components may render toolbar, migration key table, composer, localhost strip, status, or confirmation surfaces, but they must not call storage APIs, read files, create downloads, normalize localhost targets, or mutate global browser state.

Allowed child responsibilities:

- Render given pending data and derived state.
- Dispatch explicit `CustomEvent` commands with typed detail payloads.
- Keep local control focus or open confirmation presentation state only when `OptionsApp` can still cancel or reset it through props.

Required `OptionsApp` responsibilities:

- Load existing custom config, localhost targets, and default target.
- Maintain pending migration keys, localhost targets, default target, filter, status, import mode, and saved snapshot.
- Derive pending change status.
- Validate composer input and duplicate combinations.
- Normalize imported config.
- Handle export download generation.
- Open the import file picker.
- Save through existing storage APIs.
- Clear through existing storage APIs after explicit confirmation.
- Preserve the existing JSON export payload shape:

```ts
type ExportedOptionsConfig = {
  version: 3
  exportedAt: string
  localhostTargets: Array<{ protocol: 'http' | 'https'; port: string }>
  defaultLocalhostTarget: string
  items: Array<{
    storageType: 'localStorage' | 'sessionStorage' | 'cookie'
    key: string
    description: string
  }>
}
  ```

### Event detail conventions

Every child-to-`OptionsApp` event carries an object `detail`; raw string details and detail-less command events are not part of this contract. `rowId` is the existing transient row `uiId` value, renamed only at the component boundary to describe its role.

- Filter events carry `{ value }`.
- Row changes carry `{ rowId, field, value }`; row delete requests carry `{ rowId, storageType, key }`; row delete confirm and cancel events carry `{ rowId }`.
- Composer changes carry `{ field, value }`; append carries `{ storageType, key, description }`.
- Localhost draft changes carry `{ field, value }`; append carries `{ protocol, port }`; default changes carry `{ targetKey }`; delete requests carry `{ targetKey, label, isDefault }`; delete confirm and cancel events carry `{ targetKey }`.
- Toolbar commands use `{ command }` for `export-config`, `save-all`, `clear-all`, `clear-cancel`, and `clear-confirm`. File import continues to use `{ mode, file }`.

`OptionsApp` consumes these object payloads, remains the sole owner of validation, normalization, persistence, and focus-restoration decisions, and never relies on a visible filtered-row index.

## Stable test selectors

E2E and visual tests locate options controls through `data-test-id`; accessible names remain assertions of the accessibility contract, not primary locators. Repeated rows pair their selector with `data-row-id`; localhost targets pair theirs with serialized `data-target-key`.

| Region | Stable selectors |
| --- | --- |
| Toolbar | `options-toolbar`, `options-import-file-input`, `options-export-config-button`, `options-import-merge-button`, `options-import-replace-button`, `options-save-all-button`, `options-clear-all-button`, `options-pending-indicator`, `options-operation-message`, `options-load-status`, `options-load-error`, `options-clear-all-confirmation`, `options-clear-all-cancel-button`, `options-clear-all-confirm-button` |
| Migration keys | `options-key-workspace`, `options-filter-input`, `options-config-row-list`, `options-config-row`, `options-config-row-storage-type`, `options-config-row-key-input`, `options-config-row-description-input`, `options-config-row-validation-message`, `options-config-row-delete-button`, `options-config-row-delete-confirmation`, `options-config-row-delete-cancel-button`, `options-config-row-delete-confirm-button` |
| Composer | `options-config-composer`, `options-composer-storage-select`, `options-composer-key-input`, `options-composer-description-input`, `options-add-config-button`, `options-composer-message` |
| Localhost targets | `options-localhost-strip`, `options-localhost-protocol-select`, `options-localhost-port-input`, `options-add-localhost-button`, `options-localhost-target`, `options-localhost-target-label`, `options-localhost-default-button`, `options-localhost-default-indicator`, `options-localhost-delete-button`, `options-localhost-delete-confirmation`, `options-localhost-delete-cancel-button`, `options-localhost-delete-confirm-button` |

## Non goals

- No new extension permissions.
- No manifest changes.
- No storage schema changes.
- No persisted row IDs.
- No persisted filter preference.
- No autosave.
- No silent background synchronization.
- No credential transfer behavior.
- No child component persistence calls.

## Test obligations

This contract is satisfied only if tests can verify the following:

1. At 1440px with twelve migration keys, row fields and row actions are visible in a dense list with the composer in the list area.
2. Filtering by partial key or description updates visible rows and clearing the filter restores all rows.
3. Inline row edits remain pending until `保存全部配置`.
4. The inline composer appends a valid row and rejects empty or duplicate keys with visible text.
5. The localhost strip shows all configured targets, default marker, set default action, and delete action at 1280px and wider.
6. Default target changes remain pending until save and persist through existing storage after save.
7. Toolbar actions keep stable accessible names and remain reachable while the list is scrolled.
8. `导出配置` exports the current pending options state using the existing JSON shape.
9. Merge and replace imports update pending visible state only. Invalid import preserves saved and pending state.
10. Clear all, row delete, and target delete require inline confirmation before mutation.
11. Pending status is visible and clears after save.
12. Narrow fallback keeps every workflow available.
13. All interactive targets are at least 40px high, keyboard reachable, visibly focused, and reduced motion compatible.
