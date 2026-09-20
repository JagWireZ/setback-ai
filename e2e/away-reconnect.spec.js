import { test, expect } from '@playwright/test'

// The local mock backend server (e2e/mock-backend-server.mjs) doesn't implement the API
// Gateway `$disconnect` -> away-marking behavior that the real Lambda handler does, so this
// only exercises real away/reconnect semantics against a deployed environment.
test.skip(
  !process.env.E2E_BASE_URL,
  'requires a real backend (set E2E_BASE_URL) -- the mock server does not implement $disconnect away-marking',
)

test('a disconnected guest is marked away and can rejoin from a saved game', async ({
  browser,
}) => {
  const hostContext = await browser.newContext()
  const hostPage = await hostContext.newPage()

  await hostPage.goto('/')
  await hostPage.getByRole('button', { name: 'New Game' }).click()
  await hostPage.getByPlaceholder('Enter your name').fill('Casey')
  await hostPage.getByRole('button', { name: 'Create Game' }).click()

  const shareButton = hostPage.getByRole('button', { name: /Share game / })
  const gameId = (await shareButton.getAttribute('aria-label'))?.replace('Share game ', '')
  expect(gameId).toBeTruthy()

  // The guest gets its own context (so its session/localStorage is isolated from the host),
  // but keeps that same context across the disconnect/rejoin so the saved-game entry survives.
  const guestContext = await browser.newContext()
  const guestPage = await guestContext.newPage()

  await guestPage.goto('/')
  await guestPage.getByRole('button', { name: 'Join Game' }).click()
  await guestPage.getByPlaceholder('Enter game ID').fill(gameId)
  await guestPage.getByPlaceholder('Enter your name').fill('Riley')
  await guestPage.getByRole('button', { name: 'Join Game' }).last().click()
  await expect(guestPage.getByText('Waiting for game to start...')).toBeVisible()

  // Closing the guest's page drops its WebSocket connection, which the backend's
  // `$disconnect` handler observes and marks the player away server-side.
  await guestPage.close()

  const rileyRow = hostPage.getByRole('button', { name: 'Rename Riley' }).locator('..').locator('..')
  await expect(rileyRow.getByText('Away')).toBeVisible({ timeout: 15_000 })

  const reconnectPage = await guestContext.newPage()
  await reconnectPage.goto('/')
  await reconnectPage.getByRole('button', { name: 'Join Game' }).click()
  await reconnectPage.getByLabel('Continue a Saved Game').selectOption({ value: gameId })
  await reconnectPage.getByRole('button', { name: 'Join Game' }).last().click()

  await expect(reconnectPage.getByText('Waiting for game to start...')).toBeVisible()
  await expect(rileyRow.getByText('Away')).toHaveCount(0)

  await hostContext.close()
  await guestContext.close()
})
