import json from '@rollup/plugin-json';
import { createFilter } from '@rollup/pluginutils';
import path from 'path';
import esbuild from 'rollup-plugin-esbuild';
import sourcemaps from 'rollup-plugin-sourcemaps';
import { terser } from 'rollup-plugin-terser';
import typescriptPaths from 'rollup-plugin-typescript-paths';
import { execSync } from 'child_process';
//import copy from 'rollup-plugin-copy';
// //import typescript from 'rollup-plugin-typescript2';

const isProduction = process.env.BUILD === 'prod';

// Function to automatically mark all non-local imports as external
// avoids warning message about external dependencies
const isExternal = (id) => !id.startsWith('.') && !id.startsWith('/') && !path.isAbsolute(id);

const projectRootDir = __dirname;
const devConfig = {
    input: 'src/index.ts',
    output: {
        file: 'dist/index.dev.js',
        format: 'es',
        sourcemap: true,
    },
    external: isExternal, // Use the function to mark non-local imports as external
    plugins: [
        colorfulLogs('SmythOS Runtime Builder'), // Add our custom logging plugin
        ctixPlugin(), // Add ctix plugin as first plugin
        json(),
        typescriptPaths({
            tsconfig: './tsconfig.json', // Ensure this points to your tsconfig file
            preserveExtensions: true,
            nonRelative: false,
        }),
        esbuild({
            sourceMap: true,
            minify: false, //do not enable minify here, it will break the sourcemap (minification is done by terser plugin below)
            treeShaking: false,
        }),

        // typescript({
        //     tsconfig: 'tsconfig.json',
        //     clean: true,
        // }),
        filenameReplacePlugin(),
        sourcemaps(),
    ],
};

const prodConfig = {
    input: 'src/index.ts',
    output: {
        file: 'dist/index.js',
        format: 'es',
        sourcemap: true,
    },
    external: isExternal, // Use the function to mark non-local imports as external
    plugins: [
        ctixPlugin(), // Add ctix plugin as first plugin
        colorfulLogs('♻️ SmythOS Runtime Builder'), // Add our custom logging plugin
        json(),
        typescriptPaths({
            tsconfig: './tsconfig.json', // Ensure this points to your tsconfig file
            preserveExtensions: true,
            nonRelative: false,
        }),
        esbuild({
            sourceMap: true,
            minify: true,
            treeShaking: true,
        }),
        // typescript({
        //     tsconfig: 'tsconfig.json',
        //     clean: true,
        // }),
        filenameReplacePlugin(),
        sourcemaps(),
        terser(),
    ],
};

let config = isProduction ? prodConfig : devConfig;

export default config;

//#region [Custom Plugins] =====================================================

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

const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    dim: '\x1b[2m',
    underscore: '\x1b[4m',
    blink: '\x1b[5m',
    reverse: '\x1b[7m',
    hidden: '\x1b[8m',

    black: '\x1b[30m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    white: '\x1b[37m',

    bgBlack: '\x1b[40m',
    bgRed: '\x1b[41m',
    bgGreen: '\x1b[42m',
    bgYellow: '\x1b[43m',
    bgBlue: '\x1b[44m',
    bgMagenta: '\x1b[45m',
    bgCyan: '\x1b[46m',
    bgWhite: '\x1b[47m',
};

// Custom colorful logging plugin
function colorfulLogs(title = 'Builder') {
    // ANSI color codes

    // Format file size to human-readable format
    function formatBytes(bytes, decimals = 2) {
        if (bytes === 0) return '0 Bytes';

        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];

        const i = Math.floor(Math.log(bytes) / Math.log(k));

        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    }

    // Create a progress bar
    function getProgressBar(percent, length = 20) {
        const completeChars = Math.round(percent * length);
        const incompleteChars = length - completeChars;

        const completeBar = completeChars > 0 ? '█'.repeat(completeChars) : '';
        const incompleteBar = incompleteChars > 0 ? '░'.repeat(incompleteChars) : '';

        return `${colors.green}${completeBar}${colors.dim}${incompleteBar}${colors.reset}`;
    }

    // Spinner frames for animation
    const spinnerFrames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
    let spinnerIdx = 0;
    let spinnerInterval;

    let startTime;
    let processedFiles = 0;
    const totalFiles = new Set();
    let currentFile = '';

    return {
        name: 'colorful-logs',
        buildStart() {
            startTime = Date.now();
            console.log(`\n${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
            console.log(`${colors.bright}${colors.bgGreen}  ${colors.reset}${colors.green} ${title} ${colors.bgGreen}  ${colors.reset}`);
            console.log(`${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
            console.log(`${colors.yellow}⚡ ${colors.green}Building ${isProduction ? 'production' : 'development'} bundle...${colors.reset}\n`);

            // Start spinner animation
            spinnerInterval = setInterval(() => {
                const spinner = spinnerFrames[spinnerIdx];
                spinnerIdx = (spinnerIdx + 1) % spinnerFrames.length;

                if (currentFile && totalFiles.size > 0) {
                    const percent = processedFiles / totalFiles.size;
                    const progressBar = getProgressBar(percent);
                    const percentText = `${Math.round(percent * 100)}%`;

                    process.stdout.write(
                        `\r${colors.cyan}${spinner} ${colors.reset}[${progressBar}] ${colors.yellow}${percentText} ${colors.dim}${processedFiles}/${totalFiles.size} ${colors.reset}${currentFile.padEnd(50)}`,
                    );
                }
            }, 80);
        },
        load(id) {
            totalFiles.add(id);
            return null;
        },
        transform(code, id) {
            // Skip node_modules files to reduce noise
            if (!id.includes('node_modules')) {
                processedFiles++;
                const relativePath = path.relative(process.cwd(), id);
                currentFile = relativePath;
                // Don't need to write here as the spinner interval will update
            }
            return null;
        },
        buildEnd(error) {
            // Ensure we clear the interval if there's an error
            if (spinnerInterval) {
                clearInterval(spinnerInterval);
            }

            if (error) {
                console.log(`\n${colors.red}✗ ${colors.bright}Build failed with error:${colors.reset}`);
                console.log(`  ${colors.red}${error.message}${colors.reset}\n`);
            }
        },
        generateBundle(outputOptions, bundle) {
            // Clear spinner interval
            clearInterval(spinnerInterval);

            // Show completed progress bar with 100%
            const progressBar = getProgressBar(1);
            process.stdout.write(
                `\r${colors.green}✓ ${colors.reset}[${progressBar}] ${colors.yellow}100% ${colors.dim}${totalFiles.size}/${totalFiles.size} ${colors.bright}Complete!${colors.reset}${''.padEnd(50)}\n`,
            );

            // Calculate and show build duration
            const duration = ((Date.now() - startTime) / 1000).toFixed(2);
            console.log(`${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
            console.log(`${colors.green}✓ ${colors.bright}Build complete in ${colors.yellow}${duration}s${colors.reset}!`);
            console.log(`${colors.magenta}➤ ${colors.white}Processed: ${colors.yellow}${totalFiles.size} files${colors.reset}`);
            console.log(
                `${colors.magenta}➤ ${colors.white}Output: ${colors.yellow}${isProduction ? 'dist/index.js' : 'dist/index.dev.js'}${colors.reset}\n`,
            );

            // Show bundle details
            console.log(`${colors.magenta}▶ ${colors.bright}Bundle details:${colors.reset}`);

            Object.keys(bundle).forEach((fileName) => {
                const file = bundle[fileName];
                const fileSize = formatBytes(file.code?.length || 0);
                console.log(`  ${colors.green}• ${colors.yellow}${fileName}: ${colors.cyan}${fileSize}${colors.reset}`);
            });

            // Show success message at the very end
            console.log(`\n${colors.green}✅ ${colors.bright}Build completed successfully!${colors.reset} 💃 Let's Rock and Roll! 🕺\n`);
        },
    };
}

// Custom ctix plugin to generate barrel files
function ctixPlugin(options = {}) {
    return {
        name: 'ctix-barrel-generator',
        buildStart() {
            try {
                process.stdout.write(`\n${colors.cyan}⚙️ ${colors.yellow} Generating barrel files...${colors.reset}\n`);
                execSync('npx ctix build', { stdio: 'inherit' });
                console.log(`${colors.green}✅ ${colors.bright}Barrel files generated successfully!${colors.reset}\n`);
            } catch (error) {
                this.error(`Failed to generate ctix barrel files: ${error.message}`);
            }
        },
    };
}
//#endregion
