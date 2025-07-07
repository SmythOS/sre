// Suppress runtime warnings
process.env.NODE_NO_WARNINGS = '1';
process.env.OCLIF_SKIP_TYPESCRIPT = '1';
process.env.OCLIF_COMPILATION = 'false';

// Override console methods to suppress warnings
const originalConsoleWarn = console.warn;
const originalConsoleError = console.error;
const originalConsoleLog = console.log;

export function suppressWarnings() {
    console.warn = (...args: any[]) => {
        const message = args.join(' ');
        if (message.includes('Could not find typescript') || message.includes('punycode') || message.includes('DEP0040')) {
            return;
        }
        originalConsoleWarn.apply(console, args);
    };

    console.error = (...args: any[]) => {
        const message = args.join(' ');
        if (message.includes('Could not find typescript') || message.includes('punycode') || message.includes('DEP0040')) {
            return;
        }
        originalConsoleError.apply(console, args);
    };

    console.log = (...args: any[]) => {
        const message = args.join(' ');
        if (message.includes('Could not find typescript') || message.includes('punycode') || message.includes('DEP0040')) {
            return;
        }
        originalConsoleLog.apply(console, args);
    };

    // Override stdout.write to suppress TypeScript warnings
    const originalStdoutWrite = process.stdout.write;
    process.stdout.write = function (chunk: any, encoding?: any, callback?: any): boolean {
        if (typeof chunk === 'string' && chunk.includes('Could not find typescript')) {
            return true;
        }
        return originalStdoutWrite.call(this, chunk, encoding, callback);
    };

    // Override stderr.write to suppress punycode warnings
    const originalStderrWrite = process.stderr.write;
    process.stderr.write = function (chunk: any, encoding?: any, callback?: any): boolean {
        if (typeof chunk === 'string' && (chunk.includes('punycode') || chunk.includes('DEP0040'))) {
            return true;
        }
        return originalStderrWrite.call(this, chunk, encoding, callback);
    };
}
