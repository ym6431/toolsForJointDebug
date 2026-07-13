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
export const INDEXED_DB_STORE = 'app-state'
export const INDEXED_DB_KEY = 'current'

export const BRIDGE_REQUEST_EVENT = 'state-migrator:bridge-request'
export const BRIDGE_RESPONSE_EVENT = 'state-migrator:bridge-response'
