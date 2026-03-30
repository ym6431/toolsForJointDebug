import { LitElement, css, html } from 'lit'
import { customElement, state } from 'lit/decorators.js'
import type { SelectOption } from '../components/app-select'
import '../components/app-input'
import '../components/app-select'
import {
  getCustomConfig,
  getDefaultLocalhostPort,
  getLocalhostPorts,
  resetCustomConfig,
  saveCustomConfig,
  saveLocalhostTargetConfig,
} from '../shared/storage'
import type { ConfigItem, StorageType } from '../shared/types'
import { dedupeConfig, normalizePort, normalizePortList } from '../shared/utils'

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

  @state()
  private localhostPorts: string[] = []

  @state()
  private defaultLocalhostPort = ''

  @state()
  private localhostPortDraft = ''

  connectedCallback() {
    super.connectedCallback()
    void this.loadConfig()
  }

  private async loadConfig() {
    const [customItems, localhostPorts, defaultLocalhostPort] = await Promise.all([
      getCustomConfig(),
      getLocalhostPorts(),
      getDefaultLocalhostPort(),
    ])

    this.customItems = customItems
    this.localhostPorts = localhostPorts
    this.defaultLocalhostPort = defaultLocalhostPort
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

  private addLocalhostPort() {
    const normalizedPort = normalizePort(this.localhostPortDraft)

    if (!normalizedPort) {
      this.message = '端口必须是 1 到 65535 之间的数字。'
      return
    }

    if (this.localhostPorts.includes(normalizedPort)) {
      this.message = `localhost:${normalizedPort} 已存在。`
      this.localhostPortDraft = ''
      return
    }

    this.localhostPorts = [...this.localhostPorts, normalizedPort]
    this.defaultLocalhostPort = this.defaultLocalhostPort || normalizedPort
    this.localhostPortDraft = ''
    this.message = ''
  }

  private removeLocalhostPort(port: string) {
    this.localhostPorts = this.localhostPorts.filter((item) => item !== port)

    if (this.defaultLocalhostPort === port) {
      this.defaultLocalhostPort = this.localhostPorts[0] ?? ''
    }
  }

  private setDefaultLocalhostPort(port: string) {
    this.defaultLocalhostPort = port
  }

  private async saveAll() {
    this.customItems = await saveCustomConfig(this.customItems)

    const localhostTargetConfig = await saveLocalhostTargetConfig(
      this.localhostPorts,
      this.defaultLocalhostPort,
    )

    this.localhostPorts = localhostTargetConfig.localhostPorts
    this.defaultLocalhostPort = localhostTargetConfig.defaultLocalhostPort
    this.message = '配置已保存。'
  }

  private handleExportConfig() {
    const payload = {
      version: 2,
      exportedAt: new Date().toISOString(),
      localhostPorts: this.localhostPorts,
      defaultLocalhostPort: this.defaultLocalhostPort,
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
    const localhostPorts =
      data && typeof data === 'object' && 'localhostPorts' in data
        ? (data as { localhostPorts?: unknown }).localhostPorts
        : []
    const defaultLocalhostPort =
      data && typeof data === 'object' && 'defaultLocalhostPort' in data
        ? (data as { defaultLocalhostPort?: unknown }).defaultLocalhostPort
        : data && typeof data === 'object' && 'localhostPort' in data
          ? (data as { localhostPort?: unknown }).localhostPort
          : ''

    if (!Array.isArray(items)) {
      throw new Error('导入文件格式不正确，缺少 items 数组。')
    }

    const normalizedPorts = Array.isArray(localhostPorts)
      ? localhostPorts.flatMap((value) => (typeof value === 'string' ? [value] : []))
      : typeof defaultLocalhostPort === 'string' && defaultLocalhostPort
        ? [defaultLocalhostPort]
        : []

    return {
      localhostPorts: normalizedPorts,
      defaultLocalhostPort:
        typeof defaultLocalhostPort === 'string' ? defaultLocalhostPort : '',
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
      const importedConfig = this.normalizeImportedConfig(parsed)
      const importedItems = importedConfig.items

      if (this.importMode === 'merge') {
        const mergedItems = dedupeConfig([...this.customItems, ...importedItems])
        const mergedPorts = normalizePortList([
          ...this.localhostPorts,
          ...importedConfig.localhostPorts,
        ])

        this.customItems = mergedItems
        this.localhostPorts = mergedPorts
        this.defaultLocalhostPort =
          normalizePort(importedConfig.defaultLocalhostPort) || this.defaultLocalhostPort
        this.message = `已追加合并 ${importedItems.length} 项配置，请确认后保存。`
      } else {
        this.customItems = dedupeConfig(importedItems)
        this.localhostPorts = normalizePortList(importedConfig.localhostPorts)
        this.defaultLocalhostPort = normalizePort(importedConfig.defaultLocalhostPort)
        this.message = `已覆盖导入 ${this.customItems.length} 项配置，请确认后保存。`
      }
    } catch (error) {
      this.message = error instanceof Error ? error.message : '导入配置失败。'
    } finally {
      input.value = ''
    }
  }

  private async restoreDefaults() {
    await Promise.all([
      resetCustomConfig(),
      saveLocalhostTargetConfig([], ''),
    ])
    this.customItems = []
    this.localhostPorts = []
    this.defaultLocalhostPort = ''
    this.localhostPortDraft = ''
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
              <app-select
                .options=${this.storageTypeOptions}
                .value=${this.draft.storageType}
                @value-change=${(event: Event) =>
                  this.updateDraft(
                    'storageType',
                    (event as CustomEvent<string>).detail as StorageType,
                  )}
              ></app-select>
            </label>
            <label class="field field-key">
              <span>Key</span>
              <app-input
                .value=${this.draft.key}
                @value-change=${(event: Event) =>
                  this.updateDraft('key', (event as CustomEvent<string>).detail)}
                placeholder="例如 userLocale"
              ></app-input>
            </label>
            <label class="field field-description">
              <span>说明</span>
              <app-input
                .value=${this.draft.description}
                @value-change=${(event: Event) =>
                  this.updateDraft(
                    'description',
                    (event as CustomEvent<string>).detail,
                  )}
                placeholder="例如：业务语言标识"
              ></app-input>
            </label>
          </div>
          <div class="actions">
            <button class="primary" @click=${this.addCustomItem}>加入列表</button>
          </div>
        </section>

        <section class="panel">
          <div class="section-head">
            <h2>本地注入目标</h2>
          </div>
          <div class="port-editor">
            <label class="field">
              <span>新增端口</span>
              <app-input
                .value=${this.localhostPortDraft}
                inputmode="numeric"
                @value-change=${(event: Event) => {
                  this.localhostPortDraft = (event as CustomEvent<string>).detail
                }}
                placeholder="例如：5173"
              ></app-input>
            </label>
            <button class="secondary" @click=${this.addLocalhostPort}>加入端口列表</button>
          </div>
          ${this.localhostPorts.length === 0
            ? html`<p class="empty">还没有可用的 localhost 端口。</p>`
            : html`
                <div class="port-list">
                  ${this.localhostPorts.map(
                    (port) => html`
                      <article class="port-card">
                        <div class="port-meta">
                          <strong>localhost:${port}</strong>
                          ${this.defaultLocalhostPort === port
                            ? html`<span class="badge">默认</span>`
                            : null}
                        </div>
                        <div class="port-actions">
                          ${this.defaultLocalhostPort === port
                            ? html`
                                <button class="success" disabled>
                                  默认端口
                                </button>
                              `
                            : html`
                                <button
                                  class="success"
                                  @click=${() => this.setDefaultLocalhostPort(port)}
                                >
                                  设为默认
                                </button>
                              `}
                          <button
                            class="danger"
                            @click=${() => this.removeLocalhostPort(port)}
                          >
                            删除
                          </button>
                        </div>
                      </article>
                    `,
                  )}
                </div>
              `}
          <p class="helper">
            popup 中会以下拉列表展示这里保存的端口，并默认选中当前默认值。
          </p>
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
            <button class="primary" @click=${this.saveAll}>保存全部配置</button>
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
          <app-select
            .options=${this.storageTypeOptions}
            .value=${item.storageType}
            @value-change=${(event: Event) =>
              this.updateCustomItem(
                index,
                'storageType',
                (event as CustomEvent<string>).detail,
              )}
          ></app-select>
        </label>
        <label class="field field-key">
          <span>Key</span>
          <app-input
            .value=${item.key}
            @value-change=${(event: Event) =>
              this.updateCustomItem(index, 'key', (event as CustomEvent<string>).detail)}
          ></app-input>
        </label>
        <label class="field field-description">
          <span>说明</span>
          <app-input
            .value=${item.description}
            @value-change=${(event: Event) =>
              this.updateCustomItem(
                index,
                'description',
                (event as CustomEvent<string>).detail,
              )}
          ></app-input>
        </label>
        <div class="field field-action">
          <span>操作</span>
          <button class="danger" @click=${() => this.removeCustomItem(index)}>删除</button>
        </div>
      </article>
    `
  }

  private get storageTypeOptions(): SelectOption[] {
    return [
      { label: 'localStorage', value: 'localStorage' },
      { label: 'sessionStorage', value: 'sessionStorage' },
      { label: 'cookie', value: 'cookie' },
    ]
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
    .message,
    .helper {
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
    .actions,
    .port-editor,
    .port-card,
    .port-meta,
    .port-actions {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }

    .list,
    .port-list {
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

    .port-editor {
      margin-top: 14px;
      align-items: end;
      justify-content: flex-start;
    }

    .port-editor .field {
      width: min(240px, 100%);
    }

    .helper {
      margin-top: 12px;
      font-size: 13px;
    }

    .config-card,
    .port-card {
      border: 1px solid var(--color-border);
      border-radius: 14px;
      background: var(--color-surface-muted);
      padding: 14px;
    }

    .config-card {
      grid-template-columns: 180px minmax(220px, 1.1fr) minmax(260px, 1.4fr) 110px;
      align-items: start;
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

    button {
      font: inherit;
    }

    .actions {
      margin-top: 16px;
      justify-content: flex-start;
      flex-wrap: wrap;
    }

    button {
      border: none;
      border-radius: 10px;
      padding: 10px 14px;
      cursor: pointer;
      transition:
        background-color 0.18s ease,
        color 0.18s ease,
        opacity 0.18s ease;
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
      font-weight: 600;
    }

    .success {
      background: var(--color-success-bg);
      color: var(--color-success-text);
      border: 1px solid var(--color-success-border);
      font-weight: 600;
    }

    .message {
      margin-top: 14px;
      font-size: 13px;
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

    @media (max-width: 900px) {
      .editor-grid,
      .config-card {
        grid-template-columns: 1fr;
      }

      .section-head,
      .port-editor {
        flex-direction: column;
        align-items: stretch;
      }

      .port-editor .field,
      .port-actions {
        max-width: none;
        width: 100%;
      }

      .port-card,
      .port-meta {
        align-items: flex-start;
        flex-direction: column;
      }
    }
  `
}
