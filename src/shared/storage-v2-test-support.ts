import 'fake-indexeddb/auto'

import { deleteDB, openDB } from 'idb'
import type { DBSchema } from 'idb'
import { vi } from 'vitest'
import { INDEXED_DB_KEY, INDEXED_DB_NAME, INDEXED_DB_STORE, STORAGE_KEYS } from './constants'
import type { ConfigRecord, LocalhostTargetRecord } from './storage-db'
import type { AppStorageState, Dataset, DatasetItem } from './types'

type DatasetMetadata = Omit<Dataset, 'items'>

type DatasetItemRecord = {
  datasetId: string
  position: number
  item: DatasetItem
}

type DefaultLocalhostTargetRecord = {
  key: string
  targetKey: string
}

type MetadataRecord = {
  key: string
  initialized: true
}

interface LegacyDatabase extends DBSchema {
  'app-state': {
    key: string
    value: AppStorageState
  }
}

export interface V2Database extends DBSchema {
  datasets: {
    key: string
    value: DatasetMetadata
  }
  'dataset-items': {
    key: [string, number]
    value: DatasetItemRecord
    indexes: { datasetId: string }
  }
  'custom-config': {
    key: string
    value: ConfigRecord
  }
  'localhost-targets': {
    key: string
    value: LocalhostTargetRecord
  }
  'default-localhost-target': {
    key: string
    value: DefaultLocalhostTargetRecord
  }
  metadata: {
    key: string
    value: MetadataRecord
  }
}

export const V2_STORE_NAMES = [
  'custom-config',
  'dataset-items',
  'datasets',
  'default-localhost-target',
  'localhost-targets',
  'metadata',
] as const

export function createLegacyState(): AppStorageState {
  return {
    datasets: [],
    customConfig: [],
    localhostPorts: [],
    defaultLocalhostPort: '',
  }
}

export async function resetIndexedDb() {
  for (const database of await indexedDB.databases()) {
    if (database.name) {
      await deleteDB(database.name)
    }
  }
}

export async function createV1Database(state: AppStorageState) {
  const database = await openDB<LegacyDatabase>(INDEXED_DB_NAME, 1, {
    upgrade(database) {
      database.createObjectStore(INDEXED_DB_STORE)
    },
  })

  await database.put(INDEXED_DB_STORE, state, INDEXED_DB_KEY)
  database.close()
}

export async function openV2Database() {
  return await openDB<V2Database>(INDEXED_DB_NAME)
}

export function createStorageTestChrome() {
  let chromeState = createLegacyState()
  const storageGet = vi.fn(async () => ({
    [STORAGE_KEYS.datasets]: chromeState.datasets,
    [STORAGE_KEYS.customConfig]: chromeState.customConfig,
    [STORAGE_KEYS.localhostPorts]: chromeState.localhostPorts,
    [STORAGE_KEYS.defaultLocalhostPort]: chromeState.defaultLocalhostPort,
    [STORAGE_KEYS.legacyLocalhostPort]: '',
  }))
  const chromeStub = {
    storage: {
      local: {
        get: storageGet,
      },
    },
  }

  return {
    reset() {
      chromeState = createLegacyState()
      vi.clearAllMocks()
      vi.stubGlobal('chrome', chromeStub)
    },
    release() {
      vi.unstubAllGlobals()
    },
    setState(state: AppStorageState) {
      chromeState = state
    },
    storageGet,
  }
}
