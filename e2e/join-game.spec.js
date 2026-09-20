import { test, expect } from '@playwright/test'

test('a second player can join via a second browser context and both see the updated lobby', async ({
  browser,
}) => {
  const hostContext = await browser.newContext()
  const hostPage = await hostContext.newPage()

  await hostPage.goto('/')
  await hostPage.getByRole('button', { name: 'New Game' }).click()
  await hostPage.getByPlaceholder('Enter your name').fill('Casey')
  await hostPage.getByRole('button', { name: 'Create Game' }).click()

  await expect(hostPage.getByText('Players (5)')).toBeVisible()
  const shareButton = hostPage.getByRole('button', { name: /Share game / })
  const gameId = (await shareButton.getAttribute('aria-label'))?.replace('Share game ', '')
  expect(gameId).toBeTruthy()

  const guestContext = await browser.newContext()
  const guestPage = await guestContext.newPage()

  await guestPage.goto('/')
  await guestPage.getByRole('button', { name: 'Join Game' }).click()
  await guestPage.getByPlaceholder('Enter game ID').fill(gameId)
  await guestPage.getByPlaceholder('Enter your name').fill('Riley')
  await guestPage.getByRole('button', { name: 'Join Game' }).last().click()

  // The guest lands in the lobby as a non-owner (waiting for the host to start).
  await expect(guestPage.getByText('Waiting for game to start...')).toBeVisible()
  await expect(guestPage.getByText('Players (5)')).toBeVisible()
  await expect(guestPage.getByText('Riley')).toBeVisible()

  // The host's own lobby view updates live, pushed over the WebSocket connection rather than
  // any action the host took themselves -- the guest took over one of the AI seats.
  await expect(hostPage.getByText('Players (5)')).toBeVisible()
  await expect(hostPage.getByRole('button', { name: 'Rename Riley' })).toBeVisible()

  await hostContext.close()
  await guestContext.close()
})
