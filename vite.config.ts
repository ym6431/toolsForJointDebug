/// <reference types="vitest/config" />

import { crx } from '@crxjs/vite-plugin'
import { defineConfig } from 'vite'
import manifest from './manifest.config'

export default defineConfig({
  plugins: [crx({ manifest })],
  server: {
    cors: {
      origin: [/chrome-extension:\/\//],
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'es2022',
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    clearMocks: true,
    restoreMocks: true,
  },
})
