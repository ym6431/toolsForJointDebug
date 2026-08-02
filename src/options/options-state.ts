import { createId } from '../shared/utils'
import type { ConfigItem, LocalhostTarget, StorageType } from '../shared/types'
import { serializeLocalhostTarget, resolveDefaultLocalhostTargetKey } from '../shared/utils'

export type StorageTypeValue = StorageType

export interface PendingMigrationKeyRow {
  uiId: string
  item: ConfigItem
}

export interface PendingState {
  customItems: PendingMigrationKeyRow[]
  localhostTargets: LocalhostTarget[]
  defaultLocalhostTargetKey: string
}

export interface SavedSnapshot {
  customItems: ConfigItem[]
  localhostTargets: LocalhostTarget[]
  defaultLocalhostTargetKey: string
}

export interface ComposerDraft {
  storageType: StorageType
  key: string
  description: string
}

export interface LocalhostDraft {
  protocol: 'http' | 'https'
  port: string
}

export interface ImportNormalizedPayload {
  localhostTargets: LocalhostTarget[]
  defaultLocalhostTargetKey: string
  items: ConfigItem[]
}

export type AppendRejectionReason =
  | 'empty-key'
  | 'unsupported-storage-type'
  | 'duplicate-state-type-and-key'

export interface AppendValidation {
  accepted: boolean
  reason?: AppendRejectionReason
  message?: string
}

export type PendingMigrationRowValidationMessages = Readonly<Record<string, string>>

const SUPPORTED_STORAGE_TYPES: ReadonlySet<StorageType> = new Set([
  'localStorage',
  'sessionStorage',
  'cookie',
])

export function isSupportedStorageType(value: unknown): value is StorageType {
  return typeof value === 'string' && SUPPORTED_STORAGE_TYPES.has(value as StorageType)
}

export function buildPendingRows(items: ConfigItem[]): PendingMigrationKeyRow[] {
  return items.map((item) => ({ uiId: createId(), item }))
}

export function filterMigrationKeyRows(
  rows: PendingMigrationKeyRow[],
  query: string,
): PendingMigrationKeyRow[] {
  const trimmedQuery = query.trim().toLowerCase()

  if (!trimmedQuery) {
    return rows
  }

  return rows.filter(({ item }) => {
    const key = item.key.toLowerCase()
    const description = item.description.toLowerCase()
    return key.includes(trimmedQuery) || description.includes(trimmedQuery)
  })
}

export function validateComposerDraft(
  draft: ComposerDraft,
  existingRows: PendingMigrationKeyRow[],
): AppendValidation {
  const trimmedKey = draft.key.trim()

  if (!trimmedKey) {
    return {
      accepted: false,
      reason: 'empty-key',
      message: 'Key 不能为空。',
    }
  }

  if (!isSupportedStorageType(draft.storageType)) {
    return {
      accepted: false,
      reason: 'unsupported-storage-type',
      message: `不支持的 Storage 类型：${String(draft.storageType)}。`,
    }
  }

  const duplicate = existingRows.some(
    ({ item }) =>
      item.storageType === draft.storageType && item.key.trim() === trimmedKey,
  )

  if (duplicate) {
    return {
      accepted: false,
      reason: 'duplicate-state-type-and-key',
      message: `${draft.storageType}:${trimmedKey} 已存在，请使用其它 Key。`,
    }
  }

  return { accepted: true }
}

export function validatePendingMigrationKeyRows(
  rows: PendingMigrationKeyRow[],
): PendingMigrationRowValidationMessages {
  const normalizedRows = rows.map(({ uiId, item }) => ({
    uiId,
    storageType: item.storageType,
    trimmedKey: item.key.trim(),
    supportedStorageType: isSupportedStorageType(item.storageType),
  }))

  const duplicateCounts = new Map<string, number>()

  for (const row of normalizedRows) {
    if (!row.supportedStorageType || !row.trimmedKey) {
      continue
    }

    const duplicateKey = `${row.storageType}\u0000${row.trimmedKey}`
    duplicateCounts.set(duplicateKey, (duplicateCounts.get(duplicateKey) ?? 0) + 1)
  }

  const messages: Record<string, string> = {}

  for (const row of normalizedRows) {
    if (!row.trimmedKey) {
      messages[row.uiId] = 'Key 不能为空。'
      continue
    }

    if (!row.supportedStorageType) {
      messages[row.uiId] = `不支持的 Storage 类型：${String(row.storageType)}。`
      continue
    }

    const duplicateKey = `${row.storageType}\u0000${row.trimmedKey}`
    if ((duplicateCounts.get(duplicateKey) ?? 0) > 1) {
      messages[row.uiId] = `${row.storageType}:${row.trimmedKey} 已存在，请使用其它 Key。`
    }
  }

  return messages
}

export function composeMigrationKeyItem(draft: ComposerDraft): ConfigItem {
  return {
    storageType: draft.storageType,
    key: draft.key.trim(),
    description: draft.description.trim(),
  }
}

export function comparePendingWithSnapshot(
  pending: PendingState,
  snapshot: SavedSnapshot,
): boolean {
  if (pending.defaultLocalhostTargetKey !== snapshot.defaultLocalhostTargetKey) {
    return true
  }

  if (pending.localhostTargets.length !== snapshot.localhostTargets.length) {
    return true
  }

  for (let index = 0; index < pending.localhostTargets.length; index += 1) {
    const pendingTarget = pending.localhostTargets[index]
    const snapshotTarget = snapshot.localhostTargets[index]

    if (!pendingTarget || !snapshotTarget) {
      return true
    }

    if (
      pendingTarget.protocol !== snapshotTarget.protocol ||
      pendingTarget.port !== snapshotTarget.port
    ) {
      return true
    }
  }

  if (pending.customItems.length !== snapshot.customItems.length) {
    return true
  }

  for (let index = 0; index < pending.customItems.length; index += 1) {
    const pendingRow = pending.customItems[index]
    const snapshotItem = snapshot.customItems[index]

    if (!pendingRow || !snapshotItem) {
      return true
    }

    if (
      pendingRow.item.storageType !== snapshotItem.storageType ||
      pendingRow.item.key !== snapshotItem.key ||
      pendingRow.item.description !== snapshotItem.description
    ) {
      return true
    }
  }

  return false
}

export function reconcilePendingAfterRemovingDefault(
  targets: LocalhostTarget[],
  removedTargetKey: string,
  currentDefault: string,
): { targets: LocalhostTarget[]; defaultKey: string } {
  const remainingTargets = targets.filter(
    (target) => serializeLocalhostTarget(target) !== removedTargetKey,
  )
  const nextDefault =
    currentDefault === removedTargetKey
      ? resolveDefaultLocalhostTargetKey(remainingTargets, '')
      : currentDefault

  return { targets: remainingTargets, defaultKey: nextDefault }
}

export function buildSavedSnapshot(state: {
  customItems: PendingMigrationKeyRow[]
  localhostTargets: LocalhostTarget[]
  defaultLocalhostTargetKey: string
}): SavedSnapshot {
  return {
    customItems: state.customItems.map((row) => ({ ...row.item })),
    localhostTargets: state.localhostTargets.map((target) => ({ ...target })),
    defaultLocalhostTargetKey: state.defaultLocalhostTargetKey,
  }
}

export function buildExportPayload(
  pending: PendingState,
  exportedAt: string = new Date().toISOString(),
): {
  version: 3
  exportedAt: string
  localhostTargets: LocalhostTarget[]
  defaultLocalhostTarget: string
  items: ConfigItem[]
} {
  return {
    version: 3,
    exportedAt,
    localhostTargets: pending.localhostTargets.map((target) => ({ ...target })),
    defaultLocalhostTarget: pending.defaultLocalhostTargetKey,
    items: pending.customItems.map((row) => ({ ...row.item })),
  }
}

export function isImportPayload(value: unknown): value is ImportNormalizedPayload {
  if (!value || typeof value !== 'object') {
    return false
  }

  const candidate = value as Partial<ImportNormalizedPayload>

  if (!Array.isArray(candidate.items) || !Array.isArray(candidate.localhostTargets)) {
    return false
  }

  if (typeof candidate.defaultLocalhostTargetKey !== 'string') {
    return false
  }

  return true
}
