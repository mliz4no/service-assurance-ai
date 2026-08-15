import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      thresholds: {
        statements: 53,
        branches: 55,
        functions: 65,
        lines: 53,
      },
    },
  },
});