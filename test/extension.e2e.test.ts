import { expect, test } from 'vitest'

test('popup 应正确渲染基础界面', async () => {
  const popupPage = await browser.getPopupPage()

  await popupPage.waitForLoadState('domcontentloaded')

  expect(await popupPage.title()).toMatch(/State Migrator/i)
  expect(
    await popupPage.getByRole('heading', { name: '页面状态迁移' }).isVisible(),
  ).toBe(true)
  expect(
    await popupPage.getByRole('button', { name: '配置', exact: true }).isVisible(),
  ).toBe(true)
})
