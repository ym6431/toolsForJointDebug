import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from 'node:http'
import { readFile } from 'node:fs/promises'
import type { AddressInfo } from 'node:net'
import { expect, test } from 'vitest'
import {
  deleteExtensionIndexedDbState,
  getExtensionIndexedDbState,
  setExtensionIndexedDbState,
} from './extension-indexeddb-state'
import type { AppStorageState } from '../src/shared/types'

const STORAGE_KEYS = {
  datasets: 'datasets',
  customConfig: 'customConfig',
  localhostPorts: 'localhostPorts',
  defaultLocalhostPort: 'defaultLocalhostPort',
  legacyLocalhostPort: 'localhostPort',
} as const

type LegacyChromeStorageState = AppStorageState & {
  readonly localhostPort?: string
}

interface CookieLookupInput {
  url: string
  name: string
}

interface CookieSnapshot {
  name: string
  value: string
  path: string
  httpOnly: boolean
  sameSite: chrome.cookies.SameSiteStatus
  expirationDate?: number
}

let sourceServer: Server
let targetServer: Server
let sourcePort = 0
let targetPort = 0

test.beforeAll(async () => {
  sourceServer = await startHtmlServer('Source Cookie Page', 'source page')
  targetServer = await startHtmlServer('Target Localhost Page', 'target page')
  sourcePort = getServerPort(sourceServer)
  targetPort = getServerPort(targetServer)
})

test.afterAll(async () => {
  await Promise.all([
    closeServer(sourceServer),
    closeServer(targetServer),
  ])
})

test.beforeEach(async () => {
  await context.clearCookies()
  await clearExtensionChromeStorageLocal()
  await setExtensionIndexedDbState({
    [STORAGE_KEYS.datasets]: [],
    [STORAGE_KEYS.customConfig]: [],
    [STORAGE_KEYS.localhostPorts]: [],
    [STORAGE_KEYS.defaultLocalhostPort]: '',
  })
})

test('popup 应正确渲染基础界面', async () => {
  const popupPage = await browser.getPopupPage()

  await popupPage.waitForLoadState('domcontentloaded')

  expect(await popupPage.title()).toMatch(/State Migrator/i)
  expect(
    await popupPage.locator('[data-test-id="popup-title"]').isVisible(),
  ).toBe(true)
  expect(
    await popupPage.locator('[data-test-id="popup-open-options-button"]').isVisible(),
  ).toBe(true)

  await popupPage.setViewportSize({ width: 375, height: 900 })
  const horizontalOverflow = await popupPage.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  )
  expect(horizontalOverflow).toBeLessThanOrEqual(0)

  await popupPage.close()
})

test('popup 导入预览应展示 cookie 元信息', async () => {
  await setExtensionIndexedDbState({
    [STORAGE_KEYS.datasets]: [
      {
        id: 'dataset-cookie-preview',
        datasetName: 'Cookie dataset',
        sourceUrl: 'https://example.com/demo',
        createdAt: '2026-03-31T12:00:00.000Z',
        items: [
          {
            storageType: 'cookie',
            key: 'locale',
            value: 'zh-CN',
            cookie: {
              domain: '.example.com',
              hostOnly: false,
              path: '/',
              secure: true,
              httpOnly: true,
              sameSite: 'no_restriction',
              session: false,
              expirationDate: 1_800_000_000,
            },
          },
        ],
      },
    ],
  })

  const popupPage = await browser.getPopupPage()

  await popupPage.waitForLoadState('domcontentloaded')
  await popupPage.locator('[data-test-id="popup-mode-import-button"]').click()

  const importDetails = popupPage.locator('[data-test-id="import-preview-disclosure-details"]')
  const importSummary = popupPage.locator('[data-test-id="import-preview-disclosure-details-summary"]')
  const cookieMeta = popupPage.locator('[data-test-id="import-preview-cookie-meta"]')

  expect(await popupPage.locator('[data-test-id="saved-dataset-name"]').first().isVisible()).toBe(true)
  expect(await importDetails.getAttribute('open')).toBeNull()
  expect(await importSummary.textContent()).toContain('数据集内容')
  expect(await importSummary.textContent()).toContain('1 项')
  expect(await popupPage.locator('[data-test-id="import-preview-item-key"]').first().isVisible()).toBe(false)
  expect(await cookieMeta.isVisible()).toBe(false)

  await importSummary.focus()
  await popupPage.keyboard.press('Enter')

  expect(await importDetails.getAttribute('open')).toBe('')
  expect(await popupPage.locator('[data-test-id="import-preview-item-key"]').first().isVisible()).toBe(true)
  expect(await cookieMeta.isVisible()).toBe(true)
  expect(await cookieMeta.textContent()).toContain('HttpOnly')
  expect(await cookieMeta.textContent()).toContain('Secure')
  expect(await cookieMeta.textContent()).toContain('Domain=.example.com')
  expect(await cookieMeta.textContent()).toContain('SameSite=None')
  expect(await cookieMeta.textContent()).toContain('Expires=')

  await popupPage.close()
})

test('options 页面应允许保存 cookie 配置和 localhost 端口', async () => {
  const optionsPage = await openOptionsPage()

  expect(
    await optionsPage.locator('[data-test-id="options-title"]').isVisible(),
  ).toBe(true)

  const composerStorageType = optionsPage.locator('[data-test-id="options-composer-storage-select"]')
  const composerKeyInput = optionsPage.locator('[data-test-id="options-composer-key-input"]')
  const composerDescriptionInput = optionsPage.locator('[data-test-id="options-composer-description-input"]')
  const localhostProtocolSelect = optionsPage.locator('[data-test-id="options-localhost-protocol-select"]')
  const localhostPortInput = optionsPage.locator('[data-test-id="options-localhost-port-input"]')

  expect(await optionsPage.getByRole('combobox', { name: '新增 Storage 类型' }).isVisible()).toBe(true)
  expect(await optionsPage.getByRole('textbox', { name: '新增 Key' }).isVisible()).toBe(true)
  expect(await optionsPage.getByRole('textbox', { name: '新增说明' }).isVisible()).toBe(true)
  expect(await optionsPage.getByRole('combobox', { name: '协议' }).isVisible()).toBe(true)
  expect(await optionsPage.getByRole('textbox', { name: '端口' }).isVisible()).toBe(true)

  await composerStorageType.selectOption('cookie')
  await composerKeyInput.fill('locale')
  await composerDescriptionInput.fill('语言 Cookie')
  await optionsPage.locator('[data-test-id="options-add-config-button"]').click()

  await localhostProtocolSelect.selectOption('https')
  await localhostPortInput.fill('5173')
  await optionsPage.locator('[data-test-id="options-add-localhost-button"]').click()
  await optionsPage.locator('[data-test-id="options-save-all-button"]').click()

  expect(await optionsPage.locator('[data-test-id="options-operation-message"]').isVisible()).toBe(true)
  expect(await optionsPage.locator('[data-test-id="options-pending-indicator"]').isVisible()).toBe(false)
  expect(await optionsPage.locator('[data-test-id="options-localhost-target-label"]').isVisible()).toBe(true)

  const storageState = await getExtensionIndexedDbState()

  expect(storageState[STORAGE_KEYS.customConfig]).toEqual([
    {
      storageType: 'cookie',
      key: 'locale',
      description: '语言 Cookie',
    },
  ])
  expect(storageState[STORAGE_KEYS.localhostPorts]).toEqual([
    { protocol: 'https', port: '5173' },
  ])
  expect(storageState[STORAGE_KEYS.defaultLocalhostPort]).toBe('https:5173')

  await optionsPage.close()
})

test('options 加载期间禁用工具栏操作，加载失败时保留已保存状态', async () => {
  await deleteExtensionIndexedDbState()
  await setExtensionChromeStorageLocalState({
    [STORAGE_KEYS.datasets]: [],
    [STORAGE_KEYS.customConfig]: [
      { storageType: 'localStorage', key: 'legacy-key', description: '保留的旧配置' },
    ],
    [STORAGE_KEYS.localhostPorts]: [{ protocol: 'http', port: '5173' }],
    [STORAGE_KEYS.defaultLocalhostPort]: 'http:5173',
  })

  const extensionId = await browser.getExtensionId()
  const loadingPage = await context.newPage()
  await loadingPage.addInitScript(() => {
    Object.defineProperty(chrome.storage.local, 'get', {
      configurable: true,
      value: () => new Promise<never>(() => {}),
    })
  })
  await loadingPage.goto(`chrome-extension://${extensionId}/options.html`)

  try {
    const toolbar = loadingPage.locator('[data-test-id="options-toolbar"]')
    const saveAll = toolbar.locator('[data-test-id="options-save-all-button"]')
    await saveAll.waitFor()
    expect(await toolbar.locator('[data-test-id="options-export-config-button"]').isDisabled()).toBe(true)
    expect(await toolbar.locator('[data-test-id="options-import-merge-button"]').isDisabled()).toBe(true)
    expect(await toolbar.locator('[data-test-id="options-import-replace-button"]').isDisabled()).toBe(true)
    expect(await saveAll.isDisabled()).toBe(true)
    expect(await toolbar.locator('[data-test-id="options-clear-all-button"]').isDisabled()).toBe(true)
    expect(await toolbar.locator('[data-test-id="options-load-status"]').textContent()).toContain('正在加载配置')
  } finally {
    await loadingPage.close()
  }

  const failingPage = await context.newPage()
  await failingPage.addInitScript(() => {
    Object.defineProperty(chrome.storage.local, 'get', {
      configurable: true,
      value: () => Promise.reject(new Error('模拟加载失败')),
    })
  })
  await failingPage.goto(`chrome-extension://${extensionId}/options.html`)

  try {
    const loadError = failingPage.locator('[data-test-id="options-load-error"]')
    await loadError.waitFor()
    expect(await loadError.textContent()).toContain('模拟加载失败')
    expect(await getExtensionChromeStorageLocalState()).toMatchObject({
      [STORAGE_KEYS.customConfig]: [
        { storageType: 'localStorage', key: 'legacy-key', description: '保留的旧配置' },
      ],
      [STORAGE_KEYS.localhostPorts]: [{ protocol: 'http', port: '5173' }],
      [STORAGE_KEYS.defaultLocalhostPort]: 'http:5173',
    })
  } finally {
    await failingPage.close()
  }
})

test('options 重设计应在初始 1440×900 视口内紧凑展示十二行，并支持筛选和行内编辑', async () => {
  await setExtensionIndexedDbState({
    [STORAGE_KEYS.customConfig]: Array.from({ length: 12 }, (_, index) => ({
      storageType: 'localStorage' as const,
      key: `dense-key-${String(index + 1).padStart(2, '0')}`,
      description: `高密度说明 ${index + 1}`,
    })),
  })

  let optionsPage: Awaited<ReturnType<typeof openOptionsPage>> | null = null

  try {
    optionsPage = await openOptionsPage()
    await optionsPage.setViewportSize({ width: 1440, height: 900 })

    const workspace = optionsPage.locator('[data-test-id="options-key-workspace"]')
    const rows = workspace.locator('[data-test-id="options-config-row"]')
    const rowList = workspace.locator('[data-test-id="options-config-row-list"]')

    await rows.first().waitFor()
    expect(await rows.count()).toBe(12)

    const rowListMetrics = await rowList.evaluate((element) => ({
      clientHeight: element.clientHeight,
      scrollHeight: element.scrollHeight,
    }))
    const horizontalOverflow = await optionsPage.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    )

    expect(rowListMetrics.scrollHeight).toBe(rowListMetrics.clientHeight)
    expect(horizontalOverflow).toBeLessThanOrEqual(0)
    expect(await optionsPage.evaluate(() => window.scrollY)).toBe(0)
    const outOfViewportElements = await optionsPage.locator([
      '[data-test-id="options-toolbar"]',
      '[data-test-id="options-localhost-strip"]',
      '[data-test-id="options-config-row"]',
      '[data-test-id="options-config-composer"]',
      'button[data-test-id]',
    ].join(', ')).evaluateAll((elements) => elements.map((element) => {
      const box = element.getBoundingClientRect()
      const isWithinViewport = box.width > 0
        && box.height > 0
        && box.top >= 0
        && box.bottom <= window.innerHeight
      return isWithinViewport
        ? null
        : {
            tagName: element.tagName,
            text: element.textContent?.trim(),
            top: box.top,
            bottom: box.bottom,
          }
    }).filter((element): element is NonNullable<typeof element> => element !== null))
    expect(outOfViewportElements).toEqual([])
    const filterInput = workspace.locator('[data-test-id="options-filter-input"]')
    expect(await filterInput.getAttribute('aria-label')).toBe('筛选配置')
    await filterInput.fill('dense-key-08')
    expect(await rows.count()).toBe(1)
    expect(await rows.first().locator('[data-test-id="options-config-row-key-input"]').inputValue()).toBe('dense-key-08')

    await filterInput.fill('高密度说明 11')
    expect(await rows.count()).toBe(1)
    expect(await rows.first().locator('[data-test-id="options-config-row-key-input"]').inputValue()).toBe('dense-key-11')

    await filterInput.fill('')
    await rows.first().locator('[data-test-id="options-config-row-description-input"]').fill('已行内编辑的说明')

    expect(await optionsPage.locator('[data-test-id="options-pending-indicator"]').isVisible()).toBe(true)
    expect((await getExtensionIndexedDbState())[STORAGE_KEYS.customConfig]?.[0]).toEqual({
      storageType: 'localStorage',
      key: 'dense-key-01',
      description: '高密度说明 1',
    })
  } finally {
    await optionsPage?.close().catch(() => {})
  }
})

test('options localhost 目标应切换默认值、确认删除并同步给 popup', async () => {
  await setExtensionIndexedDbState({
    [STORAGE_KEYS.localhostPorts]: [
      { protocol: 'http', port: '5173' },
      { protocol: 'https', port: '3000' },
    ],
    [STORAGE_KEYS.defaultLocalhostPort]: 'http:5173',
  })

  let optionsPage: Awaited<ReturnType<typeof openOptionsPage>> | null = null
  let popupPage: Awaited<ReturnType<typeof browser.getPopupPage>> | null = null

  try {
    optionsPage = await openOptionsPage()
    const targetStrip = optionsPage.locator('[data-test-id="options-localhost-strip"]')
    const httpTarget = targetStrip.locator('[data-test-id="options-localhost-target"][data-target-key="http:5173"]')
    const httpsTarget = targetStrip.locator('[data-test-id="options-localhost-target"][data-target-key="https:3000"]')

    await httpsTarget.locator('[data-test-id="options-localhost-default-button"]').click()
    expect(await httpsTarget.locator('.badge').isVisible()).toBe(true)
    expect(await optionsPage.locator('[data-test-id="options-pending-indicator"]').isVisible()).toBe(true)

    const deleteHttpTarget = httpTarget.locator('[data-test-id="options-localhost-delete-button"]')
    await deleteHttpTarget.click()
    const confirmation = targetStrip.locator('[data-test-id="options-localhost-delete-confirmation"]')
    await confirmation.waitFor()
    expect(await confirmation.getAttribute('role')).toBe('alertdialog')
    expect(await confirmation.getAttribute('aria-label')).toBe('删除目标确认')
    expect(await confirmation.textContent()).toContain('确认删除目标 http://localhost:5173？')
    await confirmation.locator('[data-test-id="options-localhost-delete-cancel-button"]').click()
    expect(await deleteHttpTarget.evaluate((button) => button.matches(':focus'))).toBe(true)

    await deleteHttpTarget.click()
    await confirmation.locator('[data-test-id="options-localhost-delete-confirm-button"]').click()
    expect(await httpTarget.count()).toBe(0)
    expect(await httpsTarget.locator('[data-test-id="options-localhost-delete-button"]').evaluate((button) => button.matches(':focus'))).toBe(true)

    await optionsPage.locator('[data-test-id="options-save-all-button"]').click()
    await optionsPage.locator('[data-test-id="options-operation-message"]').waitFor()

    expect(await getExtensionIndexedDbState()).toMatchObject({
      [STORAGE_KEYS.localhostPorts]: [{ protocol: 'https', port: '3000' }],
      [STORAGE_KEYS.defaultLocalhostPort]: 'https:3000',
    })

    popupPage = await browser.getPopupPage()
    await popupPage.waitForLoadState('domcontentloaded')
    expect(
      await popupPage.locator('[data-test-id="export-localhost-target-select"]').inputValue(),
    ).toBe('https:3000')

    await httpsTarget.locator('[data-test-id="options-localhost-delete-button"]').click()
    await confirmation.locator('[data-test-id="options-localhost-delete-confirm-button"]').click()
    expect(await targetStrip.locator('[data-test-id="options-add-localhost-button"]').evaluate((button) => button.matches(':focus'))).toBe(true)
  } finally {
    await popupPage?.close().catch(() => {})
    await optionsPage?.close().catch(() => {})
  }
})

test('options 配置编辑器应阻止无效行、在行内确认删除并提示离开前保存', async () => {
  await setExtensionIndexedDbState({
    [STORAGE_KEYS.customConfig]: [
      { storageType: 'localStorage', key: 'existing-key', description: '已保存配置' },
    ],
  })

  let optionsPage: Awaited<ReturnType<typeof openOptionsPage>> | null = null

  try {
    optionsPage = await openOptionsPage()
    const workspace = optionsPage.locator('[data-test-id="options-key-workspace"]')
    const addConfig = optionsPage.locator('[data-test-id="options-add-config-button"]')
    const composerKey = optionsPage.locator('[data-test-id="options-composer-key-input"]')
    const composerStorageType = optionsPage.locator('[data-test-id="options-composer-storage-select"]')

    await addConfig.click()
    expect(await workspace.locator('[data-test-id="options-composer-message"]').textContent()).toBe('Key 不能为空。')

    expect(await composerStorageType.locator('option').evaluateAll((options) =>
      options.map((option) => option.getAttribute('value')),
    )).toEqual([
      'localStorage',
      'sessionStorage',
      'cookie',
    ])

    await composerKey.fill('existing-key')
    await addConfig.click()
    expect(await workspace.locator('[data-test-id="options-composer-message"]').textContent()).toBe('localStorage:existing-key 已存在，请使用其它 Key。')

    await composerKey.fill('second-key')
    await addConfig.click()
    const rows = workspace.locator('[data-test-id="options-config-row"]')
    expect(await rows.count()).toBe(2)

    const secondRow = rows.nth(1)
    const secondRowKey = secondRow.locator('[data-test-id="options-config-row-key-input"]')
    await secondRowKey.fill(' existing-key ')
    expect(await secondRow.locator('[data-test-id="options-config-row-validation-message"]').textContent()).toBe('localStorage:existing-key 已存在，请使用其它 Key。')
    expect(await secondRowKey.getAttribute('aria-invalid')).toBe('true')
    expect(await secondRowKey.evaluate((input) => {
      const descriptionId = input.getAttribute('aria-describedby')
      const root = input.getRootNode()
      return descriptionId && root instanceof ShadowRoot
        ? root.getElementById(descriptionId)?.textContent
        : null
    })).toBe('localStorage:existing-key 已存在，请使用其它 Key。')
    expect(await optionsPage.locator('[data-test-id="options-save-all-button"]').isDisabled()).toBe(true)
    expect(await optionsPage.locator('[data-test-id="options-export-config-button"]').isDisabled()).toBe(true)
    expect((await getExtensionIndexedDbState())[STORAGE_KEYS.customConfig]).toEqual([
      { storageType: 'localStorage', key: 'existing-key', description: '已保存配置' },
    ])

    await secondRowKey.fill('validated-key')
    expect(await secondRow.locator('[data-test-id="options-config-row-validation-message"]').count()).toBe(0)
    expect(await optionsPage.locator('[data-test-id="options-save-all-button"]').isDisabled()).toBe(false)

    const deleteExisting = rows.first().locator('[data-test-id="options-config-row-delete-button"]')
    await deleteExisting.click()
    const confirmation = workspace.locator('[data-test-id="options-config-row-delete-confirmation"]')
    await confirmation.waitFor()
    expect(await confirmation.getAttribute('role')).toBe('alertdialog')
    expect(await confirmation.getAttribute('aria-label')).toBe('删除配置确认')
    expect(await confirmation.textContent()).toContain('确认删除配置 localStorage:existing-key？')
    expect(await confirmation.evaluate((element) => element.closest('[data-ui-id]')?.getAttribute('data-ui-id'))).not.toBeNull()
    await confirmation.locator('[data-test-id="options-config-row-delete-cancel-button"]').click()
    expect(await deleteExisting.evaluate((button) => button.matches(':focus'))).toBe(true)

    await deleteExisting.click()
    await workspace.locator('[data-test-id="options-config-row-delete-confirm-button"]').click()
    expect(await rows.count()).toBe(1)
    const deleteValidated = rows.first().locator('[data-test-id="options-config-row-delete-button"]')
    expect(await deleteValidated.evaluate((button) => button.matches(':focus'))).toBe(true)

    await deleteValidated.click()
    await workspace.locator('[data-test-id="options-config-row-delete-confirm-button"]').click()
    expect(await rows.count()).toBe(0)
    expect(await composerKey.evaluate((input) => input.matches(':focus'))).toBe(true)

    const beforeUnloadDialog = optionsPage.waitForEvent('dialog')
    await optionsPage.close({ runBeforeUnload: true })
    const dialog = await beforeUnloadDialog
    expect(dialog.type()).toBe('beforeunload')
    await dialog.dismiss()
    await optionsPage.close()
    optionsPage = null
  } finally {
    await optionsPage?.close().catch(() => {})
  }
})

test('options 工具栏应导出、合并或覆盖导入，并在清空前要求确认', async () => {
  await setExtensionIndexedDbState({
    [STORAGE_KEYS.customConfig]: [
      { storageType: 'localStorage', key: 'export-key', description: '待导出配置' },
    ],
    [STORAGE_KEYS.localhostPorts]: [{ protocol: 'http', port: '5173' }],
    [STORAGE_KEYS.defaultLocalhostPort]: 'http:5173',
  })

  let optionsPage: Awaited<ReturnType<typeof openOptionsPage>> | null = null

  try {
    optionsPage = await openOptionsPage()
    const toolbar = optionsPage.locator('[data-test-id="options-toolbar"]')
    const workspace = optionsPage.locator('[data-test-id="options-key-workspace"]')
    const importInput = optionsPage.locator('[data-test-id="options-import-file-input"]')

    for (const [testId, buttonName] of [
      ['options-export-config-button', '导出配置'],
      ['options-import-merge-button', '追加合并导入'],
      ['options-import-replace-button', '覆盖导入'],
      ['options-save-all-button', '保存全部配置'],
      ['options-clear-all-button', '清空全部配置'],
    ]) {
      const button = toolbar.locator(`[data-test-id="${testId}"]`)
      expect(await button.isVisible()).toBe(true)
      expect((await button.textContent())?.trim()).toBe(buttonName)
    }

    const downloadPromise = optionsPage.waitForEvent('download')
    await toolbar.locator('[data-test-id="options-export-config-button"]').click()
    const download = await downloadPromise
    const downloadPath = await download.path()

    expect(download.suggestedFilename()).toMatch(/^state-migrator-config-\d{4}-\d{2}-\d{2}\.json$/)
    if (!downloadPath) {
      throw new Error('Expected the exported configuration download to be available.')
    }
    expect(JSON.parse(await readFile(downloadPath, 'utf8'))).toMatchObject({
      version: 3,
      localhostTargets: [{ protocol: 'http', port: '5173' }],
      defaultLocalhostTarget: 'http:5173',
      items: [{ storageType: 'localStorage', key: 'export-key', description: '待导出配置' }],
    })

    await toolbar.locator('[data-test-id="options-import-merge-button"]').click()
    await importInput.setInputFiles({
      name: 'merge-config.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify({
        items: [{ storageType: 'sessionStorage', key: 'merge-key', description: '追加配置' }],
        localhostTargets: [{ protocol: 'https', port: '4173' }],
        defaultLocalhostTarget: 'https:4173',
      })),
    })
    await optionsPage.locator('[data-test-id="options-operation-message"]').filter({ hasText: '已追加合并 1 项配置' }).waitFor()
    expect(await workspace.locator('[data-test-id="options-config-row"]').count()).toBe(2)
    expect(await workspace.locator('[data-test-id="options-config-row"]').nth(1).locator('[data-test-id="options-config-row-key-input"]').inputValue()).toBe('merge-key')

    await toolbar.locator('[data-test-id="options-import-replace-button"]').click()
    await importInput.setInputFiles({
      name: 'replace-config.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify({
        items: [{ storageType: 'cookie', key: 'replace-key', description: '覆盖配置' }],
        localhostTargets: [{ protocol: 'https', port: '9443' }],
        defaultLocalhostTarget: 'https:9443',
      })),
    })
    await optionsPage.locator('[data-test-id="options-operation-message"]').filter({ hasText: '已覆盖导入 1 项配置' }).waitFor()
    expect(await workspace.locator('[data-test-id="options-config-row"]').count()).toBe(1)
    expect(await workspace.locator('[data-test-id="options-config-row"]').first().locator('[data-test-id="options-config-row-key-input"]').inputValue()).toBe('replace-key')

    const clearAll = toolbar.locator('[data-test-id="options-clear-all-button"]')
    await clearAll.click()
    const confirmation = toolbar.locator('[data-test-id="options-clear-all-confirmation"]')
    await confirmation.waitFor()
    expect(await confirmation.getAttribute('role')).toBe('alertdialog')
    expect(await confirmation.getAttribute('aria-label')).toBe('清空配置确认')
    expect(await confirmation.textContent()).toContain('确认清空全部配置项？')
    expect(await confirmation.evaluate((element) => {
      const root = element.getRootNode()
      return root instanceof ShadowRoot && root.host.localName === 'options-toolbar'
    })).toBe(true)
    await confirmation.locator('[data-test-id="options-clear-all-cancel-button"]').click()
    expect(await clearAll.evaluate((button) => button.matches(':focus'))).toBe(true)

    await clearAll.click()
    await confirmation.locator('[data-test-id="options-clear-all-confirm-button"]').click()
    await optionsPage.locator('[data-test-id="options-operation-message"]').filter({ hasText: '已清空全部配置项。' }).waitFor()
    expect(await optionsPage.locator('[data-test-id="options-pending-indicator"]').isVisible()).toBe(false)
    expect(await clearAll.evaluate((button) => button.matches(':focus'))).toBe(true)
    expect(await getExtensionIndexedDbState()).toMatchObject({
      [STORAGE_KEYS.customConfig]: [],
      [STORAGE_KEYS.localhostPorts]: [],
      [STORAGE_KEYS.defaultLocalhostPort]: '',
    })
  } finally {
    await optionsPage?.close().catch(() => {})
  }
})

test('options 无效导入应保留草稿，保存后重载应匹配已保存状态', async () => {
  await setExtensionIndexedDbState({
    [STORAGE_KEYS.customConfig]: [
      { storageType: 'localStorage', key: 'saved-key', description: '已保存说明' },
    ],
    [STORAGE_KEYS.localhostPorts]: [{ protocol: 'http', port: '5173' }],
    [STORAGE_KEYS.defaultLocalhostPort]: 'http:5173',
  })

  let optionsPage: Awaited<ReturnType<typeof openOptionsPage>> | null = null

  try {
    optionsPage = await openOptionsPage()
    const workspace = optionsPage.locator('[data-test-id="options-key-workspace"]')
    const row = workspace.locator('[data-test-id="options-config-row"]').first()
    const importInput = optionsPage.locator('[data-test-id="options-import-file-input"]')
    const pendingIndicator = optionsPage.locator('[data-test-id="options-pending-indicator"]')

    await row.waitFor()
    await row.locator('[data-test-id="options-config-row-description-input"]').fill('待保存说明')
    expect(await pendingIndicator.isVisible()).toBe(true)
    expect((await getExtensionIndexedDbState())[STORAGE_KEYS.customConfig]).toEqual([
      { storageType: 'localStorage', key: 'saved-key', description: '已保存说明' },
    ])

    await optionsPage.locator('[data-test-id="options-import-replace-button"]').click()
    await importInput.setInputFiles({
      name: 'invalid-localhost-target.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify({
        items: [{ storageType: 'sessionStorage', key: 'valid-key', description: '有效配置' }],
        localhostTargets: [
          { protocol: 'https', port: '4173' },
          { protocol: 'ftp', port: '3000' },
        ],
      })),
    })
    await optionsPage.locator('[data-test-id="options-operation-message"]').filter({ hasText: '第 2 个 localhostTargets 不合法。' }).waitFor()
    expect(await row.locator('[data-test-id="options-config-row-description-input"]').inputValue()).toBe('待保存说明')
    expect(await pendingIndicator.isVisible()).toBe(true)

    await optionsPage.locator('[data-test-id="options-save-all-button"]').click()
    await optionsPage.locator('[data-test-id="options-operation-message"]').filter({ hasText: '配置已保存。' }).waitFor()
    expect(await pendingIndicator.isVisible()).toBe(false)
    expect((await getExtensionIndexedDbState())[STORAGE_KEYS.customConfig]).toEqual([
      { storageType: 'localStorage', key: 'saved-key', description: '待保存说明' },
    ])

    await optionsPage.reload()
    await row.waitFor()
    expect(await row.locator('[data-test-id="options-config-row-description-input"]').inputValue()).toBe('待保存说明')
    expect(await pendingIndicator.isVisible()).toBe(false)
  } finally {
    await optionsPage?.close().catch(() => {})
  }
})

test('options 保存或清空失败时保留待处理界面并显示转义后的失败状态', async () => {
  await setExtensionIndexedDbState({
    [STORAGE_KEYS.customConfig]: [
      { storageType: 'localStorage', key: 'saved-key', description: '已保存说明' },
    ],
  })

  const extensionId = await browser.getExtensionId()
  const optionsPage = await context.newPage()
  await optionsPage.addInitScript(() => {
    const originalClear = IDBObjectStore.prototype.clear
    IDBObjectStore.prototype.clear = function (this: IDBObjectStore) {
      if (this.name === 'custom-config') {
        throw new Error('模拟写入失败 <b>escaped</b>')
      }
      return originalClear.call(this)
    }
  })
  await optionsPage.goto(`chrome-extension://${extensionId}/options.html`)

  try {
    const workspace = optionsPage.locator('[data-test-id="options-key-workspace"]')
    const toolbar = optionsPage.locator('[data-test-id="options-toolbar"]')
    const row = workspace.locator('[data-test-id="options-config-row"]').first()
    const description = row.locator('[data-test-id="options-config-row-description-input"]')

    await row.waitFor()
    await description.fill('尚未保存的说明')
    expect(await toolbar.locator('[data-test-id="options-pending-indicator"]').isVisible()).toBe(true)

    await toolbar.locator('[data-test-id="options-save-all-button"]').click()
    const saveFailure = toolbar.locator('[data-test-id="options-operation-message"]').filter({ hasText: '保存配置失败' })
    await saveFailure.waitFor()
    expect(await saveFailure.textContent()).toContain('模拟写入失败 <b>escaped</b>')
    expect(await saveFailure.locator('b').count()).toBe(0)
    expect(await description.inputValue()).toBe('尚未保存的说明')
    expect(await toolbar.locator('[data-test-id="options-pending-indicator"]').isVisible()).toBe(true)
    expect((await getExtensionIndexedDbState())[STORAGE_KEYS.customConfig]).toEqual([
      { storageType: 'localStorage', key: 'saved-key', description: '已保存说明' },
    ])

    const clearAll = toolbar.locator('[data-test-id="options-clear-all-button"]')
    await clearAll.click()
    const confirmation = toolbar.locator('[data-test-id="options-clear-all-confirmation"]')
    await confirmation.locator('[data-test-id="options-clear-all-confirm-button"]').click()
    const clearFailure = toolbar.locator('[data-test-id="options-operation-message"]').filter({ hasText: '清空配置失败' })
    await clearFailure.waitFor()
    expect(await description.inputValue()).toBe('尚未保存的说明')
    expect(await toolbar.locator('[data-test-id="options-pending-indicator"]').isVisible()).toBe(true)
    expect(await clearAll.evaluate((button) => button.matches(':focus'))).toBe(true)
  } finally {
    await optionsPage.close().catch(() => {})
  }
})

test('popup 导出模式应加载已保存的默认 localhost 端口', async () => {
  await setExtensionIndexedDbState({
    [STORAGE_KEYS.localhostPorts]: [
      { protocol: 'http', port: '5173' },
      { protocol: 'https', port: '3000' },
    ],
    [STORAGE_KEYS.defaultLocalhostPort]: 'https:3000',
  })

  const popupPage = await browser.getPopupPage()

  await popupPage.waitForLoadState('domcontentloaded')

  expect(await popupPage.locator('[data-test-id="export-save-dataset-button"]').isVisible()).toBe(true)
  expect(await popupPage.locator('[data-test-id="export-rescan-button"]').isVisible()).toBe(true)
  expect(await popupPage.locator('[data-test-id="export-save-and-inject-button"]').isVisible()).toBe(true)

  const portSelect = popupPage.locator('[data-test-id="export-localhost-target-select"]')
  await portSelect.selectOption('http:5173')

  expect(await popupPage.locator('[data-test-id="export-save-and-inject-button"]').isVisible()).toBe(true)

  const storedDefaultPort = (await getExtensionIndexedDbState())[STORAGE_KEYS.defaultLocalhostPort]

  expect(storedDefaultPort).toBe('http:5173')

  await popupPage.close()
})

test('popup 保存第十一组数据后应仅保留最新十组', async () => {
  const sourceUrl = `http://127.0.0.1:${sourcePort}/`
  const datasetKey = 'e2e-dataset-cap'
  let sourcePage: Awaited<ReturnType<typeof context.newPage>> | null = null
  let popupPage: Awaited<ReturnType<typeof browser.getPopupPage>> | null = null

  try {
    await setExtensionIndexedDbState({
      [STORAGE_KEYS.datasets]: Array.from({ length: 10 }, (_, index) => makeDataset(index + 1)),
      [STORAGE_KEYS.customConfig]: [
        { storageType: 'localStorage', key: datasetKey, description: 'Dataset cap' },
      ],
    })
    sourcePage = await context.newPage()
    await sourcePage.goto(sourceUrl)
    await sourcePage.evaluate(({ key, value }) => localStorage.setItem(key, value), {
      key: datasetKey,
      value: 'latest-value',
    })
    popupPage = await openPopupPageForTab(sourceUrl)
    await popupPage.waitForLoadState('domcontentloaded')
    await popupPage.locator('[data-test-id="popup-mode-export-button"]').click()
    await popupPage.locator('[data-test-id="popup-result-message"]').waitFor()
    expect(await popupPage.locator('[data-test-id="popup-result-message"]').textContent()).toBe('已扫描到 1 个可导出项。')
    await popupPage.locator('[data-test-id="export-dataset-name-input"]').fill('Newest saved dataset')
    await popupPage.locator('[data-test-id="export-save-dataset-button"]').click()
    await popupPage.locator('[data-test-id="popup-result-message"]').waitFor()
    expect(await popupPage.locator('[data-test-id="popup-result-message"]').textContent()).toBe('已保存数据集“Newest saved dataset”。')
    await popupPage.locator('[data-test-id="popup-mode-import-button"]').click()

    expect(await popupPage.locator('[data-test-id="import-dataset-count"]').isVisible()).toBe(true)
    expect(await popupPage.locator('[data-test-id="saved-dataset-name"]').first().textContent()).toBe('Newest saved dataset')
    expect(await popupPage.locator('[data-test-id="saved-dataset-name"]').count()).toBe(10)
    expect((await getExtensionIndexedDbState())[STORAGE_KEYS.datasets]).toHaveLength(10)
  } finally {
    await popupPage?.close().catch(() => {})
    await sourcePage?.close().catch(() => {})
  }
})

test('popup 首次启动应迁移旧 chrome.storage.local 数据', async () => {
  const targetUrl = `http://localhost:${targetPort}/`
  let targetPage: Awaited<ReturnType<typeof context.newPage>> | null = null
  let popupPage: Awaited<ReturnType<typeof browser.getPopupPage>> | null = null

  try {
    await deleteExtensionIndexedDbState()
    await setExtensionChromeStorageLocalState({
      [STORAGE_KEYS.datasets]: [
        {
          id: 'legacy-dataset',
          datasetName: 'Legacy dataset',
          sourceUrl: 'https://example.com',
          createdAt: '2024-01-01T00:00:00.000Z',
          items: [{ storageType: 'localStorage', key: 'legacy-key', value: 'legacy-value' }],
        },
      ],
      [STORAGE_KEYS.customConfig]: [
        { storageType: 'localStorage', key: 'legacy-key', description: 'Legacy config' },
      ],
      [STORAGE_KEYS.localhostPorts]: [],
      [STORAGE_KEYS.defaultLocalhostPort]: '',
      [STORAGE_KEYS.legacyLocalhostPort]: ' 05173 ',
    })
    targetPage = await context.newPage()
    await targetPage.goto(targetUrl)
    popupPage = await openPopupPageForTab(targetUrl)
    await popupPage.waitForLoadState('domcontentloaded')

    await popupPage.locator('[data-test-id="saved-dataset-name"]').waitFor()
    const importSummary = popupPage.locator('[data-test-id="import-preview-disclosure-details-summary"]')
    expect(await importSummary.textContent()).toContain('1 项')
    expect(await popupPage.locator('[data-test-id="import-preview-item-key"]').isVisible()).toBe(false)
    await importSummary.click()
    expect(await popupPage.locator('[data-test-id="import-preview-item-key"]').isVisible()).toBe(true)
    const state = await getExtensionIndexedDbState()
    expect(state[STORAGE_KEYS.localhostPorts]).toEqual([{ protocol: 'http', port: '5173' }])
    expect(state[STORAGE_KEYS.defaultLocalhostPort]).toBe('http:5173')
  } finally {
    await clearExtensionChromeStorageLocal()
    await popupPage?.close().catch(() => {})
    await targetPage?.close().catch(() => {})
  }
})

test('保存并注入应在源标签后打开目标标签', async () => {
  const sourceUrl = `http://127.0.0.1:${sourcePort}/`
  const targetUrl = `http://localhost:${targetPort}/`
  const datasetKey = 'e2e-save-and-inject'
  let sourcePage: Awaited<ReturnType<typeof context.newPage>> | null = null
  let sentinelPage: Awaited<ReturnType<typeof context.newPage>> | null = null
  let popupPage: Awaited<ReturnType<typeof browser.getPopupPage>> | null = null

  try {
    await setExtensionIndexedDbState({
      [STORAGE_KEYS.customConfig]: [
        { storageType: 'localStorage', key: datasetKey, description: 'Save and inject' },
      ],
      [STORAGE_KEYS.localhostPorts]: [{ protocol: 'http', port: String(targetPort) }],
      [STORAGE_KEYS.defaultLocalhostPort]: `http:${targetPort}`,
    })
    sourcePage = await context.newPage()
    await sourcePage.goto(sourceUrl)
    await sourcePage.evaluate(({ key, value }) => localStorage.setItem(key, value), {
      key: datasetKey,
      value: 'injected-value',
    })
    sentinelPage = await context.newPage()
    await sentinelPage.goto('about:blank')
    await sourcePage.bringToFront()
    const sourceTab = (await getExtensionTabsSnapshot()).find((tab) => tab.url === sourceUrl)

    if (!sourceTab) {
      throw new Error('Source tab was not found')
    }

    popupPage = await openPopupPageForTab(sourceUrl)
    await popupPage.waitForLoadState('domcontentloaded')
    await popupPage.locator('[data-test-id="popup-mode-export-button"]').click()
    await popupPage.locator('[data-test-id="popup-result-message"]').waitFor()
    expect(await popupPage.locator('[data-test-id="popup-result-message"]').textContent()).toBe('已扫描到 1 个可导出项。')
    await sourcePage.bringToFront()
    await popupPage.locator('[data-test-id="export-save-and-inject-button"]').click()
    await popupPage
      .locator('[data-test-id="popup-result-message"]')
      .filter({ hasText: `已打开 ${targetUrl}，并成功注入 1 项。` })
      .waitFor()
    expect(await popupPage.locator('[data-test-id="popup-result-message"]').textContent()).toContain(`已打开 ${targetUrl}，并成功注入 1 项。`)

    const tabs = await getExtensionTabsSnapshot()
    const targetTab = tabs.find((tab) => tab.url === targetUrl)
    expect(targetTab?.index).toBe(sourceTab.index + 1)
  } finally {
    await popupPage?.close().catch(() => {})
    await sentinelPage?.close().catch(() => {})
    await sourcePage?.close().catch(() => {})
  }
})

test('popup 应可从源页面导出 cookie 并导入到 localhost 页面', async () => {
  const sourceUrl = `http://127.0.0.1:${sourcePort}/`
  const targetUrl = `http://localhost:${targetPort}/`
  const cookieName = 'session-token'
  const cookieValue = 'source-cookie-value'
  const expirationDate = 1_893_456_000

  let sourcePage: Awaited<ReturnType<typeof context.newPage>> | null = null
  let exportPopup: Awaited<ReturnType<typeof browser.getPopupPage>> | null = null
  let targetPage: Awaited<ReturnType<typeof context.newPage>> | null = null
  let importPopup: Awaited<ReturnType<typeof browser.getPopupPage>> | null = null

  try {
    await setExtensionIndexedDbState({
      [STORAGE_KEYS.customConfig]: [
        {
          storageType: 'cookie',
          key: cookieName,
          description: '同步登录态',
        },
      ],
    })

    sourcePage = await context.newPage()
    await sourcePage.goto(sourceUrl)
    await context.addCookies([
      {
        name: cookieName,
        value: cookieValue,
        url: sourceUrl,
        httpOnly: true,
        sameSite: 'Strict',
        expires: expirationDate,
      },
    ])
    const sourceCookie = await getCookieForUrl(sourceUrl, cookieName)

    exportPopup = await openPopupPageForTab(sourceUrl)
    await exportPopup.waitForLoadState('domcontentloaded')
    await exportPopup.locator('[data-test-id="popup-mode-export-button"]').click()
    expect(await exportPopup.locator('[data-test-id="export-page-url"]').isVisible()).toBe(true)
    expect(await exportPopup.locator('[data-test-id="export-page-url"]').textContent()).toBe(sourceUrl)

    await exportPopup.locator('[data-test-id="popup-result-message"]').waitFor()
    expect(await exportPopup.locator('[data-test-id="popup-result-message"]').textContent()).toBe('已扫描到 1 个可导出项。')
    const exportDetails = exportPopup.locator('[data-test-id="export-items-disclosure-details"]')
    const exportSummary = exportPopup.locator('[data-test-id="export-items-disclosure-details-summary"]')
    expect(await exportDetails.getAttribute('open')).toBeNull()
    expect(await exportSummary.textContent()).toContain('数据集内容')
    expect(await exportSummary.textContent()).toContain('1 项')
    expect(await exportPopup.locator('[data-test-id="export-item-key"]').isVisible()).toBe(false)

    const exportedCookieMeta = exportPopup.locator('[data-test-id="export-item-cookie-meta"]')
    expect(await exportedCookieMeta.isVisible()).toBe(false)
    await exportSummary.click()
    expect(await exportDetails.getAttribute('open')).toBe('')
    expect(await exportPopup.locator('[data-test-id="export-item-key"]').isVisible()).toBe(true)
    expect(await exportedCookieMeta.isVisible()).toBe(true)
    expect(await exportedCookieMeta.textContent()).toContain('HttpOnly')
    expect(await exportedCookieMeta.textContent()).toContain('HostOnly')
    expect(await exportedCookieMeta.textContent()).toContain('SameSite=Strict')
    expect(await exportedCookieMeta.textContent()).toContain('Expires=')

    await exportPopup.locator('[data-test-id="export-save-dataset-button"]').click()
    expect(await exportPopup.locator('[data-test-id="popup-result-message"]').textContent()).toBe('已保存数据集“Imported from 127.0.0.1”。')
    await exportPopup.close()
    exportPopup = null

    targetPage = await context.newPage()
    await targetPage.goto(targetUrl)
    importPopup = await openPopupPageForTab(targetUrl)
    await importPopup.waitForLoadState('domcontentloaded')
    expect(await importPopup.locator('[data-test-id="import-page-url"]').isVisible()).toBe(true)
    expect(await importPopup.locator('[data-test-id="import-page-url"]').textContent()).toBe(targetUrl)
    expect(await importPopup.locator('[data-test-id="popup-mode-import-button"]').isVisible()).toBe(true)
    const importDetails = importPopup.locator('[data-test-id="import-preview-disclosure-details"]')
    const importSummary = importPopup.locator('[data-test-id="import-preview-disclosure-details-summary"]')
    expect(await importDetails.getAttribute('open')).toBeNull()
    expect(await importSummary.textContent()).toContain('数据集内容')
    expect(await importSummary.textContent()).toContain('1 项')
    expect(await importPopup.locator('[data-test-id="import-preview-item-key"]').isVisible()).toBe(false)
    await importSummary.focus()
    await importPopup.keyboard.press(' ')
    expect(await importDetails.getAttribute('open')).toBe('')
    expect(await importPopup.locator('[data-test-id="import-preview-item-key"]').isVisible()).toBe(true)

    await importPopup.locator('[data-test-id="import-confirm-button"]').click()
    expect(await importPopup.locator('[data-test-id="popup-result-message"]').textContent()).toBe('成功导入 1 项。')

    const importedCookie = await getCookieForUrl(targetUrl, cookieName)

    expect(sourceCookie).toEqual({
      name: cookieName,
      value: cookieValue,
      path: '/',
      httpOnly: true,
      sameSite: 'strict',
      expirationDate: sourceCookie?.expirationDate,
    })
    expect(importedCookie).toEqual({
      name: cookieName,
      value: cookieValue,
      path: '/',
      httpOnly: true,
      sameSite: 'strict',
      expirationDate: sourceCookie?.expirationDate,
    })

    const targetDocumentCookie = await targetPage.evaluate(() => document.cookie)
    expect(targetDocumentCookie).not.toContain(cookieName)
  } finally {
    await importPopup?.close().catch(() => {})
    await exportPopup?.close().catch(() => {})
    await targetPage?.close().catch(() => {})
    await sourcePage?.close().catch(() => {})
  }
})

async function setExtensionChromeStorageLocalState(items: LegacyChromeStorageState) {
  const serviceWorker = await browser.getServiceWorker()

  await serviceWorker.evaluate(async (payload: LegacyChromeStorageState) => {
    await chrome.storage.local.clear()
    await chrome.storage.local.set(payload)
  }, items)
}

async function getExtensionChromeStorageLocalState() {
  const serviceWorker = await browser.getServiceWorker()

  return await serviceWorker.evaluate(
    async (keys: string[]) => await chrome.storage.local.get(keys),
    [
      STORAGE_KEYS.customConfig,
      STORAGE_KEYS.localhostPorts,
      STORAGE_KEYS.defaultLocalhostPort,
    ],
  )
}

async function clearExtensionChromeStorageLocal() {
  const serviceWorker = await browser.getServiceWorker()

  await serviceWorker.evaluate(async () => {
    await chrome.storage.local.clear()
  })
}

async function getExtensionTabsSnapshot() {
  const serviceWorker = await browser.getServiceWorker()

  return await serviceWorker.evaluate(async () => {
    const tabs = await chrome.tabs.query({})

    return tabs.flatMap((tab) => tab.id !== undefined && tab.url !== undefined
      ? [{ id: tab.id, index: tab.index, url: tab.url, active: tab.active }]
      : [])
  })
}

function makeDataset(index: number) {
  return {
    id: `seed-${index}`,
    datasetName: `Seed Dataset ${index}`,
    sourceUrl: `https://example.com/${index}`,
    createdAt: `2024-01-${String(index).padStart(2, '0')}T00:00:00.000Z`,
    items: [],
  }
}

async function getCookieForUrl(url: string, name: string) {
  const serviceWorker = await browser.getServiceWorker()

  return await serviceWorker.evaluate(async (input: CookieLookupInput) => {
    const cookie = await chrome.cookies.get({
      url: input.url,
      name: input.name,
    })

    if (!cookie) {
      return null
    }

    return {
      name: cookie.name,
      value: cookie.value,
      path: cookie.path,
      httpOnly: cookie.httpOnly,
      sameSite: cookie.sameSite,
      expirationDate: cookie.expirationDate,
    }
  }, { url, name } satisfies CookieLookupInput) as CookieSnapshot | null
}

async function openOptionsPage() {
  const extensionId = await browser.getExtensionId()
  const optionsPage = await context.newPage()

  await optionsPage.goto(`chrome-extension://${extensionId}/options.html`)
  await optionsPage.waitForLoadState('domcontentloaded')

  return optionsPage
}

async function openPopupPageForTab(url: string) {
  const extensionId = await browser.getExtensionId()
  const popupPage = await context.newPage()
  const pageInfo = await getTabPageInfo(url)

  await popupPage.addInitScript((activeTab) => {
    const originalSendMessage = chrome.runtime.sendMessage.bind(chrome.runtime)

    chrome.runtime.sendMessage = (async (message: unknown) => {
      if (
        message
        && typeof message === 'object'
        && 'type' in message
        && message.type === 'GET_ACTIVE_TAB'
      ) {
        return activeTab
      }

      return await originalSendMessage(message as never)
    }) as typeof chrome.runtime.sendMessage
  }, pageInfo)

  await popupPage.goto(`chrome-extension://${extensionId}/popup.html`)

  return popupPage
}

async function startHtmlServer(title: string, bodyText: string) {
  const server = createServer((
    _request: IncomingMessage,
    response: ServerResponse,
  ) => {
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
    response.end(`<!doctype html><html><head><title>${title}</title></head><body>${bodyText}</body></html>`)
  })

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      server.off('error', reject)
      resolve()
    })
  })

  return server
}

function getServerPort(server: Server) {
  return (server.address() as AddressInfo).port
}

async function getTabPageInfo(url: string) {
  const serviceWorker = await browser.getServiceWorker()

  return await serviceWorker.evaluate(async (targetUrl: string | undefined) => {
    const tabs = await chrome.tabs.query({})
    const targetTab = tabs.find((tab) => tab.url === targetUrl)

    if (!targetTab?.id || !targetTab.url) {
      throw new Error(`Tab not found for ${targetUrl}`)
    }

    return {
      tabId: targetTab.id,
      url: targetTab.url,
      title: targetTab.title ?? 'Untitled tab',
    }
  }, url)
}

async function closeServer(server: Server | undefined) {
  if (!server?.listening) {
    return
  }

  await new Promise<void>((resolve, reject) => {
    server.closeAllConnections()
    server.close((error) => {
      if (error) {
        reject(error)
        return
      }

      resolve()
    })
  })
}
