import {
  INDEXED_DB_DEFAULT_LOCALHOST_TARGET_KEY,
  INDEXED_DB_KEY,
  INDEXED_DB_METADATA_KEYS,
  INDEXED_DB_NAME,
  INDEXED_DB_STORE,
  INDEXED_DB_STORES,
  INDEXED_DB_VERSION,
} from '../src/shared/constants'
import type { ConfigItem, Dataset, DatasetItem, LocalhostTarget } from '../src/shared/types'

export type IndexedDbSchema = {
  readonly databaseName: string
  readonly version: number
  readonly legacyStore: string
  readonly legacyKey: string
  readonly datasets: string
  readonly datasetItems: string
  readonly customConfig: string
  readonly localhostTargets: string
  readonly defaultLocalhostTarget: string
  readonly metadata: string
  readonly defaultLocalhostTargetKey: string
  readonly initializedMetadataKey: string
}

export type DatasetRecord = Omit<Dataset, 'items'>

export type DatasetItemRecord = {
  readonly datasetId: string
  readonly position: number
  readonly item: DatasetItem
}

export type ConfigRecord = {
  readonly id: string
  readonly position: number
  readonly item: ConfigItem
}

export type LocalhostTargetRecord = {
  readonly id: string
  readonly position: number
  readonly target: LocalhostTarget
}

export type DefaultLocalhostTargetRecord = {
  readonly key: string
  readonly targetKey: string
}

export type MetadataRecord = {
  readonly key: string
  readonly initialized: true
}

export const INDEXED_DB_SCHEMA = {
  databaseName: INDEXED_DB_NAME,
  version: INDEXED_DB_VERSION,
  legacyStore: INDEXED_DB_STORE,
  legacyKey: INDEXED_DB_KEY,
  datasets: INDEXED_DB_STORES.datasets,
  datasetItems: INDEXED_DB_STORES.datasetItems,
  customConfig: INDEXED_DB_STORES.customConfig,
  localhostTargets: INDEXED_DB_STORES.localhostTargets,
  defaultLocalhostTarget: INDEXED_DB_STORES.defaultLocalhostTarget,
  metadata: INDEXED_DB_STORES.metadata,
  defaultLocalhostTargetKey: INDEXED_DB_DEFAULT_LOCALHOST_TARGET_KEY,
  initializedMetadataKey: INDEXED_DB_METADATA_KEYS.initialized,
} as const satisfies IndexedDbSchema
