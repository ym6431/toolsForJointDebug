import { LitElement, css, html, nothing } from 'lit'
import { customElement, property } from 'lit/decorators.js'

export type OptionsImportMode = 'replace' | 'merge'
export type OptionsToolbarLoadState = 'loading' | 'ready' | 'error'
export type OptionsToolbarCommand = 'export-config' | 'save-all' | 'clear-all' | 'clear-cancel' | 'clear-confirm'

export interface OptionsToolbarCommandDetail {
  readonly command: OptionsToolbarCommand
}

export interface OptionsConfigImportDetail {
  readonly mode: OptionsImportMode
  readonly file: File
}

@customElement('options-toolbar')
export class OptionsToolbar extends LitElement {
  @property({ type: Boolean })
  hasPendingChanges = false

  @property({ type: Boolean })
  hasInvalidRows = false

  @property({ type: Boolean })
  ready = false

  @property()
  loadState: OptionsToolbarLoadState = 'loading'

  @property()
  loadError = ''

  @property()
  operationMessage = ''

  @property({ type: Boolean })
  operationFailed = false

  @property()
  clearConfirmationMessage = ''

  @property()
  importInputId = 'config-import-input'

  private importMode: OptionsImportMode = 'replace'

  render() {
    const persistenceDisabled = !this.ready || this.hasInvalidRows

    return html`
      <section data-test-id="options-toolbar" class="toolbar" aria-label="操作工具栏">
        <input
          id=${this.importInputId}
          data-test-id="options-import-file-input"
          class="visually-hidden"
          type="file"
          accept="application/json,.json"
          aria-label="导入配置文件"
          ?disabled=${!this.ready}
          @change=${this.handleImportFile}
        />
        <button data-test-id="options-export-config-button" class="secondary" ?disabled=${persistenceDisabled} @click=${this.dispatchExportConfig}>导出配置</button>
        <button data-test-id="options-import-merge-button" class="secondary" ?disabled=${!this.ready} @click=${() => this.openImportPicker('merge')}>追加合并导入</button>
        <button data-test-id="options-import-replace-button" class="secondary" ?disabled=${!this.ready} @click=${() => this.openImportPicker('replace')}>覆盖导入</button>
        <button
          data-test-id="options-save-all-button"
          class="primary ${this.hasPendingChanges ? 'is-pending' : ''}"
          ?disabled=${persistenceDisabled}
          @click=${this.dispatchSaveAll}
        >
          保存全部配置
        </button>
        <button id="options-clear-all-button" data-test-id="options-clear-all-button" class="danger" ?disabled=${!this.ready} @click=${this.dispatchClearAll}>清空全部配置</button>
        ${this.hasPendingChanges
          ? html`<span data-test-id="options-pending-indicator" class="pending-indicator" role="status">有未保存的修改</span>`
          : nothing}
        ${this.renderStatus()}
        ${this.clearConfirmationMessage
          ? html`
              <div data-test-id="options-clear-all-confirmation" class="confirmation" role="alertdialog" aria-label="清空配置确认">
                <p>${this.clearConfirmationMessage}</p>
                <div class="confirmation-actions">
                  <button data-test-id="options-clear-all-cancel-button" class="primary" @click=${this.dispatchClearCancel}>取消</button>
                  <button data-test-id="options-clear-all-confirm-button" class="danger" @click=${this.dispatchClearConfirm}>确认清空</button>
                </div>
              </div>
            `
          : nothing}
      </section>
    `
  }

  private openImportPicker(mode: OptionsImportMode) {
    if (!this.ready) {
      return
    }

    this.importMode = mode
    this.renderRoot.querySelector<HTMLInputElement>(`#${this.importInputId}`)?.click()
  }

  private handleImportFile = (event: Event) => {
    if (!this.ready) {
      return
    }

    const input = event.target
    if (!(input instanceof HTMLInputElement)) {
      return
    }

    const file = input.files?.[0]
    if (!file) {
      return
    }

    this.dispatchEvent(
      new CustomEvent<OptionsConfigImportDetail>('config-import', {
        detail: { mode: this.importMode, file },
      }),
    )
    input.value = ''
  }

  private dispatchExportConfig = () => {
    if (!this.ready || this.hasInvalidRows) {
      return
    }

    this.dispatchCommand('export-config')
  }

  private dispatchSaveAll = () => {
    if (!this.ready || this.hasInvalidRows) {
      return
    }

    this.dispatchCommand('save-all')
  }

  private dispatchClearAll = () => {
    if (!this.ready) {
      return
    }

    this.dispatchCommand('clear-all')
  }

  private dispatchClearCancel = () => {
    this.dispatchCommand('clear-cancel')
  }

  private dispatchClearConfirm = () => {
    this.dispatchCommand('clear-confirm')
  }

  private dispatchCommand(command: OptionsToolbarCommand) {
    this.dispatchEvent(
      new CustomEvent<OptionsToolbarCommandDetail>(command, {
        detail: { command },
      }),
    )
  }

  private renderStatus() {
    switch (this.loadState) {
      case 'loading':
        return html`<p data-test-id="options-load-status" class="operation-message" role="status">正在加载配置…</p>`
      case 'error':
        return html`<p data-test-id="options-load-error" class="operation-message error-message" role="alert">无法加载配置：${this.loadError}</p>`
      case 'ready':
        return this.operationMessage
          ? html`<p data-test-id="options-operation-message" class="operation-message ${this.operationFailed ? 'error-message' : ''}" role=${this.operationFailed ? 'alert' : 'status'}>${this.operationMessage}</p>`
          : nothing
    }
  }

  focusClearControl(): boolean {
    const control = this.renderRoot.querySelector<HTMLButtonElement>('#options-clear-all-button')
    if (!control) {
      return false
    }

    control.focus()
    return true
  }

  static styles = css`
    :host { display: block; position: sticky; top: var(--space-3); z-index: 10; }
    .toolbar {
      padding: var(--space-1) var(--space-2);
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--space-2);
      background: var(--md-sys-color-surface-container);
      border: 1px solid var(--md-sys-color-outline-variant);
      border-radius: var(--shape-large);
      box-shadow: var(--elevation-1);
    }
    .pending-indicator { margin-left: auto; padding: var(--space-1) var(--space-3); border-radius: var(--shape-full); background: var(--md-sys-color-primary-container); color: var(--md-sys-color-on-primary-container); font: var(--type-label-small); }
    .operation-message, .confirmation { flex-basis: 100%; margin: 0; padding: var(--space-2) var(--space-3); border-radius: var(--shape-medium); font: var(--type-body-small); }
    .operation-message { background: var(--md-sys-color-primary-container); color: var(--md-sys-color-on-primary-container); }
    .error-message, .confirmation { background: var(--md-sys-color-error-container); color: var(--md-sys-color-on-error-container); }
    .confirmation { display: flex; align-items: center; justify-content: space-between; gap: var(--space-3); flex-wrap: wrap; }
    .confirmation p { margin: 0; }
    .confirmation-actions { display: flex; gap: var(--space-2); }
    button { box-sizing: border-box; border: none; min-height: 40px; border-radius: var(--shape-full); padding: var(--space-2) var(--space-4); font: var(--type-label-large); cursor: pointer; transition: background-color var(--motion-short), color var(--motion-short), box-shadow var(--motion-short), transform var(--motion-short); }
    button:disabled { cursor: not-allowed; background: var(--md-sys-color-surface-container-high); color: var(--color-disabled-text); box-shadow: none; }
    button:hover:not(:disabled) { box-shadow: var(--elevation-1); }
    button:active:not(:disabled) { transform: translateY(1px); }
    button:focus-visible { outline: 2px solid var(--md-sys-color-primary); outline-offset: 2px; }
    .primary { background: var(--md-sys-color-primary); color: var(--md-sys-color-on-primary); }
    .primary.is-pending { box-shadow: var(--elevation-2); }
    .secondary { background: var(--md-sys-color-primary-container); color: var(--md-sys-color-on-primary-container); }
    .danger { background: var(--md-sys-color-error-container); color: var(--md-sys-color-on-error-container); }
    .visually-hidden { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }
    @media (max-width: 900px) { :host { position: static; } .toolbar { align-items: stretch; } .pending-indicator { margin-left: 0; } }
  `
}

declare global {
  interface HTMLElementTagNameMap {
    'options-toolbar': OptionsToolbar
  }
}
