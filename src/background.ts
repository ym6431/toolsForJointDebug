import {
  buildCookieSetDetails,
  isCookieItem,
  toCookieMetadata,
} from './shared/cookie-utils'
import { ensureStorageInitialized } from './shared/storage'
import type {
  BackgroundMessage,
  DatasetItem,
  LocalhostTarget,
  PageInfo,
} from './shared/types'
import { buildLocalhostUrl } from './shared/utils'

chrome.runtime.onInstalled.addListener(() => {
  void ensureStorageInitialized()
})

chrome.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
  const payload = message as BackgroundMessage

  if (payload.type === 'GET_ACTIVE_TAB') {
    void getActiveTab()
      .then((pageInfo) => sendResponse(pageInfo))
      .catch((error: unknown) => {
        sendResponse({
          error:
            error instanceof Error ? error.message : '无法获取当前活动标签页。',
        })
      })

    return true
  }

  if (payload.type === 'OPEN_OPTIONS_PAGE') {
    void chrome.runtime.openOptionsPage()
      .then(() => sendResponse({ ok: true }))
      .catch((error: unknown) => {
        sendResponse({
          error:
            error instanceof Error ? error.message : '无法打开配置页面。',
        })
      })

    return true
  }

  if (payload.type === 'RELOAD_TAB') {
    void chrome.tabs
      .reload(payload.tabId)
      .then(() => sendResponse({ ok: true }))
      .catch((error: unknown) => {
        sendResponse({
          error: error instanceof Error ? error.message : '页面刷新失败。',
        })
      })

    return true
  }

  if (payload.type === 'READ_COOKIES') {
    void readCookies(payload.url, payload.keys)
      .then((items) => sendResponse({ items }))
      .catch((error: unknown) => {
        sendResponse({
          error: error instanceof Error ? error.message : '读取 Cookie 失败。',
        })
      })

    return true
  }

  if (payload.type === 'APPLY_COOKIES_TO_URL') {
    void applyCookiesToUrl(payload.url, payload.items)
      .then((result) => sendResponse(result))
      .catch((error: unknown) => {
        sendResponse({
          error: error instanceof Error ? error.message : '写入 Cookie 失败。',
        })
      })

    return true
  }

  if (payload.type === 'OPEN_LOCALHOST_AND_APPLY_ITEMS') {
    void openLocalhostAndApplyItems(payload.target, payload.items)
      .then((result) => sendResponse(result))
      .catch((error: unknown) => {
        sendResponse({
          error:
            error instanceof Error ? error.message : '打开并注入 localhost 页面失败。',
        })
      })

    return true
  }

  return false
})

async function getActiveTab(): Promise<PageInfo> {
  const tab = await getCurrentActiveTab()

  if (!tab?.id || !tab.url) {
    throw new Error('当前窗口没有可访问的活动页面。')
  }

  return {
    tabId: tab.id,
    url: tab.url,
    title: tab.title ?? 'Untitled tab',
  }
}

async function getCurrentActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })

  return tab
}

async function readCookies(url: string, keys: string[]): Promise<DatasetItem[]> {
  const targetKeys = new Set(keys)
  const cookies = await chrome.cookies.getAll({ url })
  const cookieMap = new Map<string, chrome.cookies.Cookie>()

  cookies.forEach((cookie) => {
    if (!targetKeys.has(cookie.name) || cookieMap.has(cookie.name)) {
      return
    }

    cookieMap.set(cookie.name, cookie)
  })

  return keys.flatMap((key) => {
    const cookie = cookieMap.get(key)

    return cookie === undefined
      ? []
      : [
          {
            storageType: 'cookie' as const,
            key,
            value: cookie.value,
            cookie: toCookieMetadata(cookie),
          },
        ]
  })
}

async function openLocalhostAndApplyItems(target: LocalhostTarget, items: DatasetItem[]) {
  const targetUrl = buildLocalhostUrl(target)
  const cookieItems = items.filter(isCookieItem)
  const storageItems = items.filter((item) => !isCookieItem(item))
  const cookieResult = cookieItems.length > 0
    ? await applyCookiesToUrl(targetUrl, cookieItems)
    : { imported: 0, failed: [] }
  const activeTab = await getCurrentActiveTab()

  if (!activeTab) {
    throw new Error('当前窗口没有可访问的活动页面。')
  }

  const tab = await chrome.tabs.create({
    url: targetUrl,
    active: true,
    index: activeTab.index + 1,
  })

  if (!tab.id) {
    throw new Error('无法打开 localhost 目标页。')
  }

  if (storageItems.length === 0) {
    return buildLocalhostApplyResult({
      targetUrl,
      imported: cookieResult.imported,
      failed: cookieResult.failed,
      refreshed: false,
      allItemsWereCookies: cookieItems.length > 0,
    })
  }

  try {
    const response = await tryApplyItemsToTab(tab.id, storageItems)
    const imported = cookieResult.imported + response.imported
    const failed = [...cookieResult.failed, ...response.failed]
    const refreshed = response.imported > 0
      ? await refreshInjectedTab(tab.id)
      : false

    return buildLocalhostApplyResult({
      targetUrl,
      imported,
      failed,
      refreshed,
      allItemsWereCookies: false,
    })
  } catch (error) {
    const failed = [
      ...cookieResult.failed,
      ...storageItems.map(
        (item) =>
          `${item.storageType}:${item.key} - ${
            error instanceof Error ? error.message : '写入失败'
          }`,
      ),
    ]

    return {
      ok: false,
      message:
        cookieResult.imported > 0
          ? `已预先注入 ${cookieResult.imported} 个 cookie 并打开 ${targetUrl}，但页面侧状态注入失败。`
          : `已打开 ${targetUrl}，但页面侧状态注入失败。`,
      details: failed,
    }
  }
}

function buildLocalhostApplyResult(options: {
  targetUrl: string
  imported: number
  failed: string[]
  refreshed: boolean
  allItemsWereCookies: boolean
}) {
  const refreshMessage = options.refreshed
    ? '页面已刷新以重新触发生命周期。'
    : ''
  const successMessage = options.allItemsWereCookies
    ? `已预先注入 ${options.imported} 个 cookie，并打开 ${options.targetUrl}。`
    : `已打开 ${options.targetUrl}，并成功注入 ${options.imported} 项。`
  const partialMessage = options.allItemsWereCookies
    ? `已打开 ${options.targetUrl}，成功预先注入 ${options.imported} 个 cookie，另有 ${options.failed.length} 个失败。`
    : `已打开 ${options.targetUrl}，成功注入 ${options.imported} 项，另有 ${options.failed.length} 项失败。`

  return {
    ok: options.failed.length === 0,
    message:
      options.failed.length === 0
        ? `${successMessage}${refreshMessage}`
        : `${partialMessage}${refreshMessage}`,
    details: options.failed.length > 0 ? options.failed : undefined,
  }
}

async function tryApplyItemsToTab(tabId: number, items: DatasetItem[]) {
  const maxAttempts = 20

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      const response = (await chrome.tabs.sendMessage(tabId, {
        type: 'APPLY_IMPORT_ITEMS',
        items,
      })) as { imported?: number; failed?: string[]; error?: string }

      if (response.error) {
        throw new Error(response.error)
      }

      return {
        imported: response.imported ?? 0,
        failed: response.failed ?? [],
      }
    } catch (error) {
      if (attempt === maxAttempts - 1) {
        throw error
      }

      await sleep(500)
    }
  }

  throw new Error('localhost 页面状态注入超时。')
}

async function applyCookiesToUrl(url: string, items: DatasetItem[]) {
  let imported = 0
  const failed: string[] = []

  for (const item of items) {
    if (!isCookieItem(item)) {
      continue
    }

    try {
      const cookie = await chrome.cookies.set(buildCookieSetDetails(url, item))

      if (cookie) {
        imported += 1
      } else {
        failed.push(`cookie:${item.key} - 浏览器未返回写入结果。`)
      }
    } catch (error) {
      failed.push(
        `cookie:${item.key} - ${
          error instanceof Error ? error.message : '写入失败'
        }`,
      )
    }
  }

  return { imported, failed }
}

async function refreshInjectedTab(tabId: number) {
  try {
    await chrome.tabs.reload(tabId)
    return true
  } catch {
    return false
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}
