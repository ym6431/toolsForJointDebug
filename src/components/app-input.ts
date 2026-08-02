import { nothing } from 'lit'
import { LitElement, css, html } from 'lit'
import { customElement, property } from 'lit/decorators.js'

@customElement('app-input')
export class AppInput extends LitElement {
  @property()
  value = ''

  @property()
  type = 'text'

  @property()
  placeholder = ''

  @property()
  inputmode = ''

  @property()
  ariaLabel = ''

  @property()
  description = ''

  @property({ type: Boolean, reflect: true })
  invalid = false

  @property({ attribute: false })
  testId = ''

  @property({ type: Boolean })
  disabled = false

  @property({ type: Boolean, reflect: true })
  compact = false

  render() {
    return html`
      <input
        data-test-id=${this.testId}
        class=${this.compact ? 'compact' : ''}
        .value=${this.value}
        .type=${this.type}
        .placeholder=${this.placeholder}
        .inputMode=${this.inputmode}
        aria-label=${this.ariaLabel || nothing}
        aria-describedby=${this.description ? 'app-input-description' : nothing}
        aria-invalid=${this.invalid ? 'true' : nothing}
        ?disabled=${this.disabled}
        @input=${(event: Event) =>
          this.dispatchValueChange((event.target as HTMLInputElement).value)}
      />
      ${this.description
        ? html`<span id="app-input-description" class="visually-hidden">${this.description}</span>`
        : nothing}
    `
  }

  focusInput() {
    this.renderRoot.querySelector<HTMLInputElement>('input')?.focus()
  }

  private dispatchValueChange(value: string) {
    this.dispatchEvent(
      new CustomEvent<string>('value-change', {
        detail: value,
        bubbles: true,
        composed: true,
      }),
    )
  }

  static styles = css`
    :host {
      display: block;
    }

    input {
      width: 100%;
      min-height: 48px;
      box-sizing: border-box;
      border: 1px solid var(--md-sys-color-outline-variant);
      border-radius: var(--shape-small);
      padding: var(--space-3) var(--space-4);
      outline: none;
      background: var(--md-sys-color-surface-container);
      color: var(--md-sys-color-on-surface);
      font: var(--type-body-medium);
      caret-color: var(--md-sys-color-primary);
      transition:
        background-color var(--motion-short),
        border-color var(--motion-short),
        box-shadow var(--motion-short);
    }

    input:hover:not(:disabled) {
      background: var(--md-sys-color-surface-container-high);
      border-color: var(--md-sys-color-outline);
    }

    input:focus-visible {
      border-color: var(--md-sys-color-primary);
      box-shadow: var(--focus-ring);
    }

    input::placeholder {
      color: var(--md-sys-color-on-surface-variant);
      opacity: 0.72;
    }

    input:disabled {
      cursor: not-allowed;
      border-color: var(--md-sys-color-outline-variant);
      background: var(--md-sys-color-surface-container);
      color: var(--color-disabled-text);
    }

    input.compact {
      min-height: 40px;
      padding: var(--space-2) var(--space-3);
      font: var(--type-body-small);
    }

    .visually-hidden {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      border: 0;
    }
  `
}
