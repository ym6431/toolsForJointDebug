import { LitElement, css, html, nothing } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { repeat } from 'lit/directives/repeat.js'
import type { SelectOption } from '../components/app-select'
import '../components/app-input'
import '../components/app-select'
import type { LocalhostTarget } from '../shared/types'
import { formatLocalhostTarget, serializeLocalhostTarget } from '../shared/utils'
import type { LocalhostDraft } from './options-state'

export type LocalhostDraftField = keyof LocalhostDraft

export interface LocalhostDraftChangeDetail {
  readonly field: LocalhostDraftField
  readonly value: string
}

export interface LocalhostTargetAppendDetail {
  readonly protocol: LocalhostDraft['protocol']
  readonly port: string
}

export interface LocalhostTargetDefaultDetail {
  readonly targetKey: string
}

export interface LocalhostTargetDeleteRequestDetail {
  readonly targetKey: string
  readonly label: string
  readonly isDefault: boolean
}

export interface LocalhostTargetDeleteConfirmationDetail {
  readonly targetKey: string
}

@customElement('options-localhost-strip')
export class OptionsLocalhostStrip extends LitElement {
  @property({ attribute: false })
  targets: LocalhostTarget[] = []

  @property()
  defaultTargetKey = ''

  @property({ attribute: false })
  draft: LocalhostDraft = { protocol: 'http', port: '' }

  @property()
  message = ''

  @property({ attribute: false })
  protocolOptions: SelectOption[] = []

  @property({ type: Boolean })
  ready = false

  @property()
  deleteConfirmationTargetKey = ''

  @property()
  deleteConfirmationMessage = ''

  render() {
    const portInvalid = Boolean(this.message)

    return html`
      <section data-test-id="options-localhost-strip" class="panel" aria-label="本地注入目标">
        <div class="strip-head">
          <h2>本地注入目标</h2>
          <span class="strip-helper">popup 中会以下拉列表展示这里保存的注入目标，并默认选中当前默认值。</span>
        </div>
        <div class="strip-body">
          <div class="strip-composer">
            <label class="field">
              <span>协议</span>
              <app-select
                .testId=${'options-localhost-protocol-select'}
                compact
                .options=${this.protocolOptions}
                .value=${this.draft.protocol}
                .ariaLabel=${'协议'}
                .description=${this.message}
                ?disabled=${!this.ready}
                @value-change=${(event: CustomEvent<string>) =>
                  this.dispatchDraftChange('protocol', event.detail)}
              ></app-select>
            </label>
            <label class="field">
              <span>端口</span>
              <app-input
                .testId=${'options-localhost-port-input'}
                compact
                .value=${this.draft.port}
                inputmode="numeric"
                placeholder="例如：5173"
                .ariaLabel=${'端口'}
                .description=${this.message}
                .invalid=${portInvalid}
                ?disabled=${!this.ready}
                @value-change=${(event: CustomEvent<string>) =>
                  this.dispatchDraftChange('port', event.detail)}
              ></app-input>
            </label>
            <button id="options-add-localhost-button" data-test-id="options-add-localhost-button" class="secondary" ?disabled=${!this.ready} @click=${this.dispatchAddTarget}>加入端口列表</button>
          </div>
           ${this.message ? html`<p class="inline-message" role="alert">${this.message}</p>` : nothing}
           ${this.renderTargets()}
           ${this.renderDeleteConfirmation()}
        </div>
      </section>
    `
  }

  private renderTargets() {
    if (this.targets.length === 0) {
      return html`<p class="empty">还没有可用的 localhost 注入目标。</p>`
    }

    return html`
      <ul class="target-list">
        ${repeat(this.targets, (target) => serializeLocalhostTarget(target), (target) => {
          const targetKey = serializeLocalhostTarget(target)
          const isDefault = this.defaultTargetKey === targetKey
          const label = formatLocalhostTarget(target)

          return html`
            <li data-test-id="options-localhost-target" data-target-key=${targetKey} class="target-chip ${isDefault ? 'is-default' : ''}">
              <div class="target-meta">
                <strong data-test-id="options-localhost-target-label">${label}</strong>
                ${isDefault ? html`<span class="badge">默认</span>` : nothing}
              </div>
              <div class="target-actions">
                ${isDefault
                  ? html`<button data-test-id="options-localhost-default-indicator" class="success" disabled>默认端口</button>`
                  : html`<button data-test-id="options-localhost-default-button" class="success" ?disabled=${!this.ready} @click=${() => this.dispatchDefaultChange(targetKey)}>设为默认</button>`}
                <button id=${`options-localhost-target-${targetKey}-delete`} data-test-id="options-localhost-delete-button" data-localhost-delete-target-key=${targetKey} class="danger" ?disabled=${!this.ready} @click=${() => this.dispatchDeleteRequest({ targetKey, label, isDefault })}>删除目标 ${label}</button>
              </div>
            </li>
          `
        })}
      </ul>
    `
  }

  private renderDeleteConfirmation() {
    if (!this.deleteConfirmationTargetKey) {
      return nothing
    }

    return html`
      <div data-test-id="options-localhost-delete-confirmation" class="confirmation" role="alertdialog" aria-label="删除目标确认">
        <p>${this.deleteConfirmationMessage}</p>
        <div class="confirmation-actions">
          <button data-test-id="options-localhost-delete-cancel-button" class="secondary" @click=${this.dispatchDeleteCancel}>取消</button>
          <button data-test-id="options-localhost-delete-confirm-button" class="danger" @click=${this.dispatchDeleteConfirm}>确认删除</button>
        </div>
      </div>
    `
  }

  private dispatchDraftChange(field: LocalhostDraftField, value: string) {
    this.dispatchEvent(
      new CustomEvent<LocalhostDraftChangeDetail>('localhost-draft-change', {
        detail: { field, value },
      }),
    )
  }

  private dispatchAddTarget = () => {
    this.dispatchEvent(
      new CustomEvent<LocalhostTargetAppendDetail>('localhost-add', {
        detail: { ...this.draft },
      }),
    )
  }

  private dispatchDefaultChange(targetKey: string) {
    this.dispatchEvent(
      new CustomEvent<LocalhostTargetDefaultDetail>('localhost-default-change', {
        detail: { targetKey },
      }),
    )
  }

  private dispatchDeleteRequest(detail: LocalhostTargetDeleteRequestDetail) {
    this.dispatchEvent(
      new CustomEvent<LocalhostTargetDeleteRequestDetail>('localhost-delete-request', {
        detail,
      }),
    )
  }

  private dispatchDeleteCancel = () => {
    this.dispatchEvent(
      new CustomEvent<LocalhostTargetDeleteConfirmationDetail>('localhost-delete-cancel', {
        detail: { targetKey: this.deleteConfirmationTargetKey },
      }),
    )
  }

  private dispatchDeleteConfirm = () => {
    this.dispatchEvent(
      new CustomEvent<LocalhostTargetDeleteConfirmationDetail>('localhost-delete-confirm', {
        detail: { targetKey: this.deleteConfirmationTargetKey },
      }),
    )
  }

  focusDeleteControl(targetKey: string): boolean {
    const control = Array.from(
      this.renderRoot.querySelectorAll<HTMLButtonElement>('[data-localhost-delete-target-key]'),
    ).find((candidate) => candidate.dataset.localhostDeleteTargetKey === targetKey)
    if (!control) {
      return false
    }

    control.focus()
    return true
  }

  focusAddControl(): boolean {
    const control = this.renderRoot.querySelector<HTMLButtonElement>('[data-test-id="options-add-localhost-button"]')
    if (!control) {
      return false
    }

    control.focus()
    return true
  }

  static styles = css`
    :host { display: block; }
    .panel {
      padding: var(--space-1);
      display: grid;
      grid-template-columns: minmax(220px, 0.72fr) minmax(0, 1.6fr);
      gap: var(--space-2);
      background: var(--md-sys-color-surface-container-low);
      border: 1px solid var(--md-sys-color-outline-variant);
      border-radius: var(--shape-large);
    }
    h2 { margin: 0; font: var(--type-title-large); }
    .strip-head { display: grid; gap: var(--space-1); align-content: start; }
    .strip-helper, .empty { color: var(--md-sys-color-on-surface-variant); font: var(--type-body-small); }
    .strip-body { display: grid; gap: var(--space-1); min-width: 0; }
    .strip-composer { display: grid; grid-template-columns: 116px 140px auto; align-items: end; gap: var(--space-1); }
    .field { display: grid; gap: var(--space-1); font: var(--type-label-small); }
    .target-list { list-style: none; padding: 0; margin: 0; display: flex; flex-wrap: wrap; gap: var(--space-1); }
    .target-chip { display: flex; align-items: center; gap: var(--space-1); padding: 0 var(--space-2); border-radius: var(--shape-medium); border: 1px solid var(--md-sys-color-outline-variant); background: var(--md-sys-color-surface-container); min-height: 40px; }
    .target-chip.is-default { border-color: var(--md-sys-color-primary); background: var(--md-sys-color-primary-container); color: var(--md-sys-color-on-primary-container); }
    .target-meta, .target-actions { display: flex; align-items: center; gap: var(--space-2); }
    .badge { display: inline-flex; align-items: center; padding: var(--space-1) var(--space-2); border-radius: var(--shape-full); background: var(--md-sys-color-primary); color: var(--md-sys-color-on-primary); font: var(--type-label-small); }
    .inline-message { margin: 0; padding: var(--space-2) var(--space-3); border-radius: var(--shape-small); background: var(--md-sys-color-error-container); color: var(--md-sys-color-on-error-container); font: var(--type-body-small); }
    .confirmation { display: flex; align-items: center; justify-content: space-between; gap: var(--space-3); flex-wrap: wrap; padding: var(--space-2) var(--space-3); border-radius: var(--shape-small); background: var(--md-sys-color-error-container); color: var(--md-sys-color-on-error-container); font: var(--type-body-small); }
    .confirmation p { margin: 0; }
    .confirmation-actions { display: flex; gap: var(--space-2); }
    button { box-sizing: border-box; border: none; min-height: 40px; border-radius: var(--shape-full); padding: var(--space-1) var(--space-2); font: var(--type-label-large); white-space: nowrap; cursor: pointer; transition: background-color var(--motion-short), color var(--motion-short), box-shadow var(--motion-short), transform var(--motion-short); }
    button:disabled { cursor: not-allowed; background: var(--md-sys-color-surface-container); color: var(--color-disabled-text); box-shadow: none; }
    button:hover:not(:disabled) { box-shadow: var(--elevation-1); }
    button:active:not(:disabled) { transform: translateY(1px); }
    button:focus-visible { outline: 2px solid var(--md-sys-color-primary); outline-offset: 2px; }
    .secondary { background: var(--md-sys-color-primary-container); color: var(--md-sys-color-on-primary-container); }
    .danger { background: var(--md-sys-color-error-container); color: var(--md-sys-color-on-error-container); }
    .success { background: var(--app-color-success-container); color: var(--app-color-on-success-container); }
    @media (min-width: 1200px) { .field > span { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; } .strip-composer { grid-template-columns: 116px 140px auto; align-items: center; } .target-list { flex-wrap: nowrap; overflow-x: auto; } .target-chip { flex: 0 0 auto; } }
    @media (max-width: 1100px) { .panel { grid-template-columns: 1fr; } }
    @media (max-width: 700px) { .panel { padding: var(--space-3); } .strip-composer, .target-chip, .target-actions { display: grid; grid-template-columns: 1fr; align-items: stretch; } }
  `
}

declare global {
  interface HTMLElementTagNameMap {
    'options-localhost-strip': OptionsLocalhostStrip
  }
}
