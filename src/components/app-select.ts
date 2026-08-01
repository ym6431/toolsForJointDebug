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

  @property({ type: Boolean })
  disabled = false

  @property({ type: Boolean, reflect: true })
  compact = false

  render() {
    return html`
      <select
        class=${this.compact ? 'compact' : ''}
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
  `
}
