import { css, type CSSResult } from 'lit'

export const popupPanelStyles: CSSResult = css`
  :host {
    display: block;
  }

  .workspace {
    display: grid;
    grid-template-columns: var(--popup-panel-columns, 1fr);
    gap: var(--space-4);
    align-items: start;
  }

  .column,
  .item-list {
    min-width: 0;
    display: grid;
    gap: var(--space-2);
  }

  .column {
    gap: var(--space-4);
  }

  .panel {
    background: var(--md-sys-color-surface-container-low);
    border: 1px solid var(--md-sys-color-outline-variant);
    border-radius: var(--shape-large);
    padding: var(--space-4);
    box-shadow: var(--elevation-1);
  }

  .section-head,
  .item-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
  }

  h2,
  p {
    margin: 0;
  }

  h2 {
    font: var(--type-title-medium);
  }

  .page-title,
  .dataset-source {
    font-weight: 600;
    margin-top: var(--space-3);
    color: var(--md-sys-color-on-surface);
  }

  .page-url {
    margin-top: var(--space-1);
    color: var(--md-sys-color-on-surface-variant);
    word-break: break-all;
    font: var(--type-body-small);
  }

  .stack {
    display: grid;
    gap: var(--space-2);
    margin: var(--space-4) 0;
    color: var(--md-sys-color-on-surface-variant);
    font: var(--type-label-large);
  }

  .item-meta,
  .dataset-meta {
    display: grid;
    gap: var(--space-2);
    min-width: 0;
  }

  .dataset-meta {
    gap: var(--space-1);
    flex: 1;
  }

  .dataset-meta span,
  .cookie-meta,
  .summary-note {
    color: var(--md-sys-color-on-surface-variant);
    font: var(--type-body-small);
  }

  .dataset-meta span,
  .dataset-meta strong,
  .cookie-meta {
    word-break: break-word;
  }

  .badge {
    font: var(--type-label-small);
    color: var(--md-sys-color-on-primary-container);
    background: var(--md-sys-color-primary-container);
    border-radius: var(--shape-full);
    padding: var(--space-1) var(--space-2);
  }

  button {
    border: none;
    min-height: 40px;
    border-radius: var(--shape-full);
    padding: var(--space-2) var(--space-4);
    font: var(--type-label-large);
    cursor: pointer;
    transition:
      background-color var(--motion-short),
      color var(--motion-short),
      box-shadow var(--motion-short),
      transform var(--motion-short);
  }

  button:hover:not(:disabled) {
    box-shadow: var(--elevation-1);
  }

  button:active:not(:disabled) {
    transform: translateY(1px);
  }

  button:focus-visible {
    outline: 2px solid var(--md-sys-color-primary);
    outline-offset: 2px;
  }

  button:disabled {
    opacity: 0.64;
    cursor: default;
  }

  .primary {
    background: var(--md-sys-color-primary);
    color: var(--md-sys-color-on-primary);
  }

  .primary:hover:not(:disabled) {
    background: color-mix(
      in srgb,
      var(--md-sys-color-primary) 88%,
      var(--md-sys-color-on-primary)
    );
  }

  .secondary {
    background: var(--md-sys-color-primary-container);
    color: var(--md-sys-color-on-primary-container);
  }

  .secondary:hover:not(:disabled) {
    background: color-mix(
      in srgb,
      var(--md-sys-color-primary-container) 88%,
      var(--md-sys-color-on-primary-container)
    );
  }

  .ghost {
    background: transparent;
    color: var(--md-sys-color-error);
    padding-inline: var(--space-3);
  }

  .ghost:hover:not(:disabled) {
    background: var(--md-sys-color-error-container);
  }

  .wide {
    width: 100%;
  }

  .actions {
    display: grid;
    gap: var(--space-2);
    margin-top: var(--space-4);
  }

  .empty {
    color: var(--md-sys-color-on-surface-variant);
    margin-top: var(--space-4);
  }

  .cookie-meta {
    margin: 0;
    line-height: 1.5;
  }

  code {
    display: block;
    white-space: pre-wrap;
    word-break: break-all;
    background: var(--app-color-code-surface);
    border-radius: var(--shape-small);
    padding: var(--space-2) var(--space-3);
    color: var(--app-color-code-text);
    font: var(--type-body-small);
    font-family: var(--font-mono);
  }

  @media (max-width: 900px) {
    .workspace {
      grid-template-columns: 1fr;
    }
  }
`
