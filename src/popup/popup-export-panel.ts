import { LitElement, css, html } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import type { ChoiceChangeDetail } from '../components/app-choice-card'
import '../components/app-choice-card'
import '../components/app-input'
import type { SelectOption } from '../components/app-select'
import { formatCookieMetadata } from '../shared/cookie-utils'
import type { DatasetItem, LocalhostTarget, PageInfo } from '../shared/types'
import {
  formatLocalhostTarget,
  previewValue,
  serializeLocalhostTarget,
  toRecordKey,
} from '../shared/utils'
import '../components/app-select'

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
            : html`${this.exportItems.map((item) => this.renderItemRow(item))}`}
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
      grid-template-columns: minmax(300px, 340px) minmax(0, 1fr);
      gap: var(--space-4);
      align-items: start;
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

    .stack {
      display: grid;
      gap: var(--space-2);
      margin: var(--space-4) 0;
      color: var(--md-sys-color-on-surface-variant);
      font: var(--type-label-large);
    }

    .page-title {
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

    button {
      font: inherit;
    }

    button {
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

    .wide {
      width: 100%;
    }

    .actions {
      display: grid;
      gap: var(--space-2);
      margin-top: var(--space-4);
    }

    .top-actions {
      margin-top: var(--space-3);
      margin-bottom: var(--space-4);
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

    .empty {
      color: var(--md-sys-color-on-surface-variant);
      margin-top: var(--space-4);
    }

    .cookie-meta {
      margin: 0;
      font: var(--type-body-small);
      color: var(--md-sys-color-on-surface-variant);
      line-height: 1.5;
      word-break: break-word;
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
