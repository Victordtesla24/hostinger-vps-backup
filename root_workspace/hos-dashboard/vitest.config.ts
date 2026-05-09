import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['server/__tests__/**/*.test.ts'],
    globals: true,
    testTimeout: 20000,
    hookTimeout: 20000,
    reporters: ['verbose'],
    sequence: { concurrent: false },
    coverage: {
      provider: 'v8',
      include: ['server/**/*.ts'],
      exclude: ['server/__tests__/**', 'server/index.ts'],
    },
  },
});
