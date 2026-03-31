import type {
  CookieMetadata,
  CookiePartitionKey,
  CookieSameSite,
  DatasetItem,
} from './types'

export function isCookieItem(item: DatasetItem) {
  return item.storageType === 'cookie'
}

export function toCookieMetadata(cookie: chrome.cookies.Cookie): CookieMetadata {
  return {
    domain: cookie.domain,
    hostOnly: cookie.hostOnly,
    path: cookie.path,
    secure: cookie.secure,
    httpOnly: cookie.httpOnly,
    sameSite: cookie.sameSite as CookieSameSite,
    session: cookie.session,
    expirationDate: cookie.expirationDate,
    storeId: cookie.storeId,
    partitionKey: clonePartitionKey(cookie.partitionKey),
  }
}

export function formatCookieMetadata(metadata?: CookieMetadata) {
  if (!metadata) {
    return ''
  }

  const parts = [
    metadata.httpOnly ? 'HttpOnly' : '',
    metadata.secure ? 'Secure' : '',
    metadata.hostOnly ? 'HostOnly' : `Domain=${metadata.domain}`,
    `Path=${metadata.path}`,
    `SameSite=${formatSameSite(metadata.sameSite)}`,
    metadata.session
      ? 'Session'
      : metadata.expirationDate
        ? `Expires=${new Date(metadata.expirationDate * 1000).toLocaleString('zh-CN', {
            hour12: false,
          })}`
        : '',
    metadata.partitionKey?.topLevelSite
      ? `Partition=${metadata.partitionKey.topLevelSite}`
      : '',
  ]

  return parts.filter(Boolean).join(' · ')
}

export function buildCookieSetDetails(url: string, item: DatasetItem) {
  const metadata = item.cookie
  const details: {
    url: string
    name: string
    value: string
    domain?: string
    path?: string
    secure?: boolean
    httpOnly?: boolean
    sameSite?: CookieSameSite
    expirationDate?: number
    storeId?: string
    partitionKey?: CookiePartitionKey
  } = {
    url,
    name: item.key,
    value: item.value,
  }

  if (!metadata) {
    details.path = '/'
    details.sameSite = 'lax'

    return details
  }

  details.path = metadata.path || '/'
  details.secure = metadata.secure
  details.httpOnly = metadata.httpOnly
  details.sameSite = metadata.sameSite

  if (!metadata.session && metadata.expirationDate !== undefined) {
    details.expirationDate = metadata.expirationDate
  }

  if (metadata.storeId) {
    details.storeId = metadata.storeId
  }

  if (metadata.partitionKey) {
    details.partitionKey = clonePartitionKey(metadata.partitionKey)
  }

  if (!metadata.hostOnly && canUseCookieDomain(url, metadata.domain)) {
    details.domain = metadata.domain
  }

  return details
}

function canUseCookieDomain(url: string, domain: string) {
  const targetHostname = normalizeHostname(new URL(url).hostname)
  const normalizedDomain = normalizeHostname(domain.replace(/^\./, ''))

  if (!normalizedDomain || isIpAddress(targetHostname) || targetHostname === 'localhost') {
    return false
  }

  return targetHostname === normalizedDomain
    || targetHostname.endsWith(`.${normalizedDomain}`)
}

function normalizeHostname(value: string) {
  return value.replace(/^\[(.*)\]$/, '$1').trim().toLowerCase()
}

function isIpAddress(hostname: string) {
  return hostname.includes(':')
    || (hostname.split('.').length === 4
      && hostname.split('.').every((segment) => /^\d+$/.test(segment)))
}

function clonePartitionKey(partitionKey?: CookiePartitionKey) {
  return partitionKey ? { ...partitionKey } : undefined
}

function formatSameSite(value: CookieSameSite) {
  if (value === 'no_restriction') {
    return 'None'
  }

  if (value === 'unspecified') {
    return 'Unspecified'
  }

  return value[0].toUpperCase() + value.slice(1)
}
