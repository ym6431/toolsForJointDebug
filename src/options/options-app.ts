import { LitElement, css, html } from 'lit'
import { customElement, state } from 'lit/decorators.js'
import { getCustomConfig, resetCustomConfig, saveCustomConfig } from '../shared/storage'
import type { ConfigItem, StorageType } from '../shared/types'
import { dedupeConfig } from '../shared/utils'

@customElement('options-app')
export class OptionsApp extends LitElement {
  private readonly importInputId = 'config-import-input'
  private importMode: 'replace' | 'merge' = 'replace'

  @state()
  private customItems: ConfigItem[] = []

  @state()
  private draft: ConfigItem = {
    storageType: 'localStorage',
    key: '',
    description: '',
  }

  @state()
  private message = ''

  connectedCallback() {
    super.connectedCallback()
    void this.loadConfig()
  }

  private async loadConfig() {
    this.customItems = await getCustomConfig()
  }

  private updateDraft<K extends keyof ConfigItem>(key: K, value: ConfigItem[K]) {
    this.draft = {
      ...this.draft,
      [key]: value,
    }
  }

  private updateCustomItem(index: number, key: keyof ConfigItem, value: string) {
    const next = [...this.customItems]
    const current = next[index]

    next[index] = {
      ...current,
      [key]: key === 'storageType' ? (value as StorageType) : value,
    }

    this.customItems = next
  }

  private addCustomItem() {
    if (!this.draft.key.trim()) {
      this.message = 'Key 不能为空。'
      return
    }

    this.customItems = [
      ...this.customItems,
      {
        storageType: this.draft.storageType,
        key: this.draft.key.trim(),
        description: this.draft.description.trim(),
      },
    ]

    this.draft = {
      storageType: 'localStorage',
      key: '',
      description: '',
    }
    this.message = ''
  }

  private removeCustomItem(index: number) {
    this.customItems = this.customItems.filter((_, itemIndex) => itemIndex !== index)
  }

  private async saveAll() {
    this.customItems = await saveCustomConfig(this.customItems)
    this.message = '自定义配置已保存。'
  }

  private handleExportConfig() {
    const payload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      items: this.customItems,
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
    this.message = `已导出 ${this.customItems.length} 项配置。`
  }

  private openImportPicker(mode: 'replace' | 'merge') {
    this.importMode = mode
    this.renderRoot
      .querySelector<HTMLInputElement>(`#${this.importInputId}`)
      ?.click()
  }

  private isStorageType(value: unknown): value is StorageType {
    return (
      value === 'localStorage'
      || value === 'sessionStorage'
      || value === 'cookie'
    )
  }

  private normalizeImportedConfig(data: unknown) {
    const items =
      Array.isArray(data)
        ? data
        : data && typeof data === 'object' && 'items' in data
          ? (data as { items?: unknown }).items
          : null

    if (!Array.isArray(items)) {
      throw new Error('导入文件格式不正确，缺少 items 数组。')
    }

    return items.map((item, index) => {
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
    })
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
      const importedItems = this.normalizeImportedConfig(parsed)

      if (this.importMode === 'merge') {
        const mergedItems = dedupeConfig([...this.customItems, ...importedItems])
        const addedCount = mergedItems.length - this.customItems.length

        this.customItems = mergedItems
        this.message = `已追加合并 ${importedItems.length} 项配置，实际新增 ${addedCount} 项，请确认后保存。`
      } else {
        this.customItems = dedupeConfig(importedItems)
        this.message = `已覆盖导入 ${this.customItems.length} 项配置，请确认后保存。`
      }
    } catch (error) {
      this.message = error instanceof Error ? error.message : '导入配置失败。'
    } finally {
      input.value = ''
    }
  }

  private async restoreDefaults() {
    await resetCustomConfig()
    this.customItems = []
    this.message = '已清空全部配置项。'
  }

  render() {
    return html`
      <main>
        <section class="hero">
          <p class="eyebrow">Options</p>
          <h1>迁移 Key 配置</h1>
          <p class="lead">这里维护 popup 扫描时使用的全部配置项</p>
        </section>

        <section class="panel">
          <div class="section-head">
            <h2>新增自定义配置</h2>
          </div>
          <div class="editor-grid">
            <label class="field field-storage">
              <span>Storage 类型</span>
              <select
                .value=${this.draft.storageType}
                @change=${(event: Event) =>
                  this.updateDraft(
                    'storageType',
                    (event.target as HTMLSelectElement).value as StorageType,
                  )}
              >
                <option value="localStorage">localStorage</option>
                <option value="sessionStorage">sessionStorage</option>
                <option value="cookie">cookie</option>
              </select>
            </label>
            <label class="field field-key">
              <span>Key</span>
              <input
                .value=${this.draft.key}
                @input=${(event: InputEvent) =>
                  this.updateDraft('key', (event.target as HTMLInputElement).value)}
                placeholder="例如 userLocale"
              />
            </label>
            <label class="field field-description">
              <span>说明</span>
              <input
                .value=${this.draft.description}
                @input=${(event: InputEvent) =>
                  this.updateDraft(
                    'description',
                    (event.target as HTMLInputElement).value,
                  )}
                placeholder="例如：业务语言标识"
              />
            </label>
          </div>
          <div class="actions">
            <button class="primary" @click=${this.addCustomItem}>加入列表</button>
          </div>
        </section>

        <section class="panel">
          <div class="section-head">
            <h2>自定义配置</h2>
            <span>${this.customItems.length} 项</span>
          </div>
          <input
            id=${this.importInputId}
            class="visually-hidden"
            type="file"
            accept="application/json,.json"
            @change=${this.handleImportFile}
          />
          ${this.customItems.length === 0
            ? html`<p class="empty">还没有自定义配置。</p>`
            : html`
                <div class="list">
                  ${this.customItems.map((item, index) => this.renderEditableItem(item, index))}
                </div>
              `}
          <div class="actions">
            <button class="secondary" @click=${this.handleExportConfig}>导出配置</button>
            <button class="secondary" @click=${() => this.openImportPicker('merge')}>
              追加合并导入
            </button>
            <button class="secondary" @click=${() => this.openImportPicker('replace')}>
              覆盖导入
            </button>
            <button class="primary" @click=${this.saveAll}>保存自定义配置</button>
            <button class="secondary" @click=${this.restoreDefaults}>清空全部配置</button>
          </div>
          ${this.message ? html`<p class="message">${this.message}</p>` : null}
        </section>
      </main>
    `
  }

  private renderEditableItem(item: ConfigItem, index: number) {
    return html`
      <article class="config-card">
        <label class="field field-storage">
          <span>Storage 类型</span>
          <select
            .value=${item.storageType}
            @change=${(event: Event) =>
              this.updateCustomItem(
                index,
                'storageType',
                (event.target as HTMLSelectElement).value,
              )}
          >
            <option value="localStorage">localStorage</option>
            <option value="sessionStorage">sessionStorage</option>
            <option value="cookie">cookie</option>
          </select>
        </label>
        <label class="field field-key">
          <span>Key</span>
          <input
            .value=${item.key}
            @input=${(event: InputEvent) =>
              this.updateCustomItem(index, 'key', (event.target as HTMLInputElement).value)}
          />
        </label>
        <label class="field field-description">
          <span>说明</span>
          <input
            .value=${item.description}
            @input=${(event: InputEvent) =>
              this.updateCustomItem(
                index,
                'description',
                (event.target as HTMLInputElement).value,
              )}
          />
        </label>
        <div class="field field-action">
          <span>操作</span>
          <button class="danger" @click=${() => this.removeCustomItem(index)}>删除</button>
        </div>
      </article>
    `
  }

  static styles = css`
    :host {
      display: block;
      min-height: 100vh;
      color: var(--color-text);
    }

    *,
    *::before,
    *::after {
      box-sizing: border-box;
    }

    main {
      max-width: 980px;
      margin: 0 auto;
      padding: 32px 20px 48px;
    }

    .hero,
    .panel {
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      border-radius: 18px;
    }

    .hero {
      padding: 28px;
      margin-bottom: 18px;
    }

    .panel {
      padding: 20px;
      margin-bottom: 18px;
    }

    .eyebrow,
    .lead,
    .empty,
    .message {
      color: var(--color-text-muted);
    }

    .eyebrow {
      margin: 0 0 8px;
      font-size: 12px;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    h1,
    h2,
    p {
      margin: 0;
    }

    h1 {
      font-size: 34px;
      margin-bottom: 10px;
      line-height: 1.1;
    }

    .section-head,
    .actions {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }

    .list {
      display: grid;
      gap: 12px;
      margin-top: 14px;
    }

    .editor-grid,
    .config-card {
      display: grid;
      gap: 12px;
    }

    .editor-grid {
      grid-template-columns: 180px minmax(240px, 1.2fr) minmax(280px, 1.5fr);
      margin-top: 14px;
      align-items: start;
    }

    .config-card {
      grid-template-columns: 180px minmax(220px, 1.1fr) minmax(260px, 1.4fr) 110px;
      align-items: start;
      border: 1px solid var(--color-border);
      border-radius: 14px;
      background: var(--color-surface-muted);
      padding: 14px;
    }

    .badge {
      display: inline-flex;
      align-items: center;
      border-radius: 999px;
      padding: 4px 9px;
      background: var(--color-badge-bg);
      color: var(--color-badge-text);
      font-weight: 600;
      font-size: 12px;
    }

    .field {
      display: grid;
      gap: 6px;
      min-width: 0;
    }

    label,
    .field {
      color: var(--color-text);
      font-weight: 600;
    }

    .field span {
      font-size: 12px;
      color: var(--color-text-muted);
    }

    .field-action {
      align-self: end;
    }

    input,
    select,
    button {
      font: inherit;
    }

    input,
    select {
      width: 100%;
      box-sizing: border-box;
      border: 1px solid var(--color-border-strong);
      border-radius: 10px;
      padding: 10px 12px;
      background: var(--color-surface);
      color: var(--color-text-strong);
    }

    .actions {
      margin-top: 16px;
      justify-content: flex-start;
    }

    button {
      border: none;
      border-radius: 10px;
      padding: 10px 14px;
      cursor: pointer;
      transition:
        background-color 0.18s ease,
        color 0.18s ease,
        border-color 0.18s ease;
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

    .danger {
      background: var(--color-danger-bg);
      color: var(--color-danger-text);
    }

    .field-action .danger {
      width: 100%;
    }

    .message {
      margin-top: 12px;
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

    @media (max-width: 820px) {
      .editor-grid,
      .config-card {
        grid-template-columns: 1fr;
      }

      .field-action {
        align-self: stretch;
      }
    }
  `
}
