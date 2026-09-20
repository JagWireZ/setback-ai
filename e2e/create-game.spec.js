import { test, expect } from '@playwright/test'

test('creating a game lands the host in a lobby with a real game ID', async ({ page }) => {
  await page.goto('/')

  await page.getByRole('button', { name: 'New Game' }).click()
  await page.getByPlaceholder('Enter your name').fill('Casey')
  await page.getByRole('button', { name: 'Create Game' }).click()

  await expect(page.getByRole('heading', { name: 'Lobby' })).toBeVisible()
  await expect(page.getByText('Players (5)')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Rename Casey' })).toBeVisible()

  const shareButton = page.getByRole('button', { name: /Share game / })
  await expect(shareButton).toBeVisible()
  const gameId = (await shareButton.getAttribute('aria-label'))?.replace('Share game ', '')
  expect(gameId).toMatch(/^[a-z]+-[a-z]+$/)
})
