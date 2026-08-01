import { mkdir } from 'node:fs/promises'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { fileURLToPath } from 'node:url'
import { test } from 'vitest'
import { setExtensionIndexedDbState } from './extension-indexeddb-state'

const EVIDENCE_DIR = fileURLToPath(
  new URL('../.omo/evidence/google-play-material/', import.meta.url),
)
const VIEWPORTS = [375, 768, 1280] as const
const COLOR_SCHEMES = ['light', 'dark'] as const

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

  await setExtensionIndexedDbState({
    datasets: [{
      id: 'visual-dataset',
      datasetName: '结算页调试状态',
      sourceUrl,
      createdAt: '2026-08-01T12:00:00.000Z',
      items: stateItems,
    }],
    customConfig: stateItems.map((item) => ({
      storageType: item.storageType,
      key: item.key,
      description: `${item.key} 调试配置`,
    })),
    localhostPorts: [
      { protocol: 'http', port: '5173' },
      { protocol: 'https', port: '3000' },
    ],
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
  await popupPage.getByRole('button', { name: '导出模式' }).click()
  await popupPage.getByText(/已扫描到 \d+ 个可导出项。/).waitFor()
  const extensionId = await browser.getExtensionId()
  const optionsPage = await context.newPage()
  await optionsPage.goto(`chrome-extension://${extensionId}/options.html`)

  try {
    for (const colorScheme of COLOR_SCHEMES) {
      await popupPage.emulateMedia({ colorScheme })
      await optionsPage.emulateMedia({ colorScheme })

      for (const width of VIEWPORTS) {
        await popupPage.setViewportSize({ width, height: 900 })
        await popupPage.getByRole('button', { name: '导出模式' }).click()
        await popupPage.getByText(/已扫描到 \d+ 个可导出项。/).waitFor()
        const exportDetails = popupPage.locator('popup-export-panel app-disclosure details').first()
        await exportDetails.evaluate((details) => details.removeAttribute('open'))
        await capture(popupPage, `popup-export-collapsed-${colorScheme}-${width}.png`)
        const exportSummary = popupPage.locator('popup-export-panel app-disclosure summary').first()
        await exportSummary.focus()
        await popupPage.keyboard.press('Enter')
        await capture(popupPage, `popup-export-open-${colorScheme}-${width}.png`)

        await popupPage.getByRole('button', { name: '导入模式' }).click()
        await capture(popupPage, `popup-import-collapsed-${colorScheme}-${width}.png`)
        const importSummary = popupPage.locator('popup-import-panel app-disclosure summary').first()
        await importSummary.focus()
        await popupPage.keyboard.press('Enter')
        await capture(popupPage, `popup-import-open-${colorScheme}-${width}.png`)

        await optionsPage.setViewportSize({ width, height: 900 })
        await capture(optionsPage, `options-${colorScheme}-${width}.png`)
      }
    }
  } finally {
    await optionsPage.close()
    await popupPage.close()
    await sourcePage.close()
  }
})

async function capture(page: Awaited<ReturnType<typeof context.newPage>>, filename: string) {
  await page.screenshot({
    path: `${EVIDENCE_DIR}/${filename}`,
    fullPage: true,
  })
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
