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
        getURL: vi.fn(() => 'chrome-extension://test-extension/'),
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
      const sender: chrome.runtime.MessageSender = {
        tab: sourceTab,
        url: 'chrome-extension://test-extension/popup.html',
      }
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

  it('rejects every privileged action sent from a tab without side effects', async () => {
    let runtimeMessageListener: RuntimeMessageListener | undefined
    const privilegedOperations = {
      openOptionsPage: vi.fn(),
      queryTabs: vi.fn(),
      reloadTab: vi.fn(),
      createTab: vi.fn(),
      sendTabMessage: vi.fn(),
      readCookies: vi.fn(),
      writeCookie: vi.fn(),
    }

    vi.stubGlobal('chrome', {
      runtime: {
        onInstalled: { addListener: vi.fn() },
        onMessage: {
          addListener: (listener: RuntimeMessageListener) => {
            runtimeMessageListener = listener
          },
        },
        openOptionsPage: privilegedOperations.openOptionsPage,
      },
      tabs: {
        query: privilegedOperations.queryTabs,
        reload: privilegedOperations.reloadTab,
        create: privilegedOperations.createTab,
        sendMessage: privilegedOperations.sendTabMessage,
      },
      cookies: {
        getAll: privilegedOperations.readCookies,
        set: privilegedOperations.writeCookie,
      },
      storage: { local: { get: vi.fn(), set: vi.fn(), remove: vi.fn() } },
    })

    await import('./background')

    const listener = runtimeMessageListener

    if (listener === undefined) {
      throw new Error('runtime message listener was not captured')
    }

    const tabSender: chrome.runtime.MessageSender = {
      tab: {
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
      },
    }
    const privilegedMessages: readonly BackgroundMessage[] = [
      { type: 'GET_ACTIVE_TAB' },
      { type: 'OPEN_OPTIONS_PAGE' },
      { type: 'RELOAD_TAB', tabId: 7 },
      { type: 'READ_COOKIES', url: 'https://example.com/', keys: ['session'] },
      {
        type: 'APPLY_COOKIES_TO_URL',
        url: 'https://example.com/',
        items: [{ storageType: 'cookie', key: 'session', value: 'value' }],
      },
      {
        type: 'OPEN_LOCALHOST_AND_APPLY_ITEMS',
        target: { protocol: 'http', port: '5173' },
        items: [],
      },
    ]

    for (const message of privilegedMessages) {
      const sendResponse: SendResponse = vi.fn()

      expect(listener(message, tabSender, sendResponse)).toBe(false)
      expect(sendResponse).not.toHaveBeenCalled()
    }

    expect(privilegedOperations.openOptionsPage).not.toHaveBeenCalled()
    expect(privilegedOperations.queryTabs).not.toHaveBeenCalled()
    expect(privilegedOperations.reloadTab).not.toHaveBeenCalled()
    expect(privilegedOperations.createTab).not.toHaveBeenCalled()
    expect(privilegedOperations.sendTabMessage).not.toHaveBeenCalled()
    expect(privilegedOperations.readCookies).not.toHaveBeenCalled()
    expect(privilegedOperations.writeCookie).not.toHaveBeenCalled()
  })

  it('rejects malformed privileged payloads without side effects', async () => {
    let runtimeMessageListener: RuntimeMessageListener | undefined
    const readCookies = vi.fn()

    vi.stubGlobal('chrome', {
      runtime: {
        onInstalled: { addListener: vi.fn() },
        onMessage: {
          addListener: (listener: RuntimeMessageListener) => {
            runtimeMessageListener = listener
          },
        },
        openOptionsPage: vi.fn(),
      },
      tabs: {
        query: vi.fn(),
        reload: vi.fn(),
        create: vi.fn(),
        sendMessage: vi.fn(),
      },
      cookies: { getAll: readCookies, set: vi.fn() },
      storage: { local: { get: vi.fn(), set: vi.fn(), remove: vi.fn() } },
    })

    await import('./background')

    const listener = runtimeMessageListener

    if (listener === undefined) {
      throw new Error('runtime message listener was not captured')
    }

    const malformedMessages: readonly unknown[] = [
      {
        type: 'READ_COOKIES',
        url: 'https://example.com/',
        keys: 'session',
      },
      {
        type: 'APPLY_COOKIES_TO_URL',
        url: 'https://example.com/',
        items: { storageType: 'cookie', key: 'session', value: 'value' },
      },
      {
        type: 'OPEN_LOCALHOST_AND_APPLY_ITEMS',
        target: { protocol: 'ftp', port: 'not-a-port' },
        items: [],
      },
    ]

    for (const message of malformedMessages) {
      const sendResponse: SendResponse = vi.fn()

      expect(listener(message, {}, sendResponse)).toBe(false)
      expect(sendResponse).not.toHaveBeenCalled()
    }

    expect(readCookies).not.toHaveBeenCalled()
  })
})
