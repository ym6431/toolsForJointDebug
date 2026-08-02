import { DEFAULT_STORAGE_STATE, MAX_SAVED_DATASETS, STORAGE_KEYS } from './constants'
import {
  clearNormalizedOptionsConfig,
  deleteNormalizedDataset,
  initializeNormalizedStorageState,
  readNormalizedStorageState,
  replaceNormalizedCustomConfig,
  replaceNormalizedLocalhostTargets,
  saveNormalizedDataset,
  saveNormalizedDefaultLocalhostTarget,
  replaceNormalizedOptionsConfig,
} from './storage-repository'
import type { AppStorageState, ConfigItem, Dataset, LocalhostTarget, SaveDatasetInput } from './types'
import {
  createId,
  dedupeConfig,
  dedupeDatasetItems,
  normalizeLocalhostTarget,
  normalizeLocalhostTargetKey,
  normalizeLocalhostTargetList,
  resolveDefaultLocalhostTargetKey,
} from './utils'

async function readLegacyStorageState(): Promise<AppStorageState> {
  const result = await chrome.storage.local.get({
    [STORAGE_KEYS.datasets]: DEFAULT_STORAGE_STATE.datasets,
    [STORAGE_KEYS.customConfig]: DEFAULT_STORAGE_STATE.customConfig,
    [STORAGE_KEYS.localhostPorts]: DEFAULT_STORAGE_STATE.localhostPorts,
    [STORAGE_KEYS.defaultLocalhostPort]: DEFAULT_STORAGE_STATE.defaultLocalhostPort,
    [STORAGE_KEYS.legacyLocalhostPort]: '',
  })
  const localhostTargets = normalizeLocalhostTargetList(
    Array.isArray(result[STORAGE_KEYS.localhostPorts]) ? result[STORAGE_KEYS.localhostPorts] : [],
  )
  const legacyLocalhostPort =
    typeof result[STORAGE_KEYS.legacyLocalhostPort] === 'string'
      ? normalizeLocalhostTarget(result[STORAGE_KEYS.legacyLocalhostPort])
      : null
  const normalizedTargets =
    localhostTargets.length > 0
      ? localhostTargets
      : legacyLocalhostPort
        ? [legacyLocalhostPort]
        : []
  const requestedDefaultPort =
    typeof result[STORAGE_KEYS.defaultLocalhostPort] === 'string'
    || typeof result[STORAGE_KEYS.defaultLocalhostPort] === 'object'
      ? normalizeLocalhostTargetKey(result[STORAGE_KEYS.defaultLocalhostPort])
      : ''

  return {
    datasets: limitDatasets(
      Array.isArray(result[STORAGE_KEYS.datasets]) ? result[STORAGE_KEYS.datasets] : [],
    ),
    customConfig: dedupeConfig(
      Array.isArray(result[STORAGE_KEYS.customConfig]) ? result[STORAGE_KEYS.customConfig] : [],
    ),
    localhostPorts: normalizedTargets,
    defaultLocalhostPort: resolveDefaultLocalhostTargetKey(normalizedTargets, requestedDefaultPort),
  }
}

async function readStorageState(): Promise<AppStorageState> {
  const normalizedState = await readNormalizedStorageState()

  if (normalizedState) {
    return normalizedState
  }

  const legacyState = await readLegacyStorageState()
  const initialized = await initializeNormalizedStorageState(legacyState)

  if (initialized) {
    return legacyState
  }

  return (await readNormalizedStorageState()) ?? legacyState
}

function limitDatasets(datasets: Dataset[]) {
  return [...datasets]
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .slice(0, MAX_SAVED_DATASETS)
}

export async function ensureStorageInitialized() {
  await readStorageState()
}

export async function getDatasets() {
  return limitDatasets((await readStorageState()).datasets)
}

export async function saveDataset(input: SaveDatasetInput) {
  const state = await readStorageState()
  const dataset: Dataset = {
    id: createId(),
    datasetName: input.datasetName.trim() || `Dataset ${state.datasets.length + 1}`,
    sourceUrl: input.sourceUrl,
    createdAt: new Date().toISOString(),
    items: dedupeDatasetItems(input.items),
  }

  await saveNormalizedDataset(dataset)

  return dataset
}

export async function deleteDataset(datasetId: string) {
  await readStorageState()

  return await deleteNormalizedDataset(datasetId)
}

export async function getCustomConfig() {
  return dedupeConfig((await readStorageState()).customConfig)
}

export async function saveCustomConfig(items: ConfigItem[]) {
  const normalizedItems = normalizeConfigItems(items)

  await readStorageState()
  await replaceNormalizedCustomConfig(normalizedItems)

  return normalizedItems
}

export async function resetCustomConfig() {
  await readStorageState()
  await replaceNormalizedCustomConfig([])
}

export async function saveOptionsConfig(
  configItems: ConfigItem[],
  targets: LocalhostTarget[],
  defaultTargetKey: string,
) {
  const customConfig = normalizeConfigItems(configItems)
  const localhostTargets = normalizeLocalhostTargetList(targets)
  const normalizedDefaultTargetKey = resolveDefaultLocalhostTargetKey(
    localhostTargets,
    defaultTargetKey,
  )

  await readStorageState()
  await replaceNormalizedOptionsConfig(
    customConfig,
    localhostTargets,
    normalizedDefaultTargetKey,
  )

  return { customConfig, localhostTargets, defaultLocalhostTargetKey: normalizedDefaultTargetKey }
}

export async function clearOptionsConfig() {
  await readStorageState()
  await clearNormalizedOptionsConfig()
}

export async function getLocalhostTargets() {
  return (await readStorageState()).localhostPorts
}

export async function getDefaultLocalhostTargetKey() {
  return (await readStorageState()).defaultLocalhostPort
}

export async function saveLocalhostTargetConfig(
  targets: LocalhostTarget[],
  defaultTargetKey: string,
) {
  const normalizedTargets = normalizeLocalhostTargetList(targets)
  const normalizedDefaultTargetKey = resolveDefaultLocalhostTargetKey(
    normalizedTargets,
    defaultTargetKey,
  )

  await readStorageState()
  await replaceNormalizedLocalhostTargets(normalizedTargets, normalizedDefaultTargetKey)

  return {
    localhostTargets: normalizedTargets,
    defaultLocalhostTargetKey: normalizedDefaultTargetKey,
  }
}

function normalizeConfigItems(items: ConfigItem[]) {
  return dedupeConfig(
    items.map((item) => ({
      storageType: item.storageType,
      key: item.key.trim(),
      description: item.description.trim(),
    })),
  )
}

export async function saveDefaultLocalhostTargetKey(targetKey: string) {
  const state = await readStorageState()
  const normalizedDefaultTargetKey = state.localhostPorts.some(
    (target) => normalizeLocalhostTargetKey(target) === targetKey,
  )
    ? targetKey
    : state.defaultLocalhostPort || resolveDefaultLocalhostTargetKey(state.localhostPorts, '')

  await saveNormalizedDefaultLocalhostTarget(normalizedDefaultTargetKey)

  return normalizedDefaultTargetKey
}
