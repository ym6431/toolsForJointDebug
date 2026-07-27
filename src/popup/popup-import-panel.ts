import { LitElement, css, html } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import type { ChoiceChangeDetail } from '../components/app-choice-card'
import '../components/app-choice-card'
import { formatCookieMetadata } from '../shared/cookie-utils'
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
            <strong>${item.key}</strong>
          </div>
          <code>${previewValue(item.value)}</code>
          ${cookieMetadata
            ? html`<p class="cookie-meta">${cookieMetadata}</p>`
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

  static styles = css`
    :host {
      display: block;
    }

    .workspace {
      display: grid;
      grid-template-columns: minmax(300px, 360px) minmax(0, 1fr);
      gap: var(--space-4);
      align-items: start;
    }

    .column {
      min-width: 0;
      display: grid;
      gap: var(--space-4);
    }

    .panel {
      background: var(--md-sys-color-surface-container-low);
      border: 1px solid var(--md-sys-color-outline-variant);
      border-radius: var(--shape-large);
      padding: var(--space-4);
      box-shadow: var(--elevation-1);
    }

    .section-head,
    .item-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-3);
    }

    h2,
    p {
      margin: 0;
    }

    h2 {
      font: var(--type-title-medium);
    }

    .page-title,
    .dataset-source {
      font-weight: 600;
      margin-top: var(--space-3);
      color: var(--md-sys-color-on-surface);
    }

    .page-url {
      margin-top: var(--space-1);
      color: var(--md-sys-color-on-surface-variant);
      word-break: break-all;
      font: var(--type-body-small);
    }

    .item-meta {
      display: grid;
      gap: var(--space-2);
      min-width: 0;
    }

    .badge {
      font: var(--type-label-small);
      color: var(--md-sys-color-on-primary-container);
      background: var(--md-sys-color-primary-container);
      border-radius: var(--shape-full);
      padding: var(--space-1) var(--space-2);
    }

    .dataset-meta {
      display: grid;
      gap: var(--space-1);
      flex: 1;
      min-width: 0;
    }

    .dataset-meta span {
      color: var(--md-sys-color-on-surface-variant);
      font: var(--type-body-small);
      word-break: break-all;
    }

    .dataset-meta strong {
      min-width: 0;
      word-break: break-word;
    }

    .cookie-meta {
      margin: 0;
      font: var(--type-body-small);
      color: var(--md-sys-color-on-surface-variant);
      line-height: 1.5;
      word-break: break-word;
    }

    .dataset-list {
      display: grid;
      gap: var(--space-2);
    }

    button {
      font: inherit;
      border: none;
      min-height: 40px;
      border-radius: var(--shape-full);
      padding: var(--space-2) var(--space-4);
      font: var(--type-label-large);
      cursor: pointer;
      transition:
        background-color var(--motion-short),
        color var(--motion-short),
        box-shadow var(--motion-short),
        transform var(--motion-short);
    }

    button:hover:not(:disabled) {
      box-shadow: var(--elevation-1);
    }

    button:active:not(:disabled) {
      transform: translateY(1px);
    }

    button:focus-visible {
      outline: 2px solid var(--md-sys-color-primary);
      outline-offset: 2px;
    }

    button:disabled {
      opacity: 0.64;
      cursor: default;
    }

    .primary {
      background: var(--md-sys-color-primary);
      color: var(--md-sys-color-on-primary);
    }

    .primary:hover:not(:disabled) {
      background: color-mix(
        in srgb,
        var(--md-sys-color-primary) 88%,
        var(--md-sys-color-on-primary)
      );
    }

    .secondary {
      background: var(--md-sys-color-primary-container);
      color: var(--md-sys-color-on-primary-container);
    }

    .secondary:hover:not(:disabled) {
      background: color-mix(
        in srgb,
        var(--md-sys-color-primary-container) 88%,
        var(--md-sys-color-on-primary-container)
      );
    }

    .ghost {
      background: transparent;
      color: var(--md-sys-color-error);
      padding-inline: var(--space-3);
    }

    .ghost:hover:not(:disabled) {
      background: var(--md-sys-color-error-container);
    }

    .wide {
      width: 100%;
      margin-top: var(--space-4);
    }

    .empty {
      color: var(--md-sys-color-on-surface-variant);
      margin-top: var(--space-4);
    }

    code {
      display: block;
      white-space: pre-wrap;
      word-break: break-all;
      background: var(--app-color-code-surface);
      border-radius: var(--shape-small);
      padding: var(--space-2) var(--space-3);
      color: var(--app-color-code-text);
      font: var(--type-body-small);
      font-family: var(--font-mono);
    }

    @media (max-width: 900px) {
      .workspace {
        grid-template-columns: 1fr;
      }
    }
  `
}
