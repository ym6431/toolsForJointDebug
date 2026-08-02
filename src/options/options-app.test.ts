import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { buildPendingRows, buildSavedSnapshot } from './options-state'
import type { ConfigItem, LocalhostTarget } from '../shared/types'
import {
  clearOptionsConfig,
  getCustomConfig,
  getDefaultLocalhostTargetKey,
  getLocalhostTargets,
  resetCustomConfig,
  saveCustomConfig,
  saveLocalhostTargetConfig,
  saveOptionsConfig,
} from '../shared/storage'

vi.mock('../shared/storage', () => ({
  clearOptionsConfig: vi.fn(),
  getCustomConfig: vi.fn(),
  getDefaultLocalhostTargetKey: vi.fn(),
  getLocalhostTargets: vi.fn(),
  resetCustomConfig: vi.fn(),
  saveCustomConfig: vi.fn(),
  saveLocalhostTargetConfig: vi.fn(),
  saveOptionsConfig: vi.fn(),
}))

const mockedGetCustomConfig = vi.mocked(getCustomConfig)
const mockedGetDefaultLocalhostTargetKey = vi.mocked(getDefaultLocalhostTargetKey)
const mockedGetLocalhostTargets = vi.mocked(getLocalhostTargets)
const mockedSaveOptionsConfig = vi.mocked(saveOptionsConfig)
const mockedSaveCustomConfig = vi.mocked(saveCustomConfig)
const mockedSaveLocalhostTargetConfig = vi.mocked(saveLocalhostTargetConfig)
const mockedClearOptionsConfig = vi.mocked(clearOptionsConfig)
const mockedResetCustomConfig = vi.mocked(resetCustomConfig)

let OptionsApp: typeof import('./options-app')['OptionsApp']

function createReadyOptionsApp() {
  const app = new OptionsApp()

  app['loadState'] = 'ready'
  app['customRows'] = buildPendingRows([
    {
      storageType: 'localStorage',
      key: '  theme  ',
      description: '  主题  ',
    },
  ] satisfies ConfigItem[])
  app['localhostTargets'] = [{ protocol: 'https', port: ' 5173 ' }] satisfies LocalhostTarget[]
  app['defaultLocalhostTargetKey'] = 'https:5173'
  app['composerDraft'] = { storageType: 'localStorage', key: '', description: '' }
  app['localhostDraft'] = { protocol: 'http', port: '' }
  app['operationMessage'] = ''
  app['operationFailed'] = false
  app['savedSnapshot'] = buildSavedSnapshot({
    customItems: [],
    localhostTargets: [],
    defaultLocalhostTargetKey: '',
  })
  app['hasPendingChanges'] = true

  return app
}

describe('options-app persistence actions', () => {
  beforeAll(async () => {
    Object.defineProperty(globalThis, 'HTMLElement', {
      configurable: true,
      value: class HTMLElementStub {},
    })
    Object.defineProperty(globalThis, 'customElements', {
      configurable: true,
      value: {
        define() {},
        get() {
          return undefined
        },
      },
    })

    ;({ OptionsApp } = await import('./options-app'))
  })

  beforeEach(() => {
    vi.clearAllMocks()
    mockedGetCustomConfig.mockResolvedValue([])
    mockedGetDefaultLocalhostTargetKey.mockResolvedValue('')
    mockedGetLocalhostTargets.mockResolvedValue([])
  })

  it('Given pending option rows, when save-all runs, then it calls saveOptionsConfig and rebuilds the snapshot from normalized atomic state', async () => {
    const app = createReadyOptionsApp()
    const normalizedConfig: ConfigItem[] = [
      { storageType: 'localStorage', key: 'theme', description: '主题' },
    ]
    const normalizedTargets: LocalhostTarget[] = [{ protocol: 'https', port: '5173' }]

    mockedSaveOptionsConfig.mockResolvedValue({
      customConfig: normalizedConfig,
      localhostTargets: normalizedTargets,
      defaultLocalhostTargetKey: 'https:5173',
    })

    await app['saveAll']()

    const rebuiltRows = buildPendingRows(normalizedConfig)
    const savedRows = app['customRows']

    expect(mockedSaveOptionsConfig).toHaveBeenCalledOnce()
    expect(mockedSaveOptionsConfig).toHaveBeenCalledWith(
      [
        {
          storageType: 'localStorage',
          key: '  theme  ',
          description: '  主题  ',
        },
      ],
      [{ protocol: 'https', port: ' 5173 ' }],
      'https:5173',
    )
    expect(mockedSaveCustomConfig).not.toHaveBeenCalled()
    expect(mockedSaveLocalhostTargetConfig).not.toHaveBeenCalled()
    expect(savedRows.map(({ item }) => item)).toEqual(rebuiltRows.map(({ item }) => item))
    expect(app['localhostTargets']).toEqual(normalizedTargets)
    expect(app['defaultLocalhostTargetKey']).toBe('https:5173')
    expect(app['savedSnapshot']).toEqual(
      buildSavedSnapshot({
        customItems: savedRows,
        localhostTargets: normalizedTargets,
        defaultLocalhostTargetKey: 'https:5173',
      }),
    )
    expect(app['hasPendingChanges']).toBe(false)
    expect(app['operationMessage']).toBe('配置已保存。')
    expect(app['operationFailed']).toBe(false)
  })

  it('Given a confirmed clear-all request, when clear-all runs, then it calls clearOptionsConfig and leaves legacy split APIs unused', async () => {
    const app = createReadyOptionsApp()
    app['confirmation'] = { kind: 'clear-all', message: '确认清空全部配置项？此操作会清除已保存配置。' }
    app['restoreClearAllFocus'] = vi.fn().mockResolvedValue(undefined)

    await app['confirmClearAll'](
      new CustomEvent('clear-confirm', {
        detail: { command: 'clear-confirm' },
      }),
    )

    expect(mockedClearOptionsConfig).toHaveBeenCalledOnce()
    expect(mockedResetCustomConfig).not.toHaveBeenCalled()
    expect(mockedSaveCustomConfig).not.toHaveBeenCalled()
    expect(mockedSaveLocalhostTargetConfig).not.toHaveBeenCalled()
    expect(app['customRows']).toEqual([])
    expect(app['localhostTargets']).toEqual([])
    expect(app['defaultLocalhostTargetKey']).toBe('')
    expect(app['savedSnapshot']).toEqual(
      buildSavedSnapshot({
        customItems: [],
        localhostTargets: [],
        defaultLocalhostTargetKey: '',
      }),
    )
    expect(app['hasPendingChanges']).toBe(false)
    expect(app['operationMessage']).toBe('已清空全部配置项。')
    expect(app['operationFailed']).toBe(false)
    expect(app['confirmation']).toBeNull()
  })
})
