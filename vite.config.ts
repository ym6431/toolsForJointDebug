import { defineConfig } from 'vitest/config'

export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        popup: new URL('./popup.html', import.meta.url).pathname,
        options: new URL('./options.html', import.meta.url).pathname,
        background: new URL('./src/background.ts', import.meta.url).pathname,
        content: new URL('./src/content.ts', import.meta.url).pathname,
        'page-bridge': new URL('./src/page-bridge.ts', import.meta.url).pathname,
      },
      output: {
        entryFileNames: 'assets/[name].js',
        chunkFileNames: 'assets/[name].js',
        assetFileNames: 'assets/[name][extname]',
      },
    },
    target: 'es2022',
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    clearMocks: true,
    restoreMocks: true,
  },
})
