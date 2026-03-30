import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
    plugins: [tsconfigPaths()],
    test: {
        globals: true,
        environment: 'node',
        include: ['packages/*/tests/**/*.test.ts'],
        exclude: ['node_modules', 'dist'],
        env: {
            // ENABLE_INTEGRATION_TESTS: 'true',
        },
        coverage: {
            reporter: ['text', 'text-summary', 'html'],
            reportsDirectory: './coverage',
            include: ['packages/*/src/**/*.{ts,tsx}'],
            exclude: ['node_modules', 'packages/*/dist/**', 'packages/*/tests/**', 'packages/cli/**'],
        },
        testTimeout: 30000,
        // `poolOptions` was removed in Vitest 4 — https://vitest.dev/guide/migration#pool-rework
        // Its sub-keys are now flat top-level `test` options:
        //   poolOptions.forks.execArgv        → test.execArgv
        //   poolOptions.forks.isolate         → test.isolate
        //   poolOptions.forks.singleFork:true → test.maxWorkers: 1  (false = default, no replacement needed)
        //   poolOptions.vmThreads.memoryLimit → test.vmMemoryLimit
        //
        // Previous config kept for reference:
        // poolOptions: {
        //     forks: {
        //         singleFork: false, // false = one fork per test file (default); true → maxWorkers: 1
        //     },
        // },
        pool: 'forks',
        // sequence: {
        //     concurrent: false, // run test files sequentially
        // },
    },
    build: {
        sourcemap: 'inline',
    },
    esbuild: {
        sourcemap: true,
    },
});
