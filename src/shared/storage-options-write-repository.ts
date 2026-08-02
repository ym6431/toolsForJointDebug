import {
  INDEXED_DB_DEFAULT_LOCALHOST_TARGET_KEY,
  INDEXED_DB_STORES,
} from './constants'
import {
  openStorageDatabase,
  type ConfigRecord,
  type LocalhostTargetRecord,
} from './storage-db'
import { queueDestructiveWriteRequests } from './storage-write-repository'
import type { ConfigItem, LocalhostTarget } from './types'
import { toRecordKey } from './utils'

export async function replaceNormalizedOptionsConfig(
  configItems: ConfigItem[],
  targets: LocalhostTarget[],
  defaultTargetKey: string,
) {
  const configRecords = configItems.map(toConfigRecord)
  const targetRecords = targets.map(toLocalhostTargetRecord)
  const database = await openStorageDatabase()

  try {
    const transaction = database.transaction(
      [
        INDEXED_DB_STORES.customConfig,
        INDEXED_DB_STORES.localhostTargets,
        INDEXED_DB_STORES.defaultLocalhostTarget,
      ],
      'readwrite',
    )
    const customConfig = transaction.objectStore(INDEXED_DB_STORES.customConfig)
    const localhostTargets = transaction.objectStore(INDEXED_DB_STORES.localhostTargets)
    const defaultLocalhostTarget = transaction.objectStore(INDEXED_DB_STORES.defaultLocalhostTarget)
    const requests = queueDestructiveWriteRequests(transaction, (requests) => {
      requests.push(
        customConfig.clear(),
        localhostTargets.clear(),
        defaultLocalhostTarget.clear(),
      )
      configRecords.forEach((record) => {
        requests.push(customConfig.put(record))
      })
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

export async function clearNormalizedOptionsConfig() {
  const database = await openStorageDatabase()

  try {
    const transaction = database.transaction(
      [
        INDEXED_DB_STORES.customConfig,
        INDEXED_DB_STORES.localhostTargets,
        INDEXED_DB_STORES.defaultLocalhostTarget,
      ],
      'readwrite',
    )
    const customConfig = transaction.objectStore(INDEXED_DB_STORES.customConfig)
    const localhostTargets = transaction.objectStore(INDEXED_DB_STORES.localhostTargets)
    const defaultLocalhostTarget = transaction.objectStore(INDEXED_DB_STORES.defaultLocalhostTarget)
    const requests = queueDestructiveWriteRequests(transaction, (requests) => {
      requests.push(
        customConfig.clear(),
        localhostTargets.clear(),
        defaultLocalhostTarget.clear(),
      )
    })

    await Promise.all([...requests, transaction.done])
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
