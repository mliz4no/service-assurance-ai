import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      include: ['src/**/*.ts'],
      exclude: ['src/index.ts', 'src/**/__tests__/**', 'src/**/*.test.ts'],
      thresholds: {
        statements: 80,
        branches: 55,
        functions: 65,
        lines: 80,
      },
    },
  },
});