# Phase 0 Research: Options Page PC Redesign

## 1. PC first page shell and density

**Decision**: Replace the current hero plus stacked card flow with a PC first workspace: a compact header, a sticky toolbar near the top of the content area, a dense migration key work surface, and a compact localhost target strip. Keep the existing Material Design 3 tokens from `DESIGN.md`, use filled neutral panels with restrained elevation, and target 1280px to 1920px viewports first while preserving a functional narrower fallback.

**Rationale**: The active spec identifies low information density as the core problem. `DESIGN.md` already sets the options content width at 1040px, PC oriented spacing, semantic color roles, visible focus, reduced motion support, and 40px minimum interactive targets. The redesign should therefore change composition and density, not the visual identity or runtime theme system.

**Alternatives considered**: Keeping the large hero and card stack was rejected because it preserves the mobile feel. Widening the page alone was rejected because it doesn't solve scanning or toolbar reachability. A fully responsive mobile first shell was rejected because the feature is explicitly PC first.

## 2. Table like editable list, stable row identity, and filtering

**Decision**: Model migration keys as rows with a stable UI identity derived when data is loaded or appended, then render the filtered rows with Lit's `repeat` directive using that identity. The filter is ephemeral `@state`, matches key and description with case insensitive substring logic, and never changes row data or storage order. Inline edits update the backing pending row by stable identity, not by visible index.

**Rationale**: Current `OptionsApp` edits rows by array index, which is safe only while every row is visible in original order. Filtering makes visible indexes unstable. Official Lit list guidance recommends `repeat(items, keyFn, template)` when preserving stateful DOM across list changes, and editable native controls inside rows are exactly the kind of stateful DOM that benefits from stable keys.

**Alternatives considered**: Filtering by creating a copied editable array was rejected because it risks losing pending edits or reordering saved data. Continuing index based updates was rejected because filtered rows can update the wrong item. Using persisted IDs was rejected because the storage schema must not change.

## 3. Saved snapshot, pending state derivation, and beforeunload cleanup

**Decision**: Keep a saved snapshot in private reactive state after load and after successful save. Derive `hasPendingChanges` by comparing the normalized pending custom items, localhost targets, and default target key with the saved snapshot. Add a `beforeunload` listener only while pending changes exist, and remove it in `disconnectedCallback` and whenever pending changes return to clean.

**Rationale**: The spec requires pending changes to remain visible until explicit save, without autosave. Current `OptionsApp` already keeps edits in memory and saves only through `saveAll`. Official Lit guidance favors internal `@state` for private reactive data, declarative template listeners for DOM events, and explicit `connectedCallback` or `disconnectedCallback` cleanup for listeners on `window`. `beforeunload` is a window listener, so lifecycle cleanup is required.

**Alternatives considered**: Autosave was rejected because FR 017 and the project principles require explicit user triggered persistence. Tracking a manual dirty flag only was rejected because import, clear, add, remove, and normalization can make the flag drift from the real pending state. Leaving a permanent `beforeunload` listener was rejected because it creates stale warnings after save and violates Lit cleanup guidance.

## 4. Compact localhost target presentation and FR 007 reconciliation

**Decision**: Present localhost targets as compact chips or rows in a horizontal friendly strip with the formatted target, default marker, set default action, and remove action visible together. When removing the current default, clear the removed key first, then pass the remaining targets and empty preferred key through the existing deterministic default normalization before persistence.

**Rationale**: Current `OptionsApp.removeLocalhostTarget` already removes the target and calls `resolveDefaultLocalhostTargetKey(nextTargets, '')` when the removed target was default. The plan should document this as reconciliation between FR 007 and the baseline invariant: the removed key is cleared from pending state, then existing normalization chooses a valid remaining target when one is required by the current storage API. This preserves popup compatibility and avoids changing storage semantics.

**Alternatives considered**: Persisting an invalid removed default key was rejected because popup selection depends on a valid default key. Changing storage to allow a missing default among remaining targets was rejected because no persistence or schema changes are allowed. Blocking removal of the default target was rejected because FR 007 requires removal to complete and leave remaining targets usable.

## 5. Inline, non modal confirmation behavior

**Decision**: Use inline confirmation surfaces near the toolbar for clear all, and near row actions for destructive row or target removals. The confirmation should keep the list visible, name the affected action, provide confirm and cancel buttons, and mutate pending or saved state only after explicit confirmation.

**Rationale**: The spec requires destructive actions to stay explicit while avoiding a full page takeover. `DESIGN.md` requires visible, manually confirmable pending data and status that doesn't rely on color alone. Inline confirmation preserves context and fits the PC density goal.

**Alternatives considered**: Browser `confirm()` was rejected because it is modal, visually outside the design system, and hard to cover with visual QA. A full page confirmation state was rejected because it hides the list. Removing without confirmation was rejected by FR 012, FR 018, and SC 006.

## 6. Shared `app-input` and `app-select` compact accessible variants

**Decision**: Extend `app-input` and `app-select` with a compact variant property for dense rows, keeping native input and select semantics, `value-change` events, focus rings, disabled states, and the existing default 48px variant. Compact interactive controls must use the stricter existing `DESIGN.md` minimum of 40px; this exceeds the spec's 32px floor while preserving the design system's accessibility constraint.

**Rationale**: The existing primitives wrap native controls and centralize visual states. Reusing them avoids one off row controls and keeps keyboard behavior consistent. A compact variant is the smallest shared primitive change needed for dense PC rows while preserving the current popup and options default field sizing.

**Alternatives considered**: Styling native inputs directly inside `OptionsApp` was rejected because AGENTS.md says to prefer shared components. Shrinking the default primitive globally was rejected because popup and existing forms depend on 48px fields. Creating separate dense field components was rejected because it duplicates behavior and increases maintenance.

## 7. Component boundaries with `OptionsApp` retaining orchestration

**Decision**: Keep `OptionsApp` as the owner of load, edit, import, export, save, clear, localhost normalization, pending state, and status orchestration. Extract only presentational or narrowly scoped rendering helpers or child components for the toolbar, migration key table, inline editor row, localhost strip, and inline confirmations, with events flowing back to `OptionsApp`.

**Rationale**: Current `OptionsApp` owns all existing behavior and already coordinates storage APIs, file import, JSON export, and target normalization. The redesign is primarily layout and interaction density, not a data ownership rewrite. Lit's declarative event listener model supports child components dispatching explicit events while orchestration remains centralized.

**Alternatives considered**: Moving persistence calls into child components was rejected because it fragments explicit save behavior. Keeping one monolithic render method was rejected because the current file is already large and dense table rendering will add complexity. Introducing a global store was rejected because this page doesn't need cross component state beyond `OptionsApp` orchestration.

## 8. Vitest, E2E, and visual validation strategy

**Decision**: Cover pure derivation with Vitest where practical: stable row identity helpers, filtering, duplicate validation, pending snapshot comparison, and localhost default reconciliation. Cover browser extension workflows with E2E: twelve or more migration keys at 1440px, filtering and inline edit save, compact localhost default switch, import failure preserving pending state, inline clear confirmation, and popup default target compatibility. Run visual validation for 1280px and narrower fallback states, including focus, pending indicator, confirmation, empty filter, long text, and reduced motion.

**Rationale**: The feature changes UI density and interaction behavior while preserving storage contracts. Unit tests can lock deterministic helpers without launching the extension. E2E is needed for file import, export, IndexedDB state, popup default behavior, keyboard reachable controls, and real extension integration. Visual validation is required because the main success criteria are PC layout density and scanability.

**Alternatives considered**: Relying only on `pnpm check` was rejected because it won't prove user workflows. Relying only on screenshots was rejected because it won't prove persistence and import behavior. Skipping visual validation was rejected because the feature is a redesign.

## 9. No persistence, schema, or manifest changes

**Decision**: Do not change IndexedDB stores, repository APIs, export JSON shape, Chrome permissions, extension manifest entries, or content and background runtime behavior. Use existing storage APIs and normalized v2 stores exactly as they are.

**Rationale**: The active spec requires compatibility with existing IndexedDB v2 state and exported files, and AGENTS.md identifies extension storage as a stable normalized v2 contract. The requested work is an options page PC redesign, not a data model or permission change. Existing APIs already support custom config, localhost targets, default target selection, import, export, save, and clear.

**Alternatives considered**: Adding persisted row IDs or filter preferences was rejected because it changes storage scope. Adding permissions was rejected because the page redesign needs none. Changing the manifest was rejected because no new extension capability is required. Changing export format was rejected because portability across sessions depends on the current version 3 shape.
