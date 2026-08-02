import { sendBridgeRequest } from './shared/bridge-client'
import type {
  ConfigItem,
  DatasetItem,
  ExportScanResponse,
  ImportApplyResponse,
} from './shared/types'
import { isContentMessage } from './shared/types'

chrome.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
  if (!isContentMessage(message)) {
    return false
  }

  if (message.type === 'COLLECT_EXPORTABLE_ITEMS') {
    void collectExportableItems(message.config)
      .then((result) => sendResponse(result))
      .catch((error: unknown) => {
        sendResponse({
          error: error instanceof Error ? error.message : '读取页面状态失败。',
        })
      })

    return true
  }

  if (message.type === 'APPLY_IMPORT_ITEMS') {
    void applyImportItems(message.items)
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
  const storageConfig = config.filter((item) => item.storageType !== 'cookie')

  return {
    items: await collectStorageItems(storageConfig),
  }
}

async function applyImportItems(
  items: DatasetItem[],
): Promise<ImportApplyResponse> {
  const storageItems = items.filter((item) => item.storageType !== 'cookie')

  if (storageItems.length === 0) {
    return { imported: 0, failed: [] }
  }

  const response = await sendBridgeRequest({
    type: 'APPLY_IMPORT_ITEMS',
    items: storageItems,
  })

  if (!response.ok || response.type !== 'APPLY_IMPORT_ITEMS') {
    throw new Error(response.ok ? '页面返回了未知的写入结果。' : response.error)
  }

  return {
    imported: response.imported,
    failed: response.failed,
  }
}

async function collectStorageItems(config: ConfigItem[]): Promise<DatasetItem[]> {
  if (config.length === 0) {
    return []
  }

  const response = await sendBridgeRequest({
    type: 'COLLECT_EXPORTABLE_ITEMS',
    config,
  })

  if (!response.ok || response.type !== 'COLLECT_EXPORTABLE_ITEMS') {
    throw new Error(response.ok ? '页面返回了未知的读取结果。' : response.error)
  }

  return response.items
}
