import { defineConfig } from 'vitest/config';

const nodeTests = [
  'packages/*/src/**/*.test.ts',
  'packages/*/test/**/*.test.ts',
  'scripts/**/*.test.ts',
];
const integrationTests = ['**/*.int.test.ts'];

export default defineConfig({
  test: {
    projects: [
      {
        extends: true,
        test: { name: 'unit', include: nodeTests, exclude: integrationTests, environment: 'node' },
      },
      {
        extends: true,
        test: { name: 'integration', include: integrationTests, environment: 'node' },
      },
      {
        extends: true,
        test: {
          name: 'dom',
          include: ['packages/client-web/**/*.test.tsx'],
          environment: 'jsdom',
          setupFiles: ['packages/client-web/test/setup-dom.ts'],
        },
      },
    ],
  },
});
