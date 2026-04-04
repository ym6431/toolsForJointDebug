import {
  buildCookieSetDetails,
  isCookieItem,
  toCookieMetadata,
} from './shared/cookie-utils'
import { ensureStorageInitialized } from './shared/storage'
import type { BackgroundMessage, DatasetItem, PageInfo } from './shared/types'

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
    void openLocalhostAndApplyItems(payload.port, payload.items)
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
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })

  if (!tab?.id || !tab.url) {
    throw new Error('当前窗口没有可访问的活动页面。')
  }

  return {
    tabId: tab.id,
    url: tab.url,
    title: tab.title ?? 'Untitled tab',
  }
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

async function openLocalhostAndApplyItems(port: string, items: DatasetItem[]) {
  const targetUrl = `http://localhost:${port}/`
  const tab = await chrome.tabs.create({
    url: targetUrl,
    active: true,
  })

  if (!tab.id) {
    throw new Error('无法打开 localhost 目标页。')
  }

  try {
    const response = await tryApplyItemsToTab(tab.id, items)
    const refreshed = response.imported > 0
      ? await refreshInjectedTab(tab.id)
      : false

    return {
      ok: response.failed.length === 0,
      message:
        response.failed.length === 0
          ? `已打开 ${targetUrl}，并成功注入 ${response.imported} 项。${refreshed ? '页面已刷新以重新触发生命周期。' : ''}`
          : `已打开 ${targetUrl}，成功注入 ${response.imported} 项，另有 ${response.failed.length} 项失败。${refreshed ? '页面已刷新以重新触发生命周期。' : ''}`,
    }
  } catch {
    const cookieItems = items.filter((item) => item.storageType === 'cookie')

    if (cookieItems.length === 0) {
      return {
        ok: false,
        message: `已打开 ${targetUrl}，但页面未能完成状态注入，且当前没有可回退注入的 cookie。`,
      }
    }

    const cookieResult = await applyCookiesToUrl(targetUrl, cookieItems)
    const refreshed = cookieResult.imported > 0
      ? await refreshInjectedTab(tab.id)
      : false

    return {
      ok: cookieResult.imported > 0 && cookieResult.failed.length === 0,
      message:
        cookieResult.imported > 0
          ? cookieResult.failed.length === 0
            ? `已打开 ${targetUrl}。页面侧存储注入不可用，已回退注入 ${cookieResult.imported} 个 cookie。${refreshed ? '页面已刷新以重新触发生命周期。' : ''}`
            : `已打开 ${targetUrl}。页面侧存储注入不可用，已回退注入 ${cookieResult.imported} 个 cookie，另有 ${cookieResult.failed.length} 个失败。${refreshed ? '页面已刷新以重新触发生命周期。' : ''}`
          : `已打开 ${targetUrl}，但页面侧存储注入不可用，cookie 回退注入也未成功。`,
      details: cookieResult.failed,
    }
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
