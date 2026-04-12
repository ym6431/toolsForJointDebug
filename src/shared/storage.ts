import { DEFAULT_STORAGE_STATE, STORAGE_KEYS } from './constants'
import type { ConfigItem, Dataset, LocalhostTarget, SaveDatasetInput } from './types'
import {
  createId,
  dedupeConfig,
  dedupeDatasetItems,
  normalizeLocalhostTarget,
  normalizeLocalhostTargetKey,
  normalizeLocalhostTargetList,
  resolveDefaultLocalhostTargetKey,
} from './utils'

async function readStorageState() {
  const result = await chrome.storage.local.get({
    [STORAGE_KEYS.datasets]: DEFAULT_STORAGE_STATE.datasets,
    [STORAGE_KEYS.customConfig]: DEFAULT_STORAGE_STATE.customConfig,
    [STORAGE_KEYS.localhostPorts]: DEFAULT_STORAGE_STATE.localhostPorts,
    [STORAGE_KEYS.defaultLocalhostPort]: DEFAULT_STORAGE_STATE.defaultLocalhostPort,
    [STORAGE_KEYS.legacyLocalhostPort]: '',
  })
  const localhostTargets = normalizeLocalhostTargetList(
    Array.isArray(result[STORAGE_KEYS.localhostPorts])
      ? (result[STORAGE_KEYS.localhostPorts] as unknown[])
      : [],
  )
  const legacyLocalhostPort =
    typeof result[STORAGE_KEYS.legacyLocalhostPort] === 'string'
      ? normalizeLocalhostTarget(result[STORAGE_KEYS.legacyLocalhostPort] as string)
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
  const defaultLocalhostPort = resolveDefaultLocalhostTargetKey(normalizedTargets, requestedDefaultPort)

  return {
    datasets: (result[STORAGE_KEYS.datasets] as Dataset[]) ?? [],
    customConfig: (result[STORAGE_KEYS.customConfig] as ConfigItem[]) ?? [],
    localhostPorts: normalizedTargets,
    defaultLocalhostPort,
  }
}

export async function ensureStorageInitialized() {
  const state = await readStorageState()

  await chrome.storage.local.set({
    [STORAGE_KEYS.datasets]: state.datasets,
    [STORAGE_KEYS.customConfig]: state.customConfig,
    [STORAGE_KEYS.localhostPorts]: state.localhostPorts,
    [STORAGE_KEYS.defaultLocalhostPort]: state.defaultLocalhostPort,
  })
}

export async function getDatasets() {
  const state = await readStorageState()

  return [...state.datasets].sort((left, right) =>
    right.createdAt.localeCompare(left.createdAt),
  )
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

  await chrome.storage.local.set({
    [STORAGE_KEYS.datasets]: [dataset, ...state.datasets],
  })

  return dataset
}

export async function deleteDataset(datasetId: string) {
  const state = await readStorageState()
  const nextDatasets = state.datasets.filter((dataset) => dataset.id !== datasetId)

  await chrome.storage.local.set({
    [STORAGE_KEYS.datasets]: nextDatasets,
  })

  return nextDatasets
}

export async function getCustomConfig() {
  const state = await readStorageState()

  return dedupeConfig(state.customConfig)
}

export async function saveCustomConfig(items: ConfigItem[]) {
  const normalizedItems = dedupeConfig(
    items.map((item) => ({
      storageType: item.storageType,
      key: item.key.trim(),
      description: item.description.trim(),
    })),
  )

  await chrome.storage.local.set({
    [STORAGE_KEYS.customConfig]: normalizedItems,
  })

  return normalizedItems
}

export async function resetCustomConfig() {
  await chrome.storage.local.remove(STORAGE_KEYS.customConfig)
}

export async function getLocalhostTargets() {
  const state = await readStorageState()

  return state.localhostPorts
}

export async function getDefaultLocalhostTargetKey() {
  const state = await readStorageState()

  return state.defaultLocalhostPort
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

  await chrome.storage.local.set({
    [STORAGE_KEYS.localhostPorts]: normalizedTargets,
    [STORAGE_KEYS.defaultLocalhostPort]: normalizedDefaultTargetKey,
  })

  return {
    localhostTargets: normalizedTargets,
    defaultLocalhostTargetKey: normalizedDefaultTargetKey,
  }
}

export async function saveDefaultLocalhostTargetKey(targetKey: string) {
  const state = await readStorageState()
  const normalizedDefaultTargetKey = state.localhostPorts.some(
    (target) => normalizeLocalhostTargetKey(target) === targetKey,
  )
    ? targetKey
    : state.defaultLocalhostPort
      || resolveDefaultLocalhostTargetKey(state.localhostPorts, '')

  await chrome.storage.local.set({
    [STORAGE_KEYS.defaultLocalhostPort]: normalizedDefaultTargetKey,
  })

  return normalizedDefaultTargetKey
}
