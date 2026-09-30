import { defineConfig } from 'vitest/config';

// Unit tests for the framework-free domain core only. Kept separate from
// nuxt.config.ts so it cannot affect app builds.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['lib/domain/**/*.test.ts'],
  },
});
