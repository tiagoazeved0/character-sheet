/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// NOTE: set `base` to '/<your-repo-name>/' before the first Pages deploy.
export default defineConfig({
  base: '/character-sheet/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Character Sheet',
        short_name: 'Sheet',
        theme_color: '#3a3129',
        background_color: '#f3f1ec',
        display: 'standalone',
        orientation: 'any',
        icons: [{ src: 'icon-512.png', sizes: '512x512', type: 'image/png' }],
      },
      workbox: { globPatterns: ['**/*.{js,css,html,woff2}'] },
    }),
  ],
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
})
