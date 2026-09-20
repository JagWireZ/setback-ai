import { test, expect } from '@playwright/test'

// Exercises `src/utils/pwa.js` (the install-prompt hook) and the PWA/service-worker offline
// behavior it participates in. `beforeinstallprompt` is a Chromium-only, install-heuristic-gated
// event that automation can't reliably trigger organically, so it's dispatched synthetically
// with the same shape the browser provides -- `preventDefault`, `prompt()`, and a `userChoice`
// promise -- which is exactly the surface `usePwaInstall` reads.

test('the install prompt surfaces an Install App action and honors acceptance', async ({
  page,
}) => {
  await page.goto('/')

  await expect(page.getByRole('button', { name: 'Install App' })).toHaveCount(0)

  await page.evaluate(() => {
    const installEvent = new Event('beforeinstallprompt', { cancelable: true })
    installEvent.prompt = () => Promise.resolve()
    installEvent.userChoice = Promise.resolve({ outcome: 'accepted' })
    window.dispatchEvent(installEvent)
  })

  const installButton = page.getByRole('button', { name: 'Install App' })
  await expect(installButton).toBeVisible()

  await installButton.click()

  await expect(page.getByRole('button', { name: 'Install App' })).toHaveCount(0)
})

test('the app shell still loads while offline once the service worker has cached it', async ({
  page,
  context,
}) => {
  await page.goto('/')
  await expect(page.getByRole('button', { name: 'New Game' })).toBeVisible()

  await page.evaluate(async () => {
    if (!('serviceWorker' in navigator)) {
      throw new Error('service workers are not supported in this browser context')
    }
    await navigator.serviceWorker.ready
  })

  await context.setOffline(true)
  await page.reload()

  await expect(page.getByRole('button', { name: 'New Game' })).toBeVisible()

  await context.setOffline(false)
})
