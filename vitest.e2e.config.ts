import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'web-ext',
    include: ['test/**/*.e2e.test.ts'],
    testTimeout: 30_000,
    hookTimeout: 30_000,
    environmentOptions: {
      'web-ext': {
        path: './dist',
        compiler: 'pnpm build',
      },
    },
  },
})
