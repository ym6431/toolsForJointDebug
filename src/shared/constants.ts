import type { AppStorageState } from './types'

export const STORAGE_KEYS = {
  datasets: 'datasets',
  customConfig: 'customConfig',
  localhostPorts: 'localhostPorts',
  defaultLocalhostPort: 'defaultLocalhostPort',
  legacyLocalhostPort: 'localhostPort',
} as const

export const DEFAULT_STORAGE_STATE: AppStorageState = {
  datasets: [],
  customConfig: [],
  localhostPorts: [],
  defaultLocalhostPort: '',
}

export const MAX_SAVED_DATASETS = 10
export const INDEXED_DB_NAME = 'frontend-state-migrator'

// IndexedDB v1 identifiers are retained exclusively to migrate existing installs.
export const INDEXED_DB_STORE = 'app-state'
export const INDEXED_DB_KEY = 'current'
export const INDEXED_DB_VERSION = 2
export const INDEXED_DB_STORES = {
  datasets: 'datasets',
  datasetItems: 'dataset-items',
  customConfig: 'custom-config',
  localhostTargets: 'localhost-targets',
  defaultLocalhostTarget: 'default-localhost-target',
  metadata: 'metadata',
} as const
export const INDEXED_DB_METADATA_KEYS = {
  initialized: 'initialized',
} as const
export const INDEXED_DB_DEFAULT_LOCALHOST_TARGET_KEY = 'current'

export const BRIDGE_REQUEST_EVENT = 'state-migrator:bridge-request'
export const BRIDGE_RESPONSE_EVENT = 'state-migrator:bridge-response'
