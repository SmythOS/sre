import json from '@rollup/plugin-json';
import { execSync } from 'child_process';
import path from 'path';
import esbuild from 'rollup-plugin-esbuild';
import sourcemaps from 'rollup-plugin-sourcemaps';
import { typescriptPaths } from 'rollup-plugin-typescript-paths';
const isProduction = process.env.BUILD === 'prod';

// Function to automatically mark all non-local imports as external
// avoids warning message about external dependencies
const isExternal = (id, ...overArgs) => {
    const _isExternal = !id.startsWith('.') && !path.isAbsolute(id);
    return _isExternal;
};

const config = [
    // Core re-export bundle (SRE pass-through)
    {
        input: 'src/core.ts',
        output: {
            file: 'dist/core.js',
            format: 'es',
            sourcemap: true,
        },
        external: isExternal,
        plugins: [
            json(),
            typescriptPaths({
                tsconfig: './tsconfig.json',
                preserveExtensions: true,
                nonRelative: false,
            }),
            sourcemaps(),
            esbuild({
                sourceMap: true,
                minifyWhitespace: true,
                minifySyntax: true,
                minifyIdentifiers: false,
                treeShaking: true,
                sourcesContent: true,
            }),
        ],
    },
    // Main SDK bundle
    {
        input: 'src/index.ts',
        output: {
            file: 'dist/index.js',
            format: 'es',
            sourcemap: true,
        },
        external: isExternal,
        plugins: [
            colorfulLogs('SDK Builder'),
            ctixPlugin(),
            json(),
            typescriptPaths({
                tsconfig: './tsconfig.json',
                preserveExtensions: true,
                nonRelative: false,
            }),
            // typescript({
            //     tsconfig: 'tsconfig.json',
            //     clean: true,
            //     sourceMap: true,
            //     // sourcemapPathTransform: (relativeSourcePath, sourcemapPath) => {
            //     //     // Convert relative paths to absolute paths for better debugging
            //     //     return path.resolve(path.dirname(sourcemapPath), relativeSourcePath);
            //     // },
            // }),
            sourcemaps(),
            esbuild({
                sourceMap: true,
                minifyWhitespace: true,
                minifySyntax: true,
                minifyIdentifiers: false,
                treeShaking: true,
                sourcesContent: true,
            }),
            //terser(),
        ],
    },
];

export default config;

//#region [Custom Plugins] =====================================================

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
    orange: '\x1b[33m',
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
function colorfulLogs(title = 'SDK Builder') {
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
    let hasShownFinalMessage = false;
    let hasBuildErrors = false;

    return {
        name: 'colorful-logs',
        buildStart() {
            startTime = Date.now();
            hasShownFinalMessage = false;
            hasBuildErrors = false;
            console.log(
                `\n${colors.bright}${colors.magenta}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`
            );
            console.log(`${colors.bright} ${colors.green}    ${title}`);

            console.log(`\n\n`);
            console.log(`${colors.yellow}⚡ ${colors.green}Building ${isProduction ? 'production' : 'development'} SDK bundle...${colors.reset}\n`);

            // Start spinner animation
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
            // Skip node_modules files to reduce noise
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
                hasBuildErrors = true;
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
                console.log(`${colors.green}✓ ${colors.bright}SDK Build complete in ${colors.yellow}${duration}s${colors.reset}!`);
                console.log(`${colors.magenta}➤ ${colors.white}Processed: ${colors.yellow}${totalFiles.size} files${colors.reset}`);
                console.log(
                    `${colors.magenta}➤ ${colors.white}Output: ${colors.yellow}${isProduction ? 'dist/index.js' : 'dist/index.dev.js'}${
                        colors.reset
                    }\n`
                );

                console.log(`${colors.magenta}▶ ${colors.bright}Bundle details:${colors.reset}`);

                Object.keys(bundle).forEach((fileName) => {
                    const file = bundle[fileName];
                    const fileSize = formatBytes(file.code?.length || 0);
                    console.log(`  ${colors.green}• ${colors.yellow}${fileName}: ${colors.cyan}${fileSize}${colors.reset}`);
                });
            }
        },
        closeBundle() {
            if (!hasShownFinalMessage && !hasBuildErrors) {
                setTimeout(() => {
                    console.log(`\n${colors.green}✅ ${colors.bright}SDK Build completed successfully!${colors.reset}\n\n`);
                    console.log(`${colors.white}${colors.bright}╔━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╗${colors.reset}`);
                    console.log(
                        `${colors.white}${colors.bright}║            ${colors.green}Smyth SDK Successfully Built${colors.white}            ║${colors.reset}`
                    );
                    console.log(`${colors.white}${colors.bright}╚━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╝${colors.reset}`);
                    hasShownFinalMessage = true;
                }, 100);
            }
        },
    };
}

// Custom ctix plugin to generate barrel files
function ctixPlugin(options = {}) {
    return {
        name: 'ctix-barrel-generator',
        buildStart() {
            try {
                process.stdout.write(`\n${colors.cyan}⚙️ ${colors.yellow} Generating SDK barrel files...${colors.reset}\n`);
                execSync('pnpm exec ctix build', { stdio: 'inherit' });
                console.log(`${colors.green}✅ ${colors.bright}SDK barrel files generated successfully!${colors.reset}\n`);
            } catch (error) {
                this.error(`Failed to generate ctix barrel files: ${error.message}`);
            }
        },
    };
}

//#endregion
