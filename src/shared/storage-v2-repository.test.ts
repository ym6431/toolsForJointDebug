import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  deleteDataset,
  ensureStorageInitialized,
  getCustomConfig,
  getDatasets,
  getDefaultLocalhostTargetKey,
  getLocalhostTargets,
  saveCustomConfig,
  saveDataset,
  saveLocalhostTargetConfig,
} from './storage'
import {
  replaceNormalizedCustomConfig,
  replaceNormalizedLocalhostTargets,
  saveNormalizedDataset,
} from './storage-repository'
import {
  createStorageTestChrome,
  openV2Database,
  resetIndexedDb,
} from './storage-v2-test-support'
import type { ConfigItem, Dataset, DatasetItem, LocalhostTarget } from './types'

type CloneFailingRecord<T extends object> = T & {
  cloneFailure: () => void
}

const chrome = createStorageTestChrome()

describe('shared storage v2 repository behavior', () => {
  beforeEach(async () => {
    await resetIndexedDb()
    chrome.reset()
  })

  afterEach(async () => {
    await resetIndexedDb()
    chrome.release()
  })

  it('Given a persisted dataset ID, when it is replaced with fewer items, then stale child records are removed atomically', async () => {
    const originalDataset: Dataset = {
      id: 'stable-dataset-id',
      datasetName: 'Original dataset',
      sourceUrl: 'https://example.com/original',
      createdAt: '2026-01-01T00:00:00.000Z',
      items: [
        { storageType: 'localStorage', key: 'theme', value: 'dark' },
        { storageType: 'sessionStorage', key: 'view', value: 'list' },
      ],
    }
    const replacementDataset: Dataset = {
      id: originalDataset.id,
      datasetName: 'Replacement dataset',
      sourceUrl: 'https://example.com/replacement',
      createdAt: '2026-01-02T00:00:00.000Z',
      items: [{ storageType: 'cookie', key: 'locale', value: 'zh-CN' }],
    }

    await ensureStorageInitialized()
    await saveNormalizedDataset(originalDataset)
    await saveNormalizedDataset(replacementDataset)

    const database = await openV2Database()

    try {
      expect(await getDatasets()).toEqual([replacementDataset])
      expect(await database.getAll('dataset-items')).toEqual([
        {
          datasetId: replacementDataset.id,
          position: 0,
          item: replacementDataset.items[0],
        },
      ])
    } finally {
      database.close()
    }
  })

  it('Given a persisted dataset, when replacement item cloning throws, then the prior dataset remains', async () => {
    const persistedDataset: Dataset = {
      id: 'clone-safe-dataset',
      datasetName: 'Persisted dataset',
      sourceUrl: 'https://example.com/persisted',
      createdAt: '2026-01-01T00:00:00.000Z',
      items: [{ storageType: 'localStorage', key: 'theme', value: 'dark' }],
    }
    const invalidReplacement: Omit<Dataset, 'items'> & {
      items: CloneFailingRecord<DatasetItem>[]
    } = {
      id: persistedDataset.id,
      datasetName: 'Invalid replacement',
      sourceUrl: 'https://example.com/invalid',
      createdAt: '2026-01-02T00:00:00.000Z',
      items: [
        {
          storageType: 'localStorage',
          key: 'theme',
          value: 'light',
          cloneFailure() {},
        },
      ],
    }

    await ensureStorageInitialized()
    await saveNormalizedDataset(persistedDataset)

    await expect(saveNormalizedDataset(invalidReplacement)).rejects.toThrow()

    expect(await getDatasets()).toEqual([persistedDataset])
  })

  it('Given persisted custom config, when replacement config cloning throws, then the prior config remains', async () => {
    const persistedConfig: ConfigItem[] = [
      { storageType: 'localStorage', key: 'theme', description: 'Theme' },
    ]
    const invalidConfig: CloneFailingRecord<ConfigItem>[] = [
      {
        storageType: 'cookie',
        key: 'locale',
        description: 'Locale',
        cloneFailure() {},
      },
    ]

    await ensureStorageInitialized()
    await replaceNormalizedCustomConfig(persistedConfig)

    await expect(replaceNormalizedCustomConfig(invalidConfig)).rejects.toThrow()

    expect(await getCustomConfig()).toEqual(persistedConfig)
  })

  it('Given persisted targets, when replacement target cloning throws, then the prior targets and default remain', async () => {
    const persistedTargets: LocalhostTarget[] = [{ protocol: 'https', port: '3000' }]
    const invalidTargets: CloneFailingRecord<LocalhostTarget>[] = [
      {
        protocol: 'http',
        port: '5173',
        cloneFailure() {},
      },
    ]

    await ensureStorageInitialized()
    await replaceNormalizedLocalhostTargets(persistedTargets, 'https:3000')

    await expect(replaceNormalizedLocalhostTargets(invalidTargets, 'http:5173')).rejects.toThrow()

    expect(await getLocalhostTargets()).toEqual(persistedTargets)
    expect(await getDefaultLocalhostTargetKey()).toBe('https:3000')
  })

  it('Given an existing dataset, when config and targets are saved, then the dataset remains unchanged', async () => {
    const dataset = await saveDataset({
      datasetName: 'Existing dataset',
      sourceUrl: 'https://example.com',
      items: [{ storageType: 'localStorage', key: 'theme', value: 'dark' }],
    })

    await saveCustomConfig([{ storageType: 'cookie', key: 'locale', description: 'Locale' }])
    await saveLocalhostTargetConfig([{ protocol: 'https', port: '3000' }], 'https:3000')

    expect(await getDatasets()).toEqual([dataset])
  })

  it('Given existing config and targets, when a dataset is saved and deleted, then the configuration remains unchanged', async () => {
    const config = await saveCustomConfig([
      { storageType: 'localStorage', key: 'theme', description: 'Theme' },
    ])
    const targets = await saveLocalhostTargetConfig(
      [{ protocol: 'http', port: '5173' }],
      'http:5173',
    )
    const dataset = await saveDataset({
      datasetName: 'Temporary dataset',
      sourceUrl: 'https://example.com',
      items: [{ storageType: 'sessionStorage', key: 'view', value: 'grid' }],
    })

    await deleteDataset(dataset.id)

    expect(await getCustomConfig()).toEqual(config)
    expect(await getLocalhostTargets()).toEqual(targets.localhostTargets)
    expect(await getDefaultLocalhostTargetKey()).toBe(targets.defaultLocalhostTargetKey)
  })
})
