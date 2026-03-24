import { ensureStorageInitialized } from './shared/storage'
import type { BackgroundMessage, PageInfo } from './shared/types'

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
