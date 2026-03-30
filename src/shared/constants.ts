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

export const BRIDGE_REQUEST_EVENT = 'state-migrator:bridge-request'
export const BRIDGE_RESPONSE_EVENT = 'state-migrator:bridge-response'
