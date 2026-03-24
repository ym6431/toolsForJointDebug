import type { ConfigItem, DatasetItem, StorageType } from './types'

export function toRecordKey(storageType: StorageType, key: string) {
  return `${storageType}:${key}`
}

export function dedupeConfig(items: ConfigItem[]) {
  const seen = new Set<string>()

  return items.filter((item) => {
    const normalizedKey = item.key.trim()

    if (!normalizedKey) {
      return false
    }

    const recordKey = toRecordKey(item.storageType, normalizedKey)

    if (seen.has(recordKey)) {
      return false
    }

    seen.add(recordKey)

    return true
  })
}

export function dedupeDatasetItems(items: DatasetItem[]) {
  const seen = new Set<string>()

  return items.filter((item) => {
    const recordKey = toRecordKey(item.storageType, item.key)

    if (seen.has(recordKey)) {
      return false
    }

    seen.add(recordKey)

    return true
  })
}

export function formatTimestamp(isoString: string) {
  return new Date(isoString).toLocaleString('zh-CN', {
    hour12: false,
  })
}

export function createId() {
  if ('randomUUID' in crypto) {
    return crypto.randomUUID()
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export function previewValue(value: string, maxLength = 72) {
  if (value.length <= maxLength) {
    return value
  }

  return `${value.slice(0, maxLength)}...`
}
