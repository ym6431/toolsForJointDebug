import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_STORAGE_STATE, STORAGE_KEYS } from './constants'
import {
  deleteDataset,
  ensureStorageInitialized,
  getCustomConfig,
  getDefaultLocalhostTargetKey,
  getDatasets,
  getLocalhostTargets,
  resetCustomConfig,
  saveCustomConfig,
  saveDataset,
  saveDefaultLocalhostTargetKey,
  saveLocalhostTargetConfig,
} from './storage'
import type { ConfigItem, Dataset, LocalhostTarget } from './types'

type StorageSnapshot = {
  datasets: Dataset[]
  customConfig: ConfigItem[]
  localhostPorts: Array<LocalhostTarget | string>
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
    })

    expect(dataset.datasetName).toBe('Homepage state')
    expect(dataset.items).toEqual([
      { storageType: 'localStorage', key: 'theme', value: 'dark' },
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
    ])
    expect(snapshot.datasets[0]).toEqual(dataset)
  })

  it('saves localhost ports and default port with normalization', async () => {
    const saved = await saveLocalhostTargetConfig(
      [
        { protocol: 'http', port: ' 05173 ' },
        { protocol: 'https', port: '3000' },
        { protocol: 'http', port: '5173' },
      ],
      'https:3000',
    )

    expect(saved).toEqual({
      localhostTargets: [
        { protocol: 'http', port: '5173' },
        { protocol: 'https', port: '3000' },
      ],
      defaultLocalhostTargetKey: 'https:3000',
    })
    expect(await getLocalhostTargets()).toEqual([
      { protocol: 'http', port: '5173' },
      { protocol: 'https', port: '3000' },
    ])
    expect(await getDefaultLocalhostTargetKey()).toBe('https:3000')
  })

  it('keeps default port inside configured list when saving from popup', async () => {
    snapshot.localhostPorts = [
      { protocol: 'http', port: '5173' },
      { protocol: 'https', port: '3000' },
    ]
    snapshot.defaultLocalhostPort = 'http:5173'

    expect(await saveDefaultLocalhostTargetKey('https:3000')).toBe('https:3000')
    expect(await saveDefaultLocalhostTargetKey('http:9999')).toBe('https:3000')
  })

  it('migrates legacy single localhost port into array config', async () => {
    snapshot.localhostPort = '05173'

    expect(await getLocalhostTargets()).toEqual([
      { protocol: 'http', port: '5173' },
    ])
    expect(await getDefaultLocalhostTargetKey()).toBe('http:5173')
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
