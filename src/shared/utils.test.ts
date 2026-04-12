import { describe, expect, it } from 'vitest'
import {
  buildLocalhostUrl,
  dedupeConfig,
  dedupeDatasetItems,
  formatDisplayHost,
  formatLocalhostTarget,
  normalizeLocalhostTarget,
  normalizeLocalhostTargetKey,
  normalizeLocalhostTargetList,
  normalizePort,
  normalizePortList,
  previewValue,
  resolveDefaultLocalhostTargetKey,
  serializeLocalhostTarget,
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

  it('normalizes valid ports and rejects invalid values', () => {
    expect(normalizePort(' 05173 ')).toBe('5173')
    expect(normalizePort('65535')).toBe('65535')
    expect(normalizePort('0')).toBe('')
    expect(normalizePort('65536')).toBe('')
    expect(normalizePort('abc')).toBe('')
  })

  it('normalizes and dedupes port lists', () => {
    expect(normalizePortList([' 05173 ', '3000', '5173', 'abc'])).toEqual([
      '5173',
      '3000',
    ])
  })

  it('normalizes localhost targets from legacy and new formats', () => {
    expect(normalizeLocalhostTarget(' 05173 ')).toEqual({
      protocol: 'http',
      port: '5173',
    })
    expect(normalizeLocalhostTarget('https://localhost:8443/')).toEqual({
      protocol: 'https',
      port: '8443',
    })
    expect(normalizeLocalhostTarget({ protocol: 'https', port: ' 0443 ' })).toEqual({
      protocol: 'https',
      port: '443',
    })
    expect(normalizeLocalhostTarget('ftp://localhost:21')).toBeNull()
  })

  it('serializes, formats, and resolves localhost targets', () => {
    const targets = normalizeLocalhostTargetList([
      '5173',
      { protocol: 'https', port: '8443' },
      'http:5173',
    ])

    expect(targets).toEqual([
      { protocol: 'http', port: '5173' },
      { protocol: 'https', port: '8443' },
    ])
    expect(serializeLocalhostTarget(targets[0]!)).toBe('http:5173')
    expect(normalizeLocalhostTargetKey('https://localhost:8443')).toBe('https:8443')
    expect(formatLocalhostTarget(targets[1]!)).toBe('https://localhost:8443')
    expect(buildLocalhostUrl(targets[1]!)).toBe('https://localhost:8443/')
    expect(resolveDefaultLocalhostTargetKey(targets, 'https:8443')).toBe('https:8443')
    expect(resolveDefaultLocalhostTargetKey(targets, 'https:3000')).toBe('http:5173')
  })

  it('formats source urls into trimmed hosts', () => {
    expect(formatDisplayHost('https://sub.example.com/path')).toBe('example.com')
    expect(formatDisplayHost('https://aaa.bbb.ccc:8080/demo')).toBe(
      'bbb.ccc:8080',
    )
    expect(formatDisplayHost('https://foo.bar.example.com.cn/demo')).toBe(
      'bar.example.com.cn',
    )
    expect(formatDisplayHost('http://localhost:5173')).toBe('localhost:5173')
    expect(formatDisplayHost('https://127.0.0.1:3000')).toBe('127.0.0.1')
    expect(formatDisplayHost('https://[2001:db8::1]:3000')).toBe('2001:db8::1')
  })
})
