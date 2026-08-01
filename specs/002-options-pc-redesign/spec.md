# Feature Specification: Options Page PC Redesign

**Feature Branch**: `002-options-pc-redesign`

**Created**: 2026-08-02

**Status**: Draft

**Input**: User description: "目前的配置页我觉得太移动端化了，信息密度有点低。这个插件主要使用场景是pc，我希望你可以重构一下整体的页面，让pc更加易用一点"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Scan and Edit Many Migration Keys at a Glance (Priority: P1)

As a frontend developer maintaining dozens of migration keys, I want the configuration list to be displayed as a dense, table-like view on a PC screen so that I can scan, find, edit, and remove many entries without excessive vertical scrolling or stacking one card per row.

**Why this priority**: Information density is the core complaint that motivated this feature; the current one-card-per-row layout wastes the wide horizontal space of a typical PC viewport and makes a list of even ten entries feel laborious.

**Independent Test**: Load the options page on a 1440px-wide viewport with at least twelve saved migration keys, verify that all entries and the inline editor are visible together on a single screen, edit one key and one description, and confirm that the changes are persisted.

**Acceptance Scenarios**:

1. **Given** twelve or more saved migration keys and a viewport at least 1280px wide, **When** the options page loads, **Then** every entry's storage type, key, description, and row action are visible together on the initial screen without vertical scrolling past the list area.
2. **Given** the dense list is visible, **When** the user edits a key or description inline, **Then** the change is reflected in the list row immediately and remains pending until the user saves.
3. **Given** the user wants to find one entry, **When** the user types a partial key or description into a list filter, **Then** only entries whose key or description contains the filter string remain visible, and clearing the filter restores every entry.
4. **Given** a list filter returns no matches, **When** the filter is active, **Then** the user sees a clear empty state inside the list area and the rest of the page remains usable.

---

### User Story 2 - Manage Localhost Targets in a Compact Strip (Priority: P1)

As a frontend developer, I want the localhost target list and default-target selector to share a compact, horizontal-friendly strip so that I can review all targets at once and switch the default with a single click instead of tapping through card-per-row layouts.

**Why this priority**: The localhost target panel suffers from the same low-density problem as the migration-key list, and developers typically have only a handful of targets, so compactness here directly improves the daily PC workflow.

**Independent Test**: With three localhost targets configured, verify all targets and the default selector render together on one row group, switch the default target, save, and confirm the new default is honored by the popup.

**Acceptance Scenarios**:

1. **Given** two or more localhost targets are configured and the viewport is at least 1280px wide, **When** the options page loads, **Then** every target, its default marker, and its row actions render together in one compact strip without requiring vertical scrolling past the list area.
2. **Given** a target that is not the default, **When** the user marks it as default, **Then** the previous default loses its default marker and the new default is highlighted within the same view.
3. **Given** a target is removed, **When** the removal completes, **Then** any target that had been selected as the default and is no longer present is cleared and the remaining targets stay usable.

---

### User Story 3 - Compose New Migration Keys Inline (Priority: P2)

As a frontend developer, I want the new-item editor to live inside the same dense view rather than above the list so that I can compose a new entry, append it, and immediately see it appear in the list without losing my place.

**Why this priority**: The current page forces the editor above the list, which both wastes vertical space and breaks the developer's visual flow when adding or reviewing entries; placing the editor inline preserves the manual-confirmation flow while restoring density.

**Independent Test**: With the page already showing a dense list of migration keys, type a new key and description into the inline editor, append the row, and verify the new entry appears at the bottom of the list with the same row shape as existing entries.

**Acceptance Scenarios**:

1. **Given** the dense list is visible, **When** the user enters a state type, key, and optional description in the inline editor row, **Then** appending the entry inserts it at the end of the list with the same row shape and remains pending until the user saves.
2. **Given** the inline editor row is empty or has an invalid key, **When** the user attempts to append, **Then** no entry is added and an inline validation message is shown next to the editor row.
3. **Given** the user has unsaved pending changes in the list, **When** the user tries to leave the page, **Then** a visible reminder informs them that pending changes have not been saved.

---

### User Story 4 - Reorganize Configuration via Compact Toolbar (Priority: P2)

As a frontend developer, I want the page's primary actions — export, import (merge or replace), save, and clear — to live in a persistent toolbar above the list so that they remain reachable without scrolling and the page does not waste a hero block on a single heading.

**Why this priority**: A persistent toolbar that stays in view while the user scrolls long lists is a defining PC ergonomics improvement; placing these actions next to the list eliminates wasted vertical space and reduces context switching.

**Independent Test**: With the page scrolled into a long migration-key list, verify the export, import, save, and clear actions remain reachable from the visible toolbar, then export the configuration and confirm the file contents reflect the current saved values.

**Acceptance Scenarios**:

1. **Given** any viewport at least 1280px wide, **When** the options page loads, **Then** the export, merge import, replace import, save, and clear actions are visible together in a single toolbar near the top of the content area.
2. **Given** the page is scrolled within the migration-key list, **When** the user activates any toolbar action, **Then** the action behaves identically to its current implementation (export downloads a file, import opens a file picker, save persists, clear empties everything after confirmation).
3. **Given** the user has selected the destructive clear-all action, **When** confirmation is required, **Then** the confirmation surface appears near the toolbar rather than as a full-page takeover so the list remains visible.

---

### User Story 5 - Keep Configuration Portable Across Sessions (Priority: P3)

As a frontend developer, I want import feedback, validation messages, and pending-change indicators to remain visible while I review the dense list so that I never lose track of unsaved state or unsure imports.

**Why this priority**: Density is only useful when accompanied by clear status affordances; without persistent status, a dense list can feel risky or confusing.

**Independent Test**: Import a configuration file that contains invalid entries and confirm that the page reports the specific failure without losing the existing list; then save and confirm the saved state matches the visible pending state.

**Acceptance Scenarios**:

1. **Given** an invalid configuration file is selected for import, **When** parsing fails, **Then** a status message identifies the specific failure, the existing list is unchanged, and the user can continue editing without leaving the page.
2. **Given** the user has pending changes, **When** the user views the page, **Then** a visible indicator marks the toolbar save action and the page-level status as containing pending changes.
3. **Given** the user has saved the configuration, **When** the page reloads or reopens, **Then** the saved state matches what was last visible as pending.

### Edge Cases

- The active browser tab does not grant the options page access or the IndexedDB v2 stores are unavailable when the page loads.
- The viewport is narrower than 1280px (for example, on a smaller laptop or zoomed-in browser window); the redesigned layout must degrade gracefully without losing the underlying functionality.
- A migration key has a very long key name or description that would overflow a dense row.
- The user submits the inline editor with a duplicate state-type-plus-key combination; the row must be rejected with a clear message instead of silently being merged later.
- The user submits a localhost port that is out of range, already present, or empty.
- The user clears all configuration while pending changes exist; the destructive action must remain explicit and reversible only by reloading saved state.
- The user imports a configuration while pending changes exist; the import must clearly state whether pending changes are replaced or preserved.
- The user removes the default localhost target while it is in use by the popup default-target selection.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The options page MUST present migration keys as a dense, table-like list on viewports at least 1280px wide so that twelve or more entries are reachable together with their inline editor and primary toolbar without vertical scrolling past the list area.
- **FR-002**: Each migration-key row MUST keep its state type, key, description, and row action visible together as one logical row at the redesigned layout's standard width.
- **FR-003**: Users MUST be able to edit a migration key's state type, key, and description inline within the list row, and such edits MUST remain pending until the user explicitly saves.
- **FR-004**: The options page MUST provide a list filter scoped to the migration-key list that matches against the key and description and that, when cleared, restores every entry.
- **FR-005**: The options page MUST present localhost targets as a compact strip on viewports at least 1280px wide so that all targets, the default marker, and their row actions remain visible together.
- **FR-006**: Users MUST be able to select exactly one configured localhost target as the default and the chosen default MUST persist exactly as before so that popup default-target selection continues to work unchanged.
- **FR-007**: Removing the currently selected default localhost target MUST clear the default selection and leave the remaining targets usable.
- **FR-008**: The options page MUST keep an inline editor row within the migration-key list area for composing new entries, and appending a valid entry MUST insert it as a new row in the list using the same row shape.
- **FR-009**: The inline editor MUST reject an entry with an empty or invalid key, an unsupported storage type, or a state-type-plus-key combination that already exists in the current list, and MUST display the specific reason near the editor row.
- **FR-010**: The options page MUST expose the export, merge import, replace import, save, and clear-all actions in a single toolbar that remains reachable from above the migration-key list area.
- **FR-011**: Activating any toolbar action MUST behave identically to its current behavior: export downloads a configuration file, merge import appends deduplicated values, replace import overwrites pending values, save persists pending values, and clear empties saved values after explicit confirmation.
- **FR-012**: The clear-all action MUST require an explicit confirmation step before mutating saved state.
- **FR-013**: Imported configuration changes MUST remain visible and pending until the user explicitly saves them, and invalid imports MUST NOT overwrite the existing saved or pending state.
- **FR-014**: The options page MUST show a visible indicator whenever pending changes exist and MUST clearly state the difference between saved and pending state in any status message.
- **FR-015**: The options page MUST degrade gracefully on viewports below 1280px so that the underlying functionality (add, edit, remove, save, import, export, clear, default target selection) remains available even if the layout becomes more compact.
- **FR-016**: The options page MUST continue to load its saved state from the same IndexedDB v2 stores, preserve the existing JSON export shape (version, exportedAt, items, localhostTargets, defaultLocalhostTarget), and remain backward-compatible with already-saved configuration.
- **FR-017**: The options page MUST keep the migration-key composition flow explicitly user-triggered; no change to this feature may silently apply pending edits to saved state.
- **FR-018**: The options page MUST preserve the manual-confirmation flow for destructive actions and MUST NOT introduce silent background synchronization of saved configuration.
- **FR-019**: All interactive controls introduced or moved by this feature MUST remain keyboard reachable, show a visible focus state, and provide status that does not rely on color alone.
- **FR-020**: The options page MUST honor the user's reduced-motion preference and MUST keep primary state-changing controls at least 32 pixels high so they remain usable on standard PC point-and-click input.

### Key Entities

- **Migration Key (existing)**: A user-maintained rule identifying one supported state type and key, with an optional description; it defines what scanning is allowed to inspect. The redesigned list row remains the visual representation of this entity.
- **Localhost Target (existing)**: A configured loopback destination identified by protocol and port; one target may be selected as the shared default. The redesigned compact strip is the new visual representation.
- **Pending Configuration State (new, derived)**: The in-memory set of migration keys, localhost targets, and default-target selection that differs from saved state; the redesigned page must keep this state visible and clearly labeled.
- **List Filter (new)**: The current substring filter applied to the migration-key list; it is ephemeral page state that never reaches persisted storage.
- **Operation Result (existing)**: A visible outcome containing success or failure state, a direct message, and optional item-level details; this remains the carrier for import, export, save, and clear feedback.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: With twelve or more saved migration keys on a 1440px-wide viewport, the developer can see every entry's storage type, key, description, and row action without scrolling past the migration-key list area.
- **SC-002**: With three localhost targets configured on a 1280px-wide viewport, every target, its default marker, and its row actions render together in one compact strip without vertical scrolling past the strip area.
- **SC-003**: A developer can locate a specific migration key among twenty saved entries using the list filter in under five seconds.
- **SC-004**: A developer can add, edit, and save a migration key without leaving the migration-key list area or scrolling the toolbar out of view.
- **SC-005**: 100% of primary workflow controls (add, edit, remove, default selection, import, export, save, clear) remain reachable from the toolbar and the migration-key list area on a 1280px-wide viewport.
- **SC-006**: 100% of destructive actions (remove item, remove target, clear all) require explicit confirmation before mutating saved state, and 100% of imports that fail validation leave saved state unchanged.
- **SC-007**: All pre-existing popup and persistence behaviors (default target sync, JSON export format, IndexedDB v2 store usage, retention of legacy chrome.storage.local data) continue to function unchanged after the redesign.
- **SC-008**: All interactive controls remain keyboard reachable, show a visible focus indicator, and remain operable with the user's reduced-motion preference enabled.
- **SC-009**: On viewports below 1280px, the redesigned page remains fully usable; no documented workflow becomes unavailable simply because the dense layout cannot fit.

## Assumptions

- The intended users are the same frontend developers who already use the popup, with typical PC viewports of 1280px to 1920px wide and standard point-and-click or keyboard input.
- Existing IndexedDB v2 stores and the storage repository API are treated as stable contracts; the redesign only changes how the configuration data is presented, never its persistence shape.
- The existing JSON export schema (version 3 with `items`, `localhostTargets`, `defaultLocalhostTarget`, `exportedAt`) remains the wire format for compatibility with previously exported files.
- The existing manual-confirmation flow for state-changing actions is preserved; this feature does not introduce any silent background synchronization or auto-save behavior.
- The current Material Design 3 themed primitives (`app-input`, `app-select`, `app-choice-card`) and shared CSS tokens remain the visual foundation; the redesign optimizes composition and density, not the underlying design system.
- Default-target selection continues to be the single source of truth for the popup's default localhost target.
- The redesigned layout prioritizes PC ergonomics; mobile and very small viewports remain functional but receive a more compact, less dense fallback rather than a mobile-first layout.
- No new permissions, silent synchronization, or credential-handling behavior is introduced by this feature.