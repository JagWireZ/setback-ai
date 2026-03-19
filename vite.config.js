import { readFileSync } from 'node:fs'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

const baseManifest = JSON.parse(
  readFileSync(new URL('./pwa/manifest.webmanifest', import.meta.url), 'utf8')
)

export default defineConfig(() => {
  const isStagingBuild = process.env.VITE_APP_ENV === 'staging'
  const buildTimestamp = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
    .format(new Date())
    .replace(',', '')
    .replace(/\//g, '-')
    + ' ET'
  const manifest = {
    ...baseManifest,
    name: isStagingBuild ? 'Setback (Staging)' : baseManifest.name,
    short_name: isStagingBuild ? 'Setback (Staging)' : baseManifest.short_name,
  }

  return {
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        manifest,
        includeAssets: [
          'apple-touch-icon.png',
          'logo-192x192.png',
          'logo-512x512.png',
        ],
      }),
    ],
    define: {
      __BUILD_TIMESTAMP__: JSON.stringify(buildTimestamp),
    },
  }
})
