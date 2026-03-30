import { LitElement, css, html } from 'lit'
import { customElement, property } from 'lit/decorators.js'

export interface ChoiceChangeDetail {
  checked: boolean
  value: string
}

@customElement('app-choice-card')
export class AppChoiceCard extends LitElement {
  @property()
  type: 'checkbox' | 'radio' = 'checkbox'

  @property({ type: Boolean })
  checked = false

  @property()
  name = ''

  @property()
  value = ''

  @property({ type: Boolean })
  disabled = false

  render() {
    return html`
      <div class="card">
        <label class="control">
          <input
            .type=${this.type}
            .checked=${this.checked}
            .name=${this.name}
            .value=${this.value}
            ?disabled=${this.disabled}
            @change=${(event: Event) => {
              const input = event.target as HTMLInputElement

              this.dispatchCheckedChange({
                checked: input.checked,
                value: input.value,
              })
            }}
          />
          <div class="content">
            <slot></slot>
          </div>
        </label>
        <slot name="action"></slot>
      </div>
    `
  }

  private dispatchCheckedChange(detail: ChoiceChangeDetail) {
    this.dispatchEvent(
      new CustomEvent<ChoiceChangeDetail>('checked-change', {
        detail,
        bubbles: true,
        composed: true,
      }),
    )
  }

  static styles = css`
    :host {
      display: block;
    }

    .card {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      border: 1px solid var(--color-border);
      border-radius: 12px;
      padding: 10px 12px;
      background: var(--color-surface-muted);
      margin-top: 10px;
    }

    .control {
      min-width: 0;
      flex: 1;
      display: grid;
      grid-template-columns: auto 1fr;
      gap: 10px;
      align-items: start;
      cursor: pointer;
    }

    .content {
      min-width: 0;
    }

    input {
      width: 16px;
      height: 16px;
      margin: 2px 0 0;
      padding: 0;
      flex: none;
    }

    ::slotted([slot='action']) {
      margin-left: auto;
    }
  `
}
