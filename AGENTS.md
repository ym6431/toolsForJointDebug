# Frontend State Migrator Agent Guide

## Project Summary

This repository is a Chrome extension built with:

- `Lit`
- `TypeScript`
- `Vite`
- `@crxjs/vite-plugin`
- `Chrome Extension Manifest V3`

Its purpose is to help developers manually migrate non-sensitive frontend state between online pages and local environments for debugging and UI reproduction.

## Core Principles

- All export and import actions must be manually triggered by the user.
- Data must only be stored in `chrome.storage.local`.
- Only non-sensitive frontend state should be handled.
- Imported data must remain visible, selectable, and confirmable in the UI.
- Do not attempt to bypass browser security boundaries.
- Prefer keeping behavior explicit over clever automation.

## Current Architecture

### Extension Entry

- [manifest.config.ts](/home/my1346/project/aiTest/lit-ex-fro-session/manifest.config.ts)
- [popup.html](/home/my1346/project/aiTest/lit-ex-fro-session/popup.html)
- [options.html](/home/my1346/project/aiTest/lit-ex-fro-session/options.html)

### Runtime Modules

- [src/background.ts](/home/my1346/project/aiTest/lit-ex-fro-session/src/background.ts)
  Handles tab actions, cookie access, localhost injection, and popup-background messaging.

- [src/content.ts](/home/my1346/project/aiTest/lit-ex-fro-session/src/content.ts)
  Receives popup requests and coordinates with the page bridge for storage read/write.

- [src/page-bridge.ts](/home/my1346/project/aiTest/lit-ex-fro-session/src/page-bridge.ts)
  Runs in the page context to read/write `localStorage` and `sessionStorage`.

### UI

- [src/popup/popup-app.ts](/home/my1346/project/aiTest/lit-ex-fro-session/src/popup/popup-app.ts)
  Main popup container, mode switching, orchestration, and result state.

- [src/popup/popup-export-panel.ts](/home/my1346/project/aiTest/lit-ex-fro-session/src/popup/popup-export-panel.ts)
  Export mode UI.

- [src/popup/popup-import-panel.ts](/home/my1346/project/aiTest/lit-ex-fro-session/src/popup/popup-import-panel.ts)
  Import mode UI.

- [src/options/options-app.ts](/home/my1346/project/aiTest/lit-ex-fro-session/src/options/options-app.ts)
  Config editor for migration keys and localhost target ports.

### Shared Modules

- [src/shared/storage.ts](/home/my1346/project/aiTest/lit-ex-fro-session/src/shared/storage.ts)
  Central storage access and normalization.

- [src/shared/types.ts](/home/my1346/project/aiTest/lit-ex-fro-session/src/shared/types.ts)
  Shared app types.

- [src/shared/utils.ts](/home/my1346/project/aiTest/lit-ex-fro-session/src/shared/utils.ts)
  Formatting, dedupe, id generation, and port normalization.

- [src/shared/base.css](/home/my1346/project/aiTest/lit-ex-fro-session/src/shared/base.css)
  Shared theme variables and base visual tokens.

### Reusable UI Primitives

- [src/components/app-input.ts](/home/my1346/project/aiTest/lit-ex-fro-session/src/components/app-input.ts)
- [src/components/app-select.ts](/home/my1346/project/aiTest/lit-ex-fro-session/src/components/app-select.ts)
- [src/components/app-choice-card.ts](/home/my1346/project/aiTest/lit-ex-fro-session/src/components/app-choice-card.ts)

Prefer extending these primitives instead of introducing one-off form controls.

## Important Product Behaviors

### Storage Handling

- `localStorage` and `sessionStorage` are read/written through the page bridge.
- Cookie reading uses `chrome.cookies` in the background script.
- Cookie injection can fall back to cookie-only behavior when full storage injection is unavailable.

### Popup Modes

- Popup supports `export` mode and `import` mode.
- Default mode is `import` for `localhost`, `127.0.0.1`, and `::1`.
- Otherwise default mode is `export`.

### Localhost Injection

- Options page stores a list of localhost ports plus one default port.
- Popup export mode allows switching the target port dynamically.
- Selecting a port in popup updates the persisted default port.

## Development Commands

- Install: `pnpm install`
- Typecheck: `pnpm check`
- Unit tests: `pnpm test`
- E2E tests: `pnpm test:e2e`
- Dev server: `pnpm dev`
- Build extension: `pnpm build`

## Testing Notes

### Unit Tests

- Located under `src/**/*.test.ts`
- Run in normal Vitest config from [vite.config.ts](/home/my1346/project/aiTest/lit-ex-fro-session/vite.config.ts)

### E2E Tests

- Located under `test/**/*.e2e.test.ts`
- Config file: [vitest.e2e.config.ts](/home/my1346/project/aiTest/lit-ex-fro-session/vitest.e2e.config.ts)
- Uses `vitest-environment-web-ext`
- Requires Playwright Chromium to be installed

If e2e fails because Chromium cannot launch, check whether the environment is sandboxed too tightly rather than assuming the test code is wrong.

## Coding Guidance For Agents

- Keep changes modular and local to the relevant feature.
- Prefer reusing shared types and helpers over duplicating small utilities.
- Preserve the current manual-confirmation flow in popup UX.
- Do not silently widen permissions or scope without a clear reason.
- When changing extension behavior, verify both `manifest.config.ts` and runtime message types.
- When changing storage shape, update normalization in `src/shared/storage.ts` and related tests.
- When changing popup or options forms, prefer shared components in `src/components`.
- When changing UI text or behavior used by tests, update e2e assertions too.

## Common Pitfalls

- `content.ts` cannot directly use privileged APIs like `chrome.cookies`; route through `background.ts`.
- Page-context code in `page-bridge.ts` should stay focused on web storage access.
- Popup button labels can affect e2e selectors; avoid ambiguous accessible names when possible.
- Storage schema changes should stay backward-compatible when feasible.

## Suggested Agent Workflow

1. Read the affected UI/runtime module first.
2. Check shared types and storage contracts before editing behavior.
3. Make the smallest coherent change.
4. Run `pnpm check`.
5. Run `pnpm test`.
6. Run `pnpm test:e2e` when popup/options behavior changes materially.

## Repository Intent

This project optimizes for practical debugging workflows, not for silent synchronization or sensitive credential transfer. When in doubt, keep the tool explicit, inspectable, and developer-friendly.
