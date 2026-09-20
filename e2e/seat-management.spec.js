import { test, expect } from '@playwright/test'

test('the owner can add a seat, reorder players, and remove a seat in the lobby', async ({
  page,
}) => {
  await page.goto('/')

  await page.getByRole('button', { name: 'New Game' }).click()
  await page.getByPlaceholder('Enter your name').fill('Casey')
  await page.getByRole('button', { name: 'Create Game' }).click()

  await expect(page.getByRole('heading', { name: 'Lobby' })).toBeVisible()
  await expect(page.getByText('Players (5)')).toBeVisible()

  await page.getByRole('button', { name: 'Add Seat' }).click()
  await expect(page.getByText('Players (6)')).toBeVisible()

  const aiSeatNames = await page.locator('[aria-label^="Remove "]').evaluateAll((buttons) =>
    buttons.map((button) => button.getAttribute('aria-label')?.replace('Remove ', '')),
  )
  const seatToMove = aiSeatNames.find((name) => name && name !== 'Casey')
  expect(seatToMove).toBeTruthy()

  const moveDownButton = page.getByRole('button', { name: `Move ${seatToMove} down` })
  await moveDownButton.click()

  const removeButton = page.getByRole('button', { name: `Remove ${seatToMove}` })
  await removeButton.click()
  await page.getByRole('button', { name: 'Remove Seat' }).click()

  await expect(page.getByText('Players (5)')).toBeVisible()
  await expect(page.getByRole('button', { name: `Remove ${seatToMove}` })).toHaveCount(0)
})
