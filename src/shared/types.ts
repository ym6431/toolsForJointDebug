export type StorageType = 'localStorage' | 'sessionStorage' | 'cookie'

export type CookieSameSite = 'no_restriction' | 'lax' | 'strict' | 'unspecified'
export type LocalhostProtocol = 'http' | 'https'

export interface LocalhostTarget {
  protocol: LocalhostProtocol
  port: string
}

export interface CookiePartitionKey {
  topLevelSite?: string
  hasCrossSiteAncestor?: boolean
}

export interface CookieMetadata {
  domain: string
  hostOnly: boolean
  path: string
  secure: boolean
  httpOnly: boolean
  sameSite: CookieSameSite
  session: boolean
  expirationDate?: number
  storeId?: string
  partitionKey?: CookiePartitionKey
}

export interface ConfigItem {
  storageType: StorageType
  key: string
  description: string
}

export interface DatasetItem {
  storageType: StorageType
  key: string
  value: string
  cookie?: CookieMetadata
}

export interface Dataset {
  id: string
  datasetName: string
  sourceUrl: string
  createdAt: string
  items: DatasetItem[]
}

export interface OperationResult {
  ok: boolean
  message: string
  details?: string[]
}

export interface PageInfo {
  tabId: number
  url: string
  title: string
}

export interface SaveDatasetInput {
  datasetName: string
  sourceUrl: string
  items: DatasetItem[]
}

export interface AppStorageState {
  datasets: Dataset[]
  customConfig: ConfigItem[]
  localhostPorts: LocalhostTarget[]
  defaultLocalhostPort: string
}

export interface ExportScanResponse {
  items: DatasetItem[]
}

export interface ImportApplyResponse {
  imported: number
  failed: string[]
}

export type ErrorResponse = {
  readonly error: string
}

export type BackgroundMessage =
  | { type: 'GET_ACTIVE_TAB' }
  | { type: 'OPEN_OPTIONS_PAGE' }
  | { type: 'RELOAD_TAB'; tabId: number }
  | { type: 'READ_COOKIES'; url: string; keys: string[] }
  | { type: 'APPLY_COOKIES_TO_URL'; url: string; items: DatasetItem[] }
  | { type: 'OPEN_LOCALHOST_AND_APPLY_ITEMS'; target: LocalhostTarget; items: DatasetItem[] }

export type ContentMessage =
  | { type: 'COLLECT_EXPORTABLE_ITEMS'; config: ConfigItem[] }
  | { type: 'APPLY_IMPORT_ITEMS'; items: DatasetItem[] }

export type PageBridgeRequest =
  | {
      requestId: string
      type: 'COLLECT_EXPORTABLE_ITEMS'
      config: ConfigItem[]
    }
  | {
      requestId: string
      type: 'APPLY_IMPORT_ITEMS'
      items: DatasetItem[]
    }

export type PageBridgeResponse =
  | {
      requestId: string
      ok: true
      type: 'COLLECT_EXPORTABLE_ITEMS'
      items: DatasetItem[]
    }
  | {
      requestId: string
      ok: true
      type: 'APPLY_IMPORT_ITEMS'
      imported: number
      failed: string[]
    }
  | {
      requestId: string
      ok: false
      error: string
    }

export function isBackgroundMessage(value: unknown): value is BackgroundMessage {
  if (!isRecord(value)) {
    return false
  }

  switch (value.type) {
    case 'GET_ACTIVE_TAB':
    case 'OPEN_OPTIONS_PAGE':
      return true
    case 'RELOAD_TAB':
      return isTabId(value.tabId)
    case 'READ_COOKIES':
      return isHttpUrl(value.url) && isStringArray(value.keys)
    case 'APPLY_COOKIES_TO_URL':
      return isHttpUrl(value.url) && isDatasetItemArray(value.items)
    case 'OPEN_LOCALHOST_AND_APPLY_ITEMS':
      return isLocalhostTarget(value.target) && isDatasetItemArray(value.items)
    default:
      return false
  }
}

export function isContentMessage(value: unknown): value is ContentMessage {
  if (!isRecord(value)) {
    return false
  }

  switch (value.type) {
    case 'COLLECT_EXPORTABLE_ITEMS':
      return Array.isArray(value.config) && value.config.every(isConfigItem)
    case 'APPLY_IMPORT_ITEMS':
      return isDatasetItemArray(value.items)
    default:
      return false
  }
}

export function isDatasetItem(value: unknown): value is DatasetItem {
  return isRecord(value)
    && isStorageType(value.storageType)
    && typeof value.key === 'string'
    && typeof value.value === 'string'
    && (value.cookie === undefined || isCookieMetadata(value.cookie))
}

export function isExportScanResponse(value: unknown): value is ExportScanResponse {
  return isRecord(value) && isDatasetItemArray(value.items)
}

export function isImportApplyResponse(value: unknown): value is ImportApplyResponse {
  return isRecord(value)
    && isNonNegativeInteger(value.imported)
    && isStringArray(value.failed)
}

export function isErrorResponse(value: unknown): value is ErrorResponse {
  return isRecord(value) && typeof value.error === 'string'
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isStorageType(value: unknown): value is StorageType {
  return value === 'localStorage' || value === 'sessionStorage' || value === 'cookie'
}

function isConfigItem(value: unknown): value is ConfigItem {
  return isRecord(value)
    && isStorageType(value.storageType)
    && typeof value.key === 'string'
    && typeof value.description === 'string'
}

function isCookieMetadata(value: unknown): value is CookieMetadata {
  return isRecord(value)
    && typeof value.domain === 'string'
    && typeof value.hostOnly === 'boolean'
    && typeof value.path === 'string'
    && typeof value.secure === 'boolean'
    && typeof value.httpOnly === 'boolean'
    && isCookieSameSite(value.sameSite)
    && typeof value.session === 'boolean'
    && (value.expirationDate === undefined || isNonNegativeNumber(value.expirationDate))
    && (value.storeId === undefined || typeof value.storeId === 'string')
    && (value.partitionKey === undefined || isCookiePartitionKey(value.partitionKey))
}

function isCookieSameSite(value: unknown): value is CookieSameSite {
  return value === 'no_restriction'
    || value === 'lax'
    || value === 'strict'
    || value === 'unspecified'
}

function isCookiePartitionKey(value: unknown): value is CookiePartitionKey {
  return isRecord(value)
    && (value.topLevelSite === undefined || typeof value.topLevelSite === 'string')
    && (value.hasCrossSiteAncestor === undefined || typeof value.hasCrossSiteAncestor === 'boolean')
}

function isLocalhostTarget(value: unknown): value is LocalhostTarget {
  return isRecord(value)
    && (value.protocol === 'http' || value.protocol === 'https')
    && isPort(value.port)
}

function isDatasetItemArray(value: unknown): value is DatasetItem[] {
  return Array.isArray(value) && value.every(isDatasetItem)
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
}

function isTabId(value: unknown): value is number {
  return isNonNegativeInteger(value)
}

function isPort(value: unknown): value is string {
  if (typeof value !== 'string' || !/^[1-9]\d{0,4}$/.test(value)) {
    return false
  }

  return Number(value) <= 65_535
}

function isHttpUrl(value: unknown): value is string {
  if (typeof value !== 'string' || !URL.canParse(value)) {
    return false
  }

  const url = new URL(value)

  return url.protocol === 'http:' || url.protocol === 'https:'
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
}

function isNonNegativeNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
}
