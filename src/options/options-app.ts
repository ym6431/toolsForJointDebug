import { LitElement, css, html } from 'lit'
import { customElement, state } from 'lit/decorators.js'
import type { SelectOption } from '../components/app-select'
import {
  clearOptionsConfig,
  getCustomConfig,
  getDefaultLocalhostTargetKey,
  getLocalhostTargets,
  saveOptionsConfig,
} from '../shared/storage'
import type {
  ConfigItem,
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
  ImportNormalizedPayload,
  LocalhostDraft,
  PendingMigrationKeyRow,
  PendingMigrationRowValidationMessages,
  PendingState,
  SavedSnapshot,
} from './options-state'
import {
  buildPendingRows,
  buildSavedSnapshot,
  comparePendingWithSnapshot,
  composeMigrationKeyItem,
  filterMigrationKeyRows,
  validateComposerDraft,
  validatePendingMigrationKeyRows,
} from './options-state'
import type {
  ComposerDraftChangeDetail,
  ConfigRowFieldChangeDetail,
  MigrationKeyAppendDetail,
  MigrationKeyDeleteConfirmationDetail,
  MigrationKeyDeleteRequestDetail,
  MigrationKeyFilterChangeDetail,
  OptionsConfigTable,
} from './options-config-table'
import './options-config-table'
import type {
  LocalhostDraftChangeDetail,
  LocalhostTargetAppendDetail,
  LocalhostTargetDefaultDetail,
  LocalhostTargetDeleteConfirmationDetail,
  LocalhostTargetDeleteRequestDetail,
  OptionsLocalhostStrip,
} from './options-localhost-strip'
import './options-localhost-strip'
import type {
  OptionsConfigImportDetail,
  OptionsToolbar,
  OptionsToolbarCommandDetail,
} from './options-toolbar'
import './options-toolbar'

type ConfirmationKind = 'remove-config-row' | 'remove-localhost-target' | 'clear-all'
type OptionsLoadState = 'loading' | 'ready' | 'error'

interface ConfirmationRequest {
  kind: ConfirmationKind
  rowUiId?: string
  targetKey?: string
  message: string
}

@customElement('options-app')
export class OptionsApp extends LitElement {
  private readonly importInputId = 'config-import-input'

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
  private operationFailed = false

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
  private loadState: OptionsLoadState = 'loading'

  @state()
  private loadError = ''

  @state()
  private rowValidationMessages: PendingMigrationRowValidationMessages = {}

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

    if (changedProperties.has('customRows')) {
      this.rowValidationMessages = validatePendingMigrationKeyRows(this.customRows)
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
    this.loadState = 'loading'
    this.loadError = ''

    try {
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
      this.loadState = 'ready'
    } catch (error) {
      this.loadState = 'error'
      this.loadError = error instanceof Error ? error.message : '未知错误。'
    }
  }

  // ---------- Filter ----------

  private handleFilterChange = (event: CustomEvent<MigrationKeyFilterChangeDetail>) => {
    this.filterQuery = event.detail.value
  }

  private get filteredRows(): PendingMigrationKeyRow[] {
    return filterMigrationKeyRows(this.customRows, this.filterQuery)
  }

  private get isReady() {
    return this.loadState === 'ready'
  }

  private get hasInvalidRows() {
    return Object.keys(this.rowValidationMessages).length > 0
  }

  private validateRowsForPersistence() {
    const messages = validatePendingMigrationKeyRows(this.customRows)
    this.rowValidationMessages = messages

    if (Object.keys(messages).length === 0) {
      return true
    }

    this.setOperationMessage('请先修复无效的配置项后再保存或导出。', true)
    return false
  }

  private setOperationMessage(message: string, failed = false) {
    this.operationMessage = message
    this.operationFailed = failed
  }

  private persistenceFailureMessage(action: string, error: unknown) {
    const reason = error instanceof Error && error.message ? error.message : '未知错误。'
    return `${action}失败：${reason} 请检查存储后重试。`
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

  private handleComposerDraftChange = (event: CustomEvent<ComposerDraftChangeDetail>) => {
    const { field, value } = event.detail

    if (field === 'storageType') {
      if (this.isStorageType(value)) {
        this.updateComposerDraft('storageType', value)
      }
      return
    }

    this.updateComposerDraft(field, value)
  }

  private handleComposerAppend = (event: CustomEvent<MigrationKeyAppendDetail>) => {
    if (!this.isReady) {
      return
    }

    const composerDraft = event.detail
    const validation = validateComposerDraft(composerDraft, this.customRows)
    if (!validation.accepted) {
      this.composerMessage = validation.message ?? '无法加入该配置项。'
      return
    }
    const newItem = composeMigrationKeyItem(composerDraft)
    this.customRows = [
      ...this.customRows,
      { uiId: cryptoRandomId(), item: newItem },
    ]
    this.composerDraft = { storageType: 'localStorage', key: '', description: '' }
    this.composerMessage = ''
  }

  // ---------- Row update / delete ----------

  private handleRowFieldChange = (event: CustomEvent<ConfigRowFieldChangeDetail>) => {
    if (!this.isReady) {
      return
    }

    const { rowId, field, value } = event.detail
    const nextRows = this.customRows.map((row) => {
      if (row.uiId !== rowId) {
        return row
      }

      if (field === 'storageType') {
        if (!this.isStorageType(value)) {
          return row
        }

        return {
          ...row,
          item: { ...row.item, storageType: value },
        }
      }

      return {
        ...row,
        item: { ...row.item, [field]: value },
      }
    })
    this.customRows = nextRows
    this.rowValidationMessages = validatePendingMigrationKeyRows(nextRows)
  }

  private requestRowDelete(uiId: string) {
    if (!this.isReady) {
      return
    }

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

  private handleRowDeleteRequest = (event: CustomEvent<MigrationKeyDeleteRequestDetail>) => {
    this.requestRowDelete(event.detail.rowId)
  }

  private cancelRowDelete = (event: CustomEvent<MigrationKeyDeleteConfirmationDetail>) => {
    const uiId = event.detail.rowId
    if (this.confirmation?.kind !== 'remove-config-row' || this.confirmation.rowUiId !== uiId) {
      return
    }

    this.confirmation = null
    void this.restoreRowDeleteFocus(uiId)
  }

  private confirmRowDelete = (event: CustomEvent<MigrationKeyDeleteConfirmationDetail>) => {
    const uiId = event.detail.rowId
    if (this.confirmation?.kind !== 'remove-config-row' || this.confirmation.rowUiId !== uiId) {
      return
    }

    const nextUiId = this.getAdjacentRowUiId(uiId)
    this.customRows = this.customRows.filter((row) => row.uiId !== uiId)
    this.confirmation = null
    void this.restoreRowDeleteFocus(nextUiId)
  }

  private getAdjacentRowUiId(uiId: string) {
    const visibleRows = this.filteredRows
    const rowIndex = visibleRows.findIndex((row) => row.uiId === uiId)
    if (rowIndex === -1) {
      return ''
    }

    return visibleRows[rowIndex + 1]?.uiId ?? visibleRows[rowIndex - 1]?.uiId ?? ''
  }

  private async restoreRowDeleteFocus(uiId: string) {
    await this.updateComplete
    const configTable = this.renderRoot.querySelector<OptionsConfigTable>('options-config-table')
    if (!configTable) {
      return
    }

    await configTable.updateComplete
    if (uiId && configTable.focusDeleteControl(uiId)) {
      return
    }

    configTable.focusComposer()
  }

  // ---------- Localhost ----------

  private handleLocalhostDraftChange = (event: CustomEvent<LocalhostDraftChangeDetail>) => {
    const { field, value } = event.detail

    if (field === 'protocol') {
      if (value !== 'http' && value !== 'https') {
        return
      }
      this.localhostDraft = { ...this.localhostDraft, protocol: value }
    } else {
      this.localhostDraft = { ...this.localhostDraft, port: value }
    }

    if (this.localhostMessage) {
      this.localhostMessage = ''
    }
  }

  private handleAddLocalhostTarget = (event: CustomEvent<LocalhostTargetAppendDetail>) => {
    if (!this.isReady) {
      return
    }

    const target = normalizeLocalhostTarget(event.detail)
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
    if (!this.isReady) {
      return
    }

    this.defaultLocalhostTargetKey = targetKey
  }

  private handleLocalhostDefaultChange = (event: CustomEvent<LocalhostTargetDefaultDetail>) => {
    this.setDefaultLocalhostTarget(event.detail.targetKey)
  }

  private requestLocalhostDelete(targetKey: string) {
    if (!this.isReady) {
      return
    }

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

  private handleLocalhostDeleteRequest = (event: CustomEvent<LocalhostTargetDeleteRequestDetail>) => {
    this.requestLocalhostDelete(event.detail.targetKey)
  }

  private cancelLocalhostDelete = (event: CustomEvent<LocalhostTargetDeleteConfirmationDetail>) => {
    const { targetKey } = event.detail
    if (
      this.confirmation?.kind !== 'remove-localhost-target'
      || this.confirmation.targetKey !== targetKey
    ) {
      return
    }

    this.confirmation = null
    void this.restoreLocalhostDeleteFocus(targetKey)
  }

  private confirmLocalhostDelete = (event: CustomEvent<LocalhostTargetDeleteConfirmationDetail>) => {
    const { targetKey } = event.detail
    if (this.confirmation?.kind !== 'remove-localhost-target' || this.confirmation.targetKey !== targetKey) {
      return
    }

    const nextTargetKey = this.getAdjacentLocalhostTargetKey(targetKey)
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
    void this.restoreLocalhostDeleteFocus(nextTargetKey)
  }

  private getAdjacentLocalhostTargetKey(targetKey: string) {
    const targetIndex = this.localhostTargets.findIndex(
      (target) => serializeLocalhostTarget(target) === targetKey,
    )
    if (targetIndex === -1) {
      return ''
    }

    const nextTarget = this.localhostTargets[targetIndex + 1]
      ?? this.localhostTargets[targetIndex - 1]
    return nextTarget ? serializeLocalhostTarget(nextTarget) : ''
  }

  private async restoreLocalhostDeleteFocus(targetKey: string) {
    await this.updateComplete
    const localhostStrip = this.renderRoot.querySelector<OptionsLocalhostStrip>(
      'options-localhost-strip',
    )
    if (!localhostStrip) {
      return
    }

    await localhostStrip.updateComplete
    if (targetKey && localhostStrip.focusDeleteControl(targetKey)) {
      return
    }

    localhostStrip.focusAddControl()
  }

  private cancelClearAll = (event: CustomEvent<OptionsToolbarCommandDetail>) => {
    if (event.detail.command !== 'clear-cancel' || this.confirmation?.kind !== 'clear-all') {
      return
    }

    this.confirmation = null
    void this.restoreClearAllFocus()
  }

  private confirmClearAll = async (event: CustomEvent<OptionsToolbarCommandDetail>) => {
    if (
      event.detail.command !== 'clear-confirm'
      || !this.isReady
      || this.confirmation?.kind !== 'clear-all'
    ) {
      return
    }

    try {
      await clearOptionsConfig()
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
      this.setOperationMessage('已清空全部配置项。')
    } catch (error) {
      this.setOperationMessage(this.persistenceFailureMessage('清空配置', error), true)
    }

    this.confirmation = null
    await this.restoreClearAllFocus()
  }

  private async restoreClearAllFocus() {
    await this.updateComplete
    const toolbar = this.renderRoot.querySelector<OptionsToolbar>('options-toolbar')
    if (!toolbar) {
      return
    }

    await toolbar.updateComplete
    toolbar.focusClearControl()
  }

  private requestClearAll = (event: CustomEvent<OptionsToolbarCommandDetail>) => {
    if (event.detail.command !== 'clear-all' || !this.isReady) {
      return
    }

    this.confirmation = {
      kind: 'clear-all',
      message: '确认清空全部配置项？此操作会清除已保存配置。',
    }
  }

  // ---------- Save ----------

  private async saveAll() {
    if (!this.isReady || !this.validateRowsForPersistence()) {
      return
    }

    try {
      const savedOptions = await saveOptionsConfig(
        this.customRows.map((row) => row.item),
        this.localhostTargets,
        this.defaultLocalhostTargetKey,
      )
      const rebuiltRows = buildPendingRows(savedOptions.customConfig)
      this.customRows = rebuiltRows
      this.localhostTargets = savedOptions.localhostTargets
      this.defaultLocalhostTargetKey = savedOptions.defaultLocalhostTargetKey
      this.savedSnapshot = buildSavedSnapshot({
        customItems: rebuiltRows,
        localhostTargets: savedOptions.localhostTargets,
        defaultLocalhostTargetKey: savedOptions.defaultLocalhostTargetKey,
      })
      this.hasPendingChanges = false
      this.setOperationMessage('配置已保存。')
    } catch (error) {
      this.setOperationMessage(this.persistenceFailureMessage('保存配置', error), true)
    }
  }

  private handleSaveAll = (event: CustomEvent<OptionsToolbarCommandDetail>) => {
    if (event.detail.command === 'save-all') {
      void this.saveAll()
    }
  }

  // ---------- Export / Import ----------

  private handleExportConfig = (event: CustomEvent<OptionsToolbarCommandDetail>) => {
    if (
      event.detail.command !== 'export-config'
      || !this.isReady
      || !this.validateRowsForPersistence()
    ) {
      return
    }

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
    this.setOperationMessage(`已导出 ${this.customRows.length} 项配置（请确认后保存）。`)
  }

  private isStorageType(value: unknown): value is StorageType {
    return value === 'localStorage' || value === 'sessionStorage' || value === 'cookie'
  }

  private normalizeImportedConfig(data: unknown): ImportNormalizedPayload {
    const importRecord = isRecord(data) ? data : null
    const items = Array.isArray(data) ? data : importRecord?.['items']

    if (!Array.isArray(items)) {
      throw new Error('导入文件格式不正确，缺少 items 数组。')
    }

    const targetSource = importRecord && Object.hasOwn(importRecord, 'localhostTargets')
      ? { field: 'localhostTargets', values: importRecord['localhostTargets'] }
      : importRecord && Object.hasOwn(importRecord, 'localhostPorts')
        ? { field: 'localhostPorts', values: importRecord['localhostPorts'] }
        : null
    const normalizedTargets = this.normalizeImportedTargets(targetSource)
    const defaultLocalhostTarget = this.getImportedDefaultLocalhostTarget(importRecord)

    return {
      localhostTargets: normalizedTargets,
      defaultLocalhostTargetKey: this.normalizeImportedDefaultLocalhostTarget(
        defaultLocalhostTarget,
      ),
      items: items.map((item, index) => {
        if (!isRecord(item)) {
          throw new Error(`第 ${index + 1} 项不是合法对象。`)
        }

        const storageType = item['storageType']
        const key = item['key']
        const description = item['description']

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

  private normalizeImportedTargets(
    source: { field: string; values: unknown } | null,
  ): LocalhostTarget[] {
    if (!source) {
      return []
    }

    if (!Array.isArray(source.values)) {
      throw new Error(`${source.field} 必须是数组。`)
    }

    const targets = source.values.map((value, index) => {
      const target = normalizeLocalhostTarget(value)
      if (!target) {
        throw new Error(`第 ${index + 1} 个 ${source.field} 不合法。`)
      }
      return target
    })

    return normalizeLocalhostTargetList(targets)
  }

  private getImportedDefaultLocalhostTarget(
    importRecord: Record<string, unknown> | null,
  ): unknown {
    if (!importRecord) {
      return ''
    }

    if (Object.hasOwn(importRecord, 'defaultLocalhostTarget')) {
      return importRecord['defaultLocalhostTarget']
    }

    if (Object.hasOwn(importRecord, 'defaultLocalhostPort')) {
      return importRecord['defaultLocalhostPort']
    }

    if (Object.hasOwn(importRecord, 'localhostPort')) {
      return importRecord['localhostPort']
    }

    return ''
  }

  private normalizeImportedDefaultLocalhostTarget(value: unknown) {
    if (value === '') {
      return ''
    }

    const targetKey = normalizeLocalhostTargetKey(value)
    if (!targetKey) {
      throw new Error('默认 localhost 目标不合法。')
    }

    return targetKey
  }

  private async handleImportConfig(event: CustomEvent<OptionsConfigImportDetail>) {
    if (!this.isReady) {
      return
    }

    const { mode, file } = event.detail
    try {
      const text = await file.text()
      const parsed = JSON.parse(text) as unknown
      const imported = this.normalizeImportedConfig(parsed)

      if (mode === 'merge') {
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
        this.setOperationMessage(`已追加合并 ${imported.items.length} 项配置，请确认后保存。`)
      } else {
        const replacedItems = dedupeConfig(imported.items)
        const replacedTargets = normalizeLocalhostTargetList(imported.localhostTargets)
        this.customRows = buildPendingRows(replacedItems)
        this.localhostTargets = replacedTargets
        this.defaultLocalhostTargetKey = resolveDefaultLocalhostTargetKey(
          replacedTargets,
          imported.defaultLocalhostTargetKey,
        )
        this.setOperationMessage(`已覆盖导入 ${this.customRows.length} 项配置，请确认后保存。`)
      }
    } catch (error) {
      this.setOperationMessage(error instanceof Error ? error.message : '导入配置失败。', true)
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
          <h1 data-test-id="options-title">迁移 Key 配置</h1>
          <p class="lead">
            这里维护 popup 扫描时使用的全部配置项。当前 ${this.customRows.length} 项配置，${this.localhostTargets.length} 个目标。
          </p>
        </header>

        <options-toolbar
          .importInputId=${this.importInputId}
          .ready=${this.isReady}
          .loadState=${this.loadState}
          .loadError=${this.loadError}
          .hasPendingChanges=${this.hasPendingChanges}
          .hasInvalidRows=${this.hasInvalidRows}
          .operationMessage=${this.operationMessage}
          .operationFailed=${this.operationFailed}
          .clearConfirmationMessage=${this.confirmation?.kind === 'clear-all'
            ? this.confirmation.message
            : ''}
          @export-config=${this.handleExportConfig}
          @config-import=${this.handleImportConfig}
          @save-all=${this.handleSaveAll}
          @clear-all=${this.requestClearAll}
          @clear-cancel=${this.cancelClearAll}
          @clear-confirm=${this.confirmClearAll}
        ></options-toolbar>

        <options-localhost-strip
          .targets=${this.localhostTargets}
          .defaultTargetKey=${this.defaultLocalhostTargetKey}
          .draft=${this.localhostDraft}
          .message=${this.localhostMessage}
          .protocolOptions=${this.localhostProtocolOptions}
          .ready=${this.isReady}
          .deleteConfirmationTargetKey=${this.confirmation?.kind === 'remove-localhost-target'
            ? this.confirmation.targetKey ?? ''
            : ''}
          .deleteConfirmationMessage=${this.confirmation?.kind === 'remove-localhost-target'
            ? this.confirmation.message
            : ''}
          @localhost-draft-change=${this.handleLocalhostDraftChange}
          @localhost-add=${this.handleAddLocalhostTarget}
          @localhost-default-change=${this.handleLocalhostDefaultChange}
          @localhost-delete-request=${this.handleLocalhostDeleteRequest}
          @localhost-delete-cancel=${this.cancelLocalhostDelete}
          @localhost-delete-confirm=${this.confirmLocalhostDelete}
        ></options-localhost-strip>

        <options-config-table
          .rows=${this.filteredRows}
          .totalCount=${this.customRows.length}
          .loaded=${this.isReady}
          .ready=${this.isReady}
          .filterQuery=${this.filterQuery}
          .composerDraft=${this.composerDraft}
          .composerMessage=${this.composerMessage}
          .rowValidationMessages=${this.rowValidationMessages}
          .rowDeleteConfirmationUiId=${this.confirmation?.kind === 'remove-config-row'
            ? this.confirmation.rowUiId ?? ''
            : ''}
          .rowDeleteConfirmationMessage=${this.confirmation?.kind === 'remove-config-row'
            ? this.confirmation.message
            : ''}
          .storageTypeOptions=${this.storageTypeOptions}
          @filter-change=${this.handleFilterChange}
          @row-field-change=${this.handleRowFieldChange}
          @row-delete-request=${this.handleRowDeleteRequest}
          @row-delete-cancel=${this.cancelRowDelete}
          @row-delete-confirm=${this.confirmRowDelete}
          @composer-draft-change=${this.handleComposerDraftChange}
          @composer-append=${this.handleComposerAppend}
        ></options-config-table>
      </main>
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
      width: min(100%, 1360px);
      margin: 0 auto;
      padding: var(--space-1) var(--space-5) var(--space-2);
      display: flex;
      flex-direction: column;
      gap: var(--space-1);
    }

    .page-header {
      display: flex;
      align-items: end;
      justify-content: space-between;
      gap: var(--space-4);
    }

    .page-header h1 {
      margin: 0;
      font: var(--type-headline-large);
      letter-spacing: -0.02em;
    }

    .page-header .lead {
      max-width: 720px;
      margin: 0;
      color: var(--md-sys-color-on-surface-variant);
      font: var(--type-body-small);
      text-align: right;
    }

    @media (max-width: 900px) {
      main {
        padding: var(--space-4) var(--space-3) var(--space-8);
      }

      .page-header {
        display: grid;
      }

      .page-header .lead {
        max-width: none;
        text-align: left;
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

declare global {
  interface HTMLElementTagNameMap {
    'options-app': OptionsApp
  }
}
