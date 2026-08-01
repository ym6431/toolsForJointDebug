# Implementation Plan: Options Page PC Redesign

**Branch**: `002-options-pc-redesign` | **Date**: 2026-08-02 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/002-options-pc-redesign/spec.md`

**Note**: This plan is filled through Phase 1 for `/speckit.plan`. It does not create implementation tasks.

## Summary

Redesign the Chrome MV3 options page from a mobile-feeling stack into a PC-first, dense configuration workspace for frontend developers who maintain many migration keys. The implementation keeps `OptionsApp` as the orchestration owner for load, import, export, save, clear, localhost normalization, pending state, and status. The UI gains a wider compact shell, sticky toolbar, keyed dense editable migration-key rows, derived saved and pending snapshots, compact shared control variants, inline confirmations, a compact localhost target strip, and extracted presentational components while preserving existing persistence and runtime contracts.

The design follows [research.md](./research.md), [data-model.md](./data-model.md), [contracts/ui-contract.md](./contracts/ui-contract.md), and [quickstart.md](./quickstart.md). Export explicitly uses the current pending in-memory config and does not persist. Removing the current default localhost target clears the removed key first, then uses existing deterministic target normalization so popup compatibility stays unchanged.

## Technical Context

**Language/Version**: TypeScript 5.9 with strict `tsconfig.json`, Lit 3.3 custom elements, and decorator-based reactive state.

**Primary Dependencies**: Lit 3.3, Vite 8, `@crxjs/vite-plugin`, `idb`, Chrome extension APIs through `chrome-types`, shared primitives `app-input` and `app-select`.

**Storage**: Existing IndexedDB v2 remains unchanged. The six normalized extension stores for datasets, dataset items, config, localhost targets, default target, and initialization metadata stay as-is. `chrome.storage.local` remains legacy migration input only. No schema, repository API, export shape, runtime message, manifest, or permission changes are planned.

**Testing**: Vitest 4 for unit tests through `vite.config.ts`, plus `vitest-environment-web-ext` and Playwright-backed E2E through `vitest.e2e.config.ts` and `vitest.visual.config.ts`. Planned coverage includes pure options state helpers, extension options workflows, popup default-target compatibility, and visual QA at PC and fallback widths.

**Target Platform**: Chrome Extension Manifest V3 options page, loaded from `options.html` and `src/options/main.ts`, optimized for PC browser viewports.

**Project Type**: Single Chrome extension project. This is a local options module redesign, not a new package, backend, service, or runtime entry.

**Performance Goals**: Render and edit 12 or more config rows plus a few localhost targets at 1280px to 1920px without excessive scrolling or sluggish row updates. Filtering should be instant for practical options-page list sizes, including 20 or more migration keys.

**Constraints**: PC-first 1280px to 1920px target with a functional fallback below 1280px. All interactive controls must honor the stricter `DESIGN.md` minimum of 40px, overriding the spec's 32px floor. Imported and pending data must remain visible, selectable where applicable, and confirmable. No autosave, silent synchronization, credential transfer, permission widening, storage schema change, manifest change, or runtime message change.

**Scale/Scope**: Options page handles 12 or more config rows and a few localhost targets as the primary design case. Existing popup, content script, background script, page bridge, shared storage contracts, and extension build pipeline remain compatible.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

`.specify/memory/constitution.md` is still an unratified placeholder with bracketed example principles, no concrete project name, no ratification date, and no enforceable governance text. It supplies no enforceable gates for this feature. The operative gates are therefore the repository rules in [AGENTS.md](../../AGENTS.md), the design system in [DESIGN.md](../../DESIGN.md), and the active feature artifacts.

### Pre-design gate check

- Explicit user actions: Pass. The plan preserves manual import, export, save, clear, row delete, target delete, and default-target changes. No autosave or silent background sync is introduced.
- IndexedDB v2 preservation: Pass. Existing normalized stores, repository APIs, legacy `chrome.storage.local` migration input, and JSON v3 export shape stay unchanged.
- Imported data inspectability: Pass. Imports update visible pending state only after validation, invalid imports preserve saved and pending state, and import success messages state that values remain pending until save.
- Shared component reuse: Pass. Dense controls extend `src/components/app-input.ts` and `src/components/app-select.ts` with compact variants instead of adding one-off form controls.
- Accessibility and design system: Pass. `DESIGN.md` tokens, semantic color roles, visible focus, reduced motion, dark mode, and 40px target minimum govern the redesign.
- Test obligations: Pass. Unit, extension E2E, and visual E2E coverage are planned through existing Vitest 4 and web-ext configurations.
- No permission widening: Pass. No manifest, Chrome permission, content script, background script, or runtime message change is required.

### Post-design re-check

- Explicit user actions: Pass. [contracts/ui-contract.md](./contracts/ui-contract.md) defines persistence boundaries where only `保存全部配置` and confirmed clear-all write saved state.
- IndexedDB v2 preservation: Pass. [data-model.md](./data-model.md) states no persisted fields, stores, repository APIs, or export fields are added.
- Imported data inspectability: Pass. [data-model.md](./data-model.md) and [contracts/ui-contract.md](./contracts/ui-contract.md) require visible pending import state, specific invalid import feedback, and unchanged saved and pending state on failure.
- Shared component reuse: Pass. [research.md](./research.md) selects compact variants for `app-input` and `app-select`, keeping native input and select semantics.
- Accessibility and design system: Pass. [contracts/ui-contract.md](./contracts/ui-contract.md) requires stable accessible names, keyboard reachability, focus visibility, live status text, reduced motion support, and 40px controls.
- Tests: Pass. [quickstart.md](./quickstart.md) lists `pnpm build`, `pnpm check`, `pnpm test`, `pnpm test:e2e`, `pnpm test:e2e:visual`, plus manual PC, fallback, import safety, popup sync, and accessibility checks. These are planned gates, not results claimed by this plan.
- No permission widening: Pass. Phase 1 artifacts keep manifest, permissions, storage contracts, and runtime messages unchanged.

## Project Structure

### Documentation (this feature)

```text
specs/002-options-pc-redesign/
├── plan.md
├── spec.md
├── research.md
├── data-model.md
├── quickstart.md
└── contracts/
    └── ui-contract.md
```

Phase artifact links:

- Phase 0 research: [research.md](./research.md)
- Phase 1 data model: [data-model.md](./data-model.md)
- Phase 1 UI contract: [contracts/ui-contract.md](./contracts/ui-contract.md)
- Phase 1 validation guide: [quickstart.md](./quickstart.md)

### Source Code (repository root)

```text
src/
├── options/
│   ├── main.ts                         # existing options entry, unchanged import boundary
│   ├── options-app.ts                  # existing orchestration owner, to be refactored but retained
│   ├── options-state.ts                # planned pure helpers for rows, filtering, snapshots, validation
│   ├── options-state.test.ts           # planned Vitest unit coverage for pure helpers
│   ├── options-toolbar.ts              # planned presentational sticky toolbar and status component
│   ├── options-config-table.ts         # planned presentational dense migration key table and composer
│   └── options-localhost-strip.ts      # planned presentational localhost target strip
├── components/
│   ├── app-input.ts                    # existing shared primitive, planned compact variant
│   └── app-select.ts                   # existing shared primitive, planned compact variant
├── shared/
│   ├── types.ts                        # existing contracts unchanged
│   ├── storage.ts                      # existing storage API unchanged
│   ├── storage-db.ts                   # IndexedDB v2 schema unchanged
│   ├── storage-repository.ts           # normalized repository unchanged
│   └── utils.ts                        # existing localhost and config normalization reused
└── shared/base.css                     # existing design tokens reused

test/
├── extension.e2e.test.ts               # planned options workflow and popup default sync updates
└── visual-qa.e2e.test.ts               # planned PC density and fallback matrix updates

DESIGN.md                              # existing design contract, 40px control minimum governs this feature
package.json                           # existing pnpm scripts and dependency versions
tsconfig.json                          # existing strict TypeScript settings
vite.config.ts                         # existing Vite 8, CRX plugin, and Vitest unit config
vitest.e2e.config.ts                   # existing web-ext E2E config
vitest.visual.config.ts                # existing web-ext visual E2E config
manifest.config.ts                     # existing Chrome MV3 manifest, unchanged
options.html                           # existing options HTML entry, unchanged
```

**Structure Decision**: Use the existing single Chrome extension project. Split only the local options module so `OptionsApp` keeps orchestration while pure state helpers and presentational Lit components carry dense PC layout. Do not create a new package, service, background workflow, manifest entry, shared storage contract, or runtime message type.

## Complexity Tracking

No constitution or operative project gate violations are present. No complexity exception is required.
