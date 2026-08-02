import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  clearOptionsConfig,
  ensureStorageInitialized,
  getCustomConfig,
  getDatasets,
  getDefaultLocalhostTargetKey,
  getLocalhostTargets,
  saveDataset,
  saveOptionsConfig,
} from './storage'
import { createStorageTestChrome, resetIndexedDb } from './storage-v2-test-support'

const chrome = createStorageTestChrome()

describe('shared storage v2 options configuration', () => {
  beforeEach(async () => {
    await resetIndexedDb()
    chrome.reset()
  })

  afterEach(async () => {
    await resetIndexedDb()
    chrome.release()
  })

  it('Given custom config, targets, and a dataset, when options configuration is saved, then all normalized options persist without changing the dataset', async () => {
    const dataset = await saveDataset({
      datasetName: 'Existing dataset',
      sourceUrl: 'https://example.com',
      items: [{ storageType: 'localStorage', key: 'theme', value: 'dark' }],
    })

    const saved = await saveOptionsConfig(
      [
        { storageType: 'localStorage', key: ' theme ', description: ' Theme ' },
        { storageType: 'localStorage', key: 'theme', description: 'Ignored duplicate' },
      ],
      [
        { protocol: 'http', port: ' 05173 ' },
        { protocol: 'https', port: '3000' },
        { protocol: 'http', port: '5173' },
      ],
      'https:3000',
    )

    expect(saved).toEqual({
      customConfig: [{ storageType: 'localStorage', key: 'theme', description: 'Theme' }],
      localhostTargets: [
        { protocol: 'http', port: '5173' },
        { protocol: 'https', port: '3000' },
      ],
      defaultLocalhostTargetKey: 'https:3000',
    })
    expect(await getCustomConfig()).toEqual(saved.customConfig)
    expect(await getLocalhostTargets()).toEqual(saved.localhostTargets)
    expect(await getDefaultLocalhostTargetKey()).toBe(saved.defaultLocalhostTargetKey)
    expect(await getDatasets()).toEqual([dataset])
  })

  it('Given persisted options, when the save transaction is aborted after a target write, then no option subset or dataset change persists', async () => {
    await ensureStorageInitialized()
    const persisted = await saveOptionsConfig(
      [{ storageType: 'localStorage', key: 'theme', description: 'Theme' }],
      [{ protocol: 'https', port: '3000' }],
      'https:3000',
    )
    const dataset = await saveDataset({
      datasetName: 'Existing dataset',
      sourceUrl: 'https://example.com',
      items: [{ storageType: 'localStorage', key: 'theme', value: 'dark' }],
    })
    const originalPut = IDBObjectStore.prototype.put
    let putRequests = 0
    const put = vi
      .spyOn(IDBObjectStore.prototype, 'put')
      .mockImplementation(function (this: IDBObjectStore, value: unknown, key?: IDBValidKey) {
        const request = key === undefined ? originalPut.call(this, value) : originalPut.call(this, value, key)
      putRequests += 1

      if (putRequests === 2) {
        this.transaction.abort()
      }

      return request
      })

    try {
      await expect(
        saveOptionsConfig(
          [{ storageType: 'cookie', key: 'locale', description: 'Locale' }],
          [{ protocol: 'http', port: '5173' }],
          'http:5173',
        ),
      ).rejects.toThrow()
    } finally {
      put.mockRestore()
    }

    expect(await getCustomConfig()).toEqual(persisted.customConfig)
    expect(await getLocalhostTargets()).toEqual(persisted.localhostTargets)
    expect(await getDefaultLocalhostTargetKey()).toBe(persisted.defaultLocalhostTargetKey)
    expect(await getDatasets()).toEqual([dataset])
  })

  it('Given persisted options and a dataset, when options configuration is cleared, then every options store clears without changing the dataset', async () => {
    const dataset = await saveDataset({
      datasetName: 'Existing dataset',
      sourceUrl: 'https://example.com',
      items: [{ storageType: 'localStorage', key: 'theme', value: 'dark' }],
    })
    await saveOptionsConfig(
      [{ storageType: 'localStorage', key: 'theme', description: 'Theme' }],
      [{ protocol: 'https', port: '3000' }],
      'https:3000',
    )

    await clearOptionsConfig()

    expect(await getCustomConfig()).toEqual([])
    expect(await getLocalhostTargets()).toEqual([])
    expect(await getDefaultLocalhostTargetKey()).toBe('')
    expect(await getDatasets()).toEqual([dataset])
  })

  it('Given persisted options, when the clear transaction is aborted, then no option store is cleared', async () => {
    await ensureStorageInitialized()
    const persisted = await saveOptionsConfig(
      [{ storageType: 'localStorage', key: 'theme', description: 'Theme' }],
      [{ protocol: 'https', port: '3000' }],
      'https:3000',
    )
    const originalClear = IDBObjectStore.prototype.clear
    let clearRequests = 0
    const clear = vi
      .spyOn(IDBObjectStore.prototype, 'clear')
      .mockImplementation(function (this: IDBObjectStore) {
        const request = originalClear.call(this)
        clearRequests += 1

        if (clearRequests === 3) {
          this.transaction.abort()
        }

        return request
      })

    try {
      await expect(clearOptionsConfig()).rejects.toThrow()
    } finally {
      clear.mockRestore()
    }

    expect(await getCustomConfig()).toEqual(persisted.customConfig)
    expect(await getLocalhostTargets()).toEqual(persisted.localhostTargets)
    expect(await getDefaultLocalhostTargetKey()).toBe(persisted.defaultLocalhostTargetKey)
  })
})
