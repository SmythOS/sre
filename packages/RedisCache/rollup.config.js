import json from '@rollup/plugin-json';
import path from 'path';
import esbuild from 'rollup-plugin-esbuild';
import sourcemaps from 'rollup-plugin-sourcemaps';
import { typescriptPaths } from 'rollup-plugin-typescript-paths';
import colorfulLogs from './scripts/rollup-colorfulLogs';

// Function to automatically mark all non-local imports as external
// avoids warning message about external dependencies
const isExternal = (id, ...overArgs) => {
    const _isExternal = !id.startsWith('.') && !path.isAbsolute(id);
    return _isExternal;
};

const config = {
    input: 'src/index.ts',
    output: {
        file: 'dist/index.js',
        format: 'es',
        sourcemap: true,
    },
    external: isExternal,
    plugins: [
        colorfulLogs('Smyth Builder'),
        json(),
        typescriptPaths({
            tsconfig: './tsconfig.json',
            preserveExtensions: true,
            nonRelative: false,
        }),

        sourcemaps(),
        esbuild({
            sourceMap: true,
            minify: false,
            treeShaking: false,
            sourcesContent: true,
        }),
    ],
};

export default config;
