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
