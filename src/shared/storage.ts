import { DEFAULT_STORAGE_STATE, STORAGE_KEYS } from './constants'
import type { ConfigItem, Dataset, SaveDatasetInput } from './types'
import { createId, dedupeConfig, dedupeDatasetItems } from './utils'

async function readStorageState() {
  const result = await chrome.storage.local.get({
    [STORAGE_KEYS.datasets]: DEFAULT_STORAGE_STATE.datasets,
    [STORAGE_KEYS.customConfig]: DEFAULT_STORAGE_STATE.customConfig,
  })

  return {
    datasets: (result[STORAGE_KEYS.datasets] as Dataset[]) ?? [],
    customConfig: (result[STORAGE_KEYS.customConfig] as ConfigItem[]) ?? [],
  }
}

export async function ensureStorageInitialized() {
  const state = await readStorageState()

  await chrome.storage.local.set({
    [STORAGE_KEYS.datasets]: state.datasets,
    [STORAGE_KEYS.customConfig]: state.customConfig,
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
