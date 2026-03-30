declare namespace chrome {
  namespace cookies {
    interface Cookie {
      name: string
      value: string
      httpOnly: boolean
      path: string
    }

    function getAll(details: { url?: string }): Promise<Cookie[]>
    function set(details: {
      url: string
      name?: string
      value?: string
      path?: string
      secure?: boolean
      sameSite?: 'no_restriction' | 'lax' | 'strict' | 'unspecified'
    }): Promise<Cookie | undefined>
  }

  namespace storage {
    interface StorageArea {
      get(
        keys?: string | string[] | Record<string, unknown> | null,
      ): Promise<Record<string, unknown>>
      set(items: Record<string, unknown>): Promise<void>
      remove(keys: string | string[]): Promise<void>
    }

    const local: StorageArea
  }

  namespace runtime {
    interface MessageSender {
      tab?: tabs.Tab
    }

    interface OnMessageEvent {
      addListener(
        callback: (
          message: unknown,
          sender: MessageSender,
          sendResponse: (response?: unknown) => void,
        ) => boolean | void,
      ): void
    }

    interface OnInstalledEvent {
      addListener(callback: () => void): void
    }

    const id: string
    const onMessage: OnMessageEvent
    const onInstalled: OnInstalledEvent
    function sendMessage(message: unknown): Promise<unknown>
    function openOptionsPage(): Promise<void>
    function getURL(path: string): string
  }

  namespace tabs {
    interface Tab {
      id?: number
      url?: string
      title?: string
      active?: boolean
      status?: string
    }

    function query(queryInfo: {
      active?: boolean
      currentWindow?: boolean
    }): Promise<Tab[]>
    function create(createProperties: {
      url?: string
      active?: boolean
    }): Promise<Tab>
    function reload(tabId?: number): Promise<void>
    function sendMessage(tabId: number, message: unknown): Promise<unknown>
  }
}
