import { defineConfig } from 'vitest/config';

// Unit tests for framework-free code only: the domain core, small pure helpers in
// lib/, and the server utilities (which take `fetch` and stores as arguments, so
// they run without Nuxt or a network). Kept separate from nuxt.config.ts so it
// cannot affect app builds.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['lib/domain/**/*.test.ts', 'lib/*.test.ts', 'lib/home/**/*.test.ts', 'server/utils/**/*.test.ts'],
  },
});
