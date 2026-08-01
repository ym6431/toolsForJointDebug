# Tasks: Options Page PC Redesign

**Input**: Design documents from `/specs/002-options-pc-redesign/`
**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/ui-contract.md](./contracts/ui-contract.md), [quickstart.md](./quickstart.md)

**Branch**: `002-options-pc-redesign`
**Tests**: Manual, unit, and E2E coverage are required by the spec and the operative governance (`AGENTS.md`, `DESIGN.md`). Tests tasks are therefore included for each user story.

**Organization**: Tasks are grouped by user story to enable independent implementation and verification of each story. The shared foundation (pure helpers, compact primitives) is split into Setup and Foundational phases so all stories depend on it.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3, US4, US5)
- Include exact file paths in descriptions

## Path Conventions

- Single Chrome extension project
- Options module: `src/options/`
- Shared primitives: `src/components/`
- Shared contracts: `src/shared/`
- E2E: `test/`

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Confirm the workspace, scripts, and shared primitive entry points before any layout refactor.

- [X] T001 Confirm pnpm scripts and Vitest configs in `package.json`, `vite.config.ts`, `vitest.e2e.config.ts`, and `vitest.visual.config.ts`
- [X] T002 Verify shared utilities in `src/shared/utils.ts` and storage entry points in `src/shared/storage.ts` are unchanged and still exported
- [X] T003 [P] Inspect existing `OptionsApp` responsibilities in `src/options/options-app.ts` and shared primitives in `src/components/app-input.ts` and `src/components/app-select.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Pure helpers and compact primitives that every user story depends on. No user story work begins until this phase completes.

**Independent Verification**: `pnpm test` runs `options-state.test.ts` and the new primitive styles compile without errors.

- [X] T004 Add pure helpers (row identity, filter, duplicate validation, snapshot comparison, default reconciliation) in `src/options/options-state.ts`
- [X] T005 Add Vitest unit tests for the pure helpers in `src/options/options-state.test.ts`
- [X] T006 [P] Add compact variant property to `src/components/app-input.ts` while preserving the existing default sizing and events
- [X] T007 [P] Add compact variant property to `src/components/app-select.ts` while preserving the existing default sizing and events
- [X] T008 Extend `OptionsApp` in `src/options/options-app.ts` with saved snapshot, pending derivation, and `beforeunload` cleanup skeleton that all stories depend on
- [X] T009 Verify `pnpm test` runs the new pure helper tests cleanly

**Checkpoint**: Foundation ready. User story work can now begin.

---

## Phase 3: User Story 1 - Dense Migration Key Workspace (Priority: P1) 🎯 MVP

**Goal**: Present migration keys as a dense, table-like editing surface with a list filter, inline edits, and a row composer so twelve or more entries plus the composer remain reachable on PC widths.

**Independent Test**: With at least twelve saved migration keys on a 1440px viewport, load the options page, verify every entry's storage type, key, description, and row action are visible without scrolling past the list area, edit a key inline, filter the list, and confirm pending changes survive filtering.

### Tests for User Story 1 ⚠️

- [X] T010 [P] [US1] Add unit tests for row identity, filter matching, duplicate detection, and pending snapshot comparison in `src/options/options-state.test.ts`
- [X] T011 [P] [US1] Add E2E test for dense migration key workspace at 1440px with twelve rows in `test/extension.e2e.test.ts`

### Implementation for User Story 1

- [X] T012 [US1] Extract dense migration key row template plus composer row in `src/options/options-config-table.ts` and dispatch the events defined in `contracts/ui-contract.md`
- [X] T013 [US1] Add `MigrationKeyFilterChangeEvent`, `MigrationKeyUpdateEvent`, and `MigrationKeyAppendEvent` handlers in `src/options/options-app.ts`
- [X] T014 [US1] Add migration key filter input, dense list area, and inline composer row to `OptionsApp` in `src/options/options-app.ts`
- [X] T015 [US1] Ensure row edits and composer appends remain pending, derive `hasPendingChanges`, and surface empty state text inside the list area in `src/options/options-app.ts`
- [X] T016 [US1] Apply compact primitives and PC-first density styles for the migration key work surface in `src/options/options-app.ts`

**Checkpoint**: User Story 1 is fully functional and independently testable. The migration key list, filter, inline edits, and composer all work end to end.

---

## Phase 4: User Story 2 - Compact Localhost Target Strip (Priority: P1)

**Goal**: Render localhost targets, default marker, set-default action, and remove action in one compact strip while preserving popup default-target compatibility.

**Independent Test**: With three localhost targets configured, switch the default, save, and confirm the popup uses the new default target. Remove the current default and confirm remaining targets stay usable without changing storage semantics.

### Tests for User Story 2 ⚠️

- [X] T017 [P] [US2] Add unit tests for default reconciliation when removing the current default and reordering pending targets in `src/options/options-state.test.ts`
- [X] T018 [P] [US2] Add E2E test for compact localhost strip, default switch, default removal, and popup default sync in `test/extension.e2e.test.ts`

### Implementation for User Story 2

- [X] T019 [P] [US2] Extract compact localhost target strip in `src/options/options-localhost-strip.ts` and dispatch the events defined in `contracts/ui-contract.md`
- [X] T020 [US2] Add `LocalhostTargetAppendEvent`, `LocalhostTargetDefaultEvent`, `LocalhostDraftChangeEvent`, and `LocalhostTargetDeleteRequestEvent` handlers in `src/options/options-app.ts`
- [X] T021 [US2] Render the compact strip, default marker, set-default action, and remove action above the migration key list in `src/options/options-app.ts`
- [X] T022 [US2] Apply compact strip styles and reconciliation rule (clear removed default first, then existing deterministic normalization) in `src/options/options-app.ts`

**Checkpoint**: User Stories 1 and 2 work independently. PC developers can scan dense migration keys and manage localhost targets with one click.

---

## Phase 5: User Story 3 - Inline Composer Validation and Pending Reminder (Priority: P2)

**Goal**: Keep the inline composer inside the list area and surface explicit validation plus a beforeunload reminder so pending edits are never silently lost.

**Independent Test**: Try to add an empty, invalid, or duplicate state-type-plus-key entry, then trigger a row remove and a tab close while pending edits exist. Verify rejected entries leave pending state unchanged, and the beforeunload reminder fires only when there are pending changes.

### Tests for User Story 3 ⚠️

- [X] T023 [P] [US3] Add unit tests for composer validation, duplicate detection, and pending reminder lifecycle in `src/options/options-state.test.ts`
- [X] T024 [P] [US3] Add E2E test for inline composer validation, row delete, and beforeunload reminder in `test/extension.e2e.test.ts`

### Implementation for User Story 3

- [X] T025 [US3] Extend `OptionsApp` composer validation in `src/options/options-app.ts` to surface the specific rejection reason next to the composer row without mutating pending state
- [X] T026 [US3] Add inline row-level confirmation for `MigrationKeyDeleteRequestEvent` in `src/options/options-config-table.ts`
- [X] T027 [US3] Register the `beforeunload` listener only while `hasPendingChanges` is true, with proper `disconnectedCallback` cleanup, in `src/options/options-app.ts`

**Checkpoint**: User Story 3 is testable on top of US1/US2. Inline composer, validation feedback, and pending reminders work without breaking previous stories.

---

## Phase 6: User Story 4 - Sticky Toolbar and Inline Clear Confirmation (Priority: P2)

**Goal**: Move export, merge import, replace import, save, and clear into a persistent toolbar with inline confirmation and a visible pending indicator.

**Independent Test**: With the page scrolled into a long migration key list, trigger every toolbar action, confirm export downloads a JSON file using the current pending configuration, invalid imports preserve pending and saved state, and clear-all requires inline confirmation before mutating saved state.

### Tests for User Story 4 ⚠️

- [X] T028 [P] [US4] Add unit tests for export payload shape (matches `data-model.md` JSON v3), import error preservation, and clear-all confirmation lifecycle in `src/options/options-state.test.ts`
- [X] T029 [P] [US4] Add E2E test for sticky toolbar reachability, export download, invalid import preservation, and clear-all inline confirmation in `test/extension.e2e.test.ts`

### Implementation for User Story 4

- [X] T030 [P] [US4] Extract sticky toolbar and pending indicator in `src/options/options-toolbar.ts` with the stable accessible names from `contracts/ui-contract.md`
- [X] T031 [US4] Wire export, merge import, replace import, save, and clear-all actions in `src/options/options-app.ts` to existing storage APIs without changing behavior
- [X] T032 [US4] Add inline clear-all confirmation surface near the toolbar in `src/options/options-toolbar.ts` that mutates saved state only on confirm
- [X] T033 [US4] Add sticky positioning, pending indicator text, and operation status live region in `src/options/options-app.ts`

**Checkpoint**: User Story 4 is testable on top of US1/US2/US3. Toolbar actions keep their existing semantics and remain reachable while scrolling.

---

## Phase 7: User Story 5 - Portable Status Feedback (Priority: P3)

**Goal**: Keep import feedback, validation messages, and pending indicators visible while the developer reviews the dense list so unsaved state or unsure imports never get lost.

**Independent Test**: Import an invalid configuration file while pending edits exist and confirm a specific failure message keeps both saved and pending state intact, then save and reload the page to verify saved state matches the last pending state.

### Tests for User Story 5 ⚠️

- [X] T034 [P] [US5] Add unit tests for operation result derivation (success vs failure, pending vs saved) in `src/options/options-state.test.ts`
- [X] T035 [P] [US5] Add E2E test for import success-pending messaging, import failure preservation, and reload-after-save state match in `test/extension.e2e.test.ts`

### Implementation for User Story 5

- [X] T036 [US5] Replace single-string message state with `OperationResult` (`ok`, `message`, optional `details`) plus pending vs saved distinction in `src/options/options-app.ts`
- [X] T037 [US5] Surface import and validation results inside a live region so they remain visible while editing in `src/options/options-toolbar.ts`
- [X] T038 [US5] Ensure export messages do not label pending data as saved in `src/options/options-app.ts`

**Checkpoint**: All user stories are independently functional. Status feedback, import results, and pending/saved distinction stay visible across the dense layout.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Cross-cutting quality, accessibility, visual, and manual validation work that affects multiple stories.

- [X] T039 [P] Add visual E2E coverage for the dense PC matrix (1280px, 1440px) and the narrow fallback in `test/visual-qa.e2e.test.ts`
- [X] T040 [P] Add accessibility checks (40px target size, focus visibility, reduced motion, keyboard reachability, color-not-alone) to `test/visual-qa.e2e.test.ts`
- [X] T041 Tighten responsive fallback styles below 1280px in `src/options/options-app.ts` while preserving all workflows
- [X] T042 Run the manual validation sequence described in `quickstart.md` against the rebuilt extension
- [X] T043 Run the full automated gate: `pnpm build`, `pnpm check`, `pnpm test`, `pnpm test:e2e`, `pnpm test:e2e:visual`
- [X] T044 Confirm the export payload still matches the JSON v3 shape in `data-model.md` and that popup default target sync remains unchanged

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3+)**: All depend on Foundational phase completion
  - User stories can proceed sequentially (P1 → P2 → P3) or in parallel once foundational primitives land
  - US1 is MVP; US2 extends the same `OptionsApp`; US3 adds validation and lifecycle; US4 adds toolbar; US5 polishes status
- **Polish (Phase 8)**: Depends on the user stories chosen for delivery

### User Story Dependencies

- **User Story 1 (P1)**: Depends on Foundational - no dependencies on other stories
- **User Story 2 (P1)**: Depends on Foundational - independent of US1, but integrates into the same `OptionsApp` shell
- **User Story 3 (P2)**: Depends on Foundational - extends US1 composer and US1 row deletion
- **User Story 4 (P2)**: Depends on Foundational - integrates with US1/US2 but can be implemented independently as toolbar extraction
- **User Story 5 (P3)**: Depends on Foundational - independent status overhaul; should run after US4 to keep the live region wired

### Within Each User Story

- Pure helper unit tests should be added before the implementation tasks that consume them
- Component extraction tasks (e.g. `options-config-table.ts`, `options-localhost-strip.ts`, `options-toolbar.ts`) should land before their integration into `OptionsApp`
- E2E and visual tests for a user story run after that story's implementation is complete

### Parallel Opportunities

- All Foundational tasks marked [P] (T006, T007) can run in parallel
- US1 unit and E2E tests (T010, T011) can run in parallel with their implementation tasks
- US2 component extraction (T019) can run in parallel with US2 test creation (T017, T018)
- US4 toolbar extraction (T030) can run in parallel with US4 test creation (T028, T029)
- Polish tasks (T039, T040) can run in parallel once the chosen stories are merged

---

## Parallel Example: User Story 1

```bash
# Tests for US1 can launch alongside component extraction:
Task: "Add unit tests for row identity, filter matching, duplicate detection, and pending snapshot comparison in src/options/options-state.test.ts"
Task: "Add E2E test for dense migration key workspace at 1440px with twelve rows in test/extension.e2e.test.ts"
Task: "Extract dense migration key row template plus composer row in src/options/options-config-table.ts and dispatch the events defined in contracts/ui-contract.md"

# After US1 components land:
Task: "Wire MigrationKeyFilterChangeEvent, MigrationKeyUpdateEvent, and MigrationKeyAppendEvent handlers in src/options/options-app.ts"
Task: "Add migration key filter input, dense list area, and inline composer row to OptionsApp in src/options/options-app.ts"
Task: "Apply compact primitives and PC-first density styles for the migration key work surface in src/options/options-app.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 + User Story 2)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 3: User Story 1 (US1 - dense migration key workspace)
4. Complete Phase 4: User Story 2 (US2 - compact localhost strip)
5. STOP and VALIDATE: Verify dense list, filter, inline edit, composer, and compact strip independently
6. Deploy/demo if ready

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → Deploy/Demo (MVP dense list)
3. Add User Story 2 → Test independently → Deploy/Demo (compact localhost strip)
4. Add User Story 3 → Test independently → Deploy/Demo (composer validation + pending reminder)
5. Add User Story 4 → Test independently → Deploy/Demo (sticky toolbar + inline clear confirmation)
6. Add User Story 5 → Test independently → Deploy/Demo (portable status feedback)
7. Each story adds value without breaking previous stories

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: User Story 1 (dense migration key workspace)
   - Developer B: User Story 2 (compact localhost strip)
   - Developer C: User Story 4 (sticky toolbar extraction)
3. After US1/US2 merge:
   - Developer A: User Story 3 (composer validation, lifecycle)
   - Developer B: User Story 5 (status overhaul)
4. Polish (Phase 8) tasks run in parallel

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps each task to its user story for traceability
- Each user story is independently completable and testable
- Verify the specific gates for each story before moving on
- `pnpm build`, `pnpm check`, `pnpm test`, `pnpm test:e2e`, and `pnpm test:e2e:visual` are run during Phase 8
- Manual PC validation follows `quickstart.md` and runs during Phase 8
- Stop at any checkpoint to validate a story independently
- Avoid: vague tasks, same-file conflicts, cross-story dependencies that break independence