import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

export default defineConfig({
  plugins: [react(), viteSingleFile()],
  build: {
    target: 'esnext',
    cssCodeSplit: false,
  },
  // Vitest reads this config automatically. Tests cover pure logic + a stubbed
  // localStorage only, so the lightweight 'node' environment is enough — no
  // jsdom/happy-dom, and nothing renders React.
  test: {
    environment: 'node',
    include: ['src/__tests__/**/*.test.js'],
  },
});
