export type StorageType = 'localStorage' | 'sessionStorage' | 'cookie'

export type CookieSameSite = 'no_restriction' | 'lax' | 'strict' | 'unspecified'

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
  localhostPorts: string[]
  defaultLocalhostPort: string
}

export interface ExportScanResponse {
  items: DatasetItem[]
}

export interface ImportApplyResponse {
  imported: number
  failed: string[]
}

export type BackgroundMessage =
  | { type: 'GET_ACTIVE_TAB' }
  | { type: 'OPEN_OPTIONS_PAGE' }
  | { type: 'RELOAD_TAB'; tabId: number }
  | { type: 'READ_COOKIES'; url: string; keys: string[] }
  | { type: 'APPLY_COOKIES_TO_URL'; url: string; items: DatasetItem[] }
  | { type: 'OPEN_LOCALHOST_AND_APPLY_ITEMS'; port: string; items: DatasetItem[] }

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
