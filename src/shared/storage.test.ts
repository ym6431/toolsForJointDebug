import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_STORAGE_STATE, STORAGE_KEYS } from './constants'
import {
  deleteDataset,
  ensureStorageInitialized,
  getCustomConfig,
  getDatasets,
  getDefaultLocalhostPort,
  getLocalhostPorts,
  resetCustomConfig,
  saveCustomConfig,
  saveDataset,
  saveDefaultLocalhostPort,
  saveLocalhostTargetConfig,
} from './storage'
import type { ConfigItem, Dataset } from './types'

type StorageSnapshot = {
  datasets: Dataset[]
  customConfig: ConfigItem[]
  localhostPorts: string[]
  defaultLocalhostPort: string
  localhostPort?: string
}

describe('shared storage', () => {
  let snapshot: StorageSnapshot

  beforeEach(() => {
    snapshot = structuredClone({
      ...DEFAULT_STORAGE_STATE,
      localhostPort: '',
    })

    globalThis.chrome = {
      storage: {
        local: {
          get: vi.fn(async (keys?: string | string[] | Record<string, unknown> | null) => {
            if (!keys || Array.isArray(keys) || typeof keys === 'string') {
              return {
                [STORAGE_KEYS.datasets]: snapshot.datasets,
                [STORAGE_KEYS.customConfig]: snapshot.customConfig,
                [STORAGE_KEYS.localhostPorts]: snapshot.localhostPorts,
                [STORAGE_KEYS.defaultLocalhostPort]: snapshot.defaultLocalhostPort,
                [STORAGE_KEYS.legacyLocalhostPort]: snapshot.localhostPort,
              }
            }

            return {
              [STORAGE_KEYS.datasets]:
                snapshot.datasets ?? keys[STORAGE_KEYS.datasets],
              [STORAGE_KEYS.customConfig]:
                snapshot.customConfig ?? keys[STORAGE_KEYS.customConfig],
              [STORAGE_KEYS.localhostPorts]:
                snapshot.localhostPorts ?? keys[STORAGE_KEYS.localhostPorts],
              [STORAGE_KEYS.defaultLocalhostPort]:
                snapshot.defaultLocalhostPort ?? keys[STORAGE_KEYS.defaultLocalhostPort],
              [STORAGE_KEYS.legacyLocalhostPort]:
                snapshot.localhostPort ?? keys[STORAGE_KEYS.legacyLocalhostPort],
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
      [STORAGE_KEYS.localhostPorts]: [],
      [STORAGE_KEYS.defaultLocalhostPort]: '',
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

  it('saves localhost ports and default port with normalization', async () => {
    const saved = await saveLocalhostTargetConfig(
      [' 05173 ', '3000', '5173', 'abc'],
      '3000',
    )

    expect(saved).toEqual({
      localhostPorts: ['5173', '3000'],
      defaultLocalhostPort: '3000',
    })
    expect(await getLocalhostPorts()).toEqual(['5173', '3000'])
    expect(await getDefaultLocalhostPort()).toBe('3000')
  })

  it('keeps default port inside configured list when saving from popup', async () => {
    snapshot.localhostPorts = ['5173', '3000']
    snapshot.defaultLocalhostPort = '5173'

    expect(await saveDefaultLocalhostPort('3000')).toBe('3000')
    expect(await saveDefaultLocalhostPort('9999')).toBe('5173')
  })

  it('migrates legacy single localhost port into array config', async () => {
    snapshot.localhostPort = '05173'

    expect(await getLocalhostPorts()).toEqual(['5173'])
    expect(await getDefaultLocalhostPort()).toBe('5173')
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
