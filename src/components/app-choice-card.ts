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
      align-items: center;
      gap: var(--space-3);
      min-height: 56px;
      border: 1px solid var(--md-sys-color-outline-variant);
      border-radius: var(--shape-medium);
      padding: var(--space-3) var(--space-4);
      background: var(--md-sys-color-surface-container-low);
      transition:
        background-color var(--motion-short),
        border-color var(--motion-short),
        box-shadow var(--motion-short),
        transform var(--motion-short);
    }

    .card:hover:not(:has(input:disabled)) {
      background: var(--md-sys-color-surface-container);
      border-color: var(--md-sys-color-outline);
    }

    .card:has(input:checked) {
      border-color: var(--md-sys-color-primary);
      background: var(--md-sys-color-primary-container);
      color: var(--md-sys-color-on-primary-container);
    }

    .card:focus-within {
      border-color: var(--md-sys-color-primary);
      box-shadow: var(--focus-ring);
    }

    .card:active {
      transform: translateY(1px);
    }

    .card:has(input:disabled) {
      cursor: not-allowed;
      opacity: 0.56;
    }

    .control {
      min-width: 0;
      flex: 1;
      display: grid;
      grid-template-columns: auto 1fr;
      gap: var(--space-3);
      align-items: start;
      cursor: pointer;
    }

    .content {
      min-width: 0;
    }

    input {
      width: 18px;
      height: 18px;
      margin: 2px 0 0;
      padding: 0;
      flex: none;
      accent-color: var(--md-sys-color-primary);
      cursor: inherit;
    }

    ::slotted([slot='action']) {
      margin-left: auto;
    }
  `
}
