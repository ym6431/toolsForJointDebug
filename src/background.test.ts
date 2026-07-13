import { afterEach, describe, expect, it, vi } from 'vitest'
import type { BackgroundMessage } from './shared/types'

type RuntimeMessageListener = Parameters<
  typeof chrome.runtime.onMessage.addListener
>[0]

type CreateTabDetails = Parameters<typeof chrome.tabs.create>[0]

type SendResponse = Parameters<RuntimeMessageListener>[2]

describe('background script', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.resetModules()
  })

  it('creates the localhost tab immediately after the active tab', async () => {
    const sourceTab: chrome.tabs.Tab = {
      id: 7,
      index: 3,
      groupId: -1,
      windowId: 1,
      selected: true,
      lastAccessed: 1_700_000_000_000,
      highlighted: true,
      active: true,
      pinned: false,
      frozen: false,
      discarded: false,
      autoDiscardable: true,
      incognito: false,
      url: 'https://example.com/',
      title: 'Example',
      status: 'complete',
    }

    const createdTabs: CreateTabDetails[] = []
    let runtimeMessageListener: RuntimeMessageListener | undefined

    vi.stubGlobal('chrome', {
      runtime: {
        onInstalled: {
          addListener: vi.fn(),
        },
        onMessage: {
          addListener: (listener: RuntimeMessageListener) => {
            runtimeMessageListener = listener
          },
        },
        openOptionsPage: vi.fn(),
      },
      tabs: {
        query: vi.fn(async () => [sourceTab]),
        create: vi.fn(async (details: CreateTabDetails) => {
          createdTabs.push(details)

          const createdTab: chrome.tabs.Tab = {
            id: 42,
            index: details.index ?? 0,
            groupId: -1,
            windowId: sourceTab.windowId,
            selected: false,
            lastAccessed: sourceTab.lastAccessed,
            highlighted: false,
            active: details.active ?? false,
            pinned: false,
            frozen: false,
            discarded: false,
            autoDiscardable: true,
            incognito: false,
            url: details.url,
          }

          return createdTab
        }),
        sendMessage: vi.fn(async () => ({ imported: 0, failed: [] })),
        reload: vi.fn(async () => undefined),
      },
      cookies: {
        getAll: vi.fn(),
        set: vi.fn(),
      },
      storage: {
        local: {
          get: vi.fn(),
          set: vi.fn(),
          remove: vi.fn(),
        },
      },
    })

    await import('./background')

    const listener = runtimeMessageListener

    if (listener === undefined) {
      throw new Error('runtime message listener was not captured')
    }

    const message: BackgroundMessage = {
      type: 'OPEN_LOCALHOST_AND_APPLY_ITEMS',
      target: { protocol: 'http', port: '5173' },
      items: [],
    }

    await new Promise<void>((resolve) => {
      const sender: chrome.runtime.MessageSender = {}
      const sendResponse: SendResponse = () => {
        resolve()
      }

      void listener(message, sender, sendResponse)
    })

    expect(createdTabs).toEqual([
      {
        url: 'http://localhost:5173/',
        active: true,
        index: 4,
      },
    ])
  })
})
