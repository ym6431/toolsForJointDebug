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

  @property({ type: Boolean })
  disabled = false

  render() {
    return html`
      <input
        .value=${this.value}
        .type=${this.type}
        .placeholder=${this.placeholder}
        .inputMode=${this.inputmode}
        ?disabled=${this.disabled}
        @input=${(event: Event) =>
          this.dispatchValueChange((event.target as HTMLInputElement).value)}
      />
    `
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
  `
}
