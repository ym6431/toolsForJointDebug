import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_STORAGE_STATE, STORAGE_KEYS } from './constants'
import {
  deleteDataset,
  ensureStorageInitialized,
  getCustomConfig,
  getDatasets,
  resetCustomConfig,
  saveCustomConfig,
  saveDataset,
} from './storage'
import type { ConfigItem, Dataset } from './types'

type StorageSnapshot = {
  datasets: Dataset[]
  customConfig: ConfigItem[]
}

describe('shared storage', () => {
  let snapshot: StorageSnapshot

  beforeEach(() => {
    snapshot = structuredClone(DEFAULT_STORAGE_STATE)

    globalThis.chrome = {
      storage: {
        local: {
          get: vi.fn(async (keys?: string | string[] | Record<string, unknown> | null) => {
            if (!keys || Array.isArray(keys) || typeof keys === 'string') {
              return {
                [STORAGE_KEYS.datasets]: snapshot.datasets,
                [STORAGE_KEYS.customConfig]: snapshot.customConfig,
              }
            }

            return {
              [STORAGE_KEYS.datasets]:
                snapshot.datasets ?? keys[STORAGE_KEYS.datasets],
              [STORAGE_KEYS.customConfig]:
                snapshot.customConfig ?? keys[STORAGE_KEYS.customConfig],
            }
          }),
          set: vi.fn(async (items: Record<string, unknown>) => {
            snapshot = {
              ...snapshot,
              ...items,
            } as StorageSnapshot
          }),
          remove: vi.fn(async (keys: string | string[]) => {
            const allKeys = Array.isArray(keys) ? keys : [keys]

            for (const key of allKeys) {
              if (key === STORAGE_KEYS.customConfig) {
                snapshot.customConfig = []
              }
            }
          }),
        },
      },
      runtime: {} as typeof chrome.runtime,
      tabs: {} as typeof chrome.tabs,
    } as unknown as typeof chrome
  })

  it('initializes storage with defaults', async () => {
    await ensureStorageInitialized()

    expect(chrome.storage.local.set).toHaveBeenCalledWith({
      [STORAGE_KEYS.datasets]: [],
      [STORAGE_KEYS.customConfig]: [],
    })
  })

  it('saves custom config with trimming and dedupe', async () => {
    const saved = await saveCustomConfig([
      { storageType: 'localStorage', key: ' theme ', description: ' Theme ' },
      { storageType: 'localStorage', key: 'theme', description: 'ignored' },
      { storageType: 'cookie', key: 'lang', description: ' Locale ' },
    ])

    expect(saved).toEqual([
      { storageType: 'localStorage', key: 'theme', description: 'Theme' },
      { storageType: 'cookie', key: 'lang', description: 'Locale' },
    ])
    expect(await getCustomConfig()).toEqual(saved)
  })

  it('resets custom config', async () => {
    snapshot.customConfig = [
      { storageType: 'cookie', key: 'lang', description: 'locale' },
    ]

    await resetCustomConfig()

    expect(snapshot.customConfig).toEqual([])
  })

  it('saves datasets with normalized name and deduped items', async () => {
    const dataset = await saveDataset({
      datasetName: '  Homepage state  ',
      sourceUrl: 'https://example.com',
      items: [
        { storageType: 'localStorage', key: 'theme', value: 'dark' },
        { storageType: 'localStorage', key: 'theme', value: 'light' },
      ],
    })

    expect(dataset.datasetName).toBe('Homepage state')
    expect(dataset.items).toEqual([
      { storageType: 'localStorage', key: 'theme', value: 'dark' },
    ])
    expect(snapshot.datasets[0]).toEqual(dataset)
  })

  it('returns datasets sorted by createdAt descending', async () => {
    snapshot.datasets = [
      {
        id: 'older',
        datasetName: 'Older',
        sourceUrl: 'https://example.com/older',
        createdAt: '2024-01-01T00:00:00.000Z',
        items: [],
      },
      {
        id: 'newer',
        datasetName: 'Newer',
        sourceUrl: 'https://example.com/newer',
        createdAt: '2024-02-01T00:00:00.000Z',
        items: [],
      },
    ]

    await deleteDataset('older')

    expect(snapshot.datasets.map((item) => item.id)).toEqual(['newer'])
    expect((await getDatasets()).map((item) => item.id)).toEqual(['newer'])
  })
})
