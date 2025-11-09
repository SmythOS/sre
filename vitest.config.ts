import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
    plugins: [tsconfigPaths()],
    test: {
        globals: true,
        environment: 'node',
        include: ['packages/*/tests/**/*.test.ts'],
        exclude: ['node_modules', 'dist'],
        coverage: {
            reporter: ['text', 'text-summary', 'html'],
            reportsDirectory: './coverage',
            include: ['packages/*/src/**/*.{ts,tsx}'],
            exclude: ['node_modules', 'packages/*/dist/**', 'packages/*/tests/**', 'packages/cli/**'],
        },
        testTimeout: 30000,
        pool: 'forks',
        poolOptions: {
            forks: {
                singleFork: false, // Each test file gets its own process for isolation
            },
        },
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
