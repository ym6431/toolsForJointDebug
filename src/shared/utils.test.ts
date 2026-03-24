import { describe, expect, it } from 'vitest'
import {
  dedupeConfig,
  dedupeDatasetItems,
  previewValue,
  toRecordKey,
} from './utils'

describe('shared utils', () => {
  it('creates stable record keys', () => {
    expect(toRecordKey('localStorage', 'theme')).toBe('localStorage:theme')
  })

  it('dedupes config items and drops blank keys', () => {
    const items = [
      { storageType: 'localStorage' as const, key: ' theme ', description: 'A' },
      { storageType: 'localStorage' as const, key: 'theme', description: 'B' },
      { storageType: 'cookie' as const, key: '  ', description: 'ignored' },
      { storageType: 'sessionStorage' as const, key: 'debug', description: 'C' },
    ]

    expect(dedupeConfig(items)).toEqual([
      { storageType: 'localStorage', key: ' theme ', description: 'A' },
      { storageType: 'sessionStorage', key: 'debug', description: 'C' },
    ])
  })

  it('dedupes dataset items by storage type and key', () => {
    const items = [
      { storageType: 'localStorage' as const, key: 'theme', value: 'dark' },
      { storageType: 'localStorage' as const, key: 'theme', value: 'light' },
      { storageType: 'cookie' as const, key: 'locale', value: 'zh-CN' },
    ]

    expect(dedupeDatasetItems(items)).toEqual([
      { storageType: 'localStorage', key: 'theme', value: 'dark' },
      { storageType: 'cookie', key: 'locale', value: 'zh-CN' },
    ])
  })

  it('truncates long preview values', () => {
    expect(previewValue('1234567890', 5)).toBe('12345...')
    expect(previewValue('short', 10)).toBe('short')
  })
})
