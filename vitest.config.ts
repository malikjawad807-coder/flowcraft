import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      '@flowcart/shared': resolve(__dirname, 'packages/shared/src/index.ts'),
      '@flowcart/vault': resolve(__dirname, 'packages/vault/src/index.ts'),
      '@flowcart/db': resolve(__dirname, 'packages/db/src/index.ts'),
      '@flowcart/engine': resolve(__dirname, 'packages/engine/src/index.ts'),
      '@flowcart/nodes': resolve(__dirname, 'packages/nodes/src/index.ts'),
      '@flowcart/agent': resolve(__dirname, 'packages/agent/src/index.ts'),
      '@flowcart/llm': resolve(__dirname, 'packages/llm/src/index.ts'),
      '@flowcart/gmail': resolve(__dirname, 'packages/gmail/src/index.ts'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['packages/**/*.test.ts', 'apps/**/*.test.ts'],
  },
});
