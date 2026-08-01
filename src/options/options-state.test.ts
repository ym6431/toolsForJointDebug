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
    ).toMatchObject({ accepted: false, reason: 'empty-key' })

    expect(
      validateComposerDraft(
        { storageType: 'indexedDB' as never, key: 'foo', description: '' },
        rows,
      ),
    ).toMatchObject({
      accepted: false,
      reason: 'unsupported-storage-type',
    })

    expect(
      validateComposerDraft(
        { storageType: 'localStorage', key: 'userLocale', description: 'dup' },
        rows,
      ),
    ).toMatchObject({
      accepted: false,
      reason: 'duplicate-state-type-and-key',
    })
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