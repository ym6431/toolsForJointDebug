import { LitElement, css, html, nothing } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { repeat } from 'lit/directives/repeat.js'
import type { SelectOption } from '../components/app-select'
import { AppInput } from '../components/app-input'
import '../components/app-select'
import type { ConfigItem } from '../shared/types'
import type {
  ComposerDraft,
  PendingMigrationKeyRow,
  PendingMigrationRowValidationMessages,
} from './options-state'

export type ConfigRowField = keyof ConfigItem
export type ComposerDraftField = keyof ComposerDraft

export interface MigrationKeyFilterChangeDetail {
  readonly value: string
}

export interface ConfigRowFieldChangeDetail {
  readonly rowId: string
  readonly field: ConfigRowField
  readonly value: string
}

export interface MigrationKeyDeleteRequestDetail {
  readonly rowId: string
  readonly storageType: ConfigItem['storageType']
  readonly key: string
}

export interface MigrationKeyDeleteConfirmationDetail {
  readonly rowId: string
}

export interface ComposerDraftChangeDetail {
  readonly field: ComposerDraftField
  readonly value: string
}

export interface MigrationKeyAppendDetail {
  readonly storageType: ConfigItem['storageType']
  readonly key: string
  readonly description: string
}

@customElement('options-config-table')
export class OptionsConfigTable extends LitElement {
  @property({ attribute: false })
  rows: PendingMigrationKeyRow[] = []

  @property({ type: Number })
  totalCount = 0

  @property({ type: Boolean })
  loaded = false

  @property({ type: Boolean })
  ready = false

  @property()
  filterQuery = ''

  @property({ attribute: false })
  composerDraft: ComposerDraft = { storageType: 'localStorage', key: '', description: '' }

  @property()
  composerMessage = ''

  @property({ attribute: false })
  rowValidationMessages: PendingMigrationRowValidationMessages = {}

  @property()
  rowDeleteConfirmationUiId = ''

  @property()
  rowDeleteConfirmationMessage = ''

  @property({ attribute: false })
  storageTypeOptions: SelectOption[] = []

  render() {
    return html`
      <section data-test-id="options-key-workspace" class="panel" aria-label="迁移 Key 工作区">
        <div class="workspace-head">
          <div>
            <h2>迁移 Key 列表</h2>
            <span class="workspace-count">${this.totalCount} 项</span>
          </div>
          <label class="filter-field">
            <span>筛选配置</span>
            <app-input
              compact
              .value=${this.filterQuery}
              placeholder="按 Key 或说明筛选"
              .ariaLabel=${'筛选配置'}
              .testId=${'options-filter-input'}
              ?disabled=${!this.ready}
              @value-change=${(event: CustomEvent<string>) => this.dispatchFilterChange(event.detail)}
            ></app-input>
          </label>
        </div>

        ${this.renderRows()}
        ${this.renderComposer()}
      </section>
    `
  }

  private renderRows() {
    if (this.loaded && this.totalCount === 0) {
      return html`<p class="empty">还没有自定义配置。</p>`
    }

    if (this.rows.length === 0) {
      return html`<p class="empty">没有匹配的配置项。</p>`
    }

    return html`
      <div class="row-grid row-head">
        <span>Storage 类型</span>
        <span>Key</span>
        <span>说明</span>
        <span class="row-actions-head">操作</span>
      </div>
      <ul data-test-id="options-config-row-list" class="row-list">
        ${repeat(this.rows, (row) => row.uiId, (row, index) => this.renderEditableRow(row, index))}
      </ul>
    `
  }

  private renderEditableRow(row: PendingMigrationKeyRow, index: number) {
    const validationMessage = this.rowValidationMessages[row.uiId] ?? ''
    const rowLabel = `迁移 Key ${index + 1}`

    return html`
      <li class="row-grid row" data-test-id="options-config-row" data-row-id=${row.uiId} data-ui-id=${row.uiId}>
        <app-select
          compact
          .testId=${'options-config-row-storage-type'}
          .options=${this.storageTypeOptions}
          .value=${row.item.storageType}
          .ariaLabel=${`${rowLabel} 的 Storage 类型`}
          .description=${validationMessage}
          .invalid=${Boolean(validationMessage)}
          ?disabled=${!this.ready}
          @value-change=${(event: CustomEvent<string>) =>
            this.dispatchRowFieldChange(row.uiId, 'storageType', event.detail)}
        ></app-select>
        <app-input
          compact
          .testId=${'options-config-row-key-input'}
          .value=${row.item.key}
          .ariaLabel=${`${rowLabel} 的 Key`}
          .description=${validationMessage}
          .invalid=${Boolean(validationMessage)}
          ?disabled=${!this.ready}
          @value-change=${(event: CustomEvent<string>) =>
            this.dispatchRowFieldChange(row.uiId, 'key', event.detail)}
        ></app-input>
        <app-input
          compact
          .testId=${'options-config-row-description-input'}
          .value=${row.item.description}
          .ariaLabel=${`${rowLabel} 的说明`}
          .description=${validationMessage}
          ?disabled=${!this.ready}
          @value-change=${(event: CustomEvent<string>) =>
            this.dispatchRowFieldChange(row.uiId, 'description', event.detail)}
        ></app-input>
        <div class="row-actions">
          <button
            id=${`options-config-row-${row.uiId}-delete`}
            data-test-id="options-config-row-delete-button"
            data-row-delete-ui-id=${row.uiId}
            class="danger"
            ?disabled=${!this.ready}
            @click=${() => this.dispatchRowDeleteRequest(row)}
          >
            删除配置 ${row.item.key || '行'}
          </button>
        </div>
        ${validationMessage
          ? html`<p data-test-id="options-config-row-validation-message" class="row-validation-message" role="alert">${validationMessage}</p>`
          : nothing}
        ${this.rowDeleteConfirmationUiId === row.uiId
          ? html`
              <div data-test-id="options-config-row-delete-confirmation" class="row-confirmation" role="alertdialog" aria-label="删除配置确认">
                <p>${this.rowDeleteConfirmationMessage}</p>
                <div class="confirmation-actions">
                  <button data-test-id="options-config-row-delete-cancel-button" class="primary" @click=${() => this.dispatchRowDeleteCancel(row.uiId)}>取消</button>
                  <button data-test-id="options-config-row-delete-confirm-button" class="danger" @click=${() => this.dispatchRowDeleteConfirm(row.uiId)}>确认删除</button>
                </div>
              </div>
            `
          : nothing}
      </li>
    `
  }

  private renderComposer() {
    const composerMessageId = 'options-composer-message'
    const composerInvalid = Boolean(this.composerMessage)

    return html`
      <div data-test-id="options-config-composer" class="composer">
        <div class="row-grid row-head composer-head">
          <span>新增 Storage 类型</span>
          <span>新增 Key</span>
          <span>新增说明</span>
          <span class="row-actions-head">操作</span>
        </div>
        <div class="row-grid composer-row">
          <app-select
            .testId=${'options-composer-storage-select'}
            compact
            .options=${this.storageTypeOptions}
            .value=${this.composerDraft.storageType}
            .ariaLabel=${'新增 Storage 类型'}
            .description=${this.composerMessage}
            .invalid=${composerInvalid}
            ?disabled=${!this.ready}
            @value-change=${(event: CustomEvent<string>) =>
              this.dispatchComposerDraftChange('storageType', event.detail)}
          ></app-select>
          <app-input
            id="options-composer-key-input"
            .testId=${'options-composer-key-input'}
            compact
            .value=${this.composerDraft.key}
            placeholder="例如 userLocale"
            .ariaLabel=${'新增 Key'}
            .description=${this.composerMessage}
            .invalid=${composerInvalid}
            ?disabled=${!this.ready}
            @value-change=${(event: CustomEvent<string>) =>
              this.dispatchComposerDraftChange('key', event.detail)}
          ></app-input>
          <app-input
            .testId=${'options-composer-description-input'}
            compact
            .value=${this.composerDraft.description}
            placeholder="例如：业务语言标识"
            .ariaLabel=${'新增说明'}
            .description=${this.composerMessage}
            ?disabled=${!this.ready}
            @value-change=${(event: CustomEvent<string>) =>
              this.dispatchComposerDraftChange('description', event.detail)}
          ></app-input>
          <button data-test-id="options-add-config-button" class="primary" ?disabled=${!this.ready} @click=${this.dispatchComposerAppend}>加入列表</button>
        </div>
        ${this.composerMessage
          ? html`<p id=${composerMessageId} data-test-id="options-composer-message" class="inline-message" role="alert">${this.composerMessage}</p>`
          : nothing}
      </div>
    `
  }

  private dispatchFilterChange(value: string) {
    this.dispatchEvent(
      new CustomEvent<MigrationKeyFilterChangeDetail>('filter-change', {
        detail: { value },
      }),
    )
  }

  private dispatchRowFieldChange(rowId: string, field: ConfigRowField, value: string) {
    this.dispatchEvent(
      new CustomEvent<ConfigRowFieldChangeDetail>('row-field-change', {
        detail: { rowId, field, value },
      }),
    )
  }

  private dispatchRowDeleteRequest(row: PendingMigrationKeyRow) {
    this.dispatchEvent(
      new CustomEvent<MigrationKeyDeleteRequestDetail>('row-delete-request', {
        detail: {
          rowId: row.uiId,
          storageType: row.item.storageType,
          key: row.item.key,
        },
      }),
    )
  }

  private dispatchRowDeleteCancel(rowId: string) {
    this.dispatchEvent(
      new CustomEvent<MigrationKeyDeleteConfirmationDetail>('row-delete-cancel', {
        detail: { rowId },
      }),
    )
  }

  private dispatchRowDeleteConfirm(rowId: string) {
    this.dispatchEvent(
      new CustomEvent<MigrationKeyDeleteConfirmationDetail>('row-delete-confirm', {
        detail: { rowId },
      }),
    )
  }

  private dispatchComposerDraftChange(field: ComposerDraftField, value: string) {
    this.dispatchEvent(
      new CustomEvent<ComposerDraftChangeDetail>('composer-draft-change', {
        detail: { field, value },
      }),
    )
  }

  private dispatchComposerAppend = () => {
    this.dispatchEvent(
      new CustomEvent<MigrationKeyAppendDetail>('composer-append', {
        detail: { ...this.composerDraft },
      }),
    )
  }

  focusDeleteControl(uiId: string): boolean {
    const control = Array.from(
      this.renderRoot.querySelectorAll<HTMLButtonElement>('[data-row-delete-ui-id]'),
    ).find((candidate) => candidate.dataset.rowDeleteUiId === uiId)
    if (!control) {
      return false
    }

    control.focus()
    return true
  }

  focusComposer(): boolean {
    const composerKey = this.renderRoot.querySelector('#options-composer-key-input')
    if (!(composerKey instanceof AppInput)) {
      return false
    }

    composerKey.focusInput()
    return true
  }

  static styles = css`
    :host { display: block; }
    .panel {
      padding: var(--space-2);
      display: grid;
      gap: var(--space-1);
      background: var(--md-sys-color-surface-container-low);
      border: 1px solid var(--md-sys-color-outline-variant);
      border-radius: var(--shape-large);
    }
    h2 { margin: 0; font: var(--type-title-large); }
    .workspace-head { display: flex; align-items: center; justify-content: space-between; gap: var(--space-2); flex-wrap: wrap; }
    .workspace-count, .empty { color: var(--md-sys-color-on-surface-variant); font: var(--type-body-small); }
    .filter-field { min-width: 300px; display: flex; align-items: center; gap: var(--space-2); font: var(--type-label-small); }
    .filter-field app-input { flex: 1; }
    .row-grid { display: grid; grid-template-columns: 140px minmax(180px, 1.2fr) minmax(220px, 1.4fr) 168px; gap: var(--space-1); align-items: center; }
    .row-head { font: var(--type-label-small); color: var(--md-sys-color-on-surface-variant); text-transform: uppercase; letter-spacing: 0.06em; }
    .row-list { list-style: none; padding: 0; margin: 0; display: grid; gap: var(--space-1); }
    .row, .composer-row { padding: 0 var(--space-2); border-radius: var(--shape-medium); background: var(--md-sys-color-surface-container); border: 1px solid var(--md-sys-color-outline-variant); }
    .row:hover { border-color: var(--md-sys-color-outline); background: var(--md-sys-color-surface-container-high); }
    .row-actions { display: flex; justify-content: flex-end; gap: var(--space-2); }
    .row-validation-message { grid-column: 1 / -1; margin: 0; padding: var(--space-2) var(--space-3); border-radius: var(--shape-small); background: var(--md-sys-color-error-container); color: var(--md-sys-color-on-error-container); font: var(--type-body-small); }
    .row-confirmation { grid-column: 1 / -1; display: flex; align-items: center; justify-content: space-between; gap: var(--space-3); flex-wrap: wrap; padding: var(--space-2) var(--space-3); border-radius: var(--shape-small); background: var(--md-sys-color-error-container); color: var(--md-sys-color-on-error-container); font: var(--type-body-small); }
    .row-confirmation p { margin: 0; }
    .confirmation-actions { display: flex; gap: var(--space-2); }
    .composer { display: grid; gap: var(--space-1); padding-top: var(--space-1); border-top: 1px solid var(--md-sys-color-outline-variant); }
    .composer-row { background: var(--md-sys-color-surface-container-high); }
    .inline-message { margin: 0; padding: var(--space-2) var(--space-3); border-radius: var(--shape-small); background: var(--md-sys-color-error-container); color: var(--md-sys-color-on-error-container); font: var(--type-body-small); }
    button { box-sizing: border-box; border: none; min-height: 40px; border-radius: var(--shape-full); padding: var(--space-1) var(--space-2); font: var(--type-label-large); white-space: nowrap; cursor: pointer; transition: background-color var(--motion-short), color var(--motion-short), box-shadow var(--motion-short), transform var(--motion-short); }
    button:hover:not(:disabled) { box-shadow: var(--elevation-1); }
    button:active:not(:disabled) { transform: translateY(1px); }
    button:focus-visible { outline: 2px solid var(--md-sys-color-primary); outline-offset: 2px; }
    .primary { background: var(--md-sys-color-primary); color: var(--md-sys-color-on-primary); }
    .danger { background: var(--md-sys-color-error-container); color: var(--md-sys-color-on-error-container); }
    @media (min-width: 1200px) { .composer-head { display: none; } .row-head { line-height: 1; } }
    @media (max-width: 1100px) { .row-grid { grid-template-columns: 132px minmax(160px, 1fr) minmax(180px, 1fr) 132px; } }
    @media (max-width: 900px) { .panel { padding: var(--space-3); } .row-grid, .row, .composer-row { grid-template-columns: 1fr; } .row-head { display: none; } .row-actions { justify-content: flex-start; } .filter-field { width: 100%; min-width: 0; } .row-list { max-height: none; overflow: visible; } }
  `
}

declare global {
  interface HTMLElementTagNameMap {
    'options-config-table': OptionsConfigTable
  }
}
