export type StorageType = 'localStorage' | 'sessionStorage' | 'cookie'

export interface ConfigItem {
  storageType: StorageType
  key: string
  description: string
}

export interface DatasetItem {
  storageType: StorageType
  key: string
  value: string
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
