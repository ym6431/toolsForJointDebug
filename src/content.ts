import { sendBridgeRequest } from './shared/bridge-client'
import type {
  ConfigItem,
  ContentMessage,
  DatasetItem,
  ExportScanResponse,
  ImportApplyResponse,
} from './shared/types'

chrome.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
  const payload = message as ContentMessage

  if (payload.type === 'COLLECT_EXPORTABLE_ITEMS') {
    void collectExportableItems(payload.config)
      .then((result) => sendResponse(result))
      .catch((error: unknown) => {
        sendResponse({
          error: error instanceof Error ? error.message : '读取页面状态失败。',
        })
      })

    return true
  }

  if (payload.type === 'APPLY_IMPORT_ITEMS') {
    void applyImportItems(payload.items)
      .then((result) => sendResponse(result))
      .catch((error: unknown) => {
        sendResponse({
          error: error instanceof Error ? error.message : '写入页面状态失败。',
        })
      })

    return true
  }

  return false
})

async function collectExportableItems(
  config: ConfigItem[],
): Promise<ExportScanResponse> {
  const response = await sendBridgeRequest({
    type: 'COLLECT_EXPORTABLE_ITEMS',
    config,
  })

  if (!response.ok || response.type !== 'COLLECT_EXPORTABLE_ITEMS') {
    throw new Error(response.ok ? '页面返回了未知的读取结果。' : response.error)
  }

  return { items: response.items }
}

async function applyImportItems(
  items: DatasetItem[],
): Promise<ImportApplyResponse> {
  const response = await sendBridgeRequest({
    type: 'APPLY_IMPORT_ITEMS',
    items,
  })

  if (!response.ok || response.type !== 'APPLY_IMPORT_ITEMS') {
    throw new Error(response.ok ? '页面返回了未知的写入结果。' : response.error)
  }

  return {
    imported: response.imported,
    failed: response.failed,
  }
}
