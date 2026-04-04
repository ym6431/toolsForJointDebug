export function getScanErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : '扫描失败。'

  if (message.includes('Could not establish connection. Receiving end does not exist.')) {
    return '当前页面尚未加载扩展脚本，请刷新页面后重试。'
  }

  if (message.includes('The message port closed before a response was received.')) {
    return '当前页面尚未完成扩展初始化，请稍后重试扫描。'
  }

  return message
}

export function shouldSilenceAutoScanError(error: unknown) {
  const message = error instanceof Error ? error.message : ''

  return (
    message.includes('Could not establish connection. Receiving end does not exist.')
    || message.includes('The message port closed before a response was received.')
  )
}
