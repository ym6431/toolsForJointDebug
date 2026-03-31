import { LitElement, css, html, nothing } from 'lit'
import { customElement, state } from 'lit/decorators.js'
import {
  deleteDataset,
  getDefaultLocalhostPort,
  getDatasets,
  getCustomConfig,
  getLocalhostPorts,
  saveDefaultLocalhostPort,
  saveDataset,
} from '../shared/storage'
import type {
  Dataset,
  DatasetItem,
  OperationResult,
  PageInfo,
} from '../shared/types'
import { formatDisplayHost, toRecordKey } from '../shared/utils'
import './popup-export-panel'
import './popup-import-panel'

interface BackgroundResponse {
  error?: string
}

type PopupMode = 'export' | 'import'

@customElement('popup-app')
export class PopupApp extends LitElement {
  @state()
  private pageInfo: PageInfo | null = null

  @state()
  private mode: PopupMode = 'export'

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
  private localhostPorts: string[] = []

  @state()
  private selectedLocalhostPort = ''

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
      const [pageInfo, datasets, localhostPorts, defaultLocalhostPort] = await Promise.all([
        this.getActiveTab(),
        getDatasets(),
        getLocalhostPorts(),
        getDefaultLocalhostPort(),
      ])

      this.pageInfo = pageInfo
      this.mode = getDefaultMode(pageInfo.url)
      this.datasets = datasets
      this.localhostPorts = localhostPorts
      this.selectedLocalhostPort = defaultLocalhostPort

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

  private handleModeChange(mode: PopupMode) {
    this.mode = mode
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

  private handleDatasetNameChange(event: Event) {
    this.datasetName = (event as CustomEvent<string>).detail
  }

  private async handleLocalhostPortChange(event: Event) {
    const port = (event as CustomEvent<string>).detail

    this.selectedLocalhostPort = port
    this.selectedLocalhostPort = await saveDefaultLocalhostPort(port)
  }

  private handleExportToggle(event: Event) {
    const { item, checked } = (event as CustomEvent<ToggleItemDetail>).detail
    const next = new Set(this.selectedExportKeys)
    const recordKey = toRecordKey(item.storageType, item.key)

    if (checked) {
      next.add(recordKey)
    } else {
      next.delete(recordKey)
    }

    this.selectedExportKeys = next
  }

  private handleImportToggle(event: Event) {
    const { item, checked } = (event as CustomEvent<ToggleItemDetail>).detail
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
    const dataset = await this.saveSelectedDataset()

    if (!dataset) {
      return
    }

    this.result = {
      ok: true,
      message: `已保存数据集“${dataset.datasetName}”。`,
    }
  }

  private async handleSaveAndInject() {
    if (!this.selectedLocalhostPort) {
      this.result = {
        ok: false,
        message: '请先在 options 中配置可用的 localhost 端口。',
      }
      return
    }

    const dataset = await this.saveSelectedDataset()

    if (!dataset) {
      return
    }

    try {
      const response = (await chrome.runtime.sendMessage({
        type: 'OPEN_LOCALHOST_AND_APPLY_ITEMS',
        port: this.selectedLocalhostPort,
        items: dataset.items,
      })) as {
        ok?: boolean
        message?: string
        details?: string[]
        error?: string
      }

      if (response.error) {
        throw new Error(response.error)
      }

      this.result = {
        ok: response.ok ?? true,
        message:
          response.message
          ?? `已保存数据集“${dataset.datasetName}”，并开始注入 localhost:${this.selectedLocalhostPort}。`,
        details: response.details,
      }
    } catch (error) {
      this.result = {
        ok: false,
        message: error instanceof Error ? error.message : '打开并注入 localhost 失败。',
      }
    }
  }

  private handleDatasetChange(event: Event) {
    const datasetId = (event as CustomEvent<string>).detail
    this.selectedDatasetId = datasetId
    const dataset = this.datasets.find((item) => item.id === datasetId)

    this.selectedImportKeys = new Set(
      dataset?.items.map((item) => toRecordKey(item.storageType, item.key)) ?? [],
    )
  }

  private async handleDeleteDataset(event: Event) {
    const datasetId = (event as CustomEvent<string>).detail

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
    const localhostPage = this.pageInfo ? isLocalhostPage(this.pageInfo.url) : false

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
              <section class="mode-panel">
                <div class="mode-head">
                  <div>
                    <h2>工作模式</h2>
                    <p class="mode-tip">
                      ${localhostPage
                        ? '检测到 localhost 页面，默认打开导入模式。'
                        : '当前页面不是 localhost，默认打开导出模式。'}
                    </p>
                  </div>
                  <div class="mode-switch" role="tablist" aria-label="切换导入导出模式">
                    <button
                      class=${this.mode === 'export' ? 'mode-button active' : 'mode-button'}
                      @click=${() => this.handleModeChange('export')}
                    >
                      导出模式
                    </button>
                    <button
                      class=${this.mode === 'import' ? 'mode-button active' : 'mode-button'}
                      @click=${() => this.handleModeChange('import')}
                    >
                      导入模式
                    </button>
                  </div>
                </div>
              </section>

              ${this.mode === 'export'
                ? html`
                    <popup-export-panel
                      .pageInfo=${this.pageInfo}
                      .scanning=${this.scanning}
                      .exportItems=${this.exportItems}
                      .selectedKeys=${this.selectedExportKeys}
                      .datasetName=${this.datasetName}
                      .localhostPorts=${this.localhostPorts}
                      .selectedLocalhostPort=${this.selectedLocalhostPort}
                      @scan-request=${this.handleScan}
                      @dataset-name-change=${this.handleDatasetNameChange}
                      @localhost-port-change=${this.handleLocalhostPortChange}
                      @export-item-toggle=${this.handleExportToggle}
                      @export-request=${this.handleExport}
                      @save-and-inject-request=${this.handleSaveAndInject}
                    ></popup-export-panel>
                  `
                : html`
                    <popup-import-panel
                      .pageInfo=${this.pageInfo}
                      .datasets=${this.datasets}
                      .selectedDataset=${this.selectedDataset}
                      .selectedDatasetId=${this.selectedDatasetId}
                      .selectedKeys=${this.selectedImportKeys}
                      .importing=${this.importing}
                      @dataset-select=${this.handleDatasetChange}
                      @dataset-delete=${this.handleDeleteDataset}
                      @import-item-toggle=${this.handleImportToggle}
                      @import-request=${this.handleImport}
                      @refresh-request=${this.handleRefreshPage}
                    ></popup-import-panel>
                  `}

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

  private async saveSelectedDataset() {
    if (!this.pageInfo) {
      return null
    }

    const selectedItems = this.exportItems.filter((item) =>
      this.selectedExportKeys.has(toRecordKey(item.storageType, item.key)),
    )

    if (selectedItems.length === 0) {
      this.result = {
        ok: false,
        message: '请至少选择一个导出项。',
      }
      return null
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

    return dataset
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
    .mode-head {
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

    .panel,
    .mode-panel {
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      border-radius: 16px;
      padding: 14px;
      margin-bottom: 14px;
    }

    .mode-tip {
      margin-top: 6px;
      color: var(--color-text-muted);
      font-size: 12px;
    }

    .mode-switch {
      display: inline-grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      padding: 4px;
      border-radius: 999px;
      background: var(--color-secondary-bg);
      gap: 4px;
      min-width: 220px;
    }

    .mode-button,
    .secondary {
      border: none;
      border-radius: 999px;
      padding: 10px 14px;
      font: inherit;
      cursor: pointer;
      transition:
        background-color 0.18s ease,
        color 0.18s ease,
        opacity 0.18s ease;
    }

    .mode-button {
      background: transparent;
      color: var(--color-text-muted);
      font-weight: 600;
    }

    .mode-button.active {
      background: var(--color-surface);
      color: var(--color-text-strong);
      box-shadow: 0 1px 2px rgba(15, 23, 42, 0.08);
    }

    .secondary {
      background: var(--color-secondary-bg);
      color: var(--color-secondary-text);
    }

    .result.ok {
      border-color: var(--color-success-border);
      background: var(--color-success-bg);
    }

    .result.error {
      border-color: var(--color-error-border);
      background: var(--color-error-bg);
    }

    ul {
      margin: 10px 0 0;
      padding-left: 18px;
    }

    @media (max-width: 900px) {
      :host {
        width: 100%;
      }

      .mode-head {
        align-items: stretch;
        flex-direction: column;
      }

      .mode-switch {
        width: 100%;
        min-width: 0;
      }
    }
  `
}

interface ToggleItemDetail {
  item: DatasetItem
  checked: boolean
}

function getDefaultMode(urlString: string): PopupMode {
  return isLocalhostPage(urlString) ? 'import' : 'export'
}

function isLocalhostPage(urlString: string) {
  try {
    const hostname = new URL(urlString).hostname.replace(/^\[(.*)\]$/, '$1')

    return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1'
  } catch {
    return false
  }
}
