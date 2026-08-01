import { LitElement, css, html } from 'lit'
import { customElement, property } from 'lit/decorators.js'

@customElement('app-disclosure')
export class AppDisclosure extends LitElement {
  @property()
  label = '展开内容'

  @property()
  count = ''

  render() {
    return html`
      <details>
        <summary>
          <span class="chevron"></span>
          <span class="summary-text">${this.label}</span>
          ${this.count ? html`<span class="count">${this.count}</span>` : null}
          <slot name="summary-extra"></slot>
        </summary>
        <div class="content">
          <slot></slot>
        </div>
      </details>
    `
  }

  static styles = css`
    :host {
      display: block;
    }

    details {
      border-radius: var(--shape-medium);
      background: var(--md-sys-color-surface-container);
      border: 1px solid var(--md-sys-color-outline-variant);
      overflow: clip;
      transition:
        background-color var(--motion-short),
        border-color var(--motion-short),
        box-shadow var(--motion-short);
    }

    details[open] {
      background: var(--md-sys-color-surface-container-low);
      box-shadow: var(--elevation-1);
    }

    summary {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      min-height: 48px;
      padding: var(--space-3) var(--space-4);
      color: var(--md-sys-color-on-surface);
      cursor: pointer;
      list-style: none;
      font: var(--type-label-large);
    }

    summary::-webkit-details-marker {
      display: none;
    }

    summary:hover {
      background: var(--md-sys-color-surface-container-high);
    }

    summary:focus-visible {
      outline: 2px solid var(--md-sys-color-primary);
      outline-offset: -2px;
      box-shadow: var(--focus-ring);
    }

    .chevron {
      width: 0.5rem;
      height: 0.5rem;
      border-block-start: 2px solid currentColor;
      border-inline-end: 2px solid currentColor;
      transform: rotate(45deg);
      transform-origin: center;
      transition: transform var(--motion-short);
    }

    details[open] .chevron {
      transform: rotate(135deg);
    }

    .summary-text {
      min-width: 0;
      flex: 1;
    }

    .count {
      border-radius: var(--shape-full);
      padding: var(--space-1) var(--space-2);
      background: var(--app-color-info-container);
      color: var(--app-color-on-info-container);
      font: var(--type-label-small);
      white-space: nowrap;
    }

    .content {
      display: grid;
      gap: var(--space-2);
      padding: 0 var(--space-3) var(--space-3);
    }
  `
}
