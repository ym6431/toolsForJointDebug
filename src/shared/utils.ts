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

export function formatDisplayHost(urlString: string) {
  try {
    const { host, hostname, port } = new URL(urlString)

    return getTrimmedHost(host, hostname, port)
  } catch {
    return urlString
  }
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

export function normalizePort(value: string) {
  const trimmedValue = value.trim()

  if (!trimmedValue) {
    return ''
  }

  if (!/^\d+$/.test(trimmedValue)) {
    return ''
  }

  const port = Number(trimmedValue)

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    return ''
  }

  return String(port)
}

export function normalizePortList(values: string[]) {
  const seen = new Set<string>()

  return values.flatMap((value) => {
    const normalizedPort = normalizePort(value)

    if (!normalizedPort || seen.has(normalizedPort)) {
      return []
    }

    seen.add(normalizedPort)

    return [normalizedPort]
  })
}

function getTrimmedHost(host: string, hostname: string, port: string) {
  const normalizedHostname = hostname.trim().toLowerCase()

  if (!normalizedHostname || normalizedHostname === 'localhost') {
    return host
  }

  if (isIpAddress(normalizedHostname)) {
    return normalizeIpDisplay(normalizedHostname)
  }

  const parts = normalizedHostname.split('.').filter(Boolean)

  if (parts.length <= 2) {
    return host
  }

  const trimmedHostname = parts.slice(1).join('.')

  return port ? `${trimmedHostname}:${port}` : trimmedHostname
}

function isIpv4Address(hostname: string) {
  return hostname.split('.').length === 4 &&
    hostname.split('.').every((segment) => /^\d+$/.test(segment))
}

function isIpAddress(hostname: string) {
  return isIpv4Address(hostname) || hostname.includes(':')
}

function normalizeIpDisplay(hostname: string) {
  return hostname.replace(/^\[(.*)\]$/, '$1')
}
