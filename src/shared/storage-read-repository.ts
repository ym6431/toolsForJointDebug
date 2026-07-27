import {
  INDEXED_DB_DEFAULT_LOCALHOST_TARGET_KEY,
  INDEXED_DB_METADATA_KEYS,
  INDEXED_DB_STORES,
} from './constants'
import {
  openStorageDatabase,
  type DatasetItemRecord,
  type DatasetRecord,
} from './storage-db'
import type { AppStorageState } from './types'

export const STATE_STORE_NAMES = [
  INDEXED_DB_STORES.datasets,
  INDEXED_DB_STORES.datasetItems,
  INDEXED_DB_STORES.customConfig,
  INDEXED_DB_STORES.localhostTargets,
  INDEXED_DB_STORES.defaultLocalhostTarget,
  INDEXED_DB_STORES.metadata,
]

export async function readNormalizedStorageState(): Promise<AppStorageState | null> {
  const database = await openStorageDatabase()

  try {
    const transaction = database.transaction(STATE_STORE_NAMES, 'readonly')
    const datasets = transaction.objectStore(INDEXED_DB_STORES.datasets)
    const datasetItems = transaction.objectStore(INDEXED_DB_STORES.datasetItems)
    const customConfig = transaction.objectStore(INDEXED_DB_STORES.customConfig)
    const localhostTargets = transaction.objectStore(INDEXED_DB_STORES.localhostTargets)
    const defaultLocalhostTarget = transaction.objectStore(INDEXED_DB_STORES.defaultLocalhostTarget)
    const metadata = transaction.objectStore(INDEXED_DB_STORES.metadata)
    const [initialized, datasetRecords, datasetItemRecords, configRecords, targetRecords, defaultTarget] =
      await Promise.all([
        metadata.get(INDEXED_DB_METADATA_KEYS.initialized),
        datasets.getAll(),
        datasetItems.getAll(),
        customConfig.getAll(),
        localhostTargets.getAll(),
        defaultLocalhostTarget.get(INDEXED_DB_DEFAULT_LOCALHOST_TARGET_KEY),
      ])

    await transaction.done

    if (!initialized) {
      return null
    }

    return {
      datasets: hydrateDatasets(datasetRecords, datasetItemRecords),
      customConfig: configRecords
        .sort((left, right) => left.position - right.position)
        .map((record) => record.item),
      localhostPorts: targetRecords
        .sort((left, right) => left.position - right.position)
        .map((record) => record.target),
      defaultLocalhostPort: defaultTarget?.targetKey ?? '',
    }
  } finally {
    database.close()
  }
}

export function sortDatasetRecords(datasets: DatasetRecord[]) {
  return [...datasets].sort((left, right) => right.createdAt.localeCompare(left.createdAt))
}

function hydrateDatasets(datasetRecords: DatasetRecord[], datasetItemRecords: DatasetItemRecord[]) {
  const itemsByDatasetId = new Map<string, DatasetItemRecord[]>()

  datasetItemRecords.forEach((record) => {
    const items = itemsByDatasetId.get(record.datasetId) ?? []
    items.push(record)
    itemsByDatasetId.set(record.datasetId, items)
  })

  return sortDatasetRecords(datasetRecords).map((record) => ({
    ...record,
    items: (itemsByDatasetId.get(record.id) ?? [])
      .sort((left, right) => left.position - right.position)
      .map((itemRecord) => itemRecord.item),
  }))
}
