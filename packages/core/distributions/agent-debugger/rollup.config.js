import json from '@rollup/plugin-json';
import { createFilter } from '@rollup/pluginutils';
import path from 'path';
import copy from 'rollup-plugin-copy';
import esbuild from 'rollup-plugin-esbuild';
import sourcemaps from 'rollup-plugin-sourcemaps';
import { terser } from 'rollup-plugin-terser';
import typescriptPaths from 'rollup-plugin-typescript-paths';
import typescript from 'rollup-plugin-typescript2';
import commonjs from '@rollup/plugin-commonjs';
import resolve from '@rollup/plugin-node-resolve';

const isProduction = process.env.BUILD === 'prod';
const format = process.env.FORMAT || 'es';

const devCJSConfig = {
    input: './distributions/agent-debugger/src/app.ts',
    output: {
        file: './distributions/agent-debugger/dist/agent-debugger.dev.cjs', // CommonJS output
        format: 'cjs', // Specify the CommonJS format
        sourcemap: true,
        inlineDynamicImports: true, // Inline all dynamic imports into one file
    },
    plugins: [
        resolve({
            browser: false, // Allow bundling of modules from `node_modules`
            preferBuiltins: true, // Prefer Node.js built-in modules
            mainFields: ['module', 'main'], // Ensure Node.js package resolution
            extensions: ['.js', '.ts', '.json'], // Resolve these extensions
        }),
        commonjs(), // Convert CommonJS modules to ES6 for Rollup to bundle them
        json(),
        filenameReplacePlugin(),
        typescriptPaths({
            tsconfig: './tsconfig.json',
            preserveExtensions: true,
            nonRelative: false,
        }),
        esbuild({
            sourceMap: true,
            minify: false,
            treeShaking: false,
            target: 'node18',
        }),
        sourcemaps(),
    ],
};
const devESBundleConfig = {
    input: 'distributions/agent-debugger/src/app.ts',
    output: {
        format: 'es',
        sourcemap: true,

        //Comment this line and uncomment the following lines if you need ES bundle
        //file: 'distributions/agent-builder/dist/agent-builder.dev.js',
        dir: 'distributions/agent-debugger/dist',
        inlineDynamicImports: true,
        entryFileNames: 'agent-debugger.dev-bundle.js',
    },
    plugins: [
        //Uncomment the following lines if you need ES Bundle
        resolve({
            browser: false,
            preferBuiltins: true,
        }),
        commonjs(),
        json(),
        filenameReplacePlugin(),
        typescriptPaths({
            tsconfig: '../tsconfig.json',
            preserveExtensions: true,
            nonRelative: false,
        }),
        esbuild({
            sourceMap: true,
            minify: false,
            treeShaking: false,
        }),

        // typescript({
        //     tsconfig: './tsconfig.json',
        //     clean: true,
        //     include: ['src/**/*.ts', 'distributions/AWS/**/*.ts'],
        //     exclude: ['node_modules'],
        // }),

        sourcemaps(),
    ],
};

const devESConfig = {
    input: 'distributions/agent-debugger/src/app.ts',
    output: {
        format: 'es',
        sourcemap: true,

        //Comment this line and uncomment the following lines if you need ES bundle
        file: 'distributions/agent-debugger/dist/agent-debugger.dev.js',
    },
    plugins: [
        json(),
        filenameReplacePlugin(),
        typescriptPaths({
            tsconfig: '../tsconfig.json',
            preserveExtensions: true,
            nonRelative: false,
        }),
        esbuild({
            sourceMap: true,
            minify: false,
            treeShaking: false,
        }),

        // typescript({
        //     tsconfig: './tsconfig.json',
        //     clean: true,
        //     include: ['src/**/*.ts', 'distributions/AWS/**/*.ts'],
        //     exclude: ['node_modules'],
        // }),

        sourcemaps(),
    ],
};

const prodConfig = {
    input: 'distributions/agent-debugger/src/app.ts',
    output: {
        file: 'distributions/agent-debugger/dist/agent-debugger.prod.js',
        format: 'es',
        sourcemap: true,
    },
    plugins: [
        json(),
        typescriptPaths({
            tsconfig: '../tsconfig.json', // Ensure this points to your tsconfig file
            preserveExtensions: true,
            nonRelative: false,
        }),
        filenameReplacePlugin(),
        esbuild({
            sourceMap: true,
            minify: true,
            treeShaking: true,
        }),
        // typescript({
        //     tsconfig: './tsconfig.json',
        //     clean: true,
        //     include: ['src/**/*.ts', 'distributions/AWS/**/*.ts'],
        //     exclude: ['node_modules'],
        // }),

        sourcemaps(),
        terser(),
    ],
};

let devConfig = devESConfig;
if (format === 'cjs') {
    devConfig = devCJSConfig;
}

if (format === 'esbundle') {
    devConfig = devESBundleConfig;
}

let config = isProduction ? prodConfig : devConfig;

export default config;

function filenameReplacePlugin() {
    const filter = createFilter('**/*.ts', 'node_modules/**');

    return {
        name: 'filename-replace',
        transform(code, id) {
            if (!filter(id)) return null;

            // Normalize the path for different environments
            const normalizedId = path.normalize(id);

            // Extract the part of the path after '/src' and remove the file extension
            const relativePath = path.relative(path.resolve('src'), normalizedId);
            const filenameWithoutExtension = relativePath.replace(path.extname(relativePath), '');

            // Replace backslashes with forward slashes if on Windows
            const unixStylePath = filenameWithoutExtension.replace(/\\/g, '/');

            const modifiedCode = code.replace(/___FILENAME___/g, unixStylePath);

            return {
                code: modifiedCode,
                map: null, // Handle source maps if necessary
            };
        },
    };
}
