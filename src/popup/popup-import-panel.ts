import { LitElement, css, html } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import type { ChoiceChangeDetail } from '../components/app-choice-card'
import '../components/app-choice-card'
import '../components/app-disclosure'
import { formatCookieMetadata } from '../shared/cookie-utils'
import type { Dataset, DatasetItem, PageInfo } from '../shared/types'
import {
  formatDisplayHost,
  formatTimestamp,
  previewValue,
  toRecordKey,
} from '../shared/utils'
import { popupPanelStyles } from './popup-panel-styles'

@customElement('popup-import-panel')
export class PopupImportPanel extends LitElement {
  @property({ attribute: false })
  pageInfo: PageInfo | null = null

  @property({ attribute: false })
  datasets: Dataset[] = []

  @property({ attribute: false })
  selectedDataset: Dataset | null = null

  @property()
  selectedDatasetId = ''

  @property({ attribute: false })
  selectedKeys = new Set<string>()

  @property({ type: Boolean })
  importing = false

  render() {
    return html`
      <div class="workspace">
        <div class="column">
          <section class="panel">
            <div class="section-head">
              <h2>当前页面</h2>
              <button
                class="secondary"
                @click=${() => this.emit('refresh-request')}
                ?disabled=${!this.pageInfo}
              >
                刷新页面
              </button>
            </div>
            <p class="page-title">${this.pageInfo?.title ?? '未识别页面'}</p>
            <p data-test-id="import-page-url" class="page-url">${this.pageInfo?.url ?? '无法读取当前标签页 URL'}</p>
          </section>

          <section class="panel">
            <div class="section-head">
              <h2>已保存数据集</h2>
              <span data-test-id="import-dataset-count">${this.datasets.length} 组</span>
            </div>
            ${this.datasets.length === 0
              ? html`<p class="empty">还没有已保存的数据集。</p>`
              : html`
                  <div data-test-id="saved-dataset-list" class="dataset-list">
                    ${this.datasets.map(
                      (item) => html`
                        <app-choice-card
                          type="radio"
                          name="dataset"
                          .value=${item.id}
                          .checked=${this.selectedDatasetId === item.id}
                          @checked-change=${(event: Event) => {
                            const detail = (event as CustomEvent<ChoiceChangeDetail>).detail

                            if (detail.checked) {
                              this.emit('dataset-select', detail.value)
                            }
                          }}
                        >
                          <div class="dataset-meta">
                            <strong data-test-id="saved-dataset-name">${item.datasetName}</strong>
                            <span>${formatTimestamp(item.createdAt)}</span>
                            <span>${formatDisplayHost(item.sourceUrl)}</span>
                          </div>
                          <button
                            slot="action"
                            class="ghost"
                            @click=${(event: Event) => {
                              event.preventDefault()
                              this.emit('dataset-delete', item.id)
                            }}
                          >
                            删除
                          </button>
                        </app-choice-card>
                      `,
                    )}
                  </div>
                `}
          </section>
        </div>

        <section class="panel">
          <div class="section-head">
            <h2>导入预览</h2>
            <span>${this.selectedDataset?.items.length ?? 0} 项</span>
          </div>
          ${this.selectedDataset
            ? html`
                <p class="dataset-source">
                  ${this.selectedDataset.datasetName} · 来源
                  ${formatDisplayHost(this.selectedDataset.sourceUrl)}
                </p>
                <p class="summary-note">
                  已选择 ${this.selectedImportCount} / ${this.selectedDataset.items.length} 项。详情可展开检查和调整。
                </p>
                <app-disclosure .testId=${'import-preview-disclosure-details'} label="数据集内容" count=${`${this.selectedDataset.items.length} 项`}>
                  <div class="item-list">
                    ${this.selectedDataset.items.map((item) => this.renderItemRow(item))}
                  </div>
                </app-disclosure>
                <button
                  data-test-id="import-confirm-button"
                  class="primary wide"
                  @click=${() => this.emit('import-request')}
                  ?disabled=${this.importing}
                >
                  ${this.importing ? '导入中...' : '确认导入选中项'}
                </button>
              `
            : html`<p class="empty">选择一个数据集后可预览并导入。</p>`}
        </section>
      </div>
    `
  }

  private renderItemRow(item: DatasetItem) {
    const checked = this.selectedKeys.has(toRecordKey(item.storageType, item.key))
    const cookieMetadata = item.storageType === 'cookie'
      ? formatCookieMetadata(item.cookie)
      : ''

    return html`
      <app-choice-card
        type="checkbox"
        .checked=${checked}
        @checked-change=${(event: Event) =>
          this.emit('import-item-toggle', {
            item,
            checked: (event as CustomEvent<ChoiceChangeDetail>).detail.checked,
          })}
      >
        <div class="item-meta">
          <div class="item-head">
            <span class="badge">${item.storageType}</span>
            <strong data-test-id="import-preview-item-key">${item.key}</strong>
          </div>
          <code>${previewValue(item.value)}</code>
          ${cookieMetadata
            ? html`<p data-test-id="import-preview-cookie-meta" class="cookie-meta">${cookieMetadata}</p>`
            : null}
        </div>
      </app-choice-card>
    `
  }

  private emit(name: string, detail?: unknown) {
    this.dispatchEvent(
      new CustomEvent(name, {
        detail,
        bubbles: true,
        composed: true,
      }),
    )
  }

  private get selectedImportCount() {
    return this.selectedDataset
      ? this.selectedDataset.items.filter((item) =>
        this.selectedKeys.has(toRecordKey(item.storageType, item.key)),
      ).length
      : 0
  }

  static styles = [popupPanelStyles, css`
    :host {
      --popup-panel-columns: minmax(300px, 360px) minmax(0, 1fr);
    }

    .dataset-list {
      display: grid;
      gap: var(--space-2);
    }

    .wide {
      margin-top: var(--space-4);
    }
  `]
}
