import { mkdir } from 'node:fs/promises'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { fileURLToPath } from 'node:url'
import { expect, test } from 'vitest'
import type { ConfigItem, LocalhostTarget } from '../src/shared/types'
import { setExtensionIndexedDbState } from './extension-indexeddb-state'

const EVIDENCE_DIR = fileURLToPath(
  new URL('../.omo/evidence/google-play-material/', import.meta.url),
)
const POPUP_VIEWPORTS = [375, 768, 1280] as const
const OPTIONS_VIEWPORTS = [375, 768, 1024, 1280, 1440] as const
const COLOR_SCHEMES = ['light', 'dark'] as const
const NARROW_OPTIONS_VIEWPORT = 1024
const TOOLBAR_ACTIONS = [
  ['options-export-config-button', '导出配置'],
  ['options-import-merge-button', '追加合并导入'],
  ['options-import-replace-button', '覆盖导入'],
  ['options-save-all-button', '保存全部配置'],
  ['options-clear-all-button', '清空全部配置'],
] as const
const OPTIONS_CJK_GLYPHS = ['迁', '移', '配', '置', '按', '或', '说', '明', '筛', '选'] as const

type ExtensionPage = Awaited<ReturnType<typeof context.newPage>>

let server: Server
let sourceUrl = ''

test.beforeAll(async () => {
  await mkdir(EVIDENCE_DIR, { recursive: true })
  server = createServer((_request, response) => {
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
    response.end('<!doctype html><html><head><title>Visual QA Source</title></head><body>visual qa</body></html>')
  })

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      server.off('error', reject)
      resolve()
    })
  })

  sourceUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/`
})

test.afterAll(async () => {
  await new Promise<void>((resolve, reject) => {
    server.closeAllConnections()
    server.close((error) => error ? reject(error) : resolve())
  })
})

test('视觉 QA 应覆盖 popup 和 options 的主题、断点与折叠状态', { timeout: 120_000 }, async () => {
  const stateItems = [
    { storageType: 'localStorage' as const, key: 'theme', value: 'material-green' },
    { storageType: 'sessionStorage' as const, key: 'workspace', value: 'checkout-debug' },
    {
      storageType: 'cookie' as const,
      key: 'locale',
      value: 'zh-CN',
      cookie: {
        domain: '127.0.0.1',
        hostOnly: true,
        path: '/',
        secure: false,
        httpOnly: false,
        sameSite: 'lax' as const,
        session: true,
      },
    },
  ]
  const migrationConfig: ConfigItem[] = [
    { storageType: 'localStorage', key: 'theme', description: '主题调试配置' },
    { storageType: 'sessionStorage', key: 'workspace', description: '工作区调试配置' },
    { storageType: 'cookie', key: 'locale', description: '语言调试配置' },
    { storageType: 'localStorage', key: 'featureFlags', description: '功能开关' },
    { storageType: 'sessionStorage', key: 'checkoutStep', description: '结算步骤' },
    { storageType: 'cookie', key: 'experimentGroup', description: '实验分组' },
    { storageType: 'localStorage', key: 'navigationState', description: '导航状态' },
    { storageType: 'sessionStorage', key: 'searchFilters', description: '搜索筛选' },
    { storageType: 'cookie', key: 'timezone', description: '时区偏好' },
    { storageType: 'localStorage', key: 'dashboardLayout', description: '仪表盘布局' },
    { storageType: 'sessionStorage', key: 'previewMode', description: '预览模式' },
    { storageType: 'cookie', key: 'density', description: '列表密度' },
  ]
  const localhostTargets: LocalhostTarget[] = [
    { protocol: 'http', port: '5173' },
    { protocol: 'https', port: '3000' },
    { protocol: 'http', port: '4173' },
    { protocol: 'https', port: '8080' },
  ]

  await setExtensionIndexedDbState({
    datasets: [{
      id: 'visual-dataset',
      datasetName: '结算页调试状态',
      sourceUrl,
      createdAt: '2026-08-01T12:00:00.000Z',
      items: stateItems,
    }],
    customConfig: migrationConfig,
    localhostPorts: localhostTargets,
    defaultLocalhostPort: 'http:5173',
  })

  const sourcePage = await context.newPage()
  await sourcePage.goto(sourceUrl)
  await sourcePage.evaluate(() => {
    localStorage.setItem('theme', 'material-green')
    sessionStorage.setItem('workspace', 'checkout-debug')
    document.cookie = 'locale=zh-CN; Path=/; SameSite=Lax'
  })
  const popupPage = await openPopupPageForTab(sourceUrl)
  await popupPage.locator('[data-test-id="popup-mode-export-button"]').click()
  await popupPage.locator('[data-test-id="popup-result-message"]').waitFor()
  const extensionId = await browser.getExtensionId()
  const optionsPage = await context.newPage()
  await optionsPage.goto(`chrome-extension://${extensionId}/options.html`)
  expect(await optionsPage.locator('[data-test-id="options-config-row"]').count()).toBe(12)

  try {
    for (const colorScheme of COLOR_SCHEMES) {
      await popupPage.emulateMedia({ colorScheme, reducedMotion: 'no-preference' })
      await optionsPage.emulateMedia({ colorScheme, reducedMotion: 'no-preference' })
      await assertOptionsCjkGlyphCoverage(optionsPage)

      for (const width of POPUP_VIEWPORTS) {
        await popupPage.setViewportSize({ width, height: 900 })
        await popupPage.locator('[data-test-id="popup-mode-export-button"]').click()
        await popupPage.locator('[data-test-id="popup-result-message"]').waitFor()
        const exportDetails = popupPage.locator('[data-test-id="export-items-disclosure-details"]')
        await exportDetails.evaluate((details) => details.removeAttribute('open'))
        await capture(popupPage, `popup-export-collapsed-${colorScheme}-${width}.png`)
        const exportSummary = popupPage.locator('[data-test-id="export-items-disclosure-details-summary"]')
        await exportSummary.focus()
        await popupPage.keyboard.press('Enter')
        await capture(popupPage, `popup-export-open-${colorScheme}-${width}.png`)

        await popupPage.locator('[data-test-id="popup-mode-import-button"]').click()
        await capture(popupPage, `popup-import-collapsed-${colorScheme}-${width}.png`)
        const importSummary = popupPage.locator('[data-test-id="import-preview-disclosure-details-summary"]')
        await importSummary.focus()
        await popupPage.keyboard.press('Enter')
        await capture(popupPage, `popup-import-open-${colorScheme}-${width}.png`)
      }

      for (const width of OPTIONS_VIEWPORTS) {
        await optionsPage.setViewportSize({ width, height: 900 })
        if (width === 1280 || width === 1440) {
          await assertWideOptionsLayout(optionsPage)
        }
        if (width === 1440) {
          await assertInitialOptionsDensity(optionsPage)
        }
        if (width === NARROW_OPTIONS_VIEWPORT) {
          await assertNarrowOptionsFallback(optionsPage)
        }
        await capture(optionsPage, `options-${colorScheme}-${width}.png`, width !== 1440)
      }

      await optionsPage.emulateMedia({ colorScheme, reducedMotion: 'reduce' })
      await assertReducedMotion(optionsPage)
    }
  } finally {
    await optionsPage.close()
    await popupPage.close()
    await sourcePage.close()
  }
})

async function capture(page: ExtensionPage, filename: string, fullPage = true) {
  await page.screenshot({
    path: `${EVIDENCE_DIR}/${filename}`,
    fullPage,
  })
}

async function assertWideOptionsLayout(page: ExtensionPage): Promise<void> {
  await expectToolbarActionsVisible(page)
  const rows = page.locator('[data-test-id="options-config-row"]')
  expect(await rows.count()).toBe(12)
  expect(await page.locator('[data-test-id="options-localhost-target-label"]').count()).toBe(4)
  expect(await page.locator('[data-test-id="options-localhost-default-button"]').count()).toBe(3)
  expect(await page.locator('[data-test-id="options-localhost-delete-button"]').count()).toBe(4)

  expect(await rows.evaluateAll((elements) => elements.every((row) => {
    const rowBox = row.getBoundingClientRect()
    return Array.from(row.querySelectorAll('app-select, app-input, button')).every((control) => {
      const controlBox = control.getBoundingClientRect()
      return controlBox.left >= rowBox.left
        && controlBox.right <= rowBox.right
        && controlBox.top >= rowBox.top
        && controlBox.bottom <= rowBox.bottom
    })
  }))).toBe(true)

  const listMetrics = await page.locator('[data-test-id="options-config-row-list"]').evaluate((list) => ({
    clientHeight: list.clientHeight, clientWidth: list.clientWidth,
    overflowY: getComputedStyle(list).overflowY, scrollHeight: list.scrollHeight, scrollWidth: list.scrollWidth,
  }))
  expect(listMetrics.clientHeight).toBeGreaterThan(0)
  expect(listMetrics.overflowY).toBe('visible')
  expect(listMetrics.scrollHeight).toBe(listMetrics.clientHeight)
  expect(listMetrics.scrollWidth).toBeLessThanOrEqual(listMetrics.clientWidth)
  const filter = page.locator('[data-test-id="options-filter-input"]')
  const firstRow = rows.first()
  expect(await filter.isVisible()).toBe(true)
  expect(await filter.getAttribute('aria-label')).toBe('筛选配置')
  expect(await firstRow.locator('[data-test-id="options-config-row-storage-type"]').getAttribute('aria-label')).toBe('迁移 Key 1 的 Storage 类型')
  expect(await firstRow.locator('[data-test-id="options-config-row-key-input"]').getAttribute('aria-label')).toBe('迁移 Key 1 的 Key')
  expect(await firstRow.locator('[data-test-id="options-config-row-description-input"]').getAttribute('aria-label')).toBe('迁移 Key 1 的说明')
  await expectNoHorizontalOverflow(page)

  const exportButton = page.locator('[data-test-id="options-export-config-button"]')
  const mergeButton = page.locator('[data-test-id="options-import-merge-button"]')
  await exportButton.focus()
  await page.keyboard.press('Tab')
  expect(await mergeButton.evaluate((button) => button.matches(':focus'))).toBe(true)
  expect(await mergeButton.evaluate((button) => button.matches(':focus-visible')
    && getComputedStyle(button).outlineStyle !== 'none')).toBe(true)
}

async function assertInitialOptionsDensity(page: ExtensionPage): Promise<void> {
  expect(await page.evaluate(() => window.scrollY)).toBe(0)
  const requiredElements = page.locator([
    '[data-test-id="options-toolbar"]',
    '[data-test-id="options-localhost-strip"]',
    '[data-test-id="options-config-row"]',
    '[data-test-id="options-config-composer"]',
    'button[data-test-id]',
  ].join(', '))

  const outOfViewportElements = await requiredElements.evaluateAll((elements) => elements.map((element) => {
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
}

async function assertOptionsCjkGlyphCoverage(page: ExtensionPage): Promise<void> {
  const missingGlyphs = await page.evaluate(async (glyphs) => {
    const font = '48px "State Migrator CJK"'
    const unsupportedGlyph = String.fromCodePoint(0x10FFFF)
    await document.fonts.load(font, glyphs.join(''))

    const pixelsFor = (glyph: string) => {
      const canvas = document.createElement('canvas')
      canvas.width = 72
      canvas.height = 72
      const context = canvas.getContext('2d')
      if (!context) {
        throw new Error('Canvas 2D context is unavailable for CJK glyph coverage.')
      }

      context.font = font
      context.fillStyle = '#000'
      context.fillText(glyph, 8, 56)
      return context.getImageData(0, 0, canvas.width, canvas.height).data
    }

    const unsupportedPixels = pixelsFor(unsupportedGlyph)
    return glyphs.filter((glyph) => {
      const glyphPixels = pixelsFor(glyph)
      return glyphPixels.every((pixel, index) => pixel === unsupportedPixels[index])
    })
  }, OPTIONS_CJK_GLYPHS)

  expect(missingGlyphs).toEqual([])
}

async function assertNarrowOptionsFallback(page: ExtensionPage): Promise<void> {
  await expectToolbarActionsVisible(page)
  expect(await page.locator('[data-test-id="options-filter-input"]').isVisible()).toBe(true)
  expect(await page.locator('[data-test-id="options-add-localhost-button"]').isVisible()).toBe(true)
  expect(await page.locator('[data-test-id="options-add-config-button"]').isVisible()).toBe(true)
  expect(await page.locator('[data-test-id="options-localhost-default-button"]').first().isVisible()).toBe(true)
  expect(await page.locator('[data-test-id="options-config-row-delete-button"]').first().isVisible()).toBe(true)
  expect(await page.locator('[data-test-id="options-localhost-delete-button"]').first().isVisible()).toBe(true)
  expect(await page.locator('button[data-test-id]')
    .evaluateAll((buttons) => buttons.every((button) => button.getBoundingClientRect().height >= 40))).toBe(true)
  await expectNoHorizontalOverflow(page)
}

async function assertReducedMotion(page: ExtensionPage): Promise<void> {
  const motion = await page.locator('[data-test-id="options-save-all-button"]').evaluate((button) => ({ prefersReducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches, transitionDuration: getComputedStyle(button).transitionDuration }))
  expect(motion.prefersReducedMotion).toBe(true)
  expect(motion.transitionDuration).toMatch(/^(?:0\.01ms|1e-05s)(?:, (?:0\.01ms|1e-05s))*$/)
}

async function expectToolbarActionsVisible(page: ExtensionPage): Promise<void> {
  for (const [testId, name] of TOOLBAR_ACTIONS) {
    const button = page.locator(`[data-test-id="${testId}"]`)
    expect(await button.isVisible()).toBe(true)
    expect((await button.textContent())?.trim()).toBe(name)
  }
}

async function expectNoHorizontalOverflow(page: ExtensionPage): Promise<void> {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
}

async function openPopupPageForTab(url: string) {
  const extensionId = await browser.getExtensionId()
  const popupPage = await context.newPage()
  const serviceWorker = await browser.getServiceWorker()
  const activeTab = await serviceWorker.evaluate(async (targetUrl: string | undefined) => {
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

  await popupPage.addInitScript((pageInfo) => {
    const originalSendMessage = chrome.runtime.sendMessage.bind(chrome.runtime)

    chrome.runtime.sendMessage = (async (message: unknown) => {
      if (
        message
        && typeof message === 'object'
        && 'type' in message
        && message.type === 'GET_ACTIVE_TAB'
      ) {
        return pageInfo
      }

      return await originalSendMessage(message as never)
    }) as typeof chrome.runtime.sendMessage
  }, activeTab)

  await popupPage.goto(`chrome-extension://${extensionId}/popup.html`)

  return popupPage
}
