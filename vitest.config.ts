import { defineConfig } from 'vitest/config';

// Config de tests para el núcleo puro `src/ritual-core` (TypeScript sin framework).
// Standalone (no carga los plugins de vite.config) porque los tests no necesitan
// React ni Tailwind: corren en Node.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
