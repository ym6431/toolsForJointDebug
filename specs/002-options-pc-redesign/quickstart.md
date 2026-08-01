# Quickstart: Options Page PC Redesign Validation

Phase 1 validation guide for the future implementation. This guide defines what to run and what to verify. It doesn't claim any command has already passed.

## References

- Data rules and derived state: [data-model.md](./data-model.md)
- UI behavior contract: [contracts/ui-contract.md](./contracts/ui-contract.md)
- Feature scope: [spec.md](./spec.md)
- Research decisions: [research.md](./research.md)

## Prerequisites

- Node.js and pnpm available locally.
- Chrome or Chromium available for extension loading.
- Playwright Chromium installed when running extension E2E or visual E2E:

```bash
pnpm exec playwright install chromium
```

If E2E fails before the extension or page test starts because Chromium can't launch, treat it as an environment or sandbox failure first. If Chromium launches and assertions fail, treat it as a product or test failure.

## Setup and automated gates

Run from the repository root:

```bash
pnpm install
pnpm build
pnpm check
pnpm test
pnpm test:e2e
pnpm test:e2e:visual
```

Expected outcomes:

- `pnpm install` installs dependencies without lockfile drift.
- `pnpm build` completes TypeScript checking and writes the extension build to `dist`.
- `pnpm check` reports no TypeScript errors.
- `pnpm test` passes unit coverage for storage, helpers, pending state, filtering, duplicate checks, and default target normalization.
- `pnpm test:e2e` passes browser extension workflows for options and popup integration.
- `pnpm test:e2e:visual` passes the PC density and fallback visual matrix.

## Manual browser extension validation

1. Run `pnpm build`.
2. Open `chrome://extensions`.
3. Enable Developer mode.
4. Choose Load unpacked.
5. Select the repository `dist` directory.
6. Open the extension options page.

Validate at these viewport widths:

- 1440px wide, primary PC density target.
- 1280px wide, minimum PC layout target.
- A narrow fallback below 1280px, for example 1024px or a zoomed laptop window.

## Focused validation sequence

### 1. Dense migration key workspace

Prepare at least twelve migration keys across `localStorage`, `sessionStorage`, and `cookie`.

Expected outcomes:

- At 1440px, all 12 or more rows, row actions, toolbar, and inline editor are reachable without scrolling past the list area.
- At 1280px, rows remain table like, scannable, and don't hide type, key, description, or actions.
- Long keys and long descriptions truncate, wrap, or reveal safely without breaking row alignment.
- Below 1280px, all workflows remain available even if the layout stacks or compresses.

### 2. Filter and empty state

Type a partial key or description into the list filter, then try a value with no matches.

Expected outcomes:

- Matching is case insensitive against key and description.
- Clearing the filter restores every row in saved order.
- A no match state appears inside the list area and doesn't block toolbar, save, import, export, or localhost controls.
- Pending edits stay attached to the correct row while filtering.

### 3. Inline edit, add, and duplicate rejection

Edit an existing row, then use the inline editor to add a new row. Try to add a duplicate state type plus key.

Expected outcomes:

- Edits appear immediately but remain pending until Save.
- A valid new item appears at the end of the list in the same row shape.
- Empty, invalid, or duplicate entries are rejected near the editor row with a specific message.
- Rejected entries don't mutate pending or saved state.

### 4. Pending, save, and reload

Make one row edit and one localhost target change, then save and reload the options page.

Expected outcomes:

- Pending state is visible in the toolbar and page status before save.
- Save is explicit. No autosave occurs.
- After Save and reload, visible state matches the last saved pending state.
- If pending changes exist and the page is closed or reloaded, the user gets a clear unsaved changes reminder.

### 5. Three targets and popup default sync

Configure three localhost targets. Change the default, save, then open the popup on a page where import mode can target localhost.

Expected outcomes:

- All three targets, default marker, set default action, and remove action are visible together at 1280px and wider.
- Selecting a new default clears the previous marker immediately in pending state.
- After save, the popup uses the new default target without any storage shape change.
- Removing the current default clears that removed key and leaves the remaining targets usable.

### 6. Import invalid state preservation

With pending edits visible, try merge import and replace import using an invalid config file.

Expected outcomes:

- The failure message names the parse or validation problem.
- Existing pending rows, localhost targets, and default selection remain unchanged.
- Saved state remains unchanged.
- The user can keep editing without leaving the page.

### 7. Inline confirmations

Trigger remove row, remove localhost target, and clear all.

Expected outcomes:

- Each destructive action asks for inline confirmation near the affected row, target, or toolbar.
- The list stays visible while confirming.
- Cancel leaves pending and saved state unchanged.
- Confirm mutates only the intended pending or saved state, according to the UI contract.

### 8. Keyboard, focus, and reduced motion

Navigate the page using keyboard only. Repeat key workflows with reduced motion enabled in the browser or OS.

Expected outcomes:

- Add, edit, remove, set default, save, import, export, filter, clear, confirm, and cancel are keyboard reachable.
- Focus indicators are visible and not color only.
- Status and validation text are announced or placed near the relevant control.
- Reduced motion removes or shortens nonessential motion while preserving affordances.

## Full quality gates

The implementation is ready only when all gates pass on the current build:

- Automated: `pnpm build`, `pnpm check`, `pnpm test`, `pnpm test:e2e`, and `pnpm test:e2e:visual` pass.
- Manual 1440px: dense 12 or more key workspace, filtering, inline edits, pending save, confirmations, long text, and keyboard flow pass.
- Manual 1280px: migration rows and three localhost targets meet the PC density expectations.
- Manual narrow fallback: every workflow remains usable below 1280px.
- Integration: saved default localhost target syncs to popup behavior.
- Import safety: invalid imports preserve pending and saved state.
- Accessibility: keyboard, focus, visible status, and reduced motion checks pass.
- Compatibility: IndexedDB v2 stores, JSON export shape, Chrome permissions, and existing popup persistence behavior remain unchanged.
- Failure triage: assertion failures are tracked as product or test defects. Chromium launch, browser binary, or sandbox errors are tracked as environment setup issues until proven otherwise.
