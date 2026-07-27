import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { INDEXED_DB_STORE } from './constants'
import {
  deleteDataset,
  ensureStorageInitialized,
  getCustomConfig,
  getDefaultLocalhostTargetKey,
  getDatasets,
  getLocalhostTargets,
  saveDataset,
} from './storage'
import type { Dataset } from './types'
import {
  createStorageTestChrome,
  createV1Database,
  openV2Database,
  resetIndexedDb,
  V2_STORE_NAMES,
} from './storage-v2-test-support'

const chrome = createStorageTestChrome()

describe('shared storage v2 schema', () => {
  beforeEach(async () => {
    await resetIndexedDb()
    chrome.reset()
  })

  afterEach(async () => {
    await resetIndexedDb()
    chrome.release()
  })

  it('Given a v1 app-state record, when storage opens, then its data is atomically normalized into the six v2 stores', async () => {
    const migratedDataset: Dataset = {
      id: 'v1-dataset',
      datasetName: 'V1 dataset',
      sourceUrl: 'https://example.com',
      createdAt: '2026-01-01T00:00:00.000Z',
      items: [
        { storageType: 'localStorage', key: 'theme', value: 'dark' },
        { storageType: 'sessionStorage', key: 'page', value: 'home' },
        {
          storageType: 'cookie',
          key: 'locale',
          value: 'zh-CN',
          cookie: {
            domain: '.example.com',
            hostOnly: false,
            path: '/',
            secure: true,
            httpOnly: true,
            sameSite: 'strict',
            session: false,
            expirationDate: 1_800_000_000,
          },
        },
      ],
    }
    await createV1Database({
      datasets: [migratedDataset],
      customConfig: [{ storageType: 'localStorage', key: 'theme', description: 'Theme' }],
      localhostPorts: [{ protocol: 'http', port: '5173' }],
      defaultLocalhostPort: 'http:5173',
    })

    await ensureStorageInitialized()

    const database = await openV2Database()

    try {
      expect([...database.objectStoreNames].sort()).toEqual(V2_STORE_NAMES)
      expect([...database.objectStoreNames]).not.toContain(INDEXED_DB_STORE)
      expect(await database.getAll('datasets')).toEqual([
        {
          id: migratedDataset.id,
          datasetName: migratedDataset.datasetName,
          sourceUrl: migratedDataset.sourceUrl,
          createdAt: migratedDataset.createdAt,
        },
      ])
      expect(await database.getAll('dataset-items')).toEqual(
        migratedDataset.items.map((item, position) => ({
          datasetId: migratedDataset.id,
          position,
          item,
        })),
      )
      expect(await database.getAll('custom-config')).toEqual([
        {
          id: '0:localStorage:theme',
          position: 0,
          item: { storageType: 'localStorage', key: 'theme', description: 'Theme' },
        },
      ])
      expect(await database.getAll('localhost-targets')).toEqual([
        {
          id: '0:http:5173',
          position: 0,
          target: { protocol: 'http', port: '5173' },
        },
      ])
      expect(await database.getAll('default-localhost-target')).toEqual([
        { key: 'current', targetKey: 'http:5173' },
      ])
      expect(await database.getAll('metadata')).toEqual([{ key: 'initialized', initialized: true }])
      expect(await getDatasets()).toEqual([migratedDataset])
      expect(await getCustomConfig()).toEqual([
        { storageType: 'localStorage', key: 'theme', description: 'Theme' },
      ])
      expect(await getLocalhostTargets()).toEqual([{ protocol: 'http', port: '5173' }])
      expect(await getDefaultLocalhostTargetKey()).toBe('http:5173')
    } finally {
      database.close()
    }
  })

  it('Given a saved dataset, when it is deleted, then its normalized items are deleted with it', async () => {
    const dataset = await saveDataset({
      datasetName: 'Delete me',
      sourceUrl: 'https://example.com',
      items: [{ storageType: 'localStorage', key: 'theme', value: 'dark' }],
    })

    const remainingDatasets = await deleteDataset(dataset.id)
    const database = await openV2Database()

    try {
      expect(remainingDatasets).toEqual([])
      expect(await database.get('datasets', dataset.id)).toBeUndefined()
      expect(await database.getAll('dataset-items')).toEqual([])
    } finally {
      database.close()
    }
  })

  it('Given more than the retained dataset limit, when the oldest dataset is pruned, then no item record is orphaned', async () => {
    for (let index = 0; index < 11; index += 1) {
      await saveDataset({
        datasetName: `Dataset ${index + 1}`,
        sourceUrl: `https://example.com/${index + 1}`,
        items: [{ storageType: 'localStorage', key: `key-${index + 1}`, value: 'value' }],
      })
    }

    const database = await openV2Database()

    try {
      const datasets = await database.getAll('datasets')
      const datasetItems = await database.getAll('dataset-items')
      const datasetIds = new Set(datasets.map((dataset) => dataset.id))

      expect(datasets).toHaveLength(10)
      expect(datasetItems).toHaveLength(10)
      expect(datasetItems.every((item) => datasetIds.has(item.datasetId))).toBe(true)
    } finally {
      database.close()
    }
  })
})
