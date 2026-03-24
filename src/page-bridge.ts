import {
  BRIDGE_REQUEST_EVENT,
  BRIDGE_RESPONSE_EVENT,
} from './shared/constants'
import type {
  ConfigItem,
  DatasetItem,
  PageBridgeRequest,
  PageBridgeResponse,
} from './shared/types'

window.addEventListener(BRIDGE_REQUEST_EVENT, (event) => {
  const customEvent = event as CustomEvent<PageBridgeRequest>
  const request = customEvent.detail

  if (!request) {
    return
  }

  try {
    if (request.type === 'COLLECT_EXPORTABLE_ITEMS') {
      dispatchResponse({
        requestId: request.requestId,
        ok: true,
        type: 'COLLECT_EXPORTABLE_ITEMS',
        items: collectItems(request.config),
      })
      return
    }

    if (request.type === 'APPLY_IMPORT_ITEMS') {
      const result = applyItems(request.items)

      dispatchResponse({
        requestId: request.requestId,
        ok: true,
        type: 'APPLY_IMPORT_ITEMS',
        imported: result.imported,
        failed: result.failed,
      })
    }
  } catch (error) {
    dispatchResponse({
      requestId: request.requestId,
      ok: false,
      error: error instanceof Error ? error.message : '页面桥接执行失败。',
    })
  }
})

function collectItems(config: ConfigItem[]): DatasetItem[] {
  const cookies = readCookies()
  const collectedItems: DatasetItem[] = []

  config.forEach((item) => {
    if (item.storageType === 'localStorage') {
      const value = window.localStorage.getItem(item.key)

      if (value !== null) {
        collectedItems.push({
          storageType: item.storageType,
          key: item.key,
          value,
        })
      }

      return
    }

    if (item.storageType === 'sessionStorage') {
      const value = window.sessionStorage.getItem(item.key)

      if (value !== null) {
        collectedItems.push({
          storageType: item.storageType,
          key: item.key,
          value,
        })
      }

      return
    }

    const value = cookies.get(item.key)

    if (value !== undefined) {
      collectedItems.push({
        storageType: item.storageType,
        key: item.key,
        value,
      })
    }
  })

  return collectedItems
}

function applyItems(items: DatasetItem[]) {
  const failed: string[] = []
  let imported = 0

  items.forEach((item) => {
    try {
      if (item.storageType === 'localStorage') {
        window.localStorage.setItem(item.key, item.value)
      } else if (item.storageType === 'sessionStorage') {
        window.sessionStorage.setItem(item.key, item.value)
      } else {
        document.cookie = `${encodeURIComponent(item.key)}=${encodeURIComponent(item.value)}; path=/; SameSite=Lax`
      }

      imported += 1
    } catch (error) {
      failed.push(
        `${item.storageType}:${item.key} - ${
          error instanceof Error ? error.message : '写入失败'
        }`,
      )
    }
  })

  return { imported, failed }
}

function readCookies() {
  const cookieMap = new Map<string, string>()

  document.cookie
    .split(';')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .forEach((entry) => {
      const separatorIndex = entry.indexOf('=')

      if (separatorIndex === -1) {
        return
      }

      const key = decodeURIComponent(entry.slice(0, separatorIndex))
      const value = decodeURIComponent(entry.slice(separatorIndex + 1))

      cookieMap.set(key, value)
    })

  return cookieMap
}

function dispatchResponse(detail: PageBridgeResponse) {
  window.dispatchEvent(
    new CustomEvent<PageBridgeResponse>(BRIDGE_RESPONSE_EVENT, {
      detail,
    }),
  )
}
