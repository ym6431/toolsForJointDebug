import { LitElement, css, html } from 'lit'
import { customElement, state } from 'lit/decorators.js'
import type { SelectOption } from '../components/app-select'
import '../components/app-input'
import '../components/app-select'
import {
  getCustomConfig,
  getDefaultLocalhostTargetKey,
  getLocalhostTargets,
  resetCustomConfig,
  saveCustomConfig,
  saveLocalhostTargetConfig,
} from '../shared/storage'
import type {
  ConfigItem,
  LocalhostProtocol,
  LocalhostTarget,
  StorageType,
} from '../shared/types'
import {
  dedupeConfig,
  formatLocalhostTarget,
  normalizeLocalhostTarget,
  normalizeLocalhostTargetKey,
  normalizeLocalhostTargetList,
  resolveDefaultLocalhostTargetKey,
  serializeLocalhostTarget,
} from '../shared/utils'
import type {
  ComposerDraft,
  LocalhostDraft,
  PendingMigrationKeyRow,
  PendingState,
  SavedSnapshot,
} from './options-state'
import {
  buildPendingRows,
  buildSavedSnapshot,
  comparePendingWithSnapshot,
  validateComposerDraft,
  composeMigrationKeyItem,
} from './options-state'

type ConfirmationKind = 'remove-config-row' | 'remove-localhost-target' | 'clear-all'

interface ConfirmationRequest {
  kind: ConfirmationKind
  rowUiId?: string
  targetKey?: string
  message: string
}

@customElement('options-app')
export class OptionsApp extends LitElement {
  private readonly importInputId = 'config-import-input'
  private importMode: 'replace' | 'merge' = 'replace'

  @state()
  private customRows: PendingMigrationKeyRow[] = []

  @state()
  private filterQuery = ''

  @state()
  private localhostTargets: LocalhostTarget[] = []

  @state()
  private defaultLocalhostTargetKey = ''

  @state()
  private composerDraft: ComposerDraft = {
    storageType: 'localStorage',
    key: '',
    description: '',
  }

  @state()
  private composerMessage = ''

  @state()
  private localhostDraft: LocalhostDraft = { protocol: 'http', port: '' }

  @state()
  private localhostMessage = ''

  @state()
  private operationMessage = ''

  @state()
  private savedSnapshot: SavedSnapshot = {
    customItems: [],
    localhostTargets: [],
    defaultLocalhostTargetKey: '',
  }

  @state()
  private hasPendingChanges = false

  @state()
  private confirmation: ConfirmationRequest | null = null

  @state()
  private loaded = false

  connectedCallback() {
    super.connectedCallback()
    void this.loadConfig()
  }

  disconnectedCallback() {
    super.disconnectedCallback()
    this.detachBeforeUnload()
  }

  willUpdate(changedProperties: Map<string, unknown>) {
    if (
      changedProperties.has('customRows') ||
      changedProperties.has('localhostTargets') ||
      changedProperties.has('defaultLocalhostTargetKey')
    ) {
      this.recomputePendingChanges()
    }

    if (changedProperties.has('hasPendingChanges')) {
      if (this.hasPendingChanges) {
        this.attachBeforeUnload()
      } else {
        this.detachBeforeUnload()
      }
    }
  }

  private attachBeforeUnload() {
    if (typeof window === 'undefined') {
      return
    }
    window.addEventListener('beforeunload', this.handleBeforeUnload)
  }

  private detachBeforeUnload() {
    if (typeof window === 'undefined') {
      return
    }
    window.removeEventListener('beforeunload', this.handleBeforeUnload)
  }

  private handleBeforeUnload = (event: BeforeUnloadEvent) => {
    if (!this.hasPendingChanges) {
      return
    }
    event.preventDefault()
    event.returnValue = ''
  }

  private recomputePendingChanges() {
    const pending: PendingState = {
      customItems: this.customRows,
      localhostTargets: this.localhostTargets,
      defaultLocalhostTargetKey: this.defaultLocalhostTargetKey,
    }
    this.hasPendingChanges = comparePendingWithSnapshot(pending, this.savedSnapshot)
  }

  private async loadConfig() {
    const [customItems, localhostTargets, defaultLocalhostTargetKey] = await Promise.all([
      getCustomConfig(),
      getLocalhostTargets(),
      getDefaultLocalhostTargetKey(),
    ])

    const rows = buildPendingRows(customItems)
    this.customRows = rows
    this.localhostTargets = localhostTargets
    this.defaultLocalhostTargetKey = defaultLocalhostTargetKey
    this.savedSnapshot = buildSavedSnapshot({
      customItems: rows,
      localhostTargets,
      defaultLocalhostTargetKey,
    })
    this.hasPendingChanges = false
    this.loaded = true
  }

  // ---------- Filter ----------

  private handleFilterChange = (event: Event) => {
    const input = event.target as HTMLInputElement
    this.filterQuery = input.value
  }

  private get filteredRows(): PendingMigrationKeyRow[] {
    const trimmed = this.filterQuery.trim().toLowerCase()
    if (!trimmed) {
      return this.customRows
    }
    return this.customRows.filter(({ item }) => {
      const key = item.key.toLowerCase()
      const description = item.description.toLowerCase()
      return key.includes(trimmed) || description.includes(trimmed)
    })
  }

  // ---------- Composer ----------

  private updateComposerDraft<K extends keyof ComposerDraft>(
    key: K,
    value: ComposerDraft[K],
  ) {
    this.composerDraft = { ...this.composerDraft, [key]: value }
    if (this.composerMessage) {
      this.composerMessage = ''
    }
  }

  private handleComposerAppend = () => {
    const validation = validateComposerDraft(this.composerDraft, this.customRows)
    if (!validation.accepted) {
      this.composerMessage = validation.message ?? '无法加入该配置项。'
      return
    }
    const newItem = composeMigrationKeyItem(this.composerDraft)
    this.customRows = [
      ...this.customRows,
      { uiId: cryptoRandomId(), item: newItem },
    ]
    this.composerDraft = { storageType: 'localStorage', key: '', description: '' }
    this.composerMessage = ''
  }

  // ---------- Row update / delete ----------

  private handleRowFieldChange = (
    uiId: string,
    field: keyof ConfigItem,
    value: string,
  ) => {
    this.customRows = this.customRows.map((row) => {
      if (row.uiId !== uiId) {
        return row
      }
      const nextValue = field === 'storageType' ? (value as StorageType) : value
      return {
        ...row,
        item: { ...row.item, [field]: nextValue },
      }
    })
  }

  private requestRowDelete(uiId: string) {
    const row = this.customRows.find((entry) => entry.uiId === uiId)
    if (!row) {
      return
    }
    this.confirmation = {
      kind: 'remove-config-row',
      rowUiId: uiId,
      message: row.item.key
        ? `确认删除配置 ${row.item.storageType}:${row.item.key}？`
        : '确认删除该配置行？',
    }
  }

  private cancelConfirmation = () => {
    this.confirmation = null
  }

  private confirmRowDelete(uiId: string) {
    this.customRows = this.customRows.filter((row) => row.uiId !== uiId)
    this.confirmation = null
  }

  // ---------- Localhost ----------

  private handleLocalhostDraftChange<K extends keyof LocalhostDraft>(
    key: K,
    value: LocalhostDraft[K],
  ) {
    this.localhostDraft = { ...this.localhostDraft, [key]: value }
    if (this.localhostMessage) {
      this.localhostMessage = ''
    }
  }

  private handleAddLocalhostTarget = () => {
    const target = normalizeLocalhostTarget(this.localhostDraft)
    if (!target) {
      this.localhostMessage = '端口必须是 1 到 65535 之间的数字。'
      return
    }
    const targetKey = serializeLocalhostTarget(target)
    if (this.localhostTargets.some((item) => serializeLocalhostTarget(item) === targetKey)) {
      this.localhostMessage = `${formatLocalhostTarget(target)} 已存在。`
      this.localhostDraft = { ...this.localhostDraft, port: '' }
      return
    }
    this.localhostTargets = [...this.localhostTargets, target]
    this.defaultLocalhostTargetKey = this.defaultLocalhostTargetKey || targetKey
    this.localhostDraft = { protocol: 'http', port: '' }
    this.localhostMessage = ''
  }

  private setDefaultLocalhostTarget(targetKey: string) {
    this.defaultLocalhostTargetKey = targetKey
  }

  private requestLocalhostDelete(targetKey: string) {
    const target = this.localhostTargets.find(
      (item) => serializeLocalhostTarget(item) === targetKey,
    )
    const label = target ? formatLocalhostTarget(target) : targetKey
    this.confirmation = {
      kind: 'remove-localhost-target',
      targetKey,
      message: `确认删除目标 ${label}？`,
    }
  }

  private confirmLocalhostDelete(targetKey: string) {
    const remaining = this.localhostTargets.filter(
      (item) => serializeLocalhostTarget(item) !== targetKey,
    )
    const nextDefault =
      this.defaultLocalhostTargetKey === targetKey
        ? resolveDefaultLocalhostTargetKey(remaining, '')
        : this.defaultLocalhostTargetKey
    this.localhostTargets = remaining
    this.defaultLocalhostTargetKey = nextDefault
    this.confirmation = null
  }

  private confirmClearAll() {
    void Promise.all([resetCustomConfig(), saveLocalhostTargetConfig([], '')]).then(() => {
      this.customRows = []
      this.localhostTargets = []
      this.defaultLocalhostTargetKey = ''
      this.localhostDraft = { protocol: 'http', port: '' }
      this.composerDraft = { storageType: 'localStorage', key: '', description: '' }
      this.composerMessage = ''
      this.localhostMessage = ''
      this.savedSnapshot = buildSavedSnapshot({
        customItems: [],
        localhostTargets: [],
        defaultLocalhostTargetKey: '',
      })
      this.hasPendingChanges = false
      this.confirmation = null
      this.operationMessage = '已清空全部配置项。'
    })
  }

  // ---------- Save ----------

  private async saveAll() {
    const normalizedItems = dedupeConfig(this.customRows.map((row) => row.item))
    const savedItems = await saveCustomConfig(normalizedItems)
    const localhostConfig = await saveLocalhostTargetConfig(
      this.localhostTargets,
      this.defaultLocalhostTargetKey,
    )
    const rebuiltRows = buildPendingRows(savedItems)
    this.customRows = rebuiltRows
    this.localhostTargets = localhostConfig.localhostTargets
    this.defaultLocalhostTargetKey = localhostConfig.defaultLocalhostTargetKey
    this.savedSnapshot = buildSavedSnapshot({
      customItems: rebuiltRows,
      localhostTargets: localhostConfig.localhostTargets,
      defaultLocalhostTargetKey: localhostConfig.defaultLocalhostTargetKey,
    })
    this.hasPendingChanges = false
    this.operationMessage = '配置已保存。'
  }

  // ---------- Export / Import ----------

  private handleExportConfig = () => {
    const payload = {
      version: 3,
      exportedAt: new Date().toISOString(),
      localhostTargets: this.localhostTargets,
      defaultLocalhostTarget: this.defaultLocalhostTargetKey,
      items: this.customRows.map((row) => row.item),
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    })
    const downloadUrl = URL.createObjectURL(blob)
    const link = document.createElement('a')
    const date = new Date().toISOString().slice(0, 10)
    link.href = downloadUrl
    link.download = `state-migrator-config-${date}.json`
    link.click()
    URL.revokeObjectURL(downloadUrl)
    this.operationMessage = `已导出 ${this.customRows.length} 项配置（请确认后保存）。`
  }

  private openImportPicker(mode: 'replace' | 'merge') {
    this.importMode = mode
    this.renderRoot
      .querySelector<HTMLInputElement>(`#${this.importInputId}`)
      ?.click()
  }

  private isStorageType(value: unknown): value is StorageType {
    return value === 'localStorage' || value === 'sessionStorage' || value === 'cookie'
  }

  private normalizeImportedConfig(data: unknown) {
    const items =
      Array.isArray(data)
        ? data
        : data && typeof data === 'object' && 'items' in data
          ? (data as { items?: unknown }).items
          : null
    const localhostTargetValues =
      data && typeof data === 'object' && 'localhostTargets' in data
        ? (data as { localhostTargets?: unknown }).localhostTargets
        : data && typeof data === 'object' && 'localhostPorts' in data
          ? (data as { localhostPorts?: unknown }).localhostPorts
          : []
    const defaultLocalhostTarget =
      data && typeof data === 'object' && 'defaultLocalhostTarget' in data
        ? (data as { defaultLocalhostTarget?: unknown }).defaultLocalhostTarget
        : data && typeof data === 'object' && 'defaultLocalhostPort' in data
          ? (data as { defaultLocalhostPort?: unknown }).defaultLocalhostPort
          : data && typeof data === 'object' && 'localhostPort' in data
            ? (data as { localhostPort?: unknown }).localhostPort
            : ''

    if (!Array.isArray(items)) {
      throw new Error('导入文件格式不正确，缺少 items 数组。')
    }

    const normalizedTargets = Array.isArray(localhostTargetValues)
      ? normalizeLocalhostTargetList(localhostTargetValues)
      : normalizeLocalhostTarget(defaultLocalhostTarget)
        ? [normalizeLocalhostTarget(defaultLocalhostTarget)!]
        : []

    return {
      localhostTargets: normalizedTargets,
      defaultLocalhostTargetKey: normalizeLocalhostTargetKey(defaultLocalhostTarget),
      items: items.map((item, index) => {
        if (!item || typeof item !== 'object') {
          throw new Error(`第 ${index + 1} 项不是合法对象。`)
        }

        const storageType = 'storageType' in item ? item.storageType : null
        const key = 'key' in item ? item.key : null
        const description = 'description' in item ? item.description : ''

        if (!this.isStorageType(storageType)) {
          throw new Error(`第 ${index + 1} 项的 storageType 不合法。`)
        }

        if (typeof key !== 'string' || !key.trim()) {
          throw new Error(`第 ${index + 1} 项的 key 不能为空。`)
        }

        return {
          storageType,
          key,
          description: typeof description === 'string' ? description : String(description ?? ''),
        } satisfies ConfigItem
      }),
    }
  }

  private async handleImportFile(event: Event) {
    const input = event.target as HTMLInputElement
    const file = input.files?.[0]
    if (!file) {
      return
    }

    try {
      const text = await file.text()
      const parsed = JSON.parse(text) as unknown
      const imported = this.normalizeImportedConfig(parsed)

      if (this.importMode === 'merge') {
        const mergedItems = dedupeConfig([
          ...this.customRows.map((row) => row.item),
          ...imported.items,
        ])
        const mergedTargets = normalizeLocalhostTargetList([
          ...this.localhostTargets,
          ...imported.localhostTargets,
        ])
        this.customRows = buildPendingRows(mergedItems)
        this.localhostTargets = mergedTargets
        this.defaultLocalhostTargetKey = resolveDefaultLocalhostTargetKey(
          mergedTargets,
          imported.defaultLocalhostTargetKey || this.defaultLocalhostTargetKey,
        )
        this.operationMessage = `已追加合并 ${imported.items.length} 项配置，请确认后保存。`
      } else {
        const replacedItems = dedupeConfig(imported.items)
        const replacedTargets = normalizeLocalhostTargetList(imported.localhostTargets)
        this.customRows = buildPendingRows(replacedItems)
        this.localhostTargets = replacedTargets
        this.defaultLocalhostTargetKey = resolveDefaultLocalhostTargetKey(
          replacedTargets,
          imported.defaultLocalhostTargetKey,
        )
        this.operationMessage = `已覆盖导入 ${this.customRows.length} 项配置，请确认后保存。`
      }
    } catch (error) {
      this.operationMessage = error instanceof Error ? error.message : '导入配置失败。'
    } finally {
      input.value = ''
    }
  }

  // ---------- Helpers ----------

  private get storageTypeOptions(): SelectOption[] {
    return [
      { label: 'localStorage', value: 'localStorage' },
      { label: 'sessionStorage', value: 'sessionStorage' },
      { label: 'cookie', value: 'cookie' },
    ]
  }

  private get localhostProtocolOptions(): SelectOption[] {
    return [
      { label: 'http', value: 'http' },
      { label: 'https', value: 'https' },
    ]
  }

  // ---------- Render ----------

  render() {
    return html`
      <main>
        <header class="page-header">
          <h1>迁移 Key 配置</h1>
          <p class="lead">
            这里维护 popup 扫描时使用的全部配置项。当前 ${this.customRows.length} 项配置，${this.localhostTargets.length} 个目标。
          </p>
        </header>

        <section class="toolbar" aria-label="操作工具栏">
          <input
            id=${this.importInputId}
            class="visually-hidden"
            type="file"
            accept="application/json,.json"
            @change=${this.handleImportFile}
          />
          <button class="secondary" @click=${this.handleExportConfig}>导出配置</button>
          <button class="secondary" @click=${() => this.openImportPicker('merge')}>
            追加合并导入
          </button>
          <button class="secondary" @click=${() => this.openImportPicker('replace')}>
            覆盖导入
          </button>
          <button
            class="primary ${this.hasPendingChanges ? 'is-pending' : ''}"
            @click=${this.saveAll}
          >
            保存全部配置
          </button>
          <button
            class="danger"
            @click=${() => {
              this.confirmation = {
                kind: 'clear-all',
                message: '确认清空全部配置项？此操作会清除已保存配置。',
              }
            }}
          >
            清空全部配置
          </button>
          ${this.hasPendingChanges
            ? html`<span class="pending-indicator" role="status">
                有未保存的修改
              </span>`
            : null}
        </section>

        ${this.confirmation && this.confirmation.kind === 'clear-all'
          ? this.renderToolbarConfirmation()
          : null}

        <section class="panel localhost-strip" aria-label="本地注入目标">
          <div class="strip-head">
            <h2>本地注入目标</h2>
            <span class="strip-helper">
              popup 中会以下拉列表展示这里保存的注入目标，并默认选中当前默认值。
            </span>
          </div>
          <div class="strip-composer">
            <label class="field">
              <span>协议</span>
              <app-select
                compact
                .options=${this.localhostProtocolOptions}
                .value=${this.localhostDraft.protocol}
                @value-change=${(event: Event) =>
                  this.handleLocalhostDraftChange(
                    'protocol',
                    (event as CustomEvent<string>).detail as LocalhostProtocol,
                  )}
              ></app-select>
            </label>
            <label class="field">
              <span>端口</span>
              <app-input
                compact
                .value=${this.localhostDraft.port}
                inputmode="numeric"
                placeholder="例如：5173"
                @value-change=${(event: Event) =>
                  this.handleLocalhostDraftChange('port', (event as CustomEvent<string>).detail)}
              ></app-input>
            </label>
            <button class="secondary" @click=${this.handleAddLocalhostTarget}>
              加入端口列表
            </button>
          </div>
          ${this.localhostMessage
            ? html`<p class="inline-message" role="alert">${this.localhostMessage}</p>`
            : null}
          ${this.localhostTargets.length === 0
            ? html`<p class="empty">还没有可用的 localhost 注入目标。</p>`
            : html`
                <ul class="target-list">
                  ${this.localhostTargets.map((target) => {
                    const targetKey = serializeLocalhostTarget(target)
                    const isDefault = this.defaultLocalhostTargetKey === targetKey
                    return html`
                      <li class="target-chip ${isDefault ? 'is-default' : ''}">
                        <div class="target-meta">
                          <strong>${formatLocalhostTarget(target)}</strong>
                          ${isDefault ? html`<span class="badge">默认</span>` : null}
                        </div>
                        <div class="target-actions">
                          ${isDefault
                            ? html`<button class="success" disabled>默认端口</button>`
                            : html`
                                <button
                                  class="success"
                                  @click=${() => this.setDefaultLocalhostTarget(targetKey)}
                                >
                                  设为默认
                                </button>
                              `}
                          <button
                            class="danger"
                            @click=${() => this.requestLocalhostDelete(targetKey)}
                          >
                            删除目标 ${formatLocalhostTarget(target)}
                          </button>
                        </div>
                      </li>
                    `
                  })}
                </ul>
              `}
        </section>

        ${this.confirmation && this.confirmation.kind === 'remove-localhost-target'
          ? this.renderLocalhostConfirmation()
          : null}

        <section class="panel key-workspace" aria-label="迁移 Key 工作区">
          <div class="workspace-head">
            <div>
              <h2>迁移 Key 列表</h2>
              <span class="workspace-count">${this.customRows.length} 项</span>
            </div>
            <label class="filter-field">
              <span>筛选配置</span>
              <app-input
                compact
                .value=${this.filterQuery}
                placeholder="按 Key 或说明筛选"
                @value-change=${this.handleFilterChange}
              ></app-input>
            </label>
          </div>

          ${this.loaded && this.customRows.length === 0
            ? html`<p class="empty">还没有自定义配置。</p>`
            : this.filteredRows.length === 0
              ? html`<p class="empty">没有匹配的配置项。</p>`
              : html`
                  <div class="row-grid row-head">
                    <span>Storage 类型</span>
                    <span>Key</span>
                    <span>说明</span>
                    <span class="row-actions-head">操作</span>
                  </div>
                  <ul class="row-grid row-list">
                    ${this.filteredRows.map((row) => this.renderEditableRow(row))}
                  </ul>
                `}

          <div class="composer">
            <div class="row-grid row-head">
              <span>新增 Storage 类型</span>
              <span>新增 Key</span>
              <span>新增说明</span>
              <span class="row-actions-head">操作</span>
            </div>
            <div class="row-grid composer-row">
              <app-select
                compact
                .options=${this.storageTypeOptions}
                .value=${this.composerDraft.storageType}
                @value-change=${(event: Event) =>
                  this.updateComposerDraft(
                    'storageType',
                    (event as CustomEvent<string>).detail as StorageType,
                  )}
              ></app-select>
              <app-input
                compact
                .value=${this.composerDraft.key}
                placeholder="例如 userLocale"
                @value-change=${(event: Event) =>
                  this.updateComposerDraft('key', (event as CustomEvent<string>).detail)}
              ></app-input>
              <app-input
                compact
                .value=${this.composerDraft.description}
                placeholder="例如：业务语言标识"
                @value-change=${(event: Event) =>
                  this.updateComposerDraft(
                    'description',
                    (event as CustomEvent<string>).detail,
                  )}
              ></app-input>
              <button class="primary" @click=${this.handleComposerAppend}>加入列表</button>
            </div>
            ${this.composerMessage
              ? html`<p class="inline-message" role="alert">${this.composerMessage}</p>`
              : null}
          </div>
        </section>

        ${this.confirmation && this.confirmation.kind === 'remove-config-row'
          ? this.renderRowConfirmation()
          : null}

        ${this.operationMessage
          ? html`<p class="operation-message" role="status">${this.operationMessage}</p>`
          : null}
      </main>
    `
  }

  private renderEditableRow(row: PendingMigrationKeyRow) {
    return html`
      <li class="row-grid row" data-ui-id=${row.uiId}>
        <app-select
          compact
          .options=${this.storageTypeOptions}
          .value=${row.item.storageType}
          @value-change=${(event: Event) =>
            this.handleRowFieldChange(
              row.uiId,
              'storageType',
              (event as CustomEvent<string>).detail,
            )}
        ></app-select>
        <app-input
          compact
          .value=${row.item.key}
          @value-change=${(event: Event) =>
            this.handleRowFieldChange(row.uiId, 'key', (event as CustomEvent<string>).detail)}
        ></app-input>
        <app-input
          compact
          .value=${row.item.description}
          @value-change=${(event: Event) =>
            this.handleRowFieldChange(
              row.uiId,
              'description',
              (event as CustomEvent<string>).detail,
            )}
        ></app-input>
        <div class="row-actions">
          <button class="danger" @click=${() => this.requestRowDelete(row.uiId)}>
            删除配置 ${row.item.key || '行'}
          </button>
        </div>
      </li>
    `
  }

  private renderRowConfirmation() {
    const confirmation = this.confirmation
    if (!confirmation || confirmation.kind !== 'remove-config-row' || !confirmation.rowUiId) {
      return null
    }
    return html`
      <div class="confirmation" role="alertdialog" aria-label="删除配置确认">
        <p>${confirmation.message}</p>
        <div class="confirmation-actions">
          <button class="primary" @click=${this.cancelConfirmation}>取消</button>
          <button
            class="danger"
            @click=${() => this.confirmRowDelete(confirmation.rowUiId!)}
          >
            确认删除
          </button>
        </div>
      </div>
    `
  }

  private renderLocalhostConfirmation() {
    const confirmation = this.confirmation
    if (!confirmation || confirmation.kind !== 'remove-localhost-target' || !confirmation.targetKey) {
      return null
    }
    return html`
      <div class="confirmation" role="alertdialog" aria-label="删除目标确认">
        <p>${confirmation.message}</p>
        <div class="confirmation-actions">
          <button class="primary" @click=${this.cancelConfirmation}>取消</button>
          <button
            class="danger"
            @click=${() => this.confirmLocalhostDelete(confirmation.targetKey!)}
          >
            确认删除
          </button>
        </div>
      </div>
    `
  }

  private renderToolbarConfirmation() {
    const confirmation = this.confirmation
    if (!confirmation || confirmation.kind !== 'clear-all') {
      return null
    }
    return html`
      <div class="confirmation toolbar-confirmation" role="alertdialog" aria-label="清空配置确认">
        <p>${confirmation.message}</p>
        <div class="confirmation-actions">
          <button class="primary" @click=${this.cancelConfirmation}>取消</button>
          <button class="danger" @click=${() => this.confirmClearAll()}>确认清空</button>
        </div>
      </div>
    `
  }

  static styles = css`
    :host {
      display: block;
      min-height: 100dvh;
      color: var(--md-sys-color-on-surface);
    }

    *,
    *::before,
    *::after {
      box-sizing: border-box;
    }

    main {
      max-width: 1240px;
      margin: 0 auto;
      padding: var(--space-6) var(--space-6) var(--space-12);
      display: flex;
      flex-direction: column;
      gap: var(--space-5);
    }

    .page-header h1 {
      margin: 0 0 var(--space-2);
      font: var(--type-headline-large);
      letter-spacing: -0.02em;
    }

    .page-header .lead {
      margin: 0;
      color: var(--md-sys-color-on-surface-variant);
      font: var(--type-body-medium);
    }

    .panel,
    .toolbar {
      background: var(--md-sys-color-surface-container-low);
      border: 1px solid var(--md-sys-color-outline-variant);
      border-radius: var(--shape-large);
    }

    .panel {
      padding: var(--space-5);
      display: flex;
      flex-direction: column;
      gap: var(--space-4);
    }

    .toolbar {
      position: sticky;
      top: var(--space-3);
      z-index: 10;
      padding: var(--space-3) var(--space-4);
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--space-2);
      background: var(--md-sys-color-surface-container);
    }

    .pending-indicator {
      margin-left: var(--space-2);
      padding: var(--space-1) var(--space-3);
      border-radius: var(--shape-full);
      background: var(--md-sys-color-primary-container);
      color: var(--md-sys-color-on-primary-container);
      font: var(--type-label-small);
    }

    .strip-head,
    .workspace-head {
      display: flex;
      align-items: flex-end;
      justify-content: space-between;
      gap: var(--space-4);
      flex-wrap: wrap;
    }

    .strip-helper,
    .workspace-count {
      color: var(--md-sys-color-on-surface-variant);
      font: var(--type-body-small);
    }

    .strip-composer,
    .filter-field {
      display: grid;
      gap: var(--space-2);
    }

    .strip-composer {
      grid-template-columns: 140px 160px auto;
      align-items: end;
      max-width: 480px;
    }

    .filter-field {
      min-width: 260px;
    }

    .target-list {
      list-style: none;
      padding: 0;
      margin: 0;
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-3);
    }

    .target-chip {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      padding: var(--space-2) var(--space-3);
      border-radius: var(--shape-medium);
      border: 1px solid var(--md-sys-color-outline-variant);
      background: var(--md-sys-color-surface-container);
      min-height: 40px;
    }

    .target-chip.is-default {
      border-color: var(--md-sys-color-primary);
      background: var(--md-sys-color-primary-container);
      color: var(--md-sys-color-on-primary-container);
    }

    .target-meta {
      display: flex;
      align-items: center;
      gap: var(--space-2);
    }

    .target-actions {
      display: flex;
      gap: var(--space-2);
    }

    .badge {
      display: inline-flex;
      align-items: center;
      padding: var(--space-1) var(--space-2);
      border-radius: var(--shape-full);
      background: var(--md-sys-color-primary);
      color: var(--md-sys-color-on-primary);
      font: var(--type-label-small);
    }

    .empty {
      color: var(--md-sys-color-on-surface-variant);
      font: var(--type-body-medium);
    }

    .inline-message {
      margin: 0;
      padding: var(--space-2) var(--space-3);
      border-radius: var(--shape-small);
      background: var(--md-sys-color-error-container);
      color: var(--md-sys-color-on-error-container);
      font: var(--type-body-small);
    }

    .operation-message {
      margin: 0;
      padding: var(--space-3) var(--space-4);
      border-radius: var(--shape-medium);
      background: var(--md-sys-color-primary-container);
      color: var(--md-sys-color-on-primary-container);
      font: var(--type-body-medium);
    }

    .row-grid {
      display: grid;
      grid-template-columns: 160px minmax(180px, 1.2fr) minmax(220px, 1.4fr) 160px;
      gap: var(--space-3);
      align-items: center;
    }

    .row-head {
      font: var(--type-label-small);
      color: var(--md-sys-color-on-surface-variant);
      text-transform: uppercase;
      letter-spacing: 0.06em;
      padding-bottom: var(--space-2);
      border-bottom: 1px solid var(--md-sys-color-outline-variant);
    }

    .row-list {
      list-style: none;
      padding: 0;
      margin: 0;
      display: grid;
      gap: var(--space-2);
    }

    .row {
      padding: var(--space-2) var(--space-3);
      border-radius: var(--shape-medium);
      background: var(--md-sys-color-surface-container);
      border: 1px solid var(--md-sys-color-outline-variant);
    }

    .row:hover {
      border-color: var(--md-sys-color-outline);
      background: var(--md-sys-color-surface-container-high);
    }

    .row-actions {
      display: flex;
      gap: var(--space-2);
      justify-content: flex-end;
    }

    .composer {
      display: grid;
      gap: var(--space-2);
      padding-top: var(--space-3);
      border-top: 1px solid var(--md-sys-color-outline-variant);
    }

    .composer-row {
      padding: var(--space-2) var(--space-3);
      border-radius: var(--shape-medium);
      background: var(--md-sys-color-surface-container-high);
    }

    .confirmation {
      padding: var(--space-3) var(--space-4);
      border-radius: var(--shape-medium);
      background: var(--md-sys-color-error-container);
      color: var(--md-sys-color-on-error-container);
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-3);
      flex-wrap: wrap;
    }

    .confirmation-actions {
      display: flex;
      gap: var(--space-2);
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

    button:disabled {
      cursor: not-allowed;
      background: var(--md-sys-color-surface-container);
      color: var(--color-disabled-text);
      box-shadow: none;
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

    .primary {
      background: var(--md-sys-color-primary);
      color: var(--md-sys-color-on-primary);
    }

    .primary.is-pending {
      box-shadow: var(--elevation-2);
    }

    .secondary {
      background: var(--md-sys-color-primary-container);
      color: var(--md-sys-color-on-primary-container);
    }

    .danger {
      background: var(--md-sys-color-error-container);
      color: var(--md-sys-color-on-error-container);
    }

    .success {
      background: var(--app-color-success-container);
      color: var(--app-color-on-success-container);
    }

    .visually-hidden {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      border: 0;
    }

    @media (max-width: 1100px) {
      .row-grid {
        grid-template-columns: 140px minmax(160px, 1fr) minmax(180px, 1fr) 140px;
      }
      .strip-composer {
        grid-template-columns: 140px 140px auto;
      }
    }

    @media (max-width: 900px) {
      main {
        padding: var(--space-4) var(--space-3) var(--space-8);
      }
      .row-grid,
      .row,
      .composer-row {
        grid-template-columns: 1fr;
      }
      .row-head {
        display: none;
      }
      .row-actions {
        justify-content: flex-start;
      }
      .strip-composer {
        grid-template-columns: 1fr;
      }
      .toolbar {
        position: static;
      }
    }
  `
}

function cryptoRandomId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

declare global {
  interface HTMLElementTagNameMap {
    'options-app': OptionsApp
  }
}