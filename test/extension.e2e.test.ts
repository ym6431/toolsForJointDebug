import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from 'node:http'
import type { AddressInfo } from 'node:net'
import { expect, test } from 'vitest'

const STORAGE_KEYS = {
  datasets: 'datasets',
  customConfig: 'customConfig',
  localhostPorts: 'localhostPorts',
  defaultLocalhostPort: 'defaultLocalhostPort',
} as const

type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS]
type StorageRecord = Record<string, unknown>

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
  await setExtensionStorage({
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
    await popupPage.getByRole('heading', { name: '页面状态迁移' }).isVisible(),
  ).toBe(true)
  expect(
    await popupPage.getByRole('button', { name: '配置', exact: true }).isVisible(),
  ).toBe(true)

  await popupPage.close()
})

test('popup 导入预览应展示 cookie 元信息', async () => {
  await setExtensionStorage({
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
  await popupPage.getByRole('button', { name: '导入模式' }).click()

  const cookieMeta = popupPage.locator('.cookie-meta').first()

  expect(
    await popupPage.getByText('Cookie dataset', { exact: true }).first().isVisible(),
  ).toBe(true)
  expect(await popupPage.getByText('locale', { exact: true }).first().isVisible()).toBe(
    true,
  )
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
    await optionsPage.getByRole('heading', { name: '迁移 Key 配置' }).isVisible(),
  ).toBe(true)

  const draftStorageType = optionsPage.locator('app-select select').first()
  const draftInputs = optionsPage.locator('app-input input')

  await draftStorageType.selectOption('cookie')
  await draftInputs.nth(0).fill('locale')
  await draftInputs.nth(1).fill('语言 Cookie')
  await optionsPage.getByRole('button', { name: '加入列表', exact: true }).click()

  await draftInputs.nth(2).fill('5173')
  await optionsPage.getByRole('button', { name: '加入端口列表', exact: true }).click()
  await optionsPage.getByRole('button', { name: '保存全部配置', exact: true }).click()

  expect(await optionsPage.getByText('配置已保存。').isVisible()).toBe(true)
  expect(await optionsPage.getByText('localhost:5173').isVisible()).toBe(true)

  const storageState = await optionsPage.evaluate(async (keys) => {
    return await chrome.storage.local.get(keys)
  }, [
    STORAGE_KEYS.customConfig,
    STORAGE_KEYS.localhostPorts,
    STORAGE_KEYS.defaultLocalhostPort,
  ])

  expect(storageState[STORAGE_KEYS.customConfig]).toEqual([
    {
      storageType: 'cookie',
      key: 'locale',
      description: '语言 Cookie',
    },
  ])
  expect(storageState[STORAGE_KEYS.localhostPorts]).toEqual(['5173'])
  expect(storageState[STORAGE_KEYS.defaultLocalhostPort]).toBe('5173')

  await optionsPage.close()
})

test('popup 导出模式应加载已保存的默认 localhost 端口', async () => {
  await setExtensionStorage({
    [STORAGE_KEYS.localhostPorts]: ['5173', '3000'],
    [STORAGE_KEYS.defaultLocalhostPort]: '3000',
  })

  const popupPage = await browser.getPopupPage()

  await popupPage.waitForLoadState('domcontentloaded')

  const exportPanels = popupPage.locator('popup-export-panel .panel')
  expect(await exportPanels.nth(0).getByRole('button', { name: '保存选中项为数据集' }).isVisible()).toBe(true)
  expect(
    await exportPanels.nth(1).getByRole('button', { name: '重新扫描可导出项' }).isVisible(),
  ).toBe(true)

  expect(
    await popupPage
      .getByRole('button', { name: '保存并注入到 localhost:3000' })
      .isVisible(),
  ).toBe(true)

  const portSelect = popupPage.locator('app-select select').first()
  await portSelect.selectOption('5173')

  expect(
    await popupPage
      .getByRole('button', { name: '保存并注入到 localhost:5173' })
      .isVisible(),
  ).toBe(true)

  const storedDefaultPort = await popupPage.evaluate(async (key: StorageKey) => {
    const result = await chrome.storage.local.get(key)

    return result[key]
  }, STORAGE_KEYS.defaultLocalhostPort)

  expect(storedDefaultPort).toBe('5173')

  await popupPage.close()
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
    await setExtensionStorage({
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
    await exportPopup.getByRole('button', { name: '导出模式' }).click()
    expect(await exportPopup.getByText(sourceUrl, { exact: true }).isVisible()).toBe(true)

    await exportPopup.getByText('已扫描到 1 个可导出项。').waitFor()
    expect(await exportPopup.getByText('已扫描到 1 个可导出项。').isVisible()).toBe(true)
    expect(await exportPopup.getByText(cookieName, { exact: true }).isVisible()).toBe(true)

    const exportedCookieMeta = exportPopup.locator('.cookie-meta').first()
    expect(await exportedCookieMeta.textContent()).toContain('HttpOnly')
    expect(await exportedCookieMeta.textContent()).toContain('HostOnly')
    expect(await exportedCookieMeta.textContent()).toContain('SameSite=Strict')
    expect(await exportedCookieMeta.textContent()).toContain('Expires=')

    await exportPopup.getByRole('button', { name: '保存选中项为数据集' }).click()
    expect(await exportPopup.getByText('已保存数据集“Imported from 127.0.0.1”。').isVisible()).toBe(
      true,
    )
    await exportPopup.close()
    exportPopup = null

    targetPage = await context.newPage()
    await targetPage.goto(targetUrl)
    importPopup = await openPopupPageForTab(targetUrl)
    await importPopup.waitForLoadState('domcontentloaded')
    expect(await importPopup.getByText(targetUrl, { exact: true }).isVisible()).toBe(true)
    expect(await importPopup.getByRole('button', { name: '导入模式' }).isVisible()).toBe(true)
    expect(await importPopup.getByText(cookieName, { exact: true }).isVisible()).toBe(true)

    await importPopup.getByRole('button', { name: '确认导入选中项' }).click()
    expect(await importPopup.getByText('成功导入 1 项。').isVisible()).toBe(true)

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

async function setExtensionStorage(items: StorageRecord) {
  const serviceWorker = await browser.getServiceWorker()

  await serviceWorker.evaluate(async (payload: StorageRecord) => {
    await chrome.storage.local.clear()
    await chrome.storage.local.set(payload)
  }, items)
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
