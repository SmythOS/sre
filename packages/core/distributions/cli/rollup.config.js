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
import LZString from 'lz-string';
import fs from 'fs';

const isProduction = process.env.BUILD === 'prod';
const isDebug = process.env.BUILD === 'debug';


const projectRootDir = __dirname;

const devConfig = {
    input: './distributions/cli/index.ts',
    output: {
        file: './distributions/cli/dist/smyth-runtime.cjs', // CommonJS output
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

const debugConfig = {
    input: './distributions/cli/index.ts',
    output: {
        file: './distributions/cli/dist/smyth-runtime.js', // CommonJS output
        format: 'es', // Specify the CommonJS format
        sourcemap: true,
        inlineDynamicImports: true, // Inline all dynamic imports into one file

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
    ],
};


const prodConfig = {
    input: './distributions/cli/index.ts',
    output: {
        file: './distributions/cli/dist/smyth-runtime.cjs', // CommonJS output
        format: 'cjs', // Specify the CommonJS format
        sourcemap: false,
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
            sourceMap: false,
            minify: false,
            treeShaking: false,
        }),
        terser({
            format: {
                comments: false,  // Remove all comments
            }
        }),
        {
            name: 'compress-with-lzstring',
            generateBundle(options, bundle) {
                //Weak obfuscation based on code compression
                for (const fileName in bundle) {
                    const chunk = bundle[fileName];
                    if (chunk.type === 'chunk') {
                        // Compress the code to UTF-16 format
                        const compressedCode = LZString.compressToBase64(chunk.code);
                        let lzLib = fs.readFileSync('./distributions/cli/wrapper/lzlib.js.txt', 'utf8');
                        lzLib = lzLib.replace(/LZString/g, '_')
                                    .replace(/decompressFromBase64/g, '____')
                                    .replace(/compressToBase64/g, '_____')
                                    .replace(/compressToUTF16/g, 'ctu')
                                    .replace(/decompressFromUTF16/g, 'dfu')
                                    .replace(/compressToUint8Array/g, 'ctua')
                                    .replace(/decompressFromUint8Array/g, 'dfua')
                                    .replace(/compressToEncodedURIComponent/g, 'ceuc')
                                    .replace(/decompressFromEncodedURIComponent/g, 'dfec')
                                    .replace(/_compress/g, '___')
                                    .replace(/_decompress/g, '__');

                        
                        // Wrap it in the eval with decompression
                        chunk.code = `${lzLib};var e=eval;var _j='${compressedCode}';var _j=_.____(_j);`;

                        //obfuscated eval
                        chunk.code += `var g = Object.getOwnPropertyNames(global).filter((property) =>  typeof global[property] === 'function');for (var i=0,j='',jj=global,jjj='require';i<g.length; i++,j=g[i]) j.length == 8 && j[5] == jjj[4] && j[2]==j[7] ? (new jj[j](jjj, _j))(require)  : j='';`
                    }
                }
            }
        }
    ],
};

let config = isProduction ? prodConfig : isDebug ? debugConfig : devConfig;


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
