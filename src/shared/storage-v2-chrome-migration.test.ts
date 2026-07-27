import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  ensureStorageInitialized,
  getCustomConfig,
  getDatasets,
  getDefaultLocalhostTargetKey,
  getLocalhostTargets,
} from './storage'
import {
  createStorageTestChrome,
  openV2Database,
  resetIndexedDb,
  V2_STORE_NAMES,
} from './storage-v2-test-support'
import type { ConfigItem, Dataset, LocalhostTarget } from './types'

const chrome = createStorageTestChrome()

describe('shared storage chrome.storage.local migration', () => {
  beforeEach(async () => {
    await resetIndexedDb()
    chrome.reset()
  })

  afterEach(async () => {
    await resetIndexedDb()
    chrome.release()
  })

  it('Given complete chrome.storage.local legacy state, when initialization repeats, then every v2 store and public state remain exact', async () => {
    const legacyDatasets: Dataset[] = [
      {
        id: 'legacy-current-dataset',
        datasetName: 'Legacy current dataset',
        sourceUrl: 'https://example.com/current',
        createdAt: '2026-01-02T00:00:00.000Z',
        items: [
          { storageType: 'localStorage', key: 'theme', value: 'dark' },
          { storageType: 'sessionStorage', key: 'view', value: 'grid' },
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
              storeId: 'profile-1',
              partitionKey: {
                topLevelSite: 'https://example.com',
                hasCrossSiteAncestor: false,
              },
            },
          },
        ],
      },
      {
        id: 'legacy-older-dataset',
        datasetName: 'Legacy older dataset',
        sourceUrl: 'https://example.com/older',
        createdAt: '2026-01-01T00:00:00.000Z',
        items: [{ storageType: 'localStorage', key: 'density', value: 'compact' }],
      },
    ]
    const legacyConfig: ConfigItem[] = [
      { storageType: 'localStorage', key: 'theme', description: 'Theme' },
      { storageType: 'sessionStorage', key: 'view', description: 'View' },
      { storageType: 'cookie', key: 'locale', description: 'Locale' },
    ]
    const legacyTargets: LocalhostTarget[] = [
      { protocol: 'http', port: '5173' },
      { protocol: 'https', port: '3000' },
      { protocol: 'http', port: '8787' },
    ]
    chrome.setState({
      datasets: legacyDatasets,
      customConfig: legacyConfig,
      localhostPorts: legacyTargets,
      defaultLocalhostPort: 'https:3000',
    })

    await ensureStorageInitialized()
    await ensureStorageInitialized()

    const database = await openV2Database()

    try {
      expect(chrome.storageGet).toHaveBeenCalledTimes(1)
      expect([...database.objectStoreNames].sort()).toEqual(V2_STORE_NAMES)
      expect(await getDatasets()).toEqual(legacyDatasets)
      expect(await getCustomConfig()).toEqual(legacyConfig)
      expect(await getLocalhostTargets()).toEqual(legacyTargets)
      expect(await getDefaultLocalhostTargetKey()).toBe('https:3000')
      expect(await database.getAll('datasets')).toEqual(
        legacyDatasets.map(({ items: _items, ...dataset }) => dataset),
      )
      expect(await database.getAll('dataset-items')).toEqual(
        legacyDatasets.flatMap((dataset) =>
          dataset.items.map((item, position) => ({
            datasetId: dataset.id,
            position,
            item,
          })),
        ),
      )
      expect(await database.getAll('custom-config')).toEqual([
        { id: '0:localStorage:theme', position: 0, item: legacyConfig[0] },
        { id: '1:sessionStorage:view', position: 1, item: legacyConfig[1] },
        { id: '2:cookie:locale', position: 2, item: legacyConfig[2] },
      ])
      expect(await database.getAll('localhost-targets')).toEqual([
        { id: '0:http:5173', position: 0, target: legacyTargets[0] },
        { id: '1:https:3000', position: 1, target: legacyTargets[1] },
        { id: '2:http:8787', position: 2, target: legacyTargets[2] },
      ])
      expect(await database.getAll('default-localhost-target')).toEqual([
        { key: 'current', targetKey: 'https:3000' },
      ])
      expect(await database.getAll('metadata')).toEqual([{ key: 'initialized', initialized: true }])
    } finally {
      database.close()
    }
  })
})
