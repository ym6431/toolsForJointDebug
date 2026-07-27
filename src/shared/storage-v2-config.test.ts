import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  ensureStorageInitialized,
  getCustomConfig,
  getDefaultLocalhostTargetKey,
  getLocalhostTargets,
  saveCustomConfig,
  saveLocalhostTargetConfig,
} from './storage'
import {
  createStorageTestChrome,
  openV2Database,
  resetIndexedDb,
} from './storage-v2-test-support'

const chrome = createStorageTestChrome()

describe('shared storage v2 configuration stores', () => {
  beforeEach(async () => {
    await resetIndexedDb()
    chrome.reset()
  })

  afterEach(async () => {
    await resetIndexedDb()
    chrome.release()
  })

  it('Given duplicate custom config input, when it is saved, then normalized records are stored only in custom-config', async () => {
    await ensureStorageInitialized()

    const savedConfig = await saveCustomConfig([
      { storageType: 'localStorage', key: ' theme ', description: ' Theme ' },
      { storageType: 'localStorage', key: 'theme', description: 'Ignored duplicate' },
      { storageType: 'cookie', key: 'lang', description: ' Locale ' },
    ])
    const database = await openV2Database()

    try {
      expect(savedConfig).toEqual([
        { storageType: 'localStorage', key: 'theme', description: 'Theme' },
        { storageType: 'cookie', key: 'lang', description: 'Locale' },
      ])
      expect(await getCustomConfig()).toEqual(savedConfig)
      expect(await database.getAll('custom-config')).toEqual([
        {
          id: '0:localStorage:theme',
          position: 0,
          item: { storageType: 'localStorage', key: 'theme', description: 'Theme' },
        },
        {
          id: '1:cookie:lang',
          position: 1,
          item: { storageType: 'cookie', key: 'lang', description: 'Locale' },
        },
      ])
      expect(await database.getAll('datasets')).toEqual([])
      expect(await database.getAll('dataset-items')).toEqual([])
      expect(await database.getAll('localhost-targets')).toEqual([])
    } finally {
      database.close()
    }
  })

  it('Given localhost targets and a default key, when they are saved, then target and default records stay separated', async () => {
    await ensureStorageInitialized()

    const savedTargets = await saveLocalhostTargetConfig(
      [
        { protocol: 'http', port: ' 05173 ' },
        { protocol: 'https', port: '3000' },
        { protocol: 'http', port: '5173' },
      ],
      'https:3000',
    )
    const database = await openV2Database()

    try {
      expect(savedTargets).toEqual({
        localhostTargets: [
          { protocol: 'http', port: '5173' },
          { protocol: 'https', port: '3000' },
        ],
        defaultLocalhostTargetKey: 'https:3000',
      })
      expect(await getLocalhostTargets()).toEqual(savedTargets.localhostTargets)
      expect(await getDefaultLocalhostTargetKey()).toBe(savedTargets.defaultLocalhostTargetKey)
      expect(await database.getAll('localhost-targets')).toEqual([
        {
          id: '0:http:5173',
          position: 0,
          target: { protocol: 'http', port: '5173' },
        },
        {
          id: '1:https:3000',
          position: 1,
          target: { protocol: 'https', port: '3000' },
        },
      ])
      expect(await database.getAll('default-localhost-target')).toEqual([
        { key: 'current', targetKey: 'https:3000' },
      ])
      expect(await database.getAll('custom-config')).toEqual([])
      expect(await database.getAll('datasets')).toEqual([])
      expect(await database.getAll('dataset-items')).toEqual([])
    } finally {
      database.close()
    }
  })
})
