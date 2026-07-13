import { openDB } from 'idb'
import type { DBSchema } from 'idb'
import {
  DEFAULT_STORAGE_STATE,
  INDEXED_DB_KEY,
  INDEXED_DB_NAME,
  INDEXED_DB_STORE,
  MAX_SAVED_DATASETS,
  STORAGE_KEYS,
} from './constants'
import type {
  AppStorageState,
  ConfigItem,
  Dataset,
  LocalhostTarget,
  SaveDatasetInput,
} from './types'
import {
  createId,
  dedupeConfig,
  dedupeDatasetItems,
  normalizeLocalhostTarget,
  normalizeLocalhostTargetKey,
  normalizeLocalhostTargetList,
  resolveDefaultLocalhostTargetKey,
} from './utils'

interface AppDatabase extends DBSchema {
  [INDEXED_DB_STORE]: {
    key: string
    value: AppStorageState
  }
}

async function openStorageDatabase() {
  return await openDB<AppDatabase>(INDEXED_DB_NAME, 1, {
    upgrade(database) {
      database.createObjectStore(INDEXED_DB_STORE)
    },
  })
}

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
  const defaultLocalhostPort = resolveDefaultLocalhostTargetKey(normalizedTargets, requestedDefaultPort)

  return {
    datasets: limitDatasets(
      Array.isArray(result[STORAGE_KEYS.datasets]) ? result[STORAGE_KEYS.datasets] : [],
    ),
    customConfig: dedupeConfig(
      Array.isArray(result[STORAGE_KEYS.customConfig]) ? result[STORAGE_KEYS.customConfig] : [],
    ),
    localhostPorts: normalizedTargets,
    defaultLocalhostPort,
  }
}

async function readStorageState() {
  const database = await openStorageDatabase()

  try {
    const storedState = await database.get(INDEXED_DB_STORE, INDEXED_DB_KEY)

    if (storedState) {
      return storedState
    }

    const migratedState = await readLegacyStorageState()
    await database.put(INDEXED_DB_STORE, migratedState, INDEXED_DB_KEY)

    return migratedState
  } finally {
    database.close()
  }
}

async function saveStorageState(state: AppStorageState) {
  const database = await openStorageDatabase()

  try {
    await database.put(INDEXED_DB_STORE, state, INDEXED_DB_KEY)
  } finally {
    database.close()
  }
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
  const state = await readStorageState()

  return limitDatasets(state.datasets)
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

  await saveStorageState({
    ...state,
    datasets: limitDatasets([dataset, ...state.datasets]),
  })

  return dataset
}

export async function deleteDataset(datasetId: string) {
  const state = await readStorageState()
  const nextDatasets = state.datasets.filter((dataset) => dataset.id !== datasetId)

  await saveStorageState({
    ...state,
    datasets: nextDatasets,
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

  const state = await readStorageState()

  await saveStorageState({
    ...state,
    customConfig: normalizedItems,
  })

  return normalizedItems
}

export async function resetCustomConfig() {
  const state = await readStorageState()

  await saveStorageState({
    ...state,
    customConfig: [],
  })
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

  const state = await readStorageState()

  await saveStorageState({
    ...state,
    localhostPorts: normalizedTargets,
    defaultLocalhostPort: normalizedDefaultTargetKey,
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

  await saveStorageState({
    ...state,
    defaultLocalhostPort: normalizedDefaultTargetKey,
  })

  return normalizedDefaultTargetKey
}
