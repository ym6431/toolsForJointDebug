import { nothing } from 'lit'
import { LitElement, css, html } from 'lit'
import { customElement, property } from 'lit/decorators.js'

export interface SelectOption {
  label: string
  value: string
}

@customElement('app-select')
export class AppSelect extends LitElement {
  @property({ attribute: false })
  options: SelectOption[] = []

  @property()
  value = ''

  @property()
  placeholder = '请选择'

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
      <select
        data-test-id=${this.testId}
        class=${this.compact ? 'compact' : ''}
        aria-label=${this.ariaLabel || nothing}
        aria-describedby=${this.description ? 'app-select-description' : nothing}
        aria-invalid=${this.invalid ? 'true' : nothing}
        ?disabled=${this.disabled}
        @change=${(event: Event) =>
          this.dispatchValueChange((event.target as HTMLSelectElement).value)}
      >
        ${!this.value
          ? html`<option value="" ?selected=${this.value === ''}>${this.placeholder}</option>`
          : null}
          
        ${this.options.map(
          (option) => html`
            <option 
              value=${option.value}
              ?selected=${this.value === option.value}
            >
              ${option.label}
            </option>
          `,
        )}
      </select>
      ${this.description
        ? html`<span id="app-select-description" class="visually-hidden">${this.description}</span>`
        : nothing}
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

    select {
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
      cursor: pointer;
      transition:
        background-color var(--motion-short),
        border-color var(--motion-short),
        box-shadow var(--motion-short);
    }

    select:hover:not(:disabled) {
      background: var(--md-sys-color-surface-container-high);
      border-color: var(--md-sys-color-outline);
    }

    select:focus-visible {
      border-color: var(--md-sys-color-primary);
      box-shadow: var(--focus-ring);
    }

    select:disabled {
      cursor: not-allowed;
      border-color: var(--md-sys-color-outline-variant);
      background: var(--md-sys-color-surface-container);
      color: var(--color-disabled-text);
    }

    select.compact {
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
