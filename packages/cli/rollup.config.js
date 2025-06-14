import json from '@rollup/plugin-json';
import path from 'path';
import esbuild from 'rollup-plugin-esbuild';
import sourcemaps from 'rollup-plugin-sourcemaps';
import { terser } from 'rollup-plugin-terser';
import { typescriptPaths } from 'rollup-plugin-typescript-paths';

import commonjs from '@rollup/plugin-commonjs';
import resolve from '@rollup/plugin-node-resolve';

const isProduction = process.env.BUILD === 'prod';

// Function to automatically mark all non-local imports as external
const isExternal = (id) => {
    return !id.startsWith('.') && !path.isAbsolute(id);
};

const config = {
    input: {
        index: 'src/index.ts',
        'commands/agent': 'src/commands/agent/agent.index.ts',
        'commands/create': 'src/commands/create.ts',
        'commands/update': 'src/commands/update.ts',
        'hooks/preparse': 'src/hooks/preparse.ts',
        help: 'src/help.ts',
    },
    output: {
        dir: 'dist',
        format: 'es',
        sourcemap: true,
        banner: '#!/usr/bin/env node',
    },
    external: isExternal,
    plugins: [
        colorfulLogs('CLI Builder'),
        json(),
        typescriptPaths({
            tsconfig: './tsconfig.json',
            preserveExtensions: true,
            nonRelative: false,
        }),
        sourcemaps(),
        esbuild({
            sourceMap: true,
            minify: isProduction,
            treeShaking: isProduction,
            sourcesContent: true,
        }),
        ...(isProduction ? [terser()] : []),
    ],
};

const devConfig = {
    input: './src/index.ts',
    output: {
        file: './dist/cli.cjs', // CommonJS output
        format: 'cjs', // Specify the CommonJS format
        sourcemap: true,
        inlineDynamicImports: true, // Inline all dynamic imports into one file
        banner: '#!/usr/bin/env node',
    },
    plugins: [
        resolve({
            browser: false, // Explicitly disable browser field resolution
            preferBuiltins: true, // Prefer Node.js built-in modules
            mainFields: ['main', 'module'], // Prioritize 'main' field for Node.js packages
            extensions: ['.js', '.ts', '.json'], // Resolve these extensions
            exportConditions: ['node'], // Use Node.js export conditions
        }),
        commonjs({
            // Handle mixed ES modules and CommonJS
            transformMixedEsModules: true,
            // Ignore browser-specific globals
            ignore: ['electron'],
        }),
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
            platform: 'node', // Explicitly set platform to node
            define: {
                // Define Node.js environment
                'process.env.NODE_ENV': '"development"',
                global: 'globalThis',
            },
        }),
        sourcemaps(),
    ],
    external: [
        // Keep Node.js built-ins external
        'fs',
        'path',
        'os',
        'util',
        'crypto',
        'events',
        'stream',
        'url',
        'querystring',
        'http',
        'https',
        'net',
        'tls',
        'zlib',
        'buffer',
        'child_process',
        'cluster',
        'dgram',
        'dns',
        'domain',
        'module',
        'readline',
        'repl',
        'string_decoder',
        'timers',
        'tty',
        'vm',
        'worker_threads',
        'perf_hooks',
        'async_hooks',
    ],
};

export default config;

//#region [Custom Plugins] =====================================================

const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    dim: '\x1b[2m',
    black: '\x1b[30m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    orange: '\x1b[33m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    white: '\x1b[37m',
    bgBlue: '\x1b[44m',
};

// Custom colorful logging plugin
function colorfulLogs(title = 'CLI Builder') {
    function formatBytes(bytes, decimals = 2) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    }

    function getProgressBar(percent, length = 20) {
        const completeChars = Math.round(percent * length);
        const incompleteChars = length - completeChars;
        const completeBar = completeChars > 0 ? '█'.repeat(completeChars) : '';
        const incompleteBar = incompleteChars > 0 ? '░'.repeat(incompleteChars) : '';
        return `${colors.green}${completeBar}${colors.dim}${incompleteBar}${colors.reset}`;
    }

    const spinnerFrames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
    let spinnerIdx = 0;
    let spinnerInterval;
    let startTime;
    let processedFiles = 0;
    const totalFiles = new Set();
    let currentFile = '';
    let hasShownFinalMessage = false;

    return {
        name: 'colorful-logs',
        buildStart() {
            startTime = Date.now();
            hasShownFinalMessage = false;
            console.log(
                `\n${colors.bright}${colors.magenta}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`
            );
            console.log(`${colors.bright} ${colors.green}    ${title}`);

            console.log(`\n\n`);
            console.log(`${colors.yellow}⚡ ${colors.green}Building ${isProduction ? 'production' : 'development'} CLI bundle...${colors.reset}\n`);

            spinnerInterval = setInterval(() => {
                const spinner = spinnerFrames[spinnerIdx];
                spinnerIdx = (spinnerIdx + 1) % spinnerFrames.length;

                if (currentFile && totalFiles.size > 0) {
                    const percent = processedFiles / totalFiles.size;
                    const progressBar = getProgressBar(percent);
                    const percentText = `${Math.round(percent * 100)}%`;

                    process.stdout.write(
                        `\r${colors.cyan}${spinner} ${colors.reset}[${progressBar}] ${colors.yellow}${percentText} ${colors.dim}${processedFiles}/${
                            totalFiles.size
                        } ${colors.reset}${currentFile.padEnd(50)}`
                    );
                }
            }, 80);
        },
        load(id) {
            totalFiles.add(id);
            return null;
        },
        transform(code, id) {
            if (!id.includes('node_modules')) {
                processedFiles++;
                const relativePath = path.relative(process.cwd(), id);
                currentFile = relativePath;
            }
            return null;
        },
        buildEnd(error) {
            if (spinnerInterval) {
                clearInterval(spinnerInterval);
            }
            if (error) {
                console.log(`\n${colors.red}✗ ${colors.bright}Build failed with error:${colors.reset}`);
                console.log(`  ${colors.red}${error.message}${colors.reset}\n`);
            }
        },
        generateBundle(outputOptions, bundle) {
            if (spinnerInterval) {
                clearInterval(spinnerInterval);
                spinnerInterval = null;
            }

            if (!hasShownFinalMessage) {
                const progressBar = getProgressBar(1);
                process.stdout.write(
                    `\r${colors.green}✓ ${colors.reset}[${progressBar}] ${colors.yellow}100% ${colors.dim}${totalFiles.size}/${totalFiles.size} ${
                        colors.bright
                    }Complete!${colors.reset}${''.padEnd(50)}\n`
                );

                const duration = ((Date.now() - startTime) / 1000).toFixed(2);
                console.log(`${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
                console.log(`${colors.green}✓ ${colors.bright}CLI Build complete in ${colors.yellow}${duration}s${colors.reset}!`);
                console.log(`${colors.magenta}➤ ${colors.white}Processed: ${colors.yellow}${totalFiles.size} files${colors.reset}`);
                console.log(`${colors.magenta}➤ ${colors.white}Output: ${colors.yellow}dist/index.js${colors.reset}`);
                console.log(`${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}\n`);
                hasShownFinalMessage = true;
            }
        },
    };
}
