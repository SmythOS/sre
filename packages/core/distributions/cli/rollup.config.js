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

const projectRootDir = __dirname;

const devConfig = {
    input: './distributions/cli/index.ts',
    output: {
        file: './distributions/cli/dist/cli.dev.cjs', // CommonJS output
        format: 'cjs', // Specify the CommonJS format
        sourcemap: true,
        inlineDynamicImports: true, // Inline all dynamic imports into one file
    },
    plugins: [
        resolve({
            browser: false, // Allow bundling of modules from `node_modules`
            preferBuiltins: true, // Prefer Node.js built-in modules
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
        }),
        sourcemaps(),
        copy({
            targets: [{ src: 'src/data/*', dest: 'dist/data' }],
        }),
    ],
};
// const devConfig = {
//     input: 'distributions/cli/index.ts',
//     output: {
//         file: 'distributions/cli/dist/cli.dev.js',
//         format: 'es',
//         sourcemap: true,
//     },
//     plugins: [
//         json(),
//         typescriptPaths({
//             tsconfig: '../tsconfig.json', // Ensure this points to your tsconfig file
//             preserveExtensions: true,
//             nonRelative: false,
//         }),
//         esbuild({
//             sourceMap: true,
//             minify: false, //do not enable minify here, it will break the sourcemap (minification is done by terser plugin below)
//             treeShaking: false,
//         }),

//         // typescript({
//         //     tsconfig: './tsconfig.json',
//         //     clean: true,
//         //     include: ['src/**/*.ts', 'distributions/AWS/**/*.ts'],
//         //     exclude: ['node_modules'],
//         // }),
//         filenameReplacePlugin(),
//         sourcemaps(),
//     ],
// };

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
        filenameReplacePlugin(),
        sourcemaps(),
        terser(),
    ],
};

let config = isProduction ? prodConfig : devConfig;

export default config;

// this is used to replace the ___FILENAME___ placeholder with source filename
//it's used by the logger to set the appropriate module name
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
