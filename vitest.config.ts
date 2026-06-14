import { defineConfig } from 'vitest/config';
import swc from 'unplugin-swc';

export default defineConfig({
  plugins: [
    swc.vite({
      module: { type: 'es6' },
    }),
  ],
  test: {
    environment: 'node',
    globals: false,
    include: ['src/**/*.spec.ts'],
    testTimeout: 30000,
    // 集成测试共享单一 PG/Redis，禁止并行避免 truncate/seed 竞态
    fileParallelism: false,
    sequence: { concurrent: false },
  },
});
