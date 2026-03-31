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

  render() {
    return html`
      <select
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
      box-sizing: border-box;
      border: 1px solid var(--color-border-strong);
      border-radius: 10px;
      padding: 10px 12px;
      background: var(--color-surface);
      color: var(--color-text-strong);
      font: inherit;
    }
  `
}
