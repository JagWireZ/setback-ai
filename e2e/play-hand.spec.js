import { test, expect } from '@playwright/test'

// Drives a full one-card round end to end through the real UI, against the real backend
// engine/reducer/AI stack (via the local mock WebSocket server) rather than a mocked
// `lambdaClient.js` boundary -- the lone human plays every seat's dealer-adjacent duties
// while the four AI seats resolve automatically, exactly as `backend/test/fullGameFlow.test.js`
// exercises at the handler level.

test('a lone human can play a full one-card hand against AI seats to game over', async ({
  page,
}) => {
  await page.goto('/')

  await page.getByRole('button', { name: 'New Game' }).click()
  await page.getByPlaceholder('Enter your name').fill('Casey')
  await page.getByRole('button', { name: 'Create Game' }).click()

  await expect(page.getByRole('heading', { name: 'Lobby' })).toBeVisible()
  await page.getByLabel('Select max cards').selectOption('1')
  await page.getByRole('button', { name: 'Start Game' }).click()

  await page.getByRole('button', { name: 'Deal Cards' }).click()

  await page.getByRole('button', { name: 'Bid', exact: true }).click()
  await page.getByRole('button', { name: 'Submit' }).click()

  const handCard = page.getByRole('button', { name: / of / }).first()
  await expect(handCard).toBeVisible({ timeout: 10_000 })
  await handCard.click()
  await page.getByRole('button', { name: 'Play Card' }).click()

  await expect(page.getByRole('button', { name: 'Start Over' })).toBeVisible({ timeout: 15_000 })
})
