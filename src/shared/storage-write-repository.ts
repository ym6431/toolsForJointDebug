import {
  INDEXED_DB_DEFAULT_LOCALHOST_TARGET_KEY,
  INDEXED_DB_METADATA_KEYS,
  INDEXED_DB_STORES,
  MAX_SAVED_DATASETS,
} from './constants'
import {
  createStateWriteRequests,
  openStorageDatabase,
  toDatasetRecord,
  type ConfigRecord,
  type LocalhostTargetRecord,
} from './storage-db'
import { readNormalizedStorageState, sortDatasetRecords, STATE_STORE_NAMES } from './storage-read-repository'
import type { AppStorageState, ConfigItem, Dataset, LocalhostTarget } from './types'
import { toRecordKey } from './utils'

export async function initializeNormalizedStorageState(state: AppStorageState) {
  const database = await openStorageDatabase()

  try {
    const transaction = database.transaction(STATE_STORE_NAMES, 'readwrite')
    const metadata = transaction.objectStore(INDEXED_DB_STORES.metadata)
    const initialized = await metadata.get(INDEXED_DB_METADATA_KEYS.initialized)

    if (initialized) {
      await transaction.done
      return false
    }

    const requests = queueDestructiveWriteRequests(transaction, (requests) =>
      requests.push(...createStateWriteRequests(transaction, state, true)),
    )

    await Promise.all([...requests, transaction.done])

    return true
  } finally {
    database.close()
  }
}

export async function saveNormalizedDataset(dataset: Dataset) {
  const datasetRecord = toDatasetRecord(dataset)
  const datasetItemRecords = dataset.items.map((item, position) => ({
    datasetId: dataset.id,
    position,
    item,
  }))
  const database = await openStorageDatabase()

  try {
    const transaction = database.transaction(
      [INDEXED_DB_STORES.datasets, INDEXED_DB_STORES.datasetItems],
      'readwrite',
    )
    const datasets = transaction.objectStore(INDEXED_DB_STORES.datasets)
    const datasetItems = transaction.objectStore(INDEXED_DB_STORES.datasetItems)
    const existingDatasets = await datasets.getAll()
    const currentItemKeys = await datasetItems.index('datasetId').getAllKeys(dataset.id)
    const existingOtherDatasets = existingDatasets.filter((record) => record.id !== dataset.id)
    const retainedDatasets = sortDatasetRecords([datasetRecord, ...existingOtherDatasets]).slice(
      0,
      MAX_SAVED_DATASETS,
    )
    const retainedDatasetIds = new Set(retainedDatasets.map((record) => record.id))
    const prunedDatasetIds = existingOtherDatasets
      .filter((record) => !retainedDatasetIds.has(record.id))
      .map((record) => record.id)
    const prunedItemKeys = await Promise.all(
      prunedDatasetIds.map(async (datasetId) => await datasetItems.index('datasetId').getAllKeys(datasetId)),
    )
    const requests = queueDestructiveWriteRequests(transaction, (requests) => {
      currentItemKeys.forEach((itemKey) => {
        requests.push(datasetItems.delete(itemKey))
      })
      prunedItemKeys.flat().forEach((itemKey) => {
        requests.push(datasetItems.delete(itemKey))
      })
      requests.push(datasets.put(datasetRecord))
      datasetItemRecords.forEach((itemRecord) => {
        requests.push(datasetItems.put(itemRecord))
      })
      prunedDatasetIds.forEach((datasetId) => {
        requests.push(datasets.delete(datasetId))
      })
    })

    await Promise.all([...requests, transaction.done])
  } finally {
    database.close()
  }
}

export async function deleteNormalizedDataset(datasetId: string) {
  const database = await openStorageDatabase()

  try {
    const transaction = database.transaction(
      [INDEXED_DB_STORES.datasets, INDEXED_DB_STORES.datasetItems],
      'readwrite',
    )
    const datasets = transaction.objectStore(INDEXED_DB_STORES.datasets)
    const datasetItems = transaction.objectStore(INDEXED_DB_STORES.datasetItems)
    const itemKeys = await datasetItems.index('datasetId').getAllKeys(datasetId)
    const requests = queueDestructiveWriteRequests(transaction, (requests) => {
      requests.push(datasets.delete(datasetId))
      itemKeys.forEach((itemKey) => {
        requests.push(datasetItems.delete(itemKey))
      })
    })

    await Promise.all([...requests, transaction.done])
  } finally {
    database.close()
  }

  const state = await readNormalizedStorageState()

  return state?.datasets ?? []
}

export async function replaceNormalizedCustomConfig(items: ConfigItem[]) {
  const records = items.map(toConfigRecord)
  const database = await openStorageDatabase()

  try {
    const transaction = database.transaction(INDEXED_DB_STORES.customConfig, 'readwrite')
    const customConfig = transaction.objectStore(INDEXED_DB_STORES.customConfig)
    const requests = queueDestructiveWriteRequests(transaction, (requests) => {
      requests.push(customConfig.clear())
      records.forEach((record) => {
        requests.push(customConfig.put(record))
      })
    })

    await Promise.all([...requests, transaction.done])
  } finally {
    database.close()
  }
}

export async function replaceNormalizedLocalhostTargets(
  targets: LocalhostTarget[],
  defaultTargetKey: string,
) {
  const targetRecords = targets.map(toLocalhostTargetRecord)
  const database = await openStorageDatabase()

  try {
    const transaction = database.transaction(
      [INDEXED_DB_STORES.localhostTargets, INDEXED_DB_STORES.defaultLocalhostTarget],
      'readwrite',
    )
    const localhostTargets = transaction.objectStore(INDEXED_DB_STORES.localhostTargets)
    const defaultLocalhostTarget = transaction.objectStore(INDEXED_DB_STORES.defaultLocalhostTarget)
    const requests = queueDestructiveWriteRequests(transaction, (requests) => {
      requests.push(localhostTargets.clear())
      targetRecords.forEach((record) => {
        requests.push(localhostTargets.put(record))
      })
      requests.push(
        defaultLocalhostTarget.put({
          key: INDEXED_DB_DEFAULT_LOCALHOST_TARGET_KEY,
          targetKey: defaultTargetKey,
        }),
      )
    })

    await Promise.all([...requests, transaction.done])
  } finally {
    database.close()
  }
}

export async function saveNormalizedDefaultLocalhostTarget(defaultTargetKey: string) {
  const database = await openStorageDatabase()

  try {
    const transaction = database.transaction(INDEXED_DB_STORES.defaultLocalhostTarget, 'readwrite')
    const defaultLocalhostTarget = transaction.objectStore(INDEXED_DB_STORES.defaultLocalhostTarget)

    await Promise.all([
      defaultLocalhostTarget.put({
        key: INDEXED_DB_DEFAULT_LOCALHOST_TARGET_KEY,
        targetKey: defaultTargetKey,
      }),
      transaction.done,
    ])
  } finally {
    database.close()
  }
}

function toConfigRecord(item: ConfigItem, position: number): ConfigRecord {
  return { id: `${position}:${toRecordKey(item.storageType, item.key)}`, position, item }
}

function toLocalhostTargetRecord(target: LocalhostTarget, position: number): LocalhostTargetRecord {
  return { id: `${position}:${target.protocol}:${target.port}`, position, target }
}

function queueDestructiveWriteRequests(
  transaction: Pick<IDBTransaction, 'abort' | 'error'> & { readonly done: Promise<void> },
  queueRequests: (requests: Promise<unknown>[]) => void,
) {
  const requests: Promise<unknown>[] = []

  try {
    queueRequests(requests)

    return requests
  } catch (error) {
    requests.forEach((request) => {
      void request.catch(() => undefined)
    })
    void transaction.done.catch(() => undefined)

    if (transaction.error === null) {
      transaction.abort()
    }

    throw error
  }
}
