import { openDB } from 'idb'
import type { DBSchema, IDBPDatabase, IDBPTransaction, StoreNames } from 'idb'
import {
  INDEXED_DB_DEFAULT_LOCALHOST_TARGET_KEY,
  INDEXED_DB_KEY,
  INDEXED_DB_METADATA_KEYS,
  INDEXED_DB_NAME,
  INDEXED_DB_STORE,
  INDEXED_DB_STORES,
  INDEXED_DB_VERSION,
} from './constants'
import type { AppStorageState, ConfigItem, Dataset, DatasetItem, LocalhostTarget } from './types'
import { toRecordKey } from './utils'

export type DatasetRecord = Omit<Dataset, 'items'>

export type DatasetItemRecord = {
  datasetId: string
  position: number
  item: DatasetItem
}

export type ConfigRecord = {
  id: string
  position: number
  item: ConfigItem
}

export type LocalhostTargetRecord = {
  id: string
  position: number
  target: LocalhostTarget
}

type DefaultLocalhostTargetRecord = {
  key: string
  targetKey: string
}

type MetadataRecord = {
  key: string
  initialized: true
}

export interface StorageDatabase extends DBSchema {
  [INDEXED_DB_STORES.datasets]: {
    key: string
    value: DatasetRecord
  }
  [INDEXED_DB_STORES.datasetItems]: {
    key: [string, number]
    value: DatasetItemRecord
    indexes: { datasetId: string }
  }
  [INDEXED_DB_STORES.customConfig]: {
    key: string
    value: ConfigRecord
  }
  [INDEXED_DB_STORES.localhostTargets]: {
    key: string
    value: LocalhostTargetRecord
  }
  [INDEXED_DB_STORES.defaultLocalhostTarget]: {
    key: string
    value: DefaultLocalhostTargetRecord
  }
  [INDEXED_DB_STORES.metadata]: {
    key: string
    value: MetadataRecord
  }
  [INDEXED_DB_STORE]: {
    key: string
    value: AppStorageState
  }
}

type StorageTransaction = IDBPTransaction<
  StorageDatabase,
  StoreNames<StorageDatabase>[],
  'readwrite' | 'versionchange'
>

export async function openStorageDatabase() {
  return await openDB<StorageDatabase>(INDEXED_DB_NAME, INDEXED_DB_VERSION, {
    upgrade(database, oldVersion, _newVersion, transaction) {
      createV2ObjectStores(database)

      if (oldVersion === 1 && database.objectStoreNames.contains(INDEXED_DB_STORE)) {
        queueV1Migration(database, transaction)
      }
    },
  })
}

export function createStateWriteRequests(
  transaction: StorageTransaction,
  state: AppStorageState,
  replaceExisting: boolean,
) {
  const records = {
    datasets: state.datasets.map(toDatasetRecord),
    datasetItems: state.datasets.flatMap((dataset) =>
      dataset.items.map((item, position) => ({ datasetId: dataset.id, position, item })),
    ),
    customConfig: state.customConfig.map((item, position) => ({
      id: `${position}:${toRecordKey(item.storageType, item.key)}`,
      position,
      item,
    })),
    localhostTargets: state.localhostPorts.map((target, position) => ({
      id: `${position}:${target.protocol}:${target.port}`,
      position,
      target,
    })),
  }
  const datasets = transaction.objectStore(INDEXED_DB_STORES.datasets)
  const datasetItems = transaction.objectStore(INDEXED_DB_STORES.datasetItems)
  const customConfig = transaction.objectStore(INDEXED_DB_STORES.customConfig)
  const localhostTargets = transaction.objectStore(INDEXED_DB_STORES.localhostTargets)
  const defaultLocalhostTarget = transaction.objectStore(INDEXED_DB_STORES.defaultLocalhostTarget)
  const metadata = transaction.objectStore(INDEXED_DB_STORES.metadata)
  const requests: Promise<unknown>[] = []

  try {
    if (replaceExisting) {
      requests.push(
        datasets.clear(),
        datasetItems.clear(),
        customConfig.clear(),
        localhostTargets.clear(),
        defaultLocalhostTarget.clear(),
      )
    }

    records.datasets.forEach((record) => requests.push(datasets.put(record)))
    records.datasetItems.forEach((record) => requests.push(datasetItems.put(record)))
    records.customConfig.forEach((record) => requests.push(customConfig.put(record)))
    records.localhostTargets.forEach((record) => requests.push(localhostTargets.put(record)))
    requests.push(
      defaultLocalhostTarget.put({
        key: INDEXED_DB_DEFAULT_LOCALHOST_TARGET_KEY,
        targetKey: state.defaultLocalhostPort,
      }),
      metadata.put({ key: INDEXED_DB_METADATA_KEYS.initialized, initialized: true }),
    )
  } catch (error) {
    requests.forEach((request) => {
      void request.catch(() => undefined)
    })

    throw error
  }

  return requests
}

export function toDatasetRecord(dataset: Dataset): DatasetRecord {
  return {
    id: dataset.id,
    datasetName: dataset.datasetName,
    sourceUrl: dataset.sourceUrl,
    createdAt: dataset.createdAt,
  }
}

function createV2ObjectStores(database: IDBPDatabase<StorageDatabase>) {
  if (!database.objectStoreNames.contains(INDEXED_DB_STORES.datasets)) {
    database.createObjectStore(INDEXED_DB_STORES.datasets, { keyPath: 'id' })
  }
  if (!database.objectStoreNames.contains(INDEXED_DB_STORES.datasetItems)) {
    const datasetItems = database.createObjectStore(INDEXED_DB_STORES.datasetItems, {
      keyPath: ['datasetId', 'position'],
    })
    datasetItems.createIndex('datasetId', 'datasetId')
  }
  if (!database.objectStoreNames.contains(INDEXED_DB_STORES.customConfig)) {
    database.createObjectStore(INDEXED_DB_STORES.customConfig, { keyPath: 'id' })
  }
  if (!database.objectStoreNames.contains(INDEXED_DB_STORES.localhostTargets)) {
    database.createObjectStore(INDEXED_DB_STORES.localhostTargets, { keyPath: 'id' })
  }
  if (!database.objectStoreNames.contains(INDEXED_DB_STORES.defaultLocalhostTarget)) {
    database.createObjectStore(INDEXED_DB_STORES.defaultLocalhostTarget, { keyPath: 'key' })
  }
  if (!database.objectStoreNames.contains(INDEXED_DB_STORES.metadata)) {
    database.createObjectStore(INDEXED_DB_STORES.metadata, { keyPath: 'key' })
  }
}

function queueV1Migration(
  database: IDBPDatabase<StorageDatabase>,
  transaction: IDBPTransaction<StorageDatabase, StoreNames<StorageDatabase>[], 'versionchange'>,
) {
  const legacyStateRequest = transaction.objectStore(INDEXED_DB_STORE).get(INDEXED_DB_KEY)

  void legacyStateRequest
    .then((legacyState) => {
      if (legacyState) {
        for (const request of createStateWriteRequests(transaction, legacyState, false)) {
          void request.catch(() => transaction.abort())
        }
      }

      database.deleteObjectStore(INDEXED_DB_STORE)
    })
    .catch(() => transaction.abort())
}
