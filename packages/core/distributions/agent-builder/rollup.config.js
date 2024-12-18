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
    input: './distributions/agent-builder/index.ts',
    output: {
        file: './distributions/agent-builder/dist/agent-builder.dev.cjs', // CommonJS output
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
    input: 'distributions/agent-builder/index.ts',
    output: {
        format: 'es',
        sourcemap: true,

        //Comment this line and uncomment the following lines if you need ES bundle
        //file: 'distributions/agent-builder/dist/agent-builder.dev.js',
        dir: 'distributions/agent-builder/dist',
        inlineDynamicImports: true,
        entryFileNames: 'agent-builder.dev-bundle.js',
    },
    plugins: [
        //Uncomment the following lines if you need ES Bundle
        resolve({
            browser: false,
            preferBuiltins: true,
        }),
        commonjs(),
        json(),
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
    input: 'distributions/agent-builder/index.ts',
    output: {
        format: 'es',
        sourcemap: true,

        //Comment this line and uncomment the following lines if you need ES bundle
        file: 'distributions/agent-builder/dist/agent-builder.dev.js',
    },
    plugins: [
        json(),
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
    input: 'distributions/cli/index.ts',
    output: {
        file: 'distributions/cli/dist/cli.prod.js',
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
