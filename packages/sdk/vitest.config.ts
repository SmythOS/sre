import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
    plugins: [tsconfigPaths()],
    test: {
        globals: true,
        environment: 'node',
        include: ['tests/**/*.test.ts'],
        exclude: ['node_modules'],
        coverage: {
            reporter: ['text', 'text-summary', 'html'],
            reportsDirectory: './coverage',
            include: ['src/**/*.{ts,tsx}'],
            exclude: ['node_modules'],
        },
        testTimeout: 30_000,
        // Pool options for better debugging
        pool: 'forks',
        poolOptions: {
            forks: {
                singleFork: true,
            },
        },
    },

    build: {
        sourcemap: true,
    },

    // Ensure sourcemaps work properly
    esbuild: {
        sourcemap: true,
    },
});
