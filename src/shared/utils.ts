import type {
  ConfigItem,
  DatasetItem,
  LocalhostProtocol,
  LocalhostTarget,
  StorageType,
} from './types'

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

export function normalizeLocalhostProtocol(value: string): LocalhostProtocol | '' {
  const normalizedValue = value.trim().toLowerCase()

  return normalizedValue === 'http' || normalizedValue === 'https'
    ? normalizedValue
    : ''
}

export function normalizeLocalhostTarget(value: unknown): LocalhostTarget | null {
  if (typeof value === 'string') {
    return parseLocalhostTargetString(value)
  }

  if (!value || typeof value !== 'object') {
    return null
  }

  const protocol = 'protocol' in value ? normalizeLocalhostProtocol(String(value.protocol ?? '')) : ''
  const port = 'port' in value ? normalizePort(String(value.port ?? '')) : ''

  if (!protocol || !port) {
    return null
  }

  return { protocol, port }
}

export function normalizeLocalhostTargetKey(value: unknown) {
  const target = normalizeLocalhostTarget(value)

  return target ? serializeLocalhostTarget(target) : ''
}

export function normalizeLocalhostTargetList(values: unknown[]) {
  const seen = new Set<string>()

  return values.flatMap((value) => {
    const target = normalizeLocalhostTarget(value)

    if (!target) {
      return []
    }

    const targetKey = serializeLocalhostTarget(target)

    if (seen.has(targetKey)) {
      return []
    }

    seen.add(targetKey)

    return [target]
  })
}

export function resolveDefaultLocalhostTargetKey(
  targets: LocalhostTarget[],
  defaultTargetKey: string,
) {
  if (targets.some((target) => serializeLocalhostTarget(target) === defaultTargetKey)) {
    return defaultTargetKey
  }

  return targets[0] ? serializeLocalhostTarget(targets[0]) : ''
}

export function serializeLocalhostTarget(target: LocalhostTarget) {
  return `${target.protocol}:${target.port}`
}

export function formatLocalhostTarget(target: LocalhostTarget) {
  return `${target.protocol}://localhost:${target.port}`
}

export function buildLocalhostUrl(target: LocalhostTarget) {
  return `${formatLocalhostTarget(target)}/`
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

function parseLocalhostTargetString(value: string): LocalhostTarget | null {
  const trimmedValue = value.trim()

  if (!trimmedValue) {
    return null
  }

  const urlMatch = trimmedValue.match(/^(https?):\/\/localhost:(\d+)\/?$/i)

  if (urlMatch) {
    const protocol = normalizeLocalhostProtocol(urlMatch[1])
    const port = normalizePort(urlMatch[2])

    return protocol && port ? { protocol, port } : null
  }

  const keyMatch = trimmedValue.match(/^(https?):(\d+)$/i)

  if (keyMatch) {
    const protocol = normalizeLocalhostProtocol(keyMatch[1])
    const port = normalizePort(keyMatch[2])

    return protocol && port ? { protocol, port } : null
  }

  const port = normalizePort(trimmedValue)

  return port ? { protocol: 'http', port } : null
}
