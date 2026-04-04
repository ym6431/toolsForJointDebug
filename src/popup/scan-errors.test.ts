import { describe, expect, it } from 'vitest'
import { getScanErrorMessage, shouldSilenceAutoScanError } from './scan-errors'

describe('scan-errors', () => {
  it('maps missing receiving end to a refresh hint', () => {
    const error = new Error('Could not establish connection. Receiving end does not exist.')

    expect(getScanErrorMessage(error)).toBe('当前页面尚未加载扩展脚本，请刷新页面后重试。')
    expect(shouldSilenceAutoScanError(error)).toBe(true)
  })

  it('maps closed message port to an initialization hint', () => {
    const error = new Error('The message port closed before a response was received.')

    expect(getScanErrorMessage(error)).toBe('当前页面尚未完成扩展初始化，请稍后重试扫描。')
    expect(shouldSilenceAutoScanError(error)).toBe(true)
  })

  it('keeps unknown scan errors unchanged', () => {
    const error = new Error('unexpected scan failure')

    expect(getScanErrorMessage(error)).toBe('unexpected scan failure')
    expect(shouldSilenceAutoScanError(error)).toBe(false)
  })

  it('falls back to the generic message for non-error values', () => {
    expect(getScanErrorMessage('oops')).toBe('扫描失败。')
    expect(shouldSilenceAutoScanError('oops')).toBe(false)
  })
})
