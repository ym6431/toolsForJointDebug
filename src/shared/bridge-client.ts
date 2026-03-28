import {
  BRIDGE_REQUEST_EVENT,
  BRIDGE_RESPONSE_EVENT,
} from './constants'
import pageBridgeScript from '../page-bridge.ts?script&module'
import type {
  ConfigItem,
  DatasetItem,
  PageBridgeRequest,
  PageBridgeResponse,
} from './types'
import { createId } from './utils'

const PAGE_BRIDGE_SCRIPT_ID = 'state-migrator-page-bridge'

let pageBridgeReadyPromise: Promise<void> | null = null

function ensurePageBridgeInjected() {
  if (pageBridgeReadyPromise) {
    return pageBridgeReadyPromise
  }

  const existingScript = document.getElementById(PAGE_BRIDGE_SCRIPT_ID) as
    | HTMLScriptElement
    | null

  if (existingScript?.dataset.loaded === 'true') {
    pageBridgeReadyPromise = Promise.resolve()
    return pageBridgeReadyPromise
  }

  pageBridgeReadyPromise = new Promise((resolve, reject) => {
    const script = existingScript ?? document.createElement('script')

    const cleanup = () => {
      script.removeEventListener('load', handleLoad)
      script.removeEventListener('error', handleError)
    }

    const handleLoad = () => {
      script.dataset.loaded = 'true'
      cleanup()
      resolve()
    }

    const handleError = () => {
      cleanup()
      pageBridgeReadyPromise = null

      if (!existingScript) {
        script.remove()
      }

      reject(new Error('页面桥接脚本注入失败，请刷新页面后重试。'))
    }

    script.addEventListener('load', handleLoad, { once: true })
    script.addEventListener('error', handleError, { once: true })

    if (!existingScript) {
      script.id = PAGE_BRIDGE_SCRIPT_ID
      script.src = chrome.runtime.getURL(pageBridgeScript)
      script.type = 'module'
      ;(document.head || document.documentElement).append(script)
      return
    }

    if (script.dataset.loaded === 'true') {
      cleanup()
      resolve()
    }
  })

  return pageBridgeReadyPromise
}

export function sendBridgeRequest(payload: {
  type: 'COLLECT_EXPORTABLE_ITEMS'
  config: ConfigItem[]
}): Promise<PageBridgeResponse>
export function sendBridgeRequest(payload: {
  type: 'APPLY_IMPORT_ITEMS'
  items: DatasetItem[]
}): Promise<PageBridgeResponse>
export function sendBridgeRequest(
  payload:
    | {
        type: 'COLLECT_EXPORTABLE_ITEMS'
        config: ConfigItem[]
      }
    | {
        type: 'APPLY_IMPORT_ITEMS'
        items: DatasetItem[]
      },
): Promise<PageBridgeResponse> {
  return ensurePageBridgeInjected().then(
    () =>
      new Promise((resolve, reject) => {
        const requestId = createId()
        const timeoutId = window.setTimeout(() => {
          cleanup()
          reject(new Error('页面桥接响应超时，请刷新页面后重试。'))
        }, 5000)

        const handleResponse = (event: Event) => {
          const customEvent = event as CustomEvent<PageBridgeResponse>
          const detail = customEvent.detail

          if (!detail || detail.requestId !== requestId) {
            return
          }

          cleanup()
          resolve(detail)
        }

        const cleanup = () => {
          window.clearTimeout(timeoutId)
          window.removeEventListener(BRIDGE_RESPONSE_EVENT, handleResponse as EventListener)
        }

        window.addEventListener(
          BRIDGE_RESPONSE_EVENT,
          handleResponse as EventListener,
        )

        const detail: PageBridgeRequest =
          payload.type === 'COLLECT_EXPORTABLE_ITEMS'
            ? {
                requestId,
                type: payload.type,
                config: payload.config,
              }
            : {
                requestId,
                type: payload.type,
                items: payload.items,
              }

        const event = new CustomEvent<PageBridgeRequest>(BRIDGE_REQUEST_EVENT, {
          detail,
        })

        window.dispatchEvent(event)
      }),
  )
}
