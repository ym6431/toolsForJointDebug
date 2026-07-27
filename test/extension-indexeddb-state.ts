import type { AppStorageState } from '../src/shared/types'
import {
  INDEXED_DB_SCHEMA,
  type ConfigRecord,
  type DatasetItemRecord,
  type DatasetRecord,
  type DefaultLocalhostTargetRecord,
  type IndexedDbSchema,
  type LocalhostTargetRecord,
  type MetadataRecord,
} from './extension-indexeddb-schema'

export async function setExtensionIndexedDbState(items: Partial<AppStorageState>): Promise<void> {
  const serviceWorker = await browser.getServiceWorker()
  const state: AppStorageState = {
    datasets: items.datasets ?? [],
    customConfig: items.customConfig ?? [],
    localhostPorts: items.localhostPorts ?? [],
    defaultLocalhostPort: items.defaultLocalhostPort ?? '',
  }

  await serviceWorker.evaluate(async (payload: {
    readonly schema: IndexedDbSchema
    readonly state: AppStorageState
  }) => {
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open(payload.schema.databaseName, payload.schema.version)

      request.onerror = () => reject(request.error)
      request.onupgradeneeded = () => {
        const database = request.result

        if (database.objectStoreNames.contains(payload.schema.legacyStore)) {
          database.deleteObjectStore(payload.schema.legacyStore)
        }
        if (!database.objectStoreNames.contains(payload.schema.datasets)) {
          database.createObjectStore(payload.schema.datasets, { keyPath: 'id' })
        }
        if (!database.objectStoreNames.contains(payload.schema.datasetItems)) {
          const datasetItems = database.createObjectStore(payload.schema.datasetItems, {
            keyPath: ['datasetId', 'position'],
          })
          datasetItems.createIndex('datasetId', 'datasetId')
        }
        if (!database.objectStoreNames.contains(payload.schema.customConfig)) {
          database.createObjectStore(payload.schema.customConfig, { keyPath: 'id' })
        }
        if (!database.objectStoreNames.contains(payload.schema.localhostTargets)) {
          database.createObjectStore(payload.schema.localhostTargets, { keyPath: 'id' })
        }
        if (!database.objectStoreNames.contains(payload.schema.defaultLocalhostTarget)) {
          database.createObjectStore(payload.schema.defaultLocalhostTarget, { keyPath: 'key' })
        }
        if (!database.objectStoreNames.contains(payload.schema.metadata)) {
          database.createObjectStore(payload.schema.metadata, { keyPath: 'key' })
        }
      }
      request.onsuccess = () => {
        const database = request.result
        const transaction = database.transaction([
          payload.schema.datasets,
          payload.schema.datasetItems,
          payload.schema.customConfig,
          payload.schema.localhostTargets,
          payload.schema.defaultLocalhostTarget,
          payload.schema.metadata,
        ], 'readwrite')
        const datasets = transaction.objectStore(payload.schema.datasets)
        const datasetItems = transaction.objectStore(payload.schema.datasetItems)
        const customConfig = transaction.objectStore(payload.schema.customConfig)
        const localhostTargets = transaction.objectStore(payload.schema.localhostTargets)
        const defaultLocalhostTarget = transaction.objectStore(payload.schema.defaultLocalhostTarget)
        const metadata = transaction.objectStore(payload.schema.metadata)

        transaction.onerror = () => {
          database.close()
          reject(transaction.error)
        }
        transaction.onabort = () => {
          database.close()
          reject(transaction.error)
        }
        transaction.oncomplete = () => {
          database.close()
          resolve()
        }

        datasets.clear()
        datasetItems.clear()
        customConfig.clear()
        localhostTargets.clear()
        defaultLocalhostTarget.clear()
        metadata.clear()

        for (const dataset of payload.state.datasets) {
          datasets.put({
            id: dataset.id,
            datasetName: dataset.datasetName,
            sourceUrl: dataset.sourceUrl,
            createdAt: dataset.createdAt,
          })
          dataset.items.forEach((item, position) => {
            datasetItems.put({ datasetId: dataset.id, position, item })
          })
        }
        payload.state.customConfig.forEach((item, position) => {
          customConfig.put({
            id: `${position}:${item.storageType}:${item.key}`,
            position,
            item,
          })
        })
        payload.state.localhostPorts.forEach((target, position) => {
          localhostTargets.put({
            id: `${position}:${target.protocol}:${target.port}`,
            position,
            target,
          })
        })
        defaultLocalhostTarget.put({
          key: payload.schema.defaultLocalhostTargetKey,
          targetKey: payload.state.defaultLocalhostPort,
        })
        metadata.put({ key: payload.schema.initializedMetadataKey, initialized: true })
      }
    })
  }, { schema: INDEXED_DB_SCHEMA, state })
}

export async function getExtensionIndexedDbState(): Promise<AppStorageState> {
  const serviceWorker = await browser.getServiceWorker()

  return await serviceWorker.evaluate(async (schema: IndexedDbSchema): Promise<AppStorageState> => {
    return await new Promise<AppStorageState>((resolve, reject) => {
      const request = indexedDB.open(schema.databaseName, schema.version)

      request.onerror = () => reject(request.error)
      request.onupgradeneeded = () => {
        const database = request.result

        if (database.objectStoreNames.contains(schema.legacyStore)) {
          database.deleteObjectStore(schema.legacyStore)
        }
        if (!database.objectStoreNames.contains(schema.datasets)) {
          database.createObjectStore(schema.datasets, { keyPath: 'id' })
        }
        if (!database.objectStoreNames.contains(schema.datasetItems)) {
          const datasetItems = database.createObjectStore(schema.datasetItems, {
            keyPath: ['datasetId', 'position'],
          })
          datasetItems.createIndex('datasetId', 'datasetId')
        }
        if (!database.objectStoreNames.contains(schema.customConfig)) {
          database.createObjectStore(schema.customConfig, { keyPath: 'id' })
        }
        if (!database.objectStoreNames.contains(schema.localhostTargets)) {
          database.createObjectStore(schema.localhostTargets, { keyPath: 'id' })
        }
        if (!database.objectStoreNames.contains(schema.defaultLocalhostTarget)) {
          database.createObjectStore(schema.defaultLocalhostTarget, { keyPath: 'key' })
        }
        if (!database.objectStoreNames.contains(schema.metadata)) {
          database.createObjectStore(schema.metadata, { keyPath: 'key' })
        }
      }
      request.onsuccess = () => {
        const database = request.result
        const transaction = database.transaction([
          schema.datasets,
          schema.datasetItems,
          schema.customConfig,
          schema.localhostTargets,
          schema.defaultLocalhostTarget,
          schema.metadata,
        ], 'readonly')
        const datasets = transaction.objectStore(schema.datasets)
        const datasetItems = transaction.objectStore(schema.datasetItems)
        const customConfig = transaction.objectStore(schema.customConfig)
        const localhostTargets = transaction.objectStore(schema.localhostTargets)
        const defaultLocalhostTarget = transaction.objectStore(schema.defaultLocalhostTarget)
        const metadata = transaction.objectStore(schema.metadata)
        const readRequest = <Value>(indexedDbRequest: IDBRequest<Value>): Promise<Value> => {
          return new Promise<Value>((resolveRequest, rejectRequest) => {
            indexedDbRequest.onerror = () => rejectRequest(indexedDbRequest.error)
            indexedDbRequest.onsuccess = () => resolveRequest(indexedDbRequest.result)
          })
        }
        const transactionDone = new Promise<void>((resolveTransaction, rejectTransaction) => {
          transaction.onerror = () => rejectTransaction(transaction.error)
          transaction.onabort = () => rejectTransaction(transaction.error)
          transaction.oncomplete = () => resolveTransaction()
        })

        void (async () => {
          const [datasetRecords, datasetItemRecords, configRecords, targetRecords, defaultTarget, initialized] = await Promise.all([
            readRequest<DatasetRecord[]>(datasets.getAll()),
            readRequest<DatasetItemRecord[]>(datasetItems.getAll()),
            readRequest<ConfigRecord[]>(customConfig.getAll()),
            readRequest<LocalhostTargetRecord[]>(localhostTargets.getAll()),
            readRequest<DefaultLocalhostTargetRecord | undefined>(
              defaultLocalhostTarget.get(schema.defaultLocalhostTargetKey),
            ),
            readRequest<MetadataRecord | undefined>(metadata.get(schema.initializedMetadataKey)),
            transactionDone,
          ])

          if (!initialized) {
            database.close()
            reject(new Error('Extension IndexedDB state is not initialized'))
            return
          }

          const itemsByDatasetId = new Map<string, DatasetItemRecord[]>()

          datasetItemRecords.forEach((record) => {
            const items = itemsByDatasetId.get(record.datasetId) ?? []
            items.push(record)
            itemsByDatasetId.set(record.datasetId, items)
          })
          database.close()
          resolve({
            datasets: [...datasetRecords]
              .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
              .map((record) => ({
                ...record,
                items: [...(itemsByDatasetId.get(record.id) ?? [])]
                  .sort((left, right) => left.position - right.position)
                  .map((itemRecord) => itemRecord.item),
              })),
            customConfig: [...configRecords]
              .sort((left, right) => left.position - right.position)
              .map((record) => record.item),
            localhostPorts: [...targetRecords]
              .sort((left, right) => left.position - right.position)
              .map((record) => record.target),
            defaultLocalhostPort: defaultTarget?.targetKey ?? '',
          })
        })().catch((error: unknown) => {
          database.close()
          reject(error)
        })
      }
    })
  }, INDEXED_DB_SCHEMA)
}

export async function deleteExtensionIndexedDbState(): Promise<void> {
  const serviceWorker = await browser.getServiceWorker()

  await serviceWorker.evaluate(async (databaseName: string) => {
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.deleteDatabase(databaseName)

      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve()
    })
  }, INDEXED_DB_SCHEMA.databaseName)
}
