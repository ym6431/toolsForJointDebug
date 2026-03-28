import { LitElement, css, html, nothing } from 'lit'
import { customElement, state } from 'lit/decorators.js'
import {
  deleteDataset,
  getDatasets,
  getCustomConfig,
  saveDataset,
} from '../shared/storage'
import type {
  Dataset,
  DatasetItem,
  OperationResult,
  PageInfo,
} from '../shared/types'
import {
  formatDisplayHost,
  formatTimestamp,
  previewValue,
  toRecordKey,
} from '../shared/utils'

interface BackgroundResponse {
  error?: string
}

@customElement('popup-app')
export class PopupApp extends LitElement {
  @state()
  private pageInfo: PageInfo | null = null

  @state()
  private datasets: Dataset[] = []

  @state()
  private exportItems: DatasetItem[] = []

  @state()
  private selectedExportKeys = new Set<string>()

  @state()
  private selectedDatasetId = ''

  @state()
  private selectedImportKeys = new Set<string>()

  @state()
  private datasetName = ''

  @state()
  private result: OperationResult | null = null

  @state()
  private loading = true

  @state()
  private scanning = false

  @state()
  private importing = false

  connectedCallback() {
    super.connectedCallback()
    void this.initialize()
  }

  private async initialize() {
    this.loading = true

    try {
      const [pageInfo, datasets] = await Promise.all([
        this.getActiveTab(),
        getDatasets(),
      ])

      this.pageInfo = pageInfo
      this.datasets = datasets

      if (datasets[0]) {
        this.selectedDatasetId = datasets[0].id
        this.selectedImportKeys = new Set(
          datasets[0].items.map((item) => toRecordKey(item.storageType, item.key)),
        )
      }
    } catch (error) {
      this.result = {
        ok: false,
        message: error instanceof Error ? error.message : '初始化失败。',
      }
    } finally {
      this.loading = false
    }
  }

  private async getActiveTab() {
    const response = (await chrome.runtime.sendMessage({
      type: 'GET_ACTIVE_TAB',
    })) as PageInfo & BackgroundResponse

    if (response.error) {
      throw new Error(response.error)
    }

    return response
  }

  private get selectedDataset() {
    return this.datasets.find((dataset) => dataset.id === this.selectedDatasetId) ?? null
  }

  private async handleScan() {
    if (!this.pageInfo) {
      return
    }

    this.scanning = true
    this.result = null

    try {
      const config = await getCustomConfig()
      const response = (await chrome.tabs.sendMessage(this.pageInfo.tabId, {
        type: 'COLLECT_EXPORTABLE_ITEMS',
        config,
      })) as { items?: DatasetItem[]; error?: string }

      if (response.error) {
        throw new Error(response.error)
      }

      const items = response.items ?? []
      this.exportItems = items
      this.selectedExportKeys = new Set(
        items.map((item) => toRecordKey(item.storageType, item.key)),
      )
      this.datasetName = `Imported from ${formatDisplayHost(this.pageInfo.url)}`
      this.result = {
        ok: true,
        message:
          items.length > 0
            ? `已扫描到 ${items.length} 个可导出项。`
            : '当前页面没有命中配置项。',
      }
    } catch (error) {
      this.result = {
        ok: false,
        message: error instanceof Error ? error.message : '扫描失败。',
      }
    } finally {
      this.scanning = false
    }
  }

  private toggleExportItem(item: DatasetItem, checked: boolean) {
    const next = new Set(this.selectedExportKeys)
    const recordKey = toRecordKey(item.storageType, item.key)

    if (checked) {
      next.add(recordKey)
    } else {
      next.delete(recordKey)
    }

    this.selectedExportKeys = next
  }

  private toggleImportItem(item: DatasetItem, checked: boolean) {
    const next = new Set(this.selectedImportKeys)
    const recordKey = toRecordKey(item.storageType, item.key)

    if (checked) {
      next.add(recordKey)
    } else {
      next.delete(recordKey)
    }

    this.selectedImportKeys = next
  }

  private async handleExport() {
    if (!this.pageInfo) {
      return
    }

    const selectedItems = this.exportItems.filter((item) =>
      this.selectedExportKeys.has(toRecordKey(item.storageType, item.key)),
    )

    if (selectedItems.length === 0) {
      this.result = {
        ok: false,
        message: '请至少选择一个导出项。',
      }
      return
    }

    const dataset = await saveDataset({
      datasetName: this.datasetName,
      sourceUrl: this.pageInfo.url,
      items: selectedItems,
    })

    this.datasets = await getDatasets()
    this.selectedDatasetId = dataset.id
    this.selectedImportKeys = new Set(
      dataset.items.map((item) => toRecordKey(item.storageType, item.key)),
    )
    this.result = {
      ok: true,
      message: `已保存数据集“${dataset.datasetName}”。`,
    }
  }

  private handleDatasetChange(datasetId: string) {
    this.selectedDatasetId = datasetId
    const dataset = this.datasets.find((item) => item.id === datasetId)

    this.selectedImportKeys = new Set(
      dataset?.items.map((item) => toRecordKey(item.storageType, item.key)) ?? [],
    )
  }

  private async handleDeleteDataset(datasetId: string) {
    await deleteDataset(datasetId)
    this.datasets = await getDatasets()

    if (this.selectedDatasetId === datasetId) {
      const nextSelected = this.datasets[0] ?? null
      this.selectedDatasetId = nextSelected?.id ?? ''
      this.selectedImportKeys = new Set(
        nextSelected?.items.map((item) => toRecordKey(item.storageType, item.key)) ?? [],
      )
    }

    this.result = {
      ok: true,
      message: '数据集已删除。',
    }
  }

  private async handleImport() {
    if (!this.pageInfo || !this.selectedDataset) {
      return
    }

    const selectedItems = this.selectedDataset.items.filter((item) =>
      this.selectedImportKeys.has(toRecordKey(item.storageType, item.key)),
    )

    if (selectedItems.length === 0) {
      this.result = {
        ok: false,
        message: '请至少选择一个导入项。',
      }
      return
    }

    this.importing = true

    try {
      const response = (await chrome.tabs.sendMessage(this.pageInfo.tabId, {
        type: 'APPLY_IMPORT_ITEMS',
        items: selectedItems,
      })) as { imported?: number; failed?: string[]; error?: string }

      if (response.error) {
        throw new Error(response.error)
      }

      const failed = response.failed ?? []
      this.result = {
        ok: failed.length === 0,
        message:
          failed.length === 0
            ? `成功导入 ${response.imported ?? 0} 项。`
            : `已导入 ${response.imported ?? 0} 项，另有 ${failed.length} 项失败。`,
        details: failed,
      }
    } catch (error) {
      this.result = {
        ok: false,
        message: error instanceof Error ? error.message : '导入失败。',
      }
    } finally {
      this.importing = false
    }
  }

  private async handleRefreshPage() {
    if (!this.pageInfo) {
      return
    }

    const response = (await chrome.runtime.sendMessage({
      type: 'RELOAD_TAB',
      tabId: this.pageInfo.tabId,
    })) as BackgroundResponse

    this.result = response.error
      ? { ok: false, message: response.error }
      : { ok: true, message: '页面已刷新。' }
  }

  private async openOptionsPage() {
    const response = (await chrome.runtime.sendMessage({
      type: 'OPEN_OPTIONS_PAGE',
    })) as BackgroundResponse

    if (response.error) {
      this.result = {
        ok: false,
        message: response.error,
      }
    }
  }

  render() {
    const dataset = this.selectedDataset

    return html`
      <main>
        <header>
          <div>
            <p class="eyebrow">Frontend State Migrator</p>
            <h1>页面状态迁移</h1>
          </div>
          <button class="secondary" @click=${this.openOptionsPage}>配置</button>
        </header>

        ${this.loading
          ? html`<section class="panel"><p>正在加载扩展状态...</p></section>`
          : html`
              <div class="workspace">
                <div class="column">
                  <section class="panel">
                    <div class="section-head">
                      <h2>当前页面</h2>
                      <button @click=${this.handleScan} ?disabled=${this.scanning}>
                        ${this.scanning ? '扫描中...' : '扫描可导出项'}
                      </button>
                    </div>
                    <p class="page-title">${this.pageInfo?.title ?? '未识别页面'}</p>
                    <p class="page-url">${this.pageInfo?.url ?? '无法读取当前标签页 URL'}</p>
                  </section>

                  <section class="panel">
                    <div class="section-head">
                      <h2>可导出项</h2>
                      <span>${this.exportItems.length} 项</span>
                    </div>
                    <label class="stack">
                      <span>数据集名称</span>
                      <input
                        .value=${this.datasetName}
                        @input=${(event: InputEvent) => {
                          this.datasetName = (event.target as HTMLInputElement).value
                        }}
                        placeholder="例如：线上首页状态"
                      />
                    </label>
                    ${this.exportItems.length === 0
                      ? html`<p class="empty">扫描后会在这里显示命中的配置项。</p>`
                      : html`${this.exportItems.map((item) => this.renderItemRow(item, 'export'))}`}
                    <button class="primary wide" @click=${this.handleExport}>
                      保存选中项为数据集
                    </button>
                  </section>
                </div>

                <div class="column">
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
                                <label class="dataset-card">
                                  <input
                                    type="radio"
                                    name="dataset"
                                    .value=${item.id}
                                    .checked=${this.selectedDatasetId === item.id}
                                    @change=${() => this.handleDatasetChange(item.id)}
                                  />
                                  <div class="dataset-meta">
                                    <strong>${item.datasetName}</strong>
                                    <span>${formatTimestamp(item.createdAt)}</span>
                                    <span>${formatDisplayHost(item.sourceUrl)}</span>
                                  </div>
                                  <button
                                    class="ghost"
                                    @click=${() => this.handleDeleteDataset(item.id)}
                                  >
                                    删除
                                  </button>
                                </label>
                              `,
                            )}
                          </div>
                        `}
                  </section>

                  <section class="panel">
                    <div class="section-head">
                      <h2>导入预览</h2>
                      <button
                        class="secondary"
                        @click=${this.handleRefreshPage}
                        ?disabled=${!this.pageInfo}
                      >
                        刷新页面
                      </button>
                    </div>
                    ${dataset
                      ? html`
                          <p class="dataset-source">
                            ${dataset.datasetName} · 来源 ${formatDisplayHost(dataset.sourceUrl)}
                          </p>
                          ${dataset.items.map((item) => this.renderItemRow(item, 'import'))}
                          <button
                            class="primary wide"
                            @click=${this.handleImport}
                            ?disabled=${this.importing}
                          >
                            ${this.importing ? '导入中...' : '确认导入选中项'}
                          </button>
                        `
                      : html`<p class="empty">选择一个数据集后可预览并导入。</p>`}
                  </section>
                </div>
              </div>

              ${this.result
                ? html`
                    <section class="panel result ${this.result.ok ? 'ok' : 'error'}">
                      <h2>操作结果</h2>
                      <p>${this.result.message}</p>
                      ${this.result.details?.length
                        ? html`
                            <ul>
                              ${this.result.details.map((detail) => html`<li>${detail}</li>`)}
                            </ul>
                          `
                        : nothing}
                    </section>
                  `
                : nothing}
            `}
      </main>
    `
  }

  private renderItemRow(item: DatasetItem, mode: 'export' | 'import') {
    const checkedSet =
      mode === 'export' ? this.selectedExportKeys : this.selectedImportKeys
    const checked = checkedSet.has(toRecordKey(item.storageType, item.key))

    return html`
      <label class="item-row">
        <input
          type="checkbox"
          .checked=${checked}
          @change=${(event: Event) => {
            const nextChecked = (event.target as HTMLInputElement).checked

            if (mode === 'export') {
              this.toggleExportItem(item, nextChecked)
            } else {
              this.toggleImportItem(item, nextChecked)
            }
          }}
        />
        <div class="item-meta">
          <div class="item-head">
            <span class="badge">${item.storageType}</span>
            <strong>${item.key}</strong>
          </div>
          <code>${previewValue(item.value)}</code>
        </div>
      </label>
    `
  }

  static styles = css`
    :host {
      display: block;
      width: 880px;
      max-width: 100vw;
      color: var(--color-text);
    }

    *,
    *::before,
    *::after {
      box-sizing: border-box;
    }

    main {
      padding: 16px;
    }

    header,
    .section-head,
    .item-head,
    .dataset-card {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }

    header {
      margin-bottom: 14px;
    }

    h1,
    h2,
    p {
      margin: 0;
    }

    h1 {
      font-size: 22px;
      line-height: 1.15;
    }

    h2 {
      font-size: 15px;
    }

    .eyebrow {
      font-size: 12px;
      color: var(--color-text-muted);
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }

    .panel {
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      border-radius: 16px;
      padding: 14px;
      margin-bottom: 14px;
    }

    .workspace {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 14px;
      align-items: start;
    }

    .column {
      min-width: 0;
    }

    .stack {
      display: grid;
      gap: 6px;
      margin: 12px 0;
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

    .item-row,
    .dataset-card {
      border: 1px solid var(--color-border);
      border-radius: 12px;
      padding: 10px 12px;
      background: var(--color-surface-muted);
      margin-top: 10px;
    }

    .item-row {
      display: grid;
      grid-template-columns: auto 1fr;
      gap: 10px;
      align-items: start;
    }

    .item-row input[type='checkbox'],
    .dataset-card input[type='radio'] {
      width: 16px;
      height: 16px;
      margin: 2px 0 0;
      padding: 0;
      flex: none;
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

    input[type='text'],
    input:not([type]),
    button {
      font: inherit;
    }

    input[type='text'],
    input:not([type]),
    input[type='url'],
    input[type='search'],
    input[type='number'],
    textarea,
    select,
    input[type='email'],
    input[type='password'],
    input[type='date'],
    input[type='datetime-local'],
    input[type='month'],
    input[type='time'],
    input[type='week'],
    input[type='tel'],
    input[type='color'],
    input[type='range'],
    input[type='file'],
    input[type='hidden'],
    input[type='image'],
    input[type='button'],
    input[type='submit'],
    input[type='reset'] {
      width: 100%;
      box-sizing: border-box;
      border: 1px solid var(--color-border-strong);
      border-radius: 10px;
      padding: 10px 12px;
      background: var(--color-surface);
      color: var(--color-text-strong);
    }

    button {
      border: none;
      border-radius: 10px;
      padding: 10px 14px;
      cursor: pointer;
      transition:
        background-color 0.18s ease,
        color 0.18s ease,
        border-color 0.18s ease,
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

    .result.ok {
      border-color: var(--color-success-border);
      background: var(--color-success-bg);
    }

    .result.error {
      border-color: var(--color-error-border);
      background: var(--color-error-bg);
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

    ul {
      margin: 10px 0 0;
      padding-left: 18px;
    }

    @media (max-width: 900px) {
      :host {
        width: 100%;
      }

      .workspace {
        grid-template-columns: 1fr;
      }
    }
  `
}
