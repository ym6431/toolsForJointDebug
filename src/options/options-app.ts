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
  private localhostTargets: LocalhostTarget[] = []

  @state()
  private defaultLocalhostTargetKey = ''

  @state()
  private localhostProtocolDraft: LocalhostProtocol = 'http'

  @state()
  private localhostPortDraft = ''

  connectedCallback() {
    super.connectedCallback()
    void this.loadConfig()
  }

  private async loadConfig() {
    const [customItems, localhostTargets, defaultLocalhostTargetKey] = await Promise.all([
      getCustomConfig(),
      getLocalhostTargets(),
      getDefaultLocalhostTargetKey(),
    ])

    this.customItems = customItems
    this.localhostTargets = localhostTargets
    this.defaultLocalhostTargetKey = defaultLocalhostTargetKey
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

  private addLocalhostTarget() {
    const target = normalizeLocalhostTarget({
      protocol: this.localhostProtocolDraft,
      port: this.localhostPortDraft,
    })

    if (!target) {
      this.message = '端口必须是 1 到 65535 之间的数字。'
      return
    }

    const targetKey = serializeLocalhostTarget(target)

    if (this.localhostTargets.some((item) => serializeLocalhostTarget(item) === targetKey)) {
      this.message = `${formatLocalhostTarget(target)} 已存在。`
      this.localhostPortDraft = ''
      return
    }

    this.localhostTargets = [...this.localhostTargets, target]
    this.defaultLocalhostTargetKey = this.defaultLocalhostTargetKey || targetKey
    this.localhostPortDraft = ''
    this.message = ''
  }

  private removeLocalhostTarget(targetKey: string) {
    const nextTargets = this.localhostTargets.filter(
      (item) => serializeLocalhostTarget(item) !== targetKey,
    )

    this.localhostTargets = nextTargets
    this.defaultLocalhostTargetKey = resolveDefaultLocalhostTargetKey(
      nextTargets,
      this.defaultLocalhostTargetKey === targetKey ? '' : this.defaultLocalhostTargetKey,
    )
  }

  private setDefaultLocalhostTarget(targetKey: string) {
    this.defaultLocalhostTargetKey = targetKey
  }

  private async saveAll() {
    this.customItems = await saveCustomConfig(this.customItems)

    const localhostTargetConfig = await saveLocalhostTargetConfig(
      this.localhostTargets,
      this.defaultLocalhostTargetKey,
    )

    this.localhostTargets = localhostTargetConfig.localhostTargets
    this.defaultLocalhostTargetKey = localhostTargetConfig.defaultLocalhostTargetKey
    this.message = '配置已保存。'
  }

  private handleExportConfig() {
    const payload = {
      version: 3,
      exportedAt: new Date().toISOString(),
      localhostTargets: this.localhostTargets,
      defaultLocalhostTarget: this.defaultLocalhostTargetKey,
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
      const importedConfig = this.normalizeImportedConfig(parsed)
      const importedItems = importedConfig.items

      if (this.importMode === 'merge') {
        const mergedItems = dedupeConfig([...this.customItems, ...importedItems])
        const mergedTargets = normalizeLocalhostTargetList([
          ...this.localhostTargets,
          ...importedConfig.localhostTargets,
        ])

        this.customItems = mergedItems
        this.localhostTargets = mergedTargets
        this.defaultLocalhostTargetKey = resolveDefaultLocalhostTargetKey(
          mergedTargets,
          importedConfig.defaultLocalhostTargetKey || this.defaultLocalhostTargetKey,
        )
        this.message = `已追加合并 ${importedItems.length} 项配置，请确认后保存。`
      } else {
        this.customItems = dedupeConfig(importedItems)
        this.localhostTargets = normalizeLocalhostTargetList(importedConfig.localhostTargets)
        this.defaultLocalhostTargetKey = resolveDefaultLocalhostTargetKey(
          this.localhostTargets,
          importedConfig.defaultLocalhostTargetKey,
        )
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
    this.localhostTargets = []
    this.defaultLocalhostTargetKey = ''
    this.localhostProtocolDraft = 'http'
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
              <span>协议</span>
              <app-select
                .options=${this.localhostProtocolOptions}
                .value=${this.localhostProtocolDraft}
                @value-change=${(event: Event) => {
                  this.localhostProtocolDraft = (event as CustomEvent<string>).detail as LocalhostProtocol
                }}
              ></app-select>
            </label>
            <label class="field">
              <span>端口</span>
              <app-input
                .value=${this.localhostPortDraft}
                inputmode="numeric"
                @value-change=${(event: Event) => {
                  this.localhostPortDraft = (event as CustomEvent<string>).detail
                }}
                placeholder="例如：5173"
              ></app-input>
            </label>
            <button class="secondary" @click=${this.addLocalhostTarget}>加入端口列表</button>
          </div>
          ${this.localhostTargets.length === 0
            ? html`<p class="empty">还没有可用的 localhost 注入目标。</p>`
            : html`
                <div class="port-list">
                  ${this.localhostTargets.map((target) => {
                    const targetKey = serializeLocalhostTarget(target)

                    return html`
                      <article class="port-card">
                        <div class="port-meta">
                          <strong>${formatLocalhostTarget(target)}</strong>
                          ${this.defaultLocalhostTargetKey === targetKey
                            ? html`<span class="badge">默认</span>`
                            : null}
                        </div>
                        <div class="port-actions">
                          ${this.defaultLocalhostTargetKey === targetKey
                            ? html`
                                <button class="success" disabled>
                                  默认端口
                                </button>
                              `
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
                            @click=${() => this.removeLocalhostTarget(targetKey)}
                          >
                            删除
                          </button>
                        </div>
                      </article>
                    `
                  })}
                </div>
              `}
          <p class="helper">
            popup 中会以下拉列表展示这里保存的注入目标，并默认选中当前默认值。
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
            <button class="danger" @click=${this.restoreDefaults}>清空全部配置</button>
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

  private get localhostProtocolOptions(): SelectOption[] {
    return [
      { label: 'http', value: 'http' },
      { label: 'https', value: 'https' },
    ]
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
      max-width: 1040px;
      margin: 0 auto;
      padding: var(--space-8) var(--space-5) var(--space-12);
    }

    .hero,
    .panel {
      background: var(--md-sys-color-surface-container-low);
      border: 1px solid var(--md-sys-color-outline-variant);
    }

    .hero {
      position: relative;
      overflow: hidden;
      padding: var(--space-8);
      margin-bottom: var(--space-5);
      border-radius: var(--shape-extra-large);
      background:
        linear-gradient(
          135deg,
          var(--md-sys-color-primary-container),
          var(--md-sys-color-surface-container-low) 70%
        );
      box-shadow: var(--elevation-2);
    }

    .panel {
      padding: var(--space-6);
      margin-bottom: var(--space-5);
      border-radius: var(--shape-large);
      box-shadow: var(--elevation-1);
    }

    .eyebrow,
    .lead,
    .empty,
    .helper {
      color: var(--md-sys-color-on-surface-variant);
    }

    .eyebrow {
      margin: 0 0 var(--space-2);
      font: var(--type-label-small);
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--md-sys-color-primary);
    }

    h1,
    h2,
    p {
      margin: 0;
    }

    h1 {
      margin-bottom: var(--space-2);
      font: var(--type-headline-large);
      letter-spacing: -0.02em;
    }

    h2 {
      font: var(--type-title-large);
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
      gap: var(--space-3);
    }

    .list,
    .port-list {
      display: grid;
      gap: var(--space-3);
      margin-top: var(--space-4);
    }

    .editor-grid,
    .config-card {
      display: grid;
      gap: var(--space-3);
    }

    .editor-grid {
      grid-template-columns: 180px minmax(240px, 1.2fr) minmax(280px, 1.5fr);
      margin-top: var(--space-4);
      align-items: start;
    }

    .port-editor {
      margin-top: var(--space-4);
      align-items: end;
      justify-content: flex-start;
    }

    .port-editor .field {
      width: min(240px, 100%);
    }

    .helper {
      margin-top: var(--space-3);
      font: var(--type-body-small);
    }

    .config-card,
    .port-card {
      border: 1px solid var(--md-sys-color-outline-variant);
      border-radius: var(--shape-medium);
      background: var(--md-sys-color-surface-container);
      padding: var(--space-4);
      transition:
        background-color var(--motion-short),
        border-color var(--motion-short);
    }

    .config-card:hover,
    .port-card:hover {
      border-color: var(--md-sys-color-outline);
      background: var(--md-sys-color-surface-container-high);
    }

    .config-card {
      grid-template-columns: 180px minmax(220px, 1.1fr) minmax(260px, 1.4fr) 110px;
      align-items: start;
    }

    .badge {
      display: inline-flex;
      align-items: center;
      border-radius: var(--shape-full);
      padding: var(--space-1) var(--space-2);
      background: var(--md-sys-color-primary-container);
      color: var(--md-sys-color-on-primary-container);
      font: var(--type-label-small);
    }

    .field {
      display: grid;
      gap: var(--space-2);
      min-width: 0;
    }

    label,
    .field {
      color: var(--md-sys-color-on-surface);
      font: var(--type-label-large);
    }

    .field span {
      font: var(--type-body-small);
      color: var(--md-sys-color-on-surface-variant);
    }

    .field-action {
      align-self: end;
    }

    button {
      font: inherit;
    }

    button:disabled {
      cursor: not-allowed;
      background: var(--md-sys-color-surface-container);
      color: var(--color-disabled-text);
      box-shadow: none;
    }

    .actions {
      margin-top: var(--space-5);
      justify-content: flex-start;
      flex-wrap: wrap;
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

    .danger {
      background: var(--md-sys-color-error-container);
      color: var(--md-sys-color-on-error-container);
    }

    .danger:hover:not(:disabled) {
      background: color-mix(
        in srgb,
        var(--md-sys-color-error-container) 84%,
        var(--md-sys-color-error)
      );
    }

    .success {
      background: var(--app-color-success-container);
      color: var(--app-color-on-success-container);
    }

    .success:hover:not(:disabled) {
      background: color-mix(
        in srgb,
        var(--app-color-success-container) 84%,
        var(--app-color-success)
      );
    }

    .message {
      margin-top: var(--space-4);
      padding: var(--space-3) var(--space-4);
      border-radius: var(--shape-medium);
      background: var(--md-sys-color-primary-container);
      color: var(--md-sys-color-on-primary-container);
      font: var(--type-body-medium);
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
      main {
        padding: var(--space-4) var(--space-3) var(--space-8);
      }

      .hero,
      .panel {
        padding: var(--space-5);
      }

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

      .port-actions button,
      .actions button {
        flex: 1 1 auto;
      }
    }
  `
}
