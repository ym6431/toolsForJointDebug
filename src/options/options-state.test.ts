import { describe, expect, it } from 'vitest'
import {
  buildExportPayload,
  buildPendingRows,
  buildSavedSnapshot,
  comparePendingWithSnapshot,
  composeMigrationKeyItem,
  filterMigrationKeyRows,
  reconcilePendingAfterRemovingDefault,
  validateComposerDraft,
  validatePendingMigrationKeyRows,
  type PendingMigrationKeyRow,
} from './options-state'
import type { LocalhostTarget } from '../shared/types'

const baseItem = {
  storageType: 'localStorage' as const,
  key: 'userLocale',
  description: '业务语言标识',
}

describe('options-state helpers', () => {
  it('buildPendingRows assigns stable uiId for every row', () => {
    const rows = buildPendingRows([baseItem, { ...baseItem, key: 'theme' }])
    expect(rows).toHaveLength(2)
    expect(rows[0].item).toEqual(baseItem)
    expect(rows[0].uiId).not.toBe(rows[1].uiId)
  })

  it('filterMigrationKeyRows matches key and description case-insensitively', () => {
    const rows = buildPendingRows([
      { ...baseItem, key: 'userLocale', description: '业务语言标识' },
      { ...baseItem, key: 'theme', description: 'UI theme mode' },
      { ...baseItem, key: 'sessionId', description: '' },
    ])

    expect(filterMigrationKeyRows(rows, 'theme')).toHaveLength(1)
    expect(filterMigrationKeyRows(rows, 'THEME')).toHaveLength(1)
    expect(filterMigrationKeyRows(rows, '语言')).toHaveLength(1)
    expect(filterMigrationKeyRows(rows, '   ')).toHaveLength(3)
    expect(filterMigrationKeyRows(rows, 'no-match')).toHaveLength(0)
  })

  it('validateComposerDraft rejects empty key, invalid storage type, and duplicates', () => {
    const rows = buildPendingRows([{ ...baseItem }])

    expect(
      validateComposerDraft(
        { storageType: 'localStorage', key: '   ', description: '' },
        rows,
      ),
    ).toMatchObject({
      accepted: false,
      reason: 'empty-key',
      message: 'Key 不能为空。',
    })

    expect(
      validateComposerDraft(
        { storageType: 'indexedDB' as never, key: 'foo', description: '' },
        rows,
      ),
    ).toMatchObject({
      accepted: false,
      reason: 'unsupported-storage-type',
      message: '不支持的 Storage 类型：indexedDB。',
    })

    expect(
      validateComposerDraft(
        { storageType: 'localStorage', key: 'userLocale', description: 'dup' },
        rows,
      ),
    ).toMatchObject({
      accepted: false,
      reason: 'duplicate-state-type-and-key',
      message: 'localStorage:userLocale 已存在，请使用其它 Key。',
    })
  })

  it('validatePendingMigrationKeyRows returns row-id keyed messages for invalid rows', () => {
    const rows = [
      {
        uiId: 'row-empty',
        item: { storageType: 'localStorage', key: '   ', description: '空键' },
      },
      {
        uiId: 'row-unsupported',
        item: { storageType: 'indexedDB' as never, key: 'theme', description: '不支持' },
      },
      {
        uiId: 'row-dup-a',
        item: { storageType: 'sessionStorage', key: ' theme ', description: 'dup-a' },
      },
      {
        uiId: 'row-dup-b',
        item: { storageType: 'sessionStorage', key: 'theme', description: 'dup-b' },
      },
      {
        uiId: 'row-valid',
        item: { storageType: 'cookie', key: 'token', description: 'ok' },
      },
    ] satisfies PendingMigrationKeyRow[]

    const snapshot = structuredClone(rows)

    expect(validatePendingMigrationKeyRows(rows)).toEqual({
      'row-empty': 'Key 不能为空。',
      'row-unsupported': '不支持的 Storage 类型：indexedDB。',
      'row-dup-a': 'sessionStorage:theme 已存在，请使用其它 Key。',
      'row-dup-b': 'sessionStorage:theme 已存在，请使用其它 Key。',
    })
    expect(rows).toEqual(snapshot)
  })

  it('validatePendingMigrationKeyRows returns no messages for valid rows', () => {
    const rows = [
      {
        uiId: 'row-1',
        item: { storageType: 'localStorage', key: 'theme', description: '主题' },
      },
      {
        uiId: 'row-2',
        item: { storageType: 'sessionStorage', key: 'draft', description: '草稿' },
      },
    ] satisfies PendingMigrationKeyRow[]

    expect(validatePendingMigrationKeyRows(rows)).toEqual({})
  })

  it('validateComposerDraft accepts a new unique item', () => {
    const rows = buildPendingRows([{ ...baseItem }])
    expect(
      validateComposerDraft(
        { storageType: 'sessionStorage', key: '  theme ', description: 'theme' },
        rows,
      ),
    ).toEqual({ accepted: true })
  })

  it('comparePendingWithSnapshot reports dirty state for migrations and targets', () => {
    const baseRows = buildPendingRows([baseItem])
    const snapshot = buildSavedSnapshot({
      customItems: baseRows,
      localhostTargets: [{ protocol: 'http', port: '5173' }] as LocalhostTarget[],
      defaultLocalhostTargetKey: 'http:5173',
    })

    expect(
      comparePendingWithSnapshot(
        {
          customItems: baseRows,
          localhostTargets: [{ protocol: 'http', port: '5173' }] as LocalhostTarget[],
          defaultLocalhostTargetKey: 'http:5173',
        },
        snapshot,
      ),
    ).toBe(false)

    expect(
      comparePendingWithSnapshot(
        {
          customItems: buildPendingRows([{ ...baseItem, description: 'changed' }]),
          localhostTargets: [{ protocol: 'http', port: '5173' }] as LocalhostTarget[],
          defaultLocalhostTargetKey: 'http:5173',
        },
        snapshot,
      ),
    ).toBe(true)
  })

  it('reconcilePendingAfterRemovingDefault keeps remaining targets usable', () => {
    const result = reconcilePendingAfterRemovingDefault(
      [{ protocol: 'http', port: '5173' }] as LocalhostTarget[],
      'http:5173',
      'http:5173',
    )
    expect(result.targets).toHaveLength(0)
    expect(result.defaultKey).toBe('')
  })

  it('reconcilePendingAfterRemovingDefault preserves a still-valid default', () => {
    const result = reconcilePendingAfterRemovingDefault(
      [
        { protocol: 'http', port: '5173' },
        { protocol: 'http', port: '4173' },
      ] as LocalhostTarget[],
      'http:5173',
      'http:4173',
    )
    expect(result.targets).toEqual([{ protocol: 'http', port: '4173' }])
    expect(result.defaultKey).toBe('http:4173')
  })

  it('buildExportPayload emits JSON v3 shape from current pending state', () => {
    const payload = buildExportPayload(
      {
        customItems: buildPendingRows([baseItem]),
        localhostTargets: [{ protocol: 'http', port: '5173' }] as LocalhostTarget[],
        defaultLocalhostTargetKey: 'http:5173',
      },
      '2026-08-02T00:00:00.000Z',
    )

    expect(payload).toEqual({
      version: 3,
      exportedAt: '2026-08-02T00:00:00.000Z',
      localhostTargets: [{ protocol: 'http', port: '5173' }],
      defaultLocalhostTarget: 'http:5173',
      items: [baseItem],
    })
  })

  it('composeMigrationKeyItem trims whitespace from key and description', () => {
    expect(
      composeMigrationKeyItem({
        storageType: 'localStorage',
        key: '  theme  ',
        description: '  UI theme  ',
      }),
    ).toEqual({ storageType: 'localStorage', key: 'theme', description: 'UI theme' })
  })
})
