import 'fake-indexeddb/auto'

import { deleteDB } from 'idb'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { STORAGE_KEYS } from './constants'
import {
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

async function resetIndexedDb() {
  for (const database of await indexedDB.databases()) {
    if (database.name) {
      await deleteDB(database.name)
    }
  }
}

let legacyLocalhostPort = ''

const chromeStorageGet = vi.fn(async () => ({
  [STORAGE_KEYS.datasets]: [],
  [STORAGE_KEYS.customConfig]: [],
  [STORAGE_KEYS.localhostPorts]: [],
  [STORAGE_KEYS.defaultLocalhostPort]: '',
  [STORAGE_KEYS.legacyLocalhostPort]: legacyLocalhostPort,
}))

const chromeStorageSet = vi.fn(async () => undefined)
const chromeStorageRemove = vi.fn(async () => undefined)

const chromeStub = {
  storage: {
    local: {
      get: chromeStorageGet,
      set: chromeStorageSet,
      remove: chromeStorageRemove,
    },
  },
}

describe('shared storage', () => {
  beforeEach(async () => {
    await resetIndexedDb()
    legacyLocalhostPort = ''
    vi.clearAllMocks()
    vi.stubGlobal('chrome', chromeStub)
  })

  afterEach(async () => {
    await resetIndexedDb()
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('Given empty storage, when initialization runs, then defaults are available', async () => {
    await ensureStorageInitialized()

    expect(await getDatasets()).toEqual([])
    expect(await getCustomConfig()).toEqual([])
    expect(await getLocalhostTargets()).toEqual([])
    expect(await getDefaultLocalhostTargetKey()).toBe('')
  })

  it('Given custom config input, when it is saved and reset, then the normalized items persist in IndexedDB', async () => {
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

    await resetCustomConfig()

    expect(await getCustomConfig()).toEqual([])
  })

  it('Given localhost target input, when it is saved and the default key changes, then the normalized targets persist', async () => {
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
    expect(await getLocalhostTargets()).toEqual(saved.localhostTargets)
    expect(await saveDefaultLocalhostTargetKey('http:5173')).toBe('http:5173')
    expect(await getDefaultLocalhostTargetKey()).toBe('http:5173')
  })

  it('Given duplicate dataset items, when a dataset is saved, then the returned record is normalized', async () => {
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
  })

  it('Given a legacy localhostPort value, when storage initializes, then it migrates the normalized value once', async () => {
    legacyLocalhostPort = ' 05173 '

    await ensureStorageInitialized()

    expect(await getLocalhostTargets()).toEqual([{ protocol: 'http', port: '5173' }])
    expect(await getDefaultLocalhostTargetKey()).toBe('http:5173')
    expect(chromeStorageRemove).not.toHaveBeenCalled()
  })

  it('Given more than ten datasets, when they are saved, then only the newest ten remain in newest-first order', async () => {
    for (let index = 0; index < 11; index += 1) {
      await new Promise((resolve) => setTimeout(resolve, 1))
      await saveDataset({
        datasetName: `Dataset ${index + 1}`,
        sourceUrl: `https://example.com/${index + 1}`,
        items: [],
      })
    }

    const datasets = await getDatasets()

    expect(datasets).toHaveLength(10)
    expect(datasets.map((dataset) => dataset.datasetName)).toEqual([
      'Dataset 11',
      'Dataset 10',
      'Dataset 9',
      'Dataset 8',
      'Dataset 7',
      'Dataset 6',
      'Dataset 5',
      'Dataset 4',
      'Dataset 3',
      'Dataset 2',
    ])
  })
})
