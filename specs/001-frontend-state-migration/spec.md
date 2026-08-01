# Feature Specification: Frontend State Migration Baseline

**Feature Branch**: `master` (baseline documentation)

**Created**: 2026-08-01

**Status**: Draft

**Input**: User description: "基于当前已实现的项目，整理 Frontend State Migrator 的基线产品规格，不新增未来功能。"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Capture Reproducible Page State (Priority: P1)

As a frontend developer debugging an online page, I want to scan only the configured non-sensitive frontend state, inspect every matched item, select the items I need, and save them as a named dataset so that I can reproduce the same page state later without manually copying values.

**Why this priority**: Capturing an inspectable dataset is the prerequisite for every migration workflow and provides value even before any automatic target injection is used.

**Independent Test**: Configure keys for each supported state type, open a page containing matching values, scan the page, deselect one result, save the dataset, and verify that the dataset contains only the selected results together with its source and creation information.

**Acceptance Scenarios**:

1. **Given** a non-local page with configured keys and matching state, **When** the user opens the popup, **Then** export mode is selected by default and the current page identity is visible.
2. **Given** matching configured state exists, **When** the user scans the page, **Then** the number of matched and selected items is visible, primary save actions remain available, and the detailed matched-item list can be revealed through an explicit disclosure before any item can be saved.
3. **Given** the scan results are visible, **When** the user changes the selection and saves, **Then** a dataset is created from only the selected items and a readable success result is displayed.
4. **Given** the user leaves the dataset name empty, **When** at least one selected item is saved, **Then** the dataset receives a generated human-readable name.
5. **Given** no export item is selected, **When** the user attempts to save, **Then** no dataset is created and the user is told to select at least one item.

---

### User Story 2 - Inspect and Restore Saved State (Priority: P1)

As a frontend developer working on a target page, I want to choose a saved dataset, review and select its individual items, and explicitly start the import so that only the state I approve is written to the page.

**Why this priority**: Selective, manually confirmed restore is the core outcome of state migration and prevents opaque or unintended writes.

**Independent Test**: Open a supported target page with at least one saved dataset, select a subset of its items, start the import, and verify that the result reports every successful and failed item without importing deselected items.

**Acceptance Scenarios**:

1. **Given** the active page uses `localhost`, `127.0.0.1`, or `::1`, **When** the popup opens, **Then** import mode is selected by default while the user remains able to switch modes manually.
2. **Given** saved datasets exist, **When** import mode is shown, **Then** the newest dataset is selected initially, its name/source/count and selected-item summary are visible, and its detailed item list can be revealed through an explicit disclosure before import.
3. **Given** a dataset is selected, **When** the user deselects one or more items and confirms import, **Then** only the remaining selected items are submitted to the target page.
4. **Given** no import item is selected, **When** the user attempts to import, **Then** no page state is changed and the user is told to select at least one item.
5. **Given** some selected items cannot be written, **When** the import finishes, **Then** the result distinguishes the successful count from the failed count and lists failure details.
6. **Given** an import has completed, **When** the user requests a page refresh, **Then** the active target page is reloaded and the refresh result is displayed.

---

### User Story 3 - Save and Inject into a Local Target (Priority: P2)

As a frontend developer viewing a source page, I want to save selected state and send it to a configured local target in one explicit action so that I can reproduce the source state in my development environment with fewer manual steps.

**Why this priority**: This shortens the common online-to-local workflow while preserving the same visible selection and manual trigger required by the basic export and import journeys.

**Independent Test**: Configure a local target, scan a source page containing web state and cookies, select items, invoke save-and-inject, and verify the dataset is saved, the target is opened, and the result identifies full, partial, or cookie-only completion.

**Acceptance Scenarios**:

1. **Given** one or more local targets are configured, **When** the popup loads export mode, **Then** the persisted default target is selected and the user can choose another target.
2. **Given** a user changes the selected local target, **When** the choice is accepted, **Then** it becomes the default target for subsequent popup and configuration-page use.
3. **Given** selected state and a valid target, **When** the user chooses save-and-inject, **Then** the dataset is saved before a new local target page is opened and injection is attempted.
4. **Given** the selected data contains cookies, **When** save-and-inject starts, **Then** eligible cookies are applied before the target page opens so they are available during initial page loading.
5. **Given** the target page cannot receive page-side state, **When** cookie application succeeded, **Then** the target remains open and the result clearly states that cookies were applied while the remaining state failed.
6. **Given** no local target is configured, **When** the user views export mode, **Then** save-and-inject is unavailable and the user is directed to configure a target.

---

### User Story 4 - Configure Migration Scope and Targets (Priority: P2)

As a frontend developer, I want to maintain the exact keys that may be migrated and the local targets that may receive them so that scanning and injection remain deliberate, reusable, and limited to known non-sensitive state.

**Why this priority**: Explicit configuration defines the migration boundary and prevents broad, implicit collection of page state.

**Independent Test**: Add, edit, remove, export, merge-import, replace-import, and clear migration configuration, then verify that only confirmed and saved configuration affects subsequent scans and target choices.

**Acceptance Scenarios**:

1. **Given** the configuration page is open, **When** the user adds a state type, non-empty key, and optional description, **Then** the item appears in the editable configuration list.
2. **Given** duplicate configuration entries are introduced, **When** configuration is normalized or saved, **Then** entries with the same state type and key are represented once.
3. **Given** a protocol and valid local port, **When** the user adds a target, **Then** the target is available for default selection and popup injection.
4. **Given** multiple local targets, **When** the user changes the default and saves, **Then** the selected default remains valid and is reused in the popup.
5. **Given** current configuration exists, **When** the user exports it, **Then** a readable configuration file contains the migration keys, local targets, default target, format version, and export time.
6. **Given** a valid configuration file, **When** the user chooses merge import, **Then** imported values are deduplicated with existing values and remain pending until the user saves.
7. **Given** a valid configuration file, **When** the user chooses replace import, **Then** the pending configuration is replaced by the normalized imported values and remains pending until the user saves.
8. **Given** an invalid configuration file, **When** import is attempted, **Then** current saved configuration remains unchanged and a specific validation message is displayed.
9. **Given** saved configuration exists, **When** the user clears all configuration, **Then** migration keys, local targets, and the default target are removed and a completion message is displayed.

---

### User Story 5 - Manage and Retain Extension State (Priority: P3)

As a returning developer, I want my datasets and configuration to remain available across extension sessions, including after upgrading from a supported earlier data layout, so that I do not need to rebuild my debugging setup.

**Why this priority**: Persistence and migration protect accumulated debugging work, but the primary capture and restore journeys can still be demonstrated independently with fresh state.

**Independent Test**: Save more than the retention limit, reopen the extension, delete a dataset, and initialize from each supported legacy state source; verify ordering, pruning, cascade deletion, retained configuration, and preservation of legacy source data.

**Acceptance Scenarios**:

1. **Given** datasets have been saved at different times, **When** the dataset list is loaded, **Then** datasets are ordered newest first.
2. **Given** ten datasets already exist, **When** another dataset is saved, **Then** the newest ten remain available and the oldest dataset and its items are removed.
3. **Given** a user deletes a dataset, **When** deletion completes, **Then** the dataset and all of its items are removed and the next newest dataset is selected when available.
4. **Given** supported legacy extension state exists and current storage is not initialized, **When** the extension first initializes, **Then** datasets, items, key configuration, local targets, and the default target become available once without deleting the legacy source values.
5. **Given** current storage has already been initialized, **When** the extension starts again, **Then** legacy inputs are not re-applied over current data.

### Edge Cases

- The active browser tab is absent, has no readable address, or does not permit extension access.
- No migration keys are configured, or configured keys produce no scan matches.
- Multiple items share the same state type and key in saved or imported input.
- A cookie exists in more than one browser scope but only one eligible value can be represented for a configured key.
- A cookie has attributes that prevent it from being written to the selected target.
- A local target has an invalid protocol or port, the target tab cannot be opened, or the target page does not become ready in time.
- Cookies succeed before local target navigation while web state later fails, producing a partial result rather than an all-or-nothing claim.
- A selected dataset is deleted while other datasets exist, or the final dataset is deleted.
- A configuration file is malformed, lacks an item list, contains an unsupported state type, or contains an empty key.
- Imported configuration references a default local target that is absent after normalization.
- Legacy state is missing optional fields, contains duplicate records, or contains more datasets than the current retention limit.
- A state operation partially succeeds; every failed item must remain identifiable in the result.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The product MUST require an explicit user action for every scan, save, import, refresh, configuration import, configuration clear, and local-target injection operation.
- **FR-002**: The product MUST NOT perform background or silent synchronization of page state between environments.
- **FR-003**: The product MUST limit scanning to user-configured keys for local state, session state, and cookies.
- **FR-004**: The product MUST keep export item summaries/counts and save actions visible, and MUST make each matched item’s state type, key, and value preview available through an explicit disclosure before the user saves it.
- **FR-005**: Users MUST be able to include or exclude individual matched items before saving a dataset.
- **FR-006**: The product MUST reject a save attempt when no export item is selected and MUST preserve the current scan results for correction.
- **FR-007**: A saved dataset MUST record a human-readable name, source page address, creation time, and deduplicated ordered items; an empty user-provided name MUST be replaced with a generated name.
- **FR-008**: The product MUST list saved datasets newest first and retain at most ten datasets, removing the oldest excess dataset together with its items.
- **FR-009**: Users MUST be able to delete a dataset, and deletion MUST remove all items belonging to that dataset.
- **FR-010**: The product MUST keep the selected dataset’s identity, source, item count, selected-item summary, and import action visible, and MUST make every selected-dataset item available through an explicit disclosure before import while selecting all items by default when the dataset is first selected.
- **FR-011**: Users MUST be able to include or exclude individual dataset items before explicitly starting import.
- **FR-012**: The product MUST reject an import attempt when no item is selected and MUST leave the target page unchanged.
- **FR-013**: The product MUST apply only selected import items and MUST report successful and failed item counts, including item-specific failure details when failures occur.
- **FR-014**: Users MUST be able to request a reload of the active target page after import and receive a visible completion or error result.
- **FR-015**: The popup MUST default to import mode for `localhost`, `127.0.0.1`, and `::1` pages, and to export mode for other accessible pages; users MUST remain able to switch modes manually.
- **FR-016**: Users MUST be able to maintain migration-key entries consisting of a supported state type, a non-empty key, and an optional description.
- **FR-017**: Migration-key entries with the same state type and key MUST be deduplicated.
- **FR-018**: Users MUST be able to add and remove local targets identified by HTTP or HTTPS protocol and a valid port, and select one configured target as the default.
- **FR-019**: A default local target MUST always resolve to an existing configured target or to no target when the target list is empty.
- **FR-020**: Changing the local target in the popup MUST persist that target as the shared default used by subsequent popup and configuration-page sessions.
- **FR-021**: The product MUST disable save-and-inject when no local target is available and MUST tell the user where configuration is required.
- **FR-022**: Save-and-inject MUST save the selected dataset before opening the chosen local target and attempting to apply its items.
- **FR-023**: During local-target injection, eligible cookies MUST be attempted before target navigation so they can participate in the target page’s initial load.
- **FR-024**: When page-side local or session state cannot be applied, the product MUST keep the opened target available and accurately report any cookies that succeeded and every remaining failure.
- **FR-025**: When page-side state is successfully injected, the product MUST refresh the opened target when needed to allow the page to consume the new state.
- **FR-026**: Users MUST be able to export migration-key and local-target configuration to a file that identifies its format version and export time.
- **FR-027**: Users MUST be able to import configuration in merge mode, which deduplicates imported and current values without removing unrelated current values.
- **FR-028**: Users MUST be able to import configuration in replace mode, which replaces the pending key and target configuration with normalized imported values.
- **FR-029**: Imported configuration changes MUST remain visible and pending until the user explicitly saves them.
- **FR-030**: Invalid configuration input MUST be rejected with a specific message and MUST NOT overwrite saved configuration.
- **FR-031**: Users MUST be able to clear all migration keys, local targets, and the default target through an explicit destructive action.
- **FR-032**: Datasets, dataset items, migration keys, local targets, the default target, and initialization status MUST persist across extension sessions.
- **FR-033**: On first initialization from a supported legacy state layout, the product MUST preserve equivalent datasets, items, migration keys, local targets, and default-target selection in current state.
- **FR-034**: Legacy migration MUST run at most once for initialized current state and MUST NOT delete or mutate the legacy source values.
- **FR-035**: Every completed or failed state-changing operation MUST produce text that states the outcome; partial completion MUST NOT be presented as full success.
- **FR-036**: Pending export and import data MUST remain inspectable, selectable, and manually confirmable before state is written or saved; detailed item lists MAY start collapsed only when item summaries/counts and primary actions remain visible and the complete details are one explicit disclosure expansion away.
- **FR-037**: All workflow controls MUST remain keyboard reachable, provide a visible focus state, and expose status without relying on color alone.
- **FR-038**: The product MUST honor the user’s reduced-motion preference and MUST keep state-changing controls at least 40 pixels high.
- **FR-039**: The product MUST operate only within browser-granted access and MUST NOT attempt to bypass page, cookie, or browser security restrictions.
- **FR-040**: The product MUST present itself as a tool for deliberately selected non-sensitive frontend state and MUST NOT add authentication, credential extraction, or credential-transfer behavior.

### Key Entities

- **Migration Key**: A user-maintained rule identifying one supported state type and key, with an optional description; it defines what scanning is allowed to inspect.
- **Dataset**: A named, time-stamped capture associated with one source page and containing an ordered set of selected dataset items.
- **Dataset Item**: One captured state value identified by state type and key; cookie items additionally retain the attributes required to reproduce their browser-visible behavior when permitted.
- **Local Target**: A configured localhost destination identified by protocol and port; one target may be selected as the shared default.
- **Active Page**: The currently selected browser page, represented by its identity and the access needed for scanning, importing, or refreshing.
- **Operation Result**: A visible outcome containing success or failure state, a direct message, and optional item-level details.
- **Persisted Extension State**: The complete collection of datasets, items, migration keys, local targets, default-target selection, and initialization metadata retained between sessions.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A developer with configured keys can scan, review, select, name, and save a dataset in under two minutes, excluding time spent choosing which values are appropriate to migrate.
- **SC-002**: A developer can select a saved dataset, review all items, adjust the selection, and start an import in under one minute.
- **SC-003**: In acceptance testing, 100% of candidate export item details and selected import item details are reachable through an explicit disclosure before the corresponding state-changing action, while item summaries/counts and primary actions remain visible without expansion.
- **SC-004**: In acceptance testing, 100% of deselected items are excluded from the saved dataset or import request.
- **SC-005**: Popup default mode is correct in 100% of tests covering `localhost`, `127.0.0.1`, `::1`, and non-local addresses.
- **SC-006**: After any save, delete, or legacy initialization, the dataset list contains no more than ten entries, is ordered newest first, and contains no orphaned items.
- **SC-007**: In all full, partial, and failed import or injection tests, the visible result accounts for every attempted item as either successful or failed; no attempted failure is silent.
- **SC-008**: Saved migration keys, local targets, and the default target remain identical after closing and reopening the extension, except for explicit user changes or documented normalization.
- **SC-009**: For each supported legacy-state test fixture, all representable user data is available after first initialization and the legacy source remains unchanged.
- **SC-010**: 100% of primary workflow controls can be reached and operated using a keyboard, show visible focus, and remain usable with reduced motion enabled.

## Assumptions

- The intended users are frontend developers who understand the meaning and sensitivity of the state keys they configure.
- Users are responsible for selecting only non-sensitive state; the product does not classify arbitrary values or guarantee that a user-configured key is safe.
- Users have installed the extension with the permissions required for the active page and accept that browser-restricted pages or cookie attributes may prevent collection or injection.
- One captured item is identified by the combination of state type and key; duplicate occurrences are normalized to one item within a dataset or configuration list.
- Local targets are limited to loopback development destinations expressed as `localhost` plus a supported protocol and port.
- Configuration imports support current structured exports and known earlier configuration shapes; unsupported or malformed shapes are rejected rather than guessed.
- The current retention policy is the ten newest datasets; no archive, search, grouping, or cloud synchronization is included in this baseline.
- The baseline excludes silent synchronization, browser-security bypass, authentication workflows, credential transfer, domain-based recommendations, and future roadmap items.
