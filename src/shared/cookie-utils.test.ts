import { describe, expect, it } from 'vitest'
import {
  buildCookieSetDetails,
  formatCookieMetadata,
  toCookieMetadata,
} from './cookie-utils'
import type { DatasetItem } from './types'

describe('shared cookie utils', () => {
  it('maps chrome cookies into dataset metadata', () => {
    expect(
      toCookieMetadata({
        name: 'locale',
        value: 'zh-CN',
        domain: '.example.com',
        hostOnly: false,
        path: '/',
        secure: true,
        httpOnly: true,
        sameSite: 'strict',
        session: false,
        expirationDate: 1_800_000_000,
        storeId: '0',
        partitionKey: {
          topLevelSite: 'https://example.com',
        },
      } as chrome.cookies.Cookie),
    ).toEqual({
      domain: '.example.com',
      hostOnly: false,
      path: '/',
      secure: true,
      httpOnly: true,
      sameSite: 'strict',
      session: false,
      expirationDate: 1_800_000_000,
      storeId: '0',
      partitionKey: {
        topLevelSite: 'https://example.com',
      },
    })
  })

  it('builds full cookie set details for compatible domains', () => {
    const item: DatasetItem = {
      storageType: 'cookie',
      key: 'locale',
      value: 'zh-CN',
      cookie: {
        domain: '.example.com',
        hostOnly: false,
        path: '/app',
        secure: true,
        httpOnly: true,
        sameSite: 'strict',
        session: false,
        expirationDate: 1_800_000_000,
        storeId: '0',
        partitionKey: {
          topLevelSite: 'https://example.com',
        },
      },
    }

    expect(buildCookieSetDetails('https://app.example.com/demo', item)).toEqual({
      url: 'https://app.example.com/demo',
      name: 'locale',
      value: 'zh-CN',
      domain: '.example.com',
      path: '/app',
      secure: true,
      httpOnly: true,
      sameSite: 'strict',
      expirationDate: 1_800_000_000,
      storeId: '0',
      partitionKey: {
        topLevelSite: 'https://example.com',
      },
    })
  })

  it('drops incompatible cookie domains when importing to localhost', () => {
    const item: DatasetItem = {
      storageType: 'cookie',
      key: 'locale',
      value: 'zh-CN',
      cookie: {
        domain: '.example.com',
        hostOnly: false,
        path: '/',
        secure: false,
        httpOnly: false,
        sameSite: 'lax',
        session: true,
      },
    }

    expect(buildCookieSetDetails('http://localhost:5173/', item)).toEqual({
      url: 'http://localhost:5173/',
      name: 'locale',
      value: 'zh-CN',
      path: '/',
      secure: false,
      httpOnly: false,
      sameSite: 'lax',
    })
  })

  it('formats readable cookie metadata for popup previews', () => {
    const formatted = formatCookieMetadata({
      domain: '.example.com',
      hostOnly: false,
      path: '/',
      secure: true,
      httpOnly: true,
      sameSite: 'no_restriction',
      session: false,
      expirationDate: 1_800_000_000,
    })

    expect(formatted).toContain('HttpOnly')
    expect(formatted).toContain('Secure')
    expect(formatted).toContain('Domain=.example.com')
    expect(formatted).toContain('SameSite=None')
    expect(formatted).toContain('Expires=')
  })
})
