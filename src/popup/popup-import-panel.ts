import { LitElement, css, html } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import type { ChoiceChangeDetail } from '../components/app-choice-card'
import '../components/app-choice-card'
import type { Dataset, DatasetItem, PageInfo } from '../shared/types'
import {
  formatDisplayHost,
  formatTimestamp,
  previewValue,
  toRecordKey,
} from '../shared/utils'

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
            <p class="page-url">${this.pageInfo?.url ?? '无法读取当前标签页 URL'}</p>
          </section>

          <section class="panel">
            <div class="section-head">
              <h2>已保存数据集</h2>
              <span>${this.datasets.length} 组</span>
            </div>
            ${this.datasets.length === 0
              ? html`<p class="empty">还没有已保存的数据集。</p>`
              : html`
                  <div class="dataset-list">
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
                            <strong>${item.datasetName}</strong>
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
                ${this.selectedDataset.items.map((item) => this.renderItemRow(item))}
                <button
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
            <strong>${item.key}</strong>
          </div>
          <code>${previewValue(item.value)}</code>
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

  static styles = css`
    :host {
      display: block;
    }

    .workspace {
      display: grid;
      grid-template-columns: minmax(300px, 360px) minmax(0, 1fr);
      gap: 14px;
      align-items: start;
    }

    .column {
      min-width: 0;
      display: grid;
      gap: 14px;
    }

    .panel {
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      border-radius: 16px;
      padding: 14px;
    }

    .section-head,
    .item-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }

    h2,
    p {
      margin: 0;
    }

    h2 {
      font-size: 15px;
    }

    .page-title,
    .dataset-source {
      font-weight: 600;
      margin-top: 10px;
      color: var(--color-text-strong);
    }

    .page-url {
      margin-top: 6px;
      color: var(--color-text-muted);
      word-break: break-all;
      font-size: 12px;
    }

    .item-meta {
      display: grid;
      gap: 8px;
      min-width: 0;
    }

    .badge {
      font-size: 11px;
      font-weight: 600;
      color: var(--color-badge-text);
      background: var(--color-badge-bg);
      border-radius: 999px;
      padding: 3px 8px;
    }

    .dataset-meta {
      display: grid;
      gap: 4px;
      flex: 1;
      min-width: 0;
    }

    .dataset-meta span {
      color: var(--color-text-muted);
      font-size: 12px;
      word-break: break-all;
    }

    .dataset-meta strong {
      min-width: 0;
      word-break: break-word;
    }

    .dataset-list {
      display: grid;
      gap: 10px;
    }

    button {
      font: inherit;
      border: none;
      border-radius: 10px;
      padding: 10px 14px;
      cursor: pointer;
      transition:
        background-color 0.18s ease,
        color 0.18s ease,
        opacity 0.18s ease;
    }

    button:disabled {
      opacity: 0.55;
      cursor: default;
    }

    .primary {
      background: var(--color-accent);
      color: var(--color-accent-contrast);
      font-weight: 700;
    }

    .secondary {
      background: var(--color-secondary-bg);
      color: var(--color-secondary-text);
    }

    .ghost {
      background: transparent;
      color: var(--color-danger-text);
      padding-inline: 10px;
    }

    .wide {
      width: 100%;
      margin-top: 12px;
    }

    .empty {
      color: var(--color-text-muted);
      margin-top: 12px;
    }

    code {
      display: block;
      white-space: pre-wrap;
      word-break: break-all;
      background: var(--color-code-bg);
      border-radius: 10px;
      padding: 8px 10px;
      color: var(--color-code-text);
      font-size: 12px;
    }

    @media (max-width: 900px) {
      .workspace {
        grid-template-columns: 1fr;
      }
    }
  `
}
