import { LitElement, css, html } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import type { ChoiceChangeDetail } from '../components/app-choice-card'
import '../components/app-choice-card'
import '../components/app-disclosure'
import '../components/app-input'
import type { SelectOption } from '../components/app-select'
import '../components/app-select'
import { formatCookieMetadata } from '../shared/cookie-utils'
import type { DatasetItem, LocalhostTarget, PageInfo } from '../shared/types'
import {
  formatLocalhostTarget,
  previewValue,
  serializeLocalhostTarget,
  toRecordKey,
} from '../shared/utils'
import { popupPanelStyles } from './popup-panel-styles'

@customElement('popup-export-panel')
export class PopupExportPanel extends LitElement {
  @property({ attribute: false })
  pageInfo: PageInfo | null = null

  @property({ type: Boolean })
  scanning = false

  @property({ attribute: false })
  exportItems: DatasetItem[] = []

  @property({ attribute: false })
  selectedKeys = new Set<string>()

  @property()
  datasetName = ''

  @property()
  selectedLocalhostTargetKey = ''

  @property({ attribute: false })
  localhostTargets: LocalhostTarget[] = []

  render() {
    return html`
      <div class="workspace">
        <section class="panel">
          <div class="section-head">
            <h2>可导出项</h2>
            <span>${this.exportItems.length} 项</span>
          </div>
          <div class="actions top-actions">
            <button
              class="secondary wide"
              @click=${() => this.emit('save-and-inject-request')}
              ?disabled=${!this.selectedLocalhostTargetKey}
            >
              ${this.selectedLocalhostTargetLabel
                ? `保存并注入到 ${this.selectedLocalhostTargetLabel}`
                : '请先配置注入目标'}
            </button>
          </div>
          <label class="stack">
            <span>数据集名称</span>
            <app-input
              .value=${this.datasetName}
              @value-change=${(event: Event) =>
                this.emit(
                  'dataset-name-change',
                  (event as CustomEvent<string>).detail,
                )}
              placeholder="例如：线上首页状态"
            ></app-input>
          </label>
          <label class="stack">
            <span>注入目标</span>
            <app-select
              .options=${this.localhostTargetOptions}
              .value=${this.selectedLocalhostTargetKey}
              placeholder="请先在 options 中配置注入目标"
              ?disabled=${this.localhostTargets.length === 0}
              @value-change=${(event: Event) =>
                this.emit(
                  'localhost-target-change',
                  (event as CustomEvent<string>).detail,
                )}
            ></app-select>
          </label>
          ${this.exportItems.length === 0
            ? html`<p class="empty">扫描后会在这里显示命中的配置项。</p>`
            : html`
                <p class="summary-note">
                  已选择 ${this.selectedExportCount} / ${this.exportItems.length} 项。详情可展开检查和调整。
                </p>
                <app-disclosure label="数据集内容" count=${`${this.exportItems.length} 项`}>
                  <div class="item-list">
                    ${this.exportItems.map((item) => this.renderItemRow(item))}
                  </div>
                </app-disclosure>
              `}
          <div class="actions">
            <button class="primary wide" @click=${() => this.emit('export-request')}>
              保存选中项为数据集
            </button>
          </div>
        </section>

        <section class="panel">
          <div class="section-head">
            <h2>当前页面</h2>
            <button @click=${() => this.emit('scan-request')} ?disabled=${this.scanning}>
              ${this.scanning ? '扫描中...' : '重新扫描可导出项'}
            </button>
          </div>
          <p class="page-title">${this.pageInfo?.title ?? '未识别页面'}</p>
          <p class="page-url">${this.pageInfo?.url ?? '无法读取当前标签页 URL'}</p>
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
          this.emit('export-item-toggle', {
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

  private get localhostTargetOptions(): SelectOption[] {
    return this.localhostTargets.map((target) => ({
      label: formatLocalhostTarget(target),
      value: serializeLocalhostTarget(target),
    }))
  }

  private get selectedLocalhostTargetLabel() {
    const target = this.localhostTargets.find(
      (item) => serializeLocalhostTarget(item) === this.selectedLocalhostTargetKey,
    )

    return target ? formatLocalhostTarget(target) : ''
  }

  private get selectedExportCount() {
    return this.exportItems.filter((item) =>
      this.selectedKeys.has(toRecordKey(item.storageType, item.key)),
    ).length
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

  static styles = [popupPanelStyles, css`
    :host {
      --popup-panel-columns: minmax(300px, 340px) minmax(0, 1fr);
    }

    .top-actions {
      margin-top: var(--space-3);
      margin-bottom: var(--space-4);
    }
  `]
}
